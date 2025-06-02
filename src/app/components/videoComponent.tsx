"use client";
import React from "react";

type Props = {
  videoUrl: string;
  onBack: () => void;
};

export default function VideoLinkPreview({ videoUrl, onBack }: Props) {
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
      <button
        onClick={onBack}
        className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition"
      >
        Upload a different link
      </button>
    </div>
  );
}
