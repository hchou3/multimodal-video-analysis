"use client";
import React, { useState } from "react";

type Props = {
  videoUrl: string;
  onBack: () => void;
};

type VideoSubtitles = {
  video_url: string;
  subtitles: Array<{
    timestamp: string;
    text: string;
    embedding: number[];
  }>;
};

export default function VideoLinkPreview({ videoUrl, onBack }: Props) {
  const [isProcessed, setIsProcessed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<VideoSubtitles | null>(null);

  const handleProcess = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const videoId = videoUrl.split("/").pop()?.split("?")[0];
      if (!videoId) {
        throw new Error("Invalid video URL");
      }
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

      const response = await fetch("/api/embed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_url: watchUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to process video");
      }

      const data = await response.json();
      setSubtitles(data);
      setIsProcessed(true);

      console.log("Video processed successfully:", data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process video");
      setIsProcessed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setIsProcessed(false);
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
          frameBorder="0"
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
    </div>
  );
}
