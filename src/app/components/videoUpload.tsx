"use client";
import React, { useState } from "react";
import VideoLinkPreview from "./videoComponent";

export default function VideoUploadBox() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rawUrl = e.currentTarget.videoUrl.value;

    const isYouTube = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(
      rawUrl
    );
    if (!isYouTube) {
      alert("Please enter a valid YouTube link.");
      return;
    }

    const embedUrl = convertToYouTubeEmbed(rawUrl);
    setVideoUrl(embedUrl);
  };

  const convertToYouTubeEmbed = (url: string) => {
    const videoIdMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/
    );
    const videoId = videoIdMatch?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
  };

  return videoUrl ? (
    <VideoLinkPreview videoUrl={videoUrl} onBack={() => setVideoUrl(null)} />
  ) : (
    <div className="border-2 border-dashed border-gray-600 rounded-2xl p-12 text-center hover:bg-gray-900 transition bg-gray-800">
      <p className="text-lg text-gray-200 mb-4">Paste a video link</p>
      <p className="text-sm text-gray-400 mb-6">YouTube links only for now</p>
      <form onSubmit={handleSubmit}>
        <input
          type="url"
          name="videoUrl"
          placeholder="https://www.youtube.com/watch?v=..."
          required
          className="w-full max-w-md mx-auto py-2 px-4 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white placeholder-gray-400"
        />
        <button
          type="submit"
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
