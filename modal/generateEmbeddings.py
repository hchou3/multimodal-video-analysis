from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import re
from google import genai
from google.genai import types
from youtube_transcript_api import YouTubeTranscriptApi

app = FastAPI()

class VideoRequest(BaseModel):
    video_id: str
    model_type: str = "all-MiniLM-L6-v2"
    api_key: str

class ChatRequest(BaseModel):
    video_id: str
    message: str 
    context: list
    start_offset: str
    end_offset: str

model = SentenceTransformer('all-MiniLM-L6-v2')
gemini_prompt = """You are a helpful assistant that analyzes video content and answers user questions by identifying relevant moments in the video.

Your response must be a JSON object with the following fields:

- "answer": A friendly, conversational explanation of what is seen and when.
- "timestamp_ms": The number of milliseconds from the start of the video when the event first happens.
- "video_url": The original YouTube video URL.

Here is the user’s question: "{user_query}"

Here is the video: {youtube_url}

Please analyze the video and return only a well-formatted JSON response, like:

{
  "answer": "...",
  "timestamp_ms": 17000,
  "video_url": "https://www.youtube.com/watch?v={video_id}"
}
"""

@app.post("/chat")
async def chat_with_video(request: ChatRequest):
    try: 
        client = genai.Client(api_key="GOOGLE_API_KEY")
        response = client.models.generate_content(
                    model='models/gemini-2.5-flash-preview-05-20',
                    contents=types.Content(
                     parts=[
                         types.Part(
                            file_data=types.FileData(file_uri=f'https://www.youtube.com/watch?v={request.video_id}'),
                            video_metadata=types.VideoMetadata(
                            start_offset=request.start_offset,
                            end_offset=request.end_offset
                            )
                        ),
                        types.Part(text=gemini_prompt)
                     ]
                ))
        
        return response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-transcript")
async def process_video(request: VideoRequest):
    try:
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(video_id=request.video_id)
        raw_data = transcript.to_raw_data()

        formatted_subtitles = {
            "video_id": request.video_id,
            "subtitles": [
                {
                    "timestamp": f"{int(entry['start'] // 60)}:{int(entry['start'] % 60):02d}",
                    "text": entry["text"],
                    "embedding": model.encode(entry["text"]).tolist() 
                }
                for entry in raw_data
            ]
        }

        return formatted_subtitles
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))