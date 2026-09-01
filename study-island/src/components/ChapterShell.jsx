import React, { useState } from "react";
import AITutorWidget from "./AITutorWidget";

const TABS = [
  { id: "experience",    label: "Experience",    icon: "­ƒÆí" },
  { id: "experiments",   label: "Experiments",   icon: "­ƒö¼" },
  { id: "quiz",          label: "Quiz",           icon: "ÔØô" },
  { id: "mixed-reality", label: "Mixed Reality",  icon: "­ƒÑ¢" },
  { id: "stories",       label: "Stories",        icon: "­ƒô¢" },
];

export default function ChapterShell({ chapter, studentContext, children }) {
  const [activeTab, setActiveTab] = useState("experience");

  function handleExit() {
    const role = studentContext?.role || "student";
    window.location.href = role === "teacher" ? "/teacher/" : role === "admin" ? "/admin/" : "/";
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#090d16", color: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ÔöÇÔöÇ Header ÔöÇÔöÇ */}
      <header style={{ background: "rgba(15,23,42,0.97)", borderBottom: "1px solid #1e293b", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, letterSpacing: "0.04em", background: "linear-gradient(90deg,#00f0ff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {chapter?.title || "LIGHT AND SHADOWS"}
          </h2>
          <span style={{ fontSize: "10px", background: "#0284c7", color: "#fff", padding: "2px 8px", borderRadius: "20px", fontWeight: 700 }}>
            {chapter?.subject || "Science"} ┬À Class {studentContext?.class_id || "6th"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {studentContext?.student_name && (
            <span style={{ fontSize: "12px", color: "#00f0ff", background: "rgba(0,240,255,0.08)", padding: "4px 10px", borderRadius: "20px", border: "1px solid rgba(0,240,255,0.2)" }}>
              {studentContext.student_name}
            </span>
          )}
          <button onClick={handleExit} style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "6px", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
            Exit
          </button>
        </div>
      </header>

      {/* ÔöÇÔöÇ Tab Nav ÔöÇÔöÇ */}
      <nav style={{ background: "#0f172a", display: "flex", gap: "2px", padding: "6px 14px", borderBottom: "1px solid #1e293b", overflowX: "auto" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? "linear-gradient(135deg,#0070f3,#00b4d8)" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#64748b",
              border: "none",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ÔöÇÔöÇ Content ÔöÇÔöÇ */}
      <main style={{ flex: 1, overflow: "auto" }}>
        {React.Children.map(children, child =>
          React.isValidElement(child)
            ? React.cloneElement(child, { activeTab, studentContext })
            : child
        )}
      </main>

      {/* ÔöÇÔöÇ Aria AI Tutor Bot Widget ÔöÇÔöÇ */}
      <AITutorWidget />
    </div>
  );
}
