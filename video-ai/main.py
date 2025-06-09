from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types
import json
import openai
import numpy as np
from typing import List
import re

app = FastAPI()

class VideoRequest(BaseModel):
    video_id: str
    api_key: str
    openai_key: str

class VideoChunk(BaseModel):
    video_id: str
    transcript: str
    embedding: List[float]

class ChatRequest(BaseModel):
    video_id: str
    content: str
    video_chunks: List[dict]
    openai_key: str
    google_api_key: str


def cosine_similarity(a: List[float], b: List[float]) -> float:
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def find_relevant_chunks(query_embedding: List[float], chunks: List[dict], top_k: int = 3) -> List[dict]:
    """Find most relevant chunks based on cosine similarity."""
    chunk_scores = []
    for chunk in chunks:
        if chunk['embedding'] and len(chunk['embedding']) > 0:
            chunk_embedding = [float(x) for x in chunk['embedding'][0]]
            similarity = cosine_similarity(query_embedding, chunk_embedding)
            chunk_scores.append((chunk, similarity))
    
    chunk_scores.sort(key=lambda x: x[1], reverse=True)
    return [chunk for chunk, _ in chunk_scores[:top_k]]


def parse_video_response(raw_response_text: str) -> list:
    try:
        cleaned_text = raw_response_text.strip()
        if cleaned_text.startswith('```json'):
            cleaned_text = cleaned_text[7:] 
        elif cleaned_text.startswith('```'):
            cleaned_text = cleaned_text[3:] 
        
        if cleaned_text.endswith('```'):
            cleaned_text = cleaned_text[:-3]
        
        cleaned_text = cleaned_text.strip()
        
        try:
            return json.loads(cleaned_text)
        except json.JSONDecodeError as e:
            print(f"Initial JSON parse failed: {str(e)}")
            print("Attempting to fix JSON format...")
        
            cleaned_text = re.sub(r'([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', cleaned_text)
            
            def fix_string_value(match):
                key = match.group(1)
                value = match.group(2)
                value = value.replace('"', '').replace("'", "")
                return f'"{key}": "{value}"'
            
            cleaned_text = re.sub(r'"([^"]+)":\s*([^",\n}]+)(?=[,}])', fix_string_value, cleaned_text)
            
            if not cleaned_text.startswith('['):
                cleaned_text = '[' + cleaned_text
            if not cleaned_text.endswith(']'):
                cleaned_text = cleaned_text + ']'
            
            print("Cleaned text:", cleaned_text)
            return json.loads(cleaned_text)
            
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON. Raw text: {raw_response_text}")
        print(f"Cleaned text: {cleaned_text}")
        raise ValueError(f"Invalid JSON format: {str(e)}")

def timestamp_to_ms(timestamp_str: str) -> int:
    """Convert timestamp string in format 'MM:SS' to milliseconds."""
    try:
        minutes, seconds = map(int, timestamp_str.split(':'))
        return (minutes * 60 + seconds) * 1000
    except Exception as e:
        print(f"Error converting timestamp {timestamp_str}: {str(e)}")
        return 0

@app.post("/chat")
async def chat_with_video(request: ChatRequest):
    try:
        client = genai.Client(api_key=request.google_api_key)
        embedding_client = openai.OpenAI(api_key=request.openai_key)
        
        query_embedding = embedding_client.embeddings.create(
            model="text-embedding-3-small",
            input=request.content
        ).data[0].embedding
        
        print("User's query embedded:", len(query_embedding))
        print("Number of chunks received:", len(request.video_chunks))
        
        relevant_chunks = find_relevant_chunks(query_embedding, request.video_chunks)
        print("Number of relevant chunks found:", len(relevant_chunks))
        
        # Format the context from the transcript list
        context_parts = []
        for chunk in relevant_chunks:
            if chunk['transcript']:
                for entry in chunk['transcript']:
                    timestamp = entry.get('timestamp', 'N/A')
                    text = entry.get('text', '')
                    context_parts.append(f"Timestamp {timestamp}: {text}")
        
        context = "\n".join(context_parts)
        print("Relevant context for chat:", context)

        chat_prompt = f"""You are an intelligent assistant that analyzes video content. Use the following relevant video segments to answer the user's question:

Context from video:
{context}

User's question: {request.content}

Your task is to:
1. Use ONLY the provided context to answer the question
2. If the context doesn't contain relevant information, say "I don't have enough information to answer that question based on the video content."
3. If you find relevant information, provide a clear and concise answer, referencing specific timestamps when relevant.
4. Format timestamps as [mm:ss] when mentioning them. DO NOT include any HTML tags or links in your response.

Your response:"""

        response = client.models.generate_content(
            model='models/gemini-2.0-flash',
            contents=types.Content(
                parts=[types.Part(text=chat_prompt)]
            )
        )

        # Return the raw response text without any HTML formatting
        return {"content": response.text}
    
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process chat request: {str(e)}")

@app.post("/generate-transcript")
async def process_video(request: VideoRequest):
    gemini_prompt = """
You are a helpful assistant that analyzes video content and describes relevant moments in the video. Focus on the key topics of the video when creating timestamps. Make sure the content of each timestamp does not overlap or include redundant information.
Keep the number of timestamps to a minimum while ensuring that each timestamp captures a distinct and important moment in the video.

IMPORTANT: Your response must be ONLY the raw JSON array. Do not include any markdown formatting, backticks, or additional text.
Example of correct response format:
[
  {
    "summary": "Example summary text",
    "timestamp": "00:00-00:30"
  }
]

Your response must follow this exact format:
[
  {
    "summary": "Your summary text here",
    "timestamp": "MM:SS-MM:SS"
  }
]
"""
    try:
        print("processing", request.video_id)
        client = genai.Client(api_key=request.api_key)
        response = client.models.generate_content(
            model='models/gemini-1.5-flash',
            contents=types.Content(
            parts=[
                types.Part(
                    file_data=types.FileData(file_uri=f'https://www.youtube.com/watch?v={request.video_id}'),
                ),
                types.Part(text=gemini_prompt)
            ]
        ))
        raw_response_text = response.text
        print("processed", raw_response_text)
        try:
            chunks = parse_video_response(raw_response_text)
            print("chunks", chunks)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse response: {str(e)}")

        # Create embeddings for each chunk individually
        client = openai.OpenAI(api_key=request.openai_key)
        for chunk in chunks:
            embedding_response = client.embeddings.create(
                model="text-embedding-3-small",
                input=chunk.get("summary", "")
            )
            chunk["embedding"] = embedding_response.data[0].embedding
            
            if "timestamp" in chunk:
                chunk["timestamp_ms"] = timestamp_to_ms(chunk["timestamp"])
                chunk["timestamp_str"] = chunk["timestamp"]
                del chunk["timestamp"]

        return {
            "video_id": request.video_id,
            "raw_response": raw_response_text,
            "chunks": chunks
        }
    except Exception as e:
        import traceback
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail=str(e))





