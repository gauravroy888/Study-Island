import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AITutorWidget from "../components/AITutorWidget";
import { SmartboardOverlay } from "./StudyIslandView";

/* Keep the reference learning experiences as standalone HTML/Three.js files. */
export default function LegacyHtmlView({ file, title }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleLegacyMessage = event => {
      if (event.data === "closeOverlay" || event.data?.type === "closeOverlay") {
        navigate("/chapter/light-shadows");
      }
    };
    window.addEventListener("message", handleLegacyMessage);
    return () => window.removeEventListener("message", handleLegacyMessage);
  }, [navigate]);

  return <div className="legacy-experience-shell">
    <iframe className="legacy-experience-frame" src={`${import.meta.env.BASE_URL}${file}`} title={title} allow="autoplay; fullscreen" />
    <SmartboardOverlay />
    <AITutorWidget />
  </div>;
}
