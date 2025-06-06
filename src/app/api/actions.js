export async function generateVideoEmbeddings(summaryText) {
  try {
    const response = await fetch("/api/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_type: "all-MiniLM-L6-v2",
        summary_text: summaryText,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}

export function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function processCaptions(captions) {
  return captions
    .map((caption) => {
      const timestamp = formatTimestamp(caption.start);
      return `${timestamp} ${caption.text}`;
    })
    .join("\n");
}
