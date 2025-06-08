"use client";
import React, { useState } from "react";
import ChatBox from "./chatBox";
import { supabaseKey, supabaseUrl, insertVideoChunk } from "@/app/db/db";

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

  const handleProcess = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const videoId = videoUrl.split("/").pop()?.split("?")[0] || "";
      setvideoID(videoId);
      if (!videoId) {
        throw new Error("Invalid video URL");
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
    <div className="text-center">
      <div className="aspect-video max-w-3xl mx-auto mb-4">
        <iframe
          src={videoUrl}
          title="Video Preview"
          className="w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {subtitles && (
        <div className="max-w-3xl mx-auto mb-4 text-left p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Video Subtitles:</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {subtitles.subtitles.map((entry, index) => (
              <div key={index} className="flex gap-2">
                <span className="font-mono text-gray-600 whitespace-nowrap">
                  {entry.timestamp}
                </span>
                <span className="flex-1">{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-x-4">
        <button
          onClick={handleProcess}
          disabled={isProcessed || isLoading}
          className={`px-4 py-2 rounded-lg transition ${
            isProcessed || isLoading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50"
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
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition"
        >
          Upload a different link
        </button>
      </div>
      {isProcessed && subtitles && (
        <div className="mt-8">
          <ChatBox videoData={subtitles} video_id={videoID ?? ""} />
        </div>
      )}
    </div>
  );
}
