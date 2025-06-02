import { GoogleGenerativeAI } from "@google/generative-ai";

const prompt =
  "Transcribe the audio from this video, giving timestamps for salient events in the video. Also provide visual descriptions.";

export async function summarizeVideo(url) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  const result = await model.generateContent([
    prompt,
    {
      fileData: {
        fileUri: url,
      },
    },
  ]);
}
