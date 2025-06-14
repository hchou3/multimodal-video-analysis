import Image from "next/image";
import VideoUploadBox from "./components/videoUpload";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-black text-white">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-6xl font-semibold mb-4">Videolize</h1>
        <p className="text-xl sm:text-2xl text-gray-400">
          Upload and analyze your videos with AI
        </p>
      </div>
      <div className="w-full max-w-4xl">
        <VideoUploadBox />
      </div>
    </div>
  );
  // <uploadbox : video player>
}
