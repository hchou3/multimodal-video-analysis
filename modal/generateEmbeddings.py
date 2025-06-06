from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import re
from google import genai
from google.genai import types
from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs

app = FastAPI()

class VideoRequest(BaseModel):
    video_id: str
    model_type: str = "all-MiniLM-L6-v2"
    api_key: str

# Initialize the sentence transformer model
model = SentenceTransformer('all-MiniLM-L6-v2')

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