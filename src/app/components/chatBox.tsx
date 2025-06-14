"use client";
import React, { useState, useEffect } from "react";
import {
  supabaseUrl,
  supabaseKey,
  getVideoChunksByVideoId,
  VideoChunk,
} from "@/app/db/db";
import { parseMessageWithTimestamps } from "./TimestampLink";

interface Message {
  role: "User" | "Assistant";
  content: string;
}

interface VideoSubtitles {
  video_id: string;
  subtitles: Array<{
    timestamp: string;
    text: string;
  }>;
}

interface ChatBoxProps {
  videoData: VideoSubtitles;
  video_id: string | "";
  onTimestampClick: (timestamp: string) => void;
}

export default function ChatBox({
  videoData,
  video_id,
  onTimestampClick,
}: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [embeddings, setVideoEmbeddings] = useState<VideoChunk[]>([]);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);

  const openai_key = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  const google_api_key = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  if (!openai_key) {
    throw new Error("OpenAI API key not found");
  }
  if (!google_api_key) {
    throw new Error("Google API key not found");
  }

  useEffect(() => {
    const fetchVideoChunks = async () => {
      console.log("Fetching video chunks for video ID:", video_id);
      if (!video_id) {
        setEmbeddingError("No video ID provided");
        return;
      }

      try {
        const embeddings = await getVideoChunksByVideoId(video_id);
        console.log("Fetched video chunks with embeddings:", embeddings);

        if (!embeddings || embeddings.length === 0) {
          setEmbeddingError(
            "No video chunks found. Please ensure the video was processed properly."
          );
          setVideoEmbeddings([]);
          return;
        }

        setVideoEmbeddings(embeddings);
        setEmbeddingError(null);
      } catch (error) {
        console.error("Error fetching video chunks:", error);
        setEmbeddingError(
          "Failed to load video data. Please try refreshing the page."
        );
        setVideoEmbeddings([]);
      }
    };

    fetchVideoChunks();
  }, [video_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;
    if (embeddingError) {
      setMessages((prev) => [
        ...prev,
        {
          role: "Assistant",
          content:
            "Sorry, I cannot process your message because: " + embeddingError,
        },
      ]);
      return;
    }
    if (embeddings.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          role: "Assistant",
          content:
            "Sorry, I cannot process your message because no video data is available.",
        },
      ]);
      return;
    }

    const newMessage: Message = {
      role: "User",
      content: inputMessage,
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase credentials not found");
      }

      // Format the chunks to include both transcript and embedding
      const formattedChunks = embeddings.map((chunk) => ({
        transcript: chunk.transcript ? JSON.parse(chunk.transcript) : null,
        embedding: chunk.embedding
          ? chunk.embedding.map((vec) => {
              // Convert string representation of array to array of numbers
              const numbers = vec
                .replace(/\[|\]/g, "")
                .split(",")
                .map((n) => Number(n));
              return numbers;
            })
          : null,
      }));

      console.log("Sending message to FastAPI with formatted chunks:", {
        video_id,
        content: inputMessage,
        video_chunks: formattedChunks,
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_id: video_id,
          content: inputMessage,
          video_chunks: formattedChunks,
          openai_key: openai_key,
          google_api_key: google_api_key,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `FastAPI responded with an error: ${response.status}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ""
          }`
        );
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "Assistant",
          content: data.content,
        },
      ]);
    } catch (error) {
      console.error("Error in chat:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "Assistant",
          content: `Sorry, I encountered an error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full bg-gray-800 rounded-lg shadow-lg">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "User" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "User"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-200"
              }`}
            >
              {message.role === "Assistant"
                ? parseMessageWithTimestamps(message.content, onTimestampClick)
                : message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-200 rounded-lg p-3">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask about the video..."
            className="flex-1 p-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`px-6 py-3 bg-blue-600 text-white rounded-lg transition-colors ${
              isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
            }`}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
