import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useThreeScene from "../../../hooks/useThreeScene";

/* ÔöÇÔöÇ Chapter data (from script.js CHAPTERS object) ÔöÇÔöÇ */
const CHAPTER = {
  title: "LIGHT AND SHADOWS",
  subject: "Science",
  description: "The light and shadow simulation model provides interactive exploration of fundamental optical principles. Visualize the formation of complex shadow patterns, examine umbra and penumbra regions, and observe how light propagates to form shadows based on object shape and distance.",
  tabs: [
    { id: "experience",    label: "Experience",    icon: "­ƒÆí" },
    { id: "experiments",   label: "Experiments",   icon: "­ƒö¼" },
    { id: "quiz",          label: "Quiz",           icon: "ÔØô" },
    { id: "mixed-reality", label: "Mixed Reality",  icon: "­ƒÑ¢" },
    { id: "stories",       label: "Stories",        icon: "­ƒô¢" },
  ],
  experiments: [
    { id: "shadow-lab", title: "Shadow Lab", description: "Adjust a light source and observe umbra/penumbra regions in real-time.", route: "/lab", badge: "Latest!" },
  ],
  stories: [
    { id: "s1", title: "Shadows and Light Explained", tag: "DOCUMENTARY", duration: "5:21", thumbnail: "https://img.youtube.com/vi/fy7eoMef3e8/hqdefault.jpg", url: "https://www.youtube.com/embed/fy7eoMef3e8?autoplay=1" },
    { id: "s2", title: "The Science of Shadows",       tag: "EXPLAINED",   duration: "4:15", thumbnail: "https://img.youtube.com/vi/Ek93M31fHDk/hqdefault.jpg", url: "https://www.youtube.com/embed/Ek93M31fHDk?autoplay=1" },
  ],
};

/* ÔöÇÔöÇ 3D Experience view ÔöÇÔöÇ */
function ExperienceTab({ studentContext }) {
  const { containerRef, loadingRef } = useThreeScene(true);
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", gap: "24px", padding: "20px", height: "calc(100vh - 180px)", boxSizing: "border-box" }}>
      {/* 3D Canvas */}
      <div style={{ flex: 1, position: "relative", borderRadius: "12px", overflow: "hidden", border: "1px solid #1e3a5f", background: "#070d18", minHeight: "400px" }}>
        <div ref={loadingRef} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#00f0ff", fontSize: "14px", zIndex: 2 }}>
          Loading 3D scene...
        </div>
        <div ref={containerRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />
      </div>

      {/* Info panel */}
      <div style={{ width: "260px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "16px" }}>
          <h3 style={{ margin: "0 0 8px", color: "#00f0ff", fontSize: "14px" }}>About this Experience</h3>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px", lineHeight: 1.6 }}>{CHAPTER.description}</p>
        </div>
        <div style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "16px" }}>
          <h4 style={{ margin: "0 0 8px", color: "#a78bfa", fontSize: "13px" }}>Controls</h4>
          <p style={{ margin: 0, color: "#64748b", fontSize: "12px", lineHeight: 1.7 }}>
            Drag to rotate the scene<br/>
            Observe the shadow cast by the dodecahedron<br/>
            Notice how the corona (glow) pulses
          </p>
        </div>
        <button
          onClick={() => navigate("/experience")}
          style={{ background: "linear-gradient(135deg, #0070f3, #00b4d8)", color: "#fff", border: "none", padding: "12px", borderRadius: "10px", fontWeight: 700, cursor: "pointer", fontSize: "14px" }}
        >
          Start Full Experience
        </button>
      </div>
    </div>
  );
}

/* ÔöÇÔöÇ Experiments view ÔöÇÔöÇ */
function ExperimentsTab() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: "20px" }}>
      <h3 style={{ color: "#00f0ff", marginTop: 0 }}>Experiments</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
        {CHAPTER.experiments.map(exp => (
          <div key={exp.id} style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "20px", width: "280px" }}>
            {exp.badge && <span style={{ background: "#0070f3", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", marginBottom: "8px", display: "inline-block" }}>{exp.badge}</span>}
            <h4 style={{ margin: "8px 0 6px", color: "#e2e8f0" }}>{exp.title}</h4>
            <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: "13px" }}>{exp.description}</p>
            <button
              onClick={() => exp.route ? navigate(exp.route) : window.open(exp.url, "_blank")}
              style={{ background: "linear-gradient(135deg, #00f0ff, #0070f3)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", width: "100%" }}
            >
              Launch Experiment
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ÔöÇÔöÇ Quiz view ÔöÇÔöÇ */
function QuizTab({ studentContext }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h3 style={{ color: "#00f0ff" }}>Chapter Quiz</h3>
      <p style={{ color: "#94a3b8" }}>Test your understanding of Light and Shadows.</p>
      <button
        onClick={() => navigate("/quiz")}
        style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)", color: "#fff", border: "none", padding: "12px 32px", borderRadius: "10px", fontWeight: 700, cursor: "pointer", fontSize: "15px" }}
      >
        Start Quiz
      </button>
    </div>
  );
}

/* ÔöÇÔöÇ Stories view ÔöÇÔöÇ */
function StoriesTab() {
  const [playing, setPlaying] = useState(null);
  return (
    <div style={{ padding: "20px" }}>
      <h3 style={{ color: "#00f0ff", marginTop: 0 }}>Stories and Videos</h3>
      {playing ? (
        <div>
          <button onClick={() => setPlaying(null)} style={{ background: "#1e293b", color: "#94a3b8", border: "none", padding: "6px 14px", borderRadius: "6px", marginBottom: "12px", cursor: "pointer" }}>Back</button>
          <iframe src={playing} width="100%" height="480" frameBorder="0" allow="autoplay; fullscreen" style={{ borderRadius: "10px" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {CHAPTER.stories.map(s => (
            <div key={s.id} onClick={() => setPlaying(s.url)}
              style={{ width: "260px", cursor: "pointer", background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: "10px", overflow: "hidden", transition: "transform 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <img src={s.thumbnail} alt={s.title} style={{ width: "100%", height: "148px", objectFit: "cover", display: "block" }}/>
              <div style={{ padding: "12px" }}>
                <span style={{ fontSize: "10px", color: "#0070f3", fontWeight: 700 }}>{s.tag} &bull; {s.duration}</span>
                <h4 style={{ margin: "6px 0 0", color: "#e2e8f0", fontSize: "13px" }}>{s.title}</h4>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ÔöÇÔöÇ Mixed Reality placeholder ÔöÇÔöÇ */
function MixedRealityTab() {
  return (
    <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
      <div style={{ fontSize: "48px", marginBottom: "12px" }}>­ƒÑ¢</div>
      <h3>Mixed Reality coming soon</h3>
    </div>
  );
}

/* ÔöÇÔöÇ Main Chapter Component ÔöÇÔöÇ */
export default function LightAndShadowsChapter({ activeTab = "experience", studentContext }) {
  const tabContent = {
    experience:     <ExperienceTab studentContext={studentContext} />,
    experiments:    <ExperimentsTab />,
    quiz:           <QuizTab studentContext={studentContext} />,
    stories:        <StoriesTab />,
    "mixed-reality":<MixedRealityTab />,
  };
  return tabContent[activeTab] ?? tabContent.experience;
}
