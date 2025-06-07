import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || "";
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface VideoChunk {
  id?: string;
  video_id: string;
  transcript: string | null;
  embedding: number[] | null;
}

export async function insertVideoChunk(chunk: VideoChunk) {
  const { data, error } = await supabase
    .from("video_chunks")
    .insert(chunk)
    .select()
    .single();

  if (error) {
    throw new Error(`Error inserting video chunk: ${error.message}`);
  }

  return data;
}

export async function getVideoChunksByVideoId(videoId: string) {
  const { data, error } = await supabase
    .from("video_chunks")
    .select("*")
    .eq("video_id", videoId);

  if (error) {
    throw new Error(`Error fetching video chunks: ${error.message}`);
  }

  return data;
}

// For testing
export async function deleteVideoChunk(id: string) {
  const { error } = await supabase.from("video_chunks").delete().eq("id", id);

  if (error) {
    throw new Error(`Error deleting video chunk: ${error.message}`);
  }
}
