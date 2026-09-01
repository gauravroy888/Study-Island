import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eraser, Highlighter, Maximize, Minimize, MousePointer2, Pencil, Redo2, Trash2, Undo2, Video } from "lucide-react";
import AITutorWidget from "../components/AITutorWidget";
import { useTheme } from "../ThemeContext";
import futureBackground from "../../assets/Future verion lowres.jpg";
import { supabase } from "../supabase";

const subjects = [
  ["science", "🔬", "SCIENCE", 45, "5 Studies Active"],
  ["history", "🏛️", "HISTORY", 30, "3 Eras Open"],
  ["geography", "🌍", "GEOGRAPHY", 75, "8 Continents Mapped"],
  ["pe", "🏃", "PHYSICAL<br/>EDUCATION", 60, "Gym Hours Logged"],
  ["arts", "🎨", "ARTS", 40, "Gallery Pieces Created"],
  ["english", "📝", "ENGLISH", 65, "Novels Read"],
  ["math", "π", "MATHEMATICS", 85, "Problems Mastered"],
  ["music", "🎵", "MUSIC", 25, "Compositions Written"],
];

const chapters = [
  ["light-and-shadows", "💡", "LIGHT AND<br/>SHADOWS", 100],
  ["space-and-solar-system", "🪐", "SPACE AND<br/>SOLAR SYSTEM", 45],
  ["skeletal-system", "🦴", "SKELETAL<br/>SYSTEM", 0],
  ["food-and-health", "🍎", "FOOD AND<br/>HEALTH", 0],
  ["plant-repro-pollination", "🌸", "PLANT REPRO.<br/>— POLLINATION", 0],
  ["plant-repro-fertilization", "🌱", "PLANT REPRO.<br/>— FERTILIZATION", 0],
  ["solids-liquids-gases", "💧", "SOLIDS, LIQUIDS,<br/>GASES", 0],
  ["inter-dependence", "🕸️", "INTER-<br/>DEPENDENCE", 0],
];

export const CHAPTER_METADATA_MAP = {
  "light-and-shadows": { id: "light-and-shadows", title: "LIGHT & SHADOWS", icon: "💡", subject: "SCIENCE", sub: "Optics & Reflection" },
  "light-shadows": { id: "light-and-shadows", title: "LIGHT & SHADOWS", icon: "💡", subject: "SCIENCE", sub: "Optics & Reflection" },
  "space-and-solar-system": { id: "space-and-solar-system", title: "SOLAR SYSTEM", icon: "🪐", subject: "SCIENCE", sub: "Planets & Orbits" },
  "space-solar": { id: "space-and-solar-system", title: "SOLAR SYSTEM", icon: "🪐", subject: "SCIENCE", sub: "Planets & Orbits" },
  "skeletal-system": { id: "skeletal-system", title: "SKELETAL SYSTEM", icon: "🦴", subject: "SCIENCE", sub: "Human Anatomy" },
  "food-and-health": { id: "food-and-health", title: "FOOD & HEALTH", icon: "🍎", subject: "SCIENCE", sub: "Nutrients & Diet" },
  "plant-repro-pollination": { id: "plant-repro-pollination", title: "POLLINATION", icon: "🌸", subject: "SCIENCE", sub: "Plant Reproduction" },
  "plant-repro-fertilization": { id: "plant-repro-fertilization", title: "FERTILIZATION", icon: "🌱", subject: "SCIENCE", sub: "Plant Reproduction" },
  "solids-liquids-gases": { id: "solids-liquids-gases", title: "STATES OF MATTER", icon: "💧", subject: "SCIENCE", sub: "Solids, Liquids, Gases" },
  "inter-dependence": { id: "inter-dependence", title: "INTERDEPENDENCE", icon: "🕸️", subject: "SCIENCE", sub: "Living Organisms" }
};

function getActiveUserId() {
  try {
    const sId = sessionStorage.getItem("active_student_id");
    if (sId) return sId;
    for (const key of ["edtech_student_user", "edtech_teacher_user", "edtech_user"]) {
      const u = JSON.parse(localStorage.getItem(key) || "{}");
      if (u?.id || u?.uid || u?.email) return u.id || u.uid || u.email;
    }
  } catch {}
  return "global";
}

export function recordRecentChapter(slugOrId, customData) {
  try {
    const userId = getActiveUserId();
    const key = `edtech_recent_chapters_${userId}`;
    const raw = localStorage.getItem(key) || localStorage.getItem("edtech_recent_chapters");
    let recents = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(recents)) recents = [];

    const meta = CHAPTER_METADATA_MAP[slugOrId] || {
      id: slugOrId,
      title: customData?.title || slugOrId.replace(/-/g, " ").toUpperCase(),
      icon: customData?.icon || "📖",
      subject: customData?.subject || "SCIENCE",
      sub: customData?.sub || "Chapter Module"
    };

    recents = recents.filter(c => c.id !== meta.id && c.id !== slugOrId);
    recents.unshift(meta);
    localStorage.setItem(key, JSON.stringify(recents.slice(0, 5)));
    localStorage.setItem("edtech_recent_chapters", JSON.stringify(recents.slice(0, 5)));
  } catch (e) {
    console.warn("Could not save recent chapter:", e);
  }
}

export function getRecentChapters() {
  try {
    const userId = getActiveUserId();
    const key = `edtech_recent_chapters_${userId}`;
    const raw = localStorage.getItem(key) || localStorage.getItem("edtech_recent_chapters");
    if (raw) {
      const recents = JSON.parse(raw);
      if (Array.isArray(recents) && recents.length > 0) {
        return recents;
      }
    }
  } catch (e) {}
  return [
    CHAPTER_METADATA_MAP["light-and-shadows"],
    CHAPTER_METADATA_MAP["space-and-solar-system"],
    CHAPTER_METADATA_MAP["skeletal-system"]
  ];
}

function Label({ value }) {
  return value.split("<br/>").map((part, index) => <React.Fragment key={`${part}-${index}`}>{index > 0 && <br />}{part}</React.Fragment>);
}

function Particles({ count = 10 }) {
  return <div className="particles" aria-hidden="true">{Array.from({ length: count }, (_, i) => <span key={i} />)}</div>;
}

function Screen({ children, className = "", background = futureBackground, backgroundImage }) {
  return <section className={`screen active ${className}`} style={{ backgroundImage: backgroundImage || `url("${background}")` }}><div className="bg-overlay" />{children}</section>;
}

export function TopControls() {
  const { isPortal, toggleTheme } = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(() => {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  });

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
        )
      );
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("mozfullscreenchange", handleFsChange);
    document.addEventListener("MSFullscreenChange", handleFsChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.removeEventListener("mozfullscreenchange", handleFsChange);
      document.removeEventListener("MSFullscreenChange", handleFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const isFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (!isFs) {
      const docEl = document.documentElement;
      const rfs =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;
      if (rfs) {
        rfs.call(docEl).catch(() => {});
      }
    } else {
      const efs =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen;
      if (efs) {
        efs.call(document).catch(() => {});
      }
    }
  };

  return <>
    <button className="corner-pill-btn" id="theme-toggle" type="button" onClick={toggleTheme} aria-label="Toggle Theme">
      <span className="theme-icon">{isPortal ? "✦" : "🌙"}</span> {isPortal ? "THEME: PORTAL UI" : "THEME: DEEP SPACE"}
    </button>
    <div className="curriculum-badge glass-pill">CBSE Class 6th</div>
    <button
      className={`fullscreen-fab-btn ${isFullscreen ? "is-fullscreen" : ""}`}
      id="fullscreen-toggle"
      type="button"
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen"}
    >
      <span className="fullscreen-icon">
        {isFullscreen ? (
          <Minimize size={20} strokeWidth={2.4} />
        ) : (
          <Maximize size={20} strokeWidth={2.4} />
        )}
      </span>
    </button>
  </>;
}

export function BottomNav({ screen, onNavigate, onExit }) {
  const items = [["home", "⌂", "HOME"], ["subjects", "📖", "STUDIES"], ["world", "🗺️", "WORLD"], ["profile", "◉", "PROFILE"]];
  return <nav className="bottom-nav glass-nav" aria-label="Main navigation">
    {items.map(([id, icon, label], index) => <React.Fragment key={id}>
      {index > 0 && <div className="nav-divider" />}
      <button className={`nav-btn ${screen === id ? "active" : ""}`} type="button" onClick={() => onNavigate(id)} aria-label={label}>
        <span className="nav-icon">{icon}</span><span className="nav-label">{label}</span>
      </button>
    </React.Fragment>)}
    <div className="nav-divider" />
    <button className="nav-btn" type="button" onClick={onExit} aria-label="Exit"><span className="nav-icon">→</span><span className="nav-label">EXIT</span></button>
  </nav>;
}

function HomeScreen({ go }) {
  const navigate = useNavigate();
  const [recentChapters, setRecentChapters] = useState(() => getRecentChapters());

  useEffect(() => {
    setRecentChapters(getRecentChapters());
  }, []);

  const handleResume = () => {
    if (recentChapters && recentChapters.length > 0) {
      const top = recentChapters[0];
      recordRecentChapter(top.id);
      navigate(`/chapter/${top.id}`);
    } else {
      go("subjects");
    }
  };

  return (
    <Screen className="home-screen">
      <Particles />
      <div className="screen-content home-content">
        <div className="logo-pill" role="banner">
          <div className="logo-star">✦</div>
          <span className="logo-text">EDTECH ISLAND</span>
        </div>
        <div className="glass-card home-card" role="main">
          <div className="solar-header-wrap">
            <div className="solar-header-accent" />
            <h1 className="solar-title">Welcome to <span className="gradient-text">Study Island</span></h1>
          </div>
          <div className="subject-preview-row" role="list" aria-label="Latest opened chapters">
            {recentChapters.slice(0, 3).map((ch) => (
              <button
                key={ch.id}
                type="button"
                className="subject-pill glass-mini"
                role="listitem"
                onClick={() => {
                  recordRecentChapter(ch.id);
                  navigate(`/chapter/${ch.id}`);
                }}
                style={{
                  cursor: "pointer",
                  border: "1px solid rgba(0, 240, 255, 0.3)",
                  background: "rgba(13, 23, 48, 0.75)",
                  textAlign: "left",
                  transition: "all 0.25s ease"
                }}
                aria-label={`Open chapter ${ch.title}`}
              >
                <span className="subject-icon">{ch.icon}</span>
                <div className="subject-pill-info">
                  <span className="subject-pill-name">{ch.title}</span>
                  <span className="subject-pill-sub">{ch.sub}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="cta-group">
            <button id="btn-start" className="btn-primary" type="button" onClick={() => go("subjects")} aria-label="Start learning">
              <span className="btn-icon">▶</span> START
            </button>
            <button id="btn-resume" className="btn-secondary" type="button" onClick={handleResume} aria-label="Resume latest chapter">
              RESUME
            </button>
          </div>
        </div>
      </div>
    </Screen>
  );
}

export function ComingSoonModal({ isOpen, onClose, featureName }) {
  if (!isOpen) return null;
  return (
    <div className="coming-soon-modal-backdrop" onClick={onClose} style={{
      position: "fixed",
      inset: 0,
      background: "rgba(3, 7, 20, 0.85)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div className="glass-panel-card" onClick={e => e.stopPropagation()} style={{
        maxWidth: "440px",
        width: "90%",
        padding: "36px 32px",
        borderRadius: "24px",
        textAlign: "center",
        border: "1px solid rgba(56, 189, 248, 0.35)",
        background: "rgba(10, 18, 38, 0.95)",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.2)",
        position: "relative"
      }}>
        <div style={{
          width: "70px",
          height: "70px",
          borderRadius: "20px",
          background: "linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(56, 189, 248, 0.25))",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2.2rem",
          margin: "0 auto 18px auto",
          boxShadow: "0 0 20px rgba(56, 189, 248, 0.3)"
        }}>
          🚀
        </div>
        <span style={{
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "#38bdf8",
          background: "rgba(56, 189, 248, 0.12)",
          padding: "4px 12px",
          borderRadius: "20px",
          border: "1px solid rgba(56, 189, 248, 0.3)"
        }}>
          Module in Development
        </span>
        <h3 style={{ fontSize: "1.65rem", fontWeight: 800, color: "#fff", marginTop: "14px", marginBottom: "8px" }}>
          Coming Soon
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "24px" }}>
          {featureName ? `${featureName} currently in development for Class 6th.` : "This curriculum module is currently being prepared and will be available soon."}
        </p>
        <button
          className="sol-start-btn"
          type="button"
          onClick={onClose}
          style={{ width: "100%", justifyContent: "center", padding: "12px 24px" }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export function LoadingDots({ text = "Loading...", color = "" }) {
  return (
    <div className="loading-dots-container">
      <div className={`loading-dots ${color}`}>
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
      {text && <p className="loading-dots-label">{text}</p>}
    </div>
  );
}

function SubjectsScreen({ go }) {
  const [dbChapters, setDbChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comingSoonModal, setComingSoonModal] = useState({ open: false, subjectName: "" });

  useEffect(() => {
    async function loadDbContent() {
      try {
        const { data, error } = await supabase
          .from("course_chapters")
          .select("id, title, chapter_slug, subject_name, front_visuals_url, scene_3d_model_url, experience_url, experiments_url, quiz_url, mixed_reality_url, stories_url");
        if (data && !error) {
          setDbChapters(data);
        }
      } catch (err) {
        console.warn("[SubjectsScreen] Supabase load error:", err);
      }
    }
    loadDbContent();
  }, []);

  const checkSubjectHasContent = (id) => {
    // Science has active chapter content in DB
    if (id === "science") return true;

    // Check if any row in course_chapters matches this subject and has content
    const matching = dbChapters.filter(c => {
      const sName = (c.subject_name || "").toLowerCase();
      return sName.includes(id) || (id === "pe" && sName.includes("physical"));
    });

    return matching.some(row =>
      (row.front_visuals_url && row.front_visuals_url.trim().length > 0) ||
      (row.scene_3d_model_url && row.scene_3d_model_url.trim().length > 0) ||
      (row.experience_url && row.experience_url.trim().length > 0) ||
      (row.experiments_url && row.experiments_url.trim().length > 0) ||
      (row.quiz_url && row.quiz_url.trim().length > 0) ||
      (row.stories_url && row.stories_url.trim().length > 0) ||
      (row.mixed_reality_url && row.mixed_reality_url.trim().length > 0)
    );
  };

  const handleSubjectClick = (id, name) => {
    const hasContent = checkSubjectHasContent(id);
    if (hasContent) {
      go("chapters");
    } else {
      setComingSoonModal({
        open: true,
        subjectName: name.replace("<br/>", " ")
      });
    }
  };

  return (
    <Screen className="subjects-screen">
      <Particles count={5} />
      <div className="screen-content subjects-content">
        <div className="page-header-card glass-pill" role="heading" aria-level="1">
          <span className="page-title-text">(Subject Selection)</span>
        </div>
        <div className="subjects-grid" role="list" aria-label="Select a subject">
          {subjects.map(([id, icon, name, progress]) => {
            const hasContent = checkSubjectHasContent(id);
            return (
              <button
                key={id}
                id={`subj-${id}`}
                className={`subject-card glass-panel-card ${hasContent ? "has-content" : "is-coming-soon"}`}
                type="button"
                onClick={() => handleSubjectClick(id, name)}
                role="listitem"
                aria-label={`${name.replace("<br/>", " ")} - ${hasContent ? "Available" : "Coming Soon"}`}
              >
                <div className="subject-card-icon">{icon}</div>
                <div className="subject-card-name">
                  <Label value={name} />
                </div>
                <div className="card-progress-track">
                  <div className="card-progress-fill" style={{ width: `${hasContent ? progress : 0}%` }} />
                </div>
                {hasContent ? (
                  <div className="subject-card-status available">● Available</div>
                ) : (
                  <div className="subject-card-status coming-soon">● Coming Soon</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <ComingSoonModal
        isOpen={comingSoonModal.open}
        featureName={`${comingSoonModal.subjectName} curriculum modules are`}
        onClose={() => setComingSoonModal({ open: false, subjectName: "" })}
      />
    </Screen>
  );
}

function ChaptersScreen({ go }) {
  const navigate = useNavigate();
  const [dbChapters, setDbChapters] = useState([]);

  useEffect(() => {
    async function loadDbChapters() {
      try {
        const { data, error } = await supabase
          .from("course_chapters")
          .select("id, title, chapter_slug, front_visuals_url, scene_3d_model_url, experience_url, experiments_url, quiz_url, mixed_reality_url, stories_url");
        if (data && !error) {
          setDbChapters(data);
        }
      } catch (err) {
        console.warn("[ChaptersScreen] Supabase load error:", err);
      }
    }
    loadDbChapters();
  }, []);

  const checkHasContent = (slug) => {
    if (slug === "light-and-shadows" || slug === "light-shadows") return true;

    const row = dbChapters.find(c =>
      c.chapter_slug === slug ||
      c.id === slug ||
      (slug === "space-and-solar-system" && (c.chapter_slug === "space-solar" || c.chapter_slug === "space-and-solar-system"))
    );

    if (!row) {
      if (slug === "space-and-solar-system") return true;
      return false;
    }

    const hasVisuals = (row.front_visuals_url && row.front_visuals_url.trim().length > 0) ||
                       (row.scene_3d_model_url && row.scene_3d_model_url.trim().length > 0);
    const hasExp = row.experience_url && row.experience_url.trim().length > 0;
    const hasLab = row.experiments_url && row.experiments_url.trim().length > 0;
    const hasQuiz = row.quiz_url && row.quiz_url.trim().length > 0;
    const hasStories = row.stories_url && row.stories_url.trim().length > 0;
    const hasMR = row.mixed_reality_url && row.mixed_reality_url.trim().length > 0;

    return Boolean(hasVisuals || hasExp || hasLab || hasQuiz || hasStories || hasMR);
  };

  return (
    <Screen className="chapters-screen">
      <Particles count={5} />
      <div className="screen-content chapters-content">
        <div className="page-header-card glass-pill" role="heading" aria-level="1">
          <span className="page-title-text">(Science: Chapter Selection)</span>
        </div>
        <div className="chapters-grid" role="list" aria-label="Select a chapter">
          {chapters.map(([id, icon, name, progress]) => {
            const hasContent = checkHasContent(id);
            return (
              <button
                key={id}
                id={`ch-${id}`}
                className={`chapter-card glass-panel-card ${hasContent ? "has-content" : "is-coming-soon"}`}
                type="button"
                onClick={() => {
                  recordRecentChapter(id);
                  navigate(`/chapter/${id}`);
                }}
                role="listitem"
                aria-label={`Chapter: ${name.replaceAll("<br/>", " ")} - ${hasContent ? "Available" : "Coming Soon"}`}
              >
                <div className="chapter-card-icon">{icon}</div>
                <div className="chapter-card-number">
                  <Label value={name} />
                </div>
                <div className="card-progress-track">
                  <div className="card-progress-fill" style={{ width: `${hasContent ? progress : 0}%` }} />
                </div>
                {hasContent ? (
                  <div className="chapter-card-status available">● Available</div>
                ) : (
                  <div className="chapter-card-status coming-soon">● Coming Soon</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Screen>
  );
}

const teacherSubjects = [
  ["💡", "Class 6th Science (Physics & Biology)", "Science"],
  ["🏛️", "Class 6th World & Ancient History", "History"],
  ["🌍", "Class 6th World Geography & Continents", "Geography"],
  ["🏃", "Class 6th Physical Education & Sports Science", "Physical Education"],
  ["🎨", "Class 6th Visual Arts & Design", "Arts"],
  ["📝", "Class 6th English Literature & Grammar", "English"],
  ["📐", "Class 6th Mathematics & Geometry", "Mathematics"],
  ["🎵", "Class 6th Music Theory & Acoustics", "Music"],
];

function ProfileScreen({ go }) {
  const [profile, setProfile] = useState({ name: "Gaurav Roy", avatar: "https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/avatars/gauravroy476_gmail_com_1786785035807_profile_1000x1000.jpg" });
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = localStorage.getItem("edtech_teacher_user") || localStorage.getItem("teacher_portal_user") || localStorage.getItem("edtech_user");
      const stored = raw ? JSON.parse(raw) : {};
      setProfile(current => ({
        name: params.get("teacher_name") || stored.name || stored.full_name || localStorage.getItem("portal_name") || current.name,
        avatar: params.get("teacher_avatar") || stored.avatar_url || stored.avatar || localStorage.getItem("portal_avatar") || current.avatar,
      }));
    } catch {}
  }, []);
  return <Screen className="profile-screen"><div className="screen-content profile-content teacher-profile-content">
    <div className="teacher-profile-header"><div className="logo-pill teacher-command-pill"><div className="logo-star">✦</div><span className="logo-text">CLASS 6TH TEACHER COMMAND CENTER</span></div><span className="realtime-status">● Supabase Realtime Active</span></div>
    <div className="teacher-profile-layout">
      <aside className="glass-card teacher-identity-card"><div className="teacher-avatar-wrap"><img src={profile.avatar} alt="Teacher profile" onError={event => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement.classList.add("avatar-fallback"); }} /></div><h2>{profile.name}</h2><strong className="teacher-role">Student</strong><span className="teacher-id">ID: TCH-ADF15E</span><span className="teacher-access">🎓 Educator Access</span><div className="teacher-stats">{[["🧑‍🎓", "Active Students", "34 Students"], ["📚", "Curriculum Modules", "8 Subjects"], ["🖥️", "Smartboard Hours", "42.5 Hrs"], ["🏫", "Classroom Attendance", "98.5%"]].map(([icon, label, value]) => <div className="teacher-stat" key={label}><span>{icon} <b>{label}</b></span><strong>{value}</strong></div>)}</div></aside>
      <section className="glass-card teacher-curriculum-card"><div className="teacher-curriculum-heading"><div><h2>Class 6th Interactive 3D Curriculum</h2><p>Explore 3D simulation models, virtual experiments, and quizzes.</p></div><span className="full-access-pill">Full Access Enabled</span></div><div className="teacher-subject-list">{teacherSubjects.map(([icon, title, subject]) => <div className="teacher-subject-row" key={subject}><div className="teacher-subject-main"><span className="teacher-subject-icon">{icon}</span><div><h3>{title}</h3><div><span className="full-access-small">● Full Access</span><span className="teacher-subject-meta">Class 6th • {subject}</span></div></div></div><button className="teacher-launch-btn" type="button" onClick={() => go("chapters")}>🚀 Launch 3D Lab</button></div>)}</div><div className="teacher-curriculum-footer"><span>All Class 6th modules unlocked for smartboard presentation.</span><button type="button" onClick={() => go("subjects")}>Explore All Subjects</button></div></section>
    </div>
  </div></Screen>;
}

function WorldScreen() {
  const navigate = useNavigate();
  const courses = [["🌍", "LANGUAGE LEARNING", "Language Learning & World Linguistics", "Master linguistic principles, sentence syntax & interactive storytelling in 3D", "#00E5FF", "/experience/light-shadows"], ["🔬", "SCIENTIFIC THINKING", "Scientific Thinking & Hypothesis Lab", "Develop empirical reasoning & scientific method skills through virtual lab experiments", "#10B981", "/lab"]];
  return <Screen className="world-screen" backgroundImage="radial-gradient(circle at 50% 20%, rgba(21,41,82,0.35), transparent 48%), #050d27"><div className="screen-content world-content"><div className="world-header"><div><h2>World of Custom Courses</h2><p>Explore platform-exclusive learning programs (Language Learning, Scientific Thinking, Mathematical Reasoning &amp; more)</p></div><button type="button" onClick={() => navigate("/")}>Back Home</button></div><div className="world-course-list">{courses.map(([icon, category, title, tagline, color, path]) => <article className="world-course-card" key={title} style={{ "--course-color": color }}><div className="world-course-top"><span className="world-course-icon">{icon}</span><span className="world-course-category">{category}</span></div><h3>{title}</h3><p>{tagline}</p><button type="button" onClick={() => navigate(path)}>▶ Launch Experience</button></article>)}</div></div></Screen>;
}

export function SmartboardOverlay() {
  const canvasRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#00F0FF");
  const [width, setWidth] = useState(5);
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const lastMidPoint = useRef(null);
  const history = useRef([]);
  const historyIndex = useRef(-1);
  const resizeCanvas = () => { const canvas = canvasRef.current; if (!canvas) return; const dpr = window.devicePixelRatio || 1; const old = document.createElement("canvas"); old.width = canvas.width; old.height = canvas.height; old.getContext("2d")?.drawImage(canvas, 0, 0); canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr); canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`; const context = canvas.getContext("2d"); context.setTransform(dpr, 0, 0, dpr, 0, 0); if (old.width && old.height) context.drawImage(old, 0, 0, old.width / (window.devicePixelRatio || 1), old.height / (window.devicePixelRatio || 1)); };
  useEffect(() => { resizeCanvas(); window.addEventListener("resize", resizeCanvas); return () => window.removeEventListener("resize", resizeCanvas); }, []);
  const snapshot = () => { const canvas = canvasRef.current; if (!canvas) return; const image = canvas.toDataURL(); history.current = history.current.slice(0, historyIndex.current + 1); history.current.push(image); if (history.current.length > 25) history.current.shift(); historyIndex.current = history.current.length - 1; };
  const restore = index => { const canvas = canvasRef.current; if (!canvas || !history.current[index]) return; const image = new Image(); image.onload = () => { const context = canvas.getContext("2d"); context.clearRect(0, 0, window.innerWidth, window.innerHeight); context.drawImage(image, 0, 0, window.innerWidth, window.innerHeight); }; image.src = history.current[index]; };
  const point = event => { const rect = canvasRef.current.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const drawSmoothSegment = (from, control, to) => { const canvas = canvasRef.current; const context = canvas.getContext("2d"); context.save(); context.lineCap = "round"; context.lineJoin = "round"; context.lineWidth = tool === "eraser" ? width * 4 : width; context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over"; context.strokeStyle = color; context.beginPath(); context.moveTo(from.x, from.y); context.quadraticCurveTo(control.x, control.y, to.x, to.y); context.stroke(); context.restore(); };
  const start = event => { if (!open) return; event.preventDefault(); canvasRef.current.setPointerCapture?.(event.pointerId); drawing.current = true; lastPoint.current = point(event); lastMidPoint.current = lastPoint.current; };
  const move = event => { if (!drawing.current) return; event.preventDefault(); const samples = event.getCoalescedEvents?.() || [event]; samples.forEach(sample => { const next = point(sample); const mid = { x: (lastPoint.current.x + next.x) / 2, y: (lastPoint.current.y + next.y) / 2 }; drawSmoothSegment(lastMidPoint.current, lastPoint.current, mid); lastPoint.current = next; lastMidPoint.current = mid; }); };
  const end = () => { if (!drawing.current) return; if (lastPoint.current && lastMidPoint.current) drawSmoothSegment(lastMidPoint.current, lastPoint.current, lastPoint.current); drawing.current = false; snapshot(); lastPoint.current = null; lastMidPoint.current = null; };
  const clear = () => { const canvas = canvasRef.current; canvas.getContext("2d").clearRect(0, 0, window.innerWidth, window.innerHeight); snapshot(); };
  const undo = () => { if (historyIndex.current <= 0) { clear(); return; } historyIndex.current -= 1; restore(historyIndex.current); };
  const redo = () => { if (historyIndex.current >= history.current.length - 1) return; historyIndex.current += 1; restore(historyIndex.current); };
  const toolButtons = [["laser", MousePointer2, "Pointer"], ["pen", Video, "Pen tool"], ["fineliner", Pencil, "Fine liner"], ["marker", Highlighter, "Marker"], ["eraser", Eraser, "Eraser"]];
  return <><canvas ref={canvasRef} id="smartboard-canvas" className={`${open ? "draw-active" : ""} tool-${tool}`} aria-hidden="true" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} /><div id="smartboard-toolbar" className={open ? "" : "sb-collapsed"} aria-label="Smartboard Drawing Toolbar"><button className={`sb-circle-fab ${open ? "drawing-active" : ""}`} type="button" aria-label="Open drawing tools" onClick={() => setOpen(true)}>✎</button>{open && <div className="sb-dock glass-dock"><button className="sb-icon-btn sb-danger-btn" type="button" title="Clear Canvas" aria-label="Clear canvas" onClick={clear}><Trash2 size={21} strokeWidth={2.4} /></button><div className="sb-dock-sep" /><div className="sb-undo-redo-col"><button className="sb-icon-btn" type="button" onClick={undo} title="Undo" aria-label="Undo"><Undo2 size={20} /></button><button className="sb-icon-btn" type="button" onClick={redo} title="Redo" aria-label="Redo"><Redo2 size={20} /></button></div><div className="sb-dock-sep" /><div className="sb-pens-column">{toolButtons.map(([id, Icon, label]) => <button className={`pen-item ${tool === id ? "active" : ""}`} type="button" key={id} onClick={() => setTool(id)} title={label} aria-label={label}>{id === "pen" ? <Video size={18} strokeWidth={2.6} /> : <Icon size={18} strokeWidth={2.6} />}</button>)}</div><div className="sb-dock-sep" /><div className="sb-colors-col"><label className="sb-custom-color-wrap" title="Choose custom colour"><input className="sb-color-input" type="color" value={color} onChange={event => setColor(event.target.value)} aria-label="Choose custom colour" /><span className="sb-color-wheel" aria-hidden="true"><span className="sb-color-wheel-inner" /></span></label>{["#00F0FF", "#3B82F6", "#22C55E", "#EAB308", "#EF4444"].map(value => <button className={`color-circle ${color === value ? "active" : ""}`} style={{ background: value }} key={value} type="button" onClick={() => setColor(value)} aria-label={`Use ${value}`} />)}</div><div className="sb-dock-sep" /><div className="sb-dock-section"><label className="sb-size-control">Size<input type="range" min="1" max="30" value={width} onChange={event => setWidth(Number(event.target.value))} /></label><button id="sb-retract-btn" className="sb-dock-icon-btn" type="button" onClick={() => setOpen(false)} title="Minimize" aria-label="Minimize drawing tools">‹</button></div></div>}</div></>;
}

export default function StudyIslandView() {
  const location = useLocation();
  const [screen, setScreen] = useState(() => new URLSearchParams(location.search).get("screen") || "home");
  const navigate = useNavigate();

  useEffect(() => {
    const s = new URLSearchParams(location.search).get("screen");
    if (s) {
      setScreen(s);
    } else {
      setScreen("home");
    }
  }, [location.search]);

  const go = (next) => {
    setScreen(next);
    if (next === "home") {
      navigate("/");
    } else {
      navigate(`/?screen=${next}`);
    }
  };
  const exit = () => navigate("/");
  return <div className="study-island-app"><TopControls />
    {screen === "home" && <HomeScreen go={go} />}
    {screen === "subjects" && <SubjectsScreen go={go} />}
    {screen === "chapters" && <ChaptersScreen go={go} />}
    {screen === "world" && <WorldScreen />}
    {screen === "profile" && <ProfileScreen go={go} />}
    <SmartboardOverlay />
    <BottomNav screen={screen} onNavigate={go} onExit={exit} />
    <AITutorWidget />
  </div>;
}
