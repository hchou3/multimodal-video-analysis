"use client";
import React, { useState, useRef, useCallback } from "react";
import ChatBox from "./chatBox";
import {
  supabaseKey,
  supabaseUrl,
  insertVideoChunk,
  getVideoChunksByVideoId,
} from "@/app/db/db";

type Props = {
  videoUrl: string;
  onBack: () => void;
};

type VideoSubtitles = {
  video_id: string;
  subtitles: Array<{
    timestamp: string;
    text: string;
  }>;
};

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export default function VideoLinkPreview({ videoUrl, onBack }: Props) {
  const [isProcessed, setIsProcessed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<VideoSubtitles | null>(null);
  const [videoID, setvideoID] = useState<string | null>(null);
  const playerRef = useRef<HTMLIFrameElement>(null);

  const seekToTimestamp = useCallback((timestamp: string) => {
    if (!playerRef.current) return;

    const [minutes, seconds] = timestamp.split(":").map(Number);
    const totalSeconds = minutes * 60 + seconds;

    // YouTube iframe API method to seek to time
    playerRef.current.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: "seekTo",
        args: [totalSeconds, true],
      }),
      "*"
    );
  }, []);

  const handleProcess = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const videoId = videoUrl.split("/").pop()?.split("?")[0] || "";
      setvideoID(videoId);
      if (!videoId) {
        throw new Error("Invalid video URL");
      }

      // First check if video already exists in database
      try {
        const existingChunks = await getVideoChunksByVideoId(videoId);
        if (existingChunks && existingChunks.length > 0) {
          // Video already exists, use the stored data
          const storedData = existingChunks[0];
          const subtitle_chunks = {
            video_id: videoId,
            subtitles: JSON.parse(storedData.transcript || "[]"),
          };
          setSubtitles(subtitle_chunks);
          setIsProcessed(true);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error("Error checking for existing video:", err);
        // Continue with processing if there's an error checking the database
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("Google API key not found");
      }

      const openai_key = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (!openai_key) {
        throw new Error("OpenAI API key not found");
      }

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase credentials not found");
      }

      const response = await fetch("/api/generate-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_id: videoId,
          api_key: apiKey,
          openai_key: openai_key,
        }),
      });

      if (!response.ok) {
        throw new Error(`FastAPI responded with status: ${response.status}`);
      }

      const data = await response.json();

      const subtitle_chunks = {
        video_id: data.video_id,
        subtitles: data.chunks.map((chunk: any) => ({
          timestamp: formatTimestamp(chunk.timestamp_ms),
          text: chunk.summary,
        })),
      };

      setSubtitles(subtitle_chunks);
      setIsProcessed(true);

      console.log("Video processed successfully:", subtitle_chunks);

      //Convert from List[List[Float]] to List[str]
      const embeddings = data.chunks.map((chunk: any) => {
        const numericalEmbedding = Array.isArray(chunk.embedding)
          ? chunk.embedding.map((val: any) => Number(val))
          : [];
        return `[${numericalEmbedding.join(",")}]`;
      });

      console.log("Video embeddings:", embeddings);

      console.log("Attempting to insert video chunk with data:", {
        video_id: videoId,
        transcript: JSON.stringify(subtitle_chunks.subtitles),
        embedding: embeddings,
      });

      try {
        const result = await insertVideoChunk({
          video_id: videoId,
          transcript: JSON.stringify(subtitle_chunks.subtitles),
          embedding: embeddings,
        });
        console.log("Video chunk insertion result:", result);
      } catch (error) {
        console.error("Error inserting video chunk:", error);
        throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process video");
      setIsProcessed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setIsProcessed(false);
    setvideoID("");
    setError(null);
    setSubtitles(null);
    onBack();
  };

  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto">
      <div className="aspect-video w-full max-w-3xl mb-8">
        <iframe
          ref={playerRef}
          src={`${videoUrl}?enablejsapi=1`}
          title="Video Preview"
          className="w-full h-full rounded-lg shadow-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {error && <div className="text-red-400 mb-4">{error}</div>}
      {subtitles && (
        <div className="w-full max-w-3xl mb-8 text-left p-6 bg-gray-800 rounded-lg shadow-lg">
          <h3 className="font-semibold mb-4 text-gray-200">Video Subtitles:</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto text-gray-300">
            {subtitles.subtitles.map((entry, index) => (
              <div key={index} className="flex gap-3">
                <span className="font-mono text-gray-400 whitespace-nowrap">
                  {entry.timestamp}
                </span>
                <span className="flex-1">{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-x-4 mb-8">
        <button
          onClick={handleProcess}
          disabled={isProcessed || isLoading}
          className={`px-6 py-2 rounded-lg transition ${
            isProcessed || isLoading
              ? "bg-gray-700 text-gray-400 cursor-not-allowed opacity-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {isLoading
            ? "Processing Video..."
            : isProcessed
            ? "Video Processed"
            : "Generate Subtitles"}
        </button>
        <button
          onClick={handleBack}
          className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
        >
          Upload a different link
        </button>
      </div>
      {isProcessed && subtitles && (
        <div className="w-full max-w-3xl">
          <ChatBox
            videoData={subtitles}
            video_id={videoID ?? ""}
            onTimestampClick={seekToTimestamp}
          />
        </div>
      )}
    </div>
  );
}
