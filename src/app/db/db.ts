import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || "";
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface VideoChunk {
  id?: string;
  video_id: string;
  transcript: string | null;
  embedding: string[] | null;
}

export async function insertVideoChunk(chunk: VideoChunk) {
  console.log("Inserting video chunk into Supabase:", chunk);

  try {
    const formattedChunk = {
      ...chunk,
      embedding: chunk.embedding?.map((vec) => vec.replace(/\s+/g, "")),
    };

    const { data, error } = await supabase
      .from("video_chunks")
      .insert(formattedChunk)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      throw new Error(`Error inserting video chunk: ${error.message}`);
    }

    console.log("Successfully inserted video chunk:", data);
    return data;
  } catch (error) {
    console.error("Unexpected error in insertVideoChunk:", error);
    throw error;
  }
}

export async function getVideoChunksByVideoId(videoId: string) {
  console.log("Fetching video chunks for video ID:", videoId);

  try {
    const { data, error } = await supabase
      .from("video_chunks")
      .select("*")
      .eq("video_id", videoId);

    if (error) {
      console.error("Supabase error:", error);
      throw new Error(`Error fetching video chunks: ${error.message}`);
    }

    console.log("Retrieved video chunks:", data);
    return data;
  } catch (error) {
    console.error("Unexpected error in getVideoChunksByVideoId:", error);
    throw error;
  }
}

//Testing
export async function getOrInsertVideoChunks(
  videoId: string,
  chunks: any[],
  embeddings: number[][]
) {
  const existingChunks = await getVideoChunksByVideoId(videoId);

  if (!existingChunks) {
    const chunkToInsert: VideoChunk = {
      video_id: videoId,
      transcript: JSON.stringify(chunks),
      embedding: embeddings[0].map((vec) => vec.toString()), // Convert each embedding vector to string format
    };

    return await insertVideoChunk(chunkToInsert);
  }

  return existingChunks;
}

// For testing
export async function deleteVideoChunk(id: string) {
  const { error } = await supabase.from("video_chunks").delete().eq("id", id);

  if (error) {
    throw new Error(`Error deleting video chunk: ${error.message}`);
  }
}
