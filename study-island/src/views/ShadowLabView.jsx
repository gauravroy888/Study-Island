import React from "react";
import AITutorWidget from "../components/AITutorWidget";

export default function ShadowLabView() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      <iframe
        src="/Shadow_Lab.html"
        title="Shadow Lab - Optical Calibration"
        className="w-full h-full border-0"
        allow="autoplay; fullscreen"
      />
      <AITutorWidget />
    </div>
  );
}
