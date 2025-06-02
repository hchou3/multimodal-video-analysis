import Image from "next/image";
import VideoUploadBox from "./components/videoUpload";

export default function Home() {
  return (
    <div className="relative min-h-screen p-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="absolute top-8 left-8 text-3xl sm:text-5xl font-semibold text-left">
        Videolize: <br />
        <span className="font-normal">
          Upload and analyze your videos with AI
        </span>
        <div className="p-20">
          <VideoUploadBox />
        </div>
      </div>
    </div>
  );
  // <uploadbox : video player>
}
