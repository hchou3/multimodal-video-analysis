from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import re
from google import genai
import os
import yt_dlp
import tempfile
import asyncio

app = FastAPI()

# Initialize Gemini client
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

class VideoRequest(BaseModel):
    video_url: str
    model_type: str = "all-MiniLM-L6-v2"

class TimestampEntry(BaseModel):
    timestamp: str
    text: str

async def download_video(video_url: str) -> str:
    """Download video to a temporary file and return the path"""
    ydl_opts = {
        'format': 'best[ext=mp4]',
        'outtmpl': '%(id)s.%(ext)s',
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(video_url, download=True)
            return f"{info['id']}.mp4"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to download video: {str(e)}")

@app.post("/embed")
async def process_video(request: VideoRequest):
    try:
        # Download the video
        video_path = await download_video(request.video_url)
        
        # Upload video to Gemini
        video_file = client.files.upload(file=video_path)
        
        # Generate subtitles with timestamps using Gemini
        prompt = """Please analyze this video and generate detailed subtitles with timestamps.
        Format each entry as 'MM:SS Subtitle text' on a new line.
        Focus on transcribing the actual speech and important visual elements.
        Example format:
        0:00 Welcome to this video
        0:15 Today we'll be discussing an important topic
        0:30 Let me show you how this works"""
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[video_file, prompt]
        )
        
        # Parse the response into timestamp entries
        summary_text = response.text
        entries = []
        
        # Process each line of the subtitles
        for line in summary_text.strip().splitlines():
            match = re.match(r"^(\d+:\d+)\s+(.*)", line)
            if match:
                timestamp, text = match.groups()
                # Generate embedding for this subtitle segment
                embedding_model = SentenceTransformer(request.model_type)
                embedding = embedding_model.encode(text)
                
                entries.append({
                    "timestamp": timestamp,
                    "text": text,
                    "embedding": embedding.tolist()
                })
        
        if not entries:
            raise HTTPException(
                status_code=400,
                detail="No valid subtitle entries found in the response"
            )
        
        # Clean up the downloaded video file
        try:
            os.remove(video_path)
        except:
            pass  # Ignore cleanup errors
            
        return {
            "video_url": request.video_url,
            "subtitles": entries
        }
        
    except Exception as e:
        # Clean up video file in case of error
        try:
            if 'video_path' in locals():
                os.remove(video_path)
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))

