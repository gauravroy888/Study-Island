import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen, FlaskConical, Glasses, Lightbulb, ListChecks } from "lucide-react";
import useThreeScene from "../hooks/useThreeScene";
import AITutorWidget from "../components/AITutorWidget";
import { SmartboardOverlay, TopControls, recordRecentChapter } from "./StudyIslandView";
import chapterBackground from "../../assets/chapter background lowres.jpg";
import { supabase } from "../supabase";

const TABS = [
  ["experience", "Experience", Lightbulb],
  ["experiments", "Experiments", FlaskConical],
  ["quiz", "Quiz", ListChecks],
  ["mixed-reality", "Mixed Reality", Glasses],
  ["stories", "Stories", BookOpen],
];

// Fallback hardcoded defaults for Light & Shadows
const DEFAULT_LIGHT_SHADOWS_DATA = {
  title: "LIGHT AND SHADOWS",
  subject: "Science",
  description: "The light and shadow simulation model provides interactive exploration of fundamental optical principles. Visualize the formation of complex shadow patterns, examine umbra and penumbra regions, and observe how light propagates to form shadows based on object shape and distance.",
  front_visuals_url: "Light_Shadows_Optics_3D.html",
  scene_3d_model_url: "Light_Shadows_Optics_3D.html",
  experience_url: "Chapter_experience_L_S.html",
  experiments_url: "Shadow_Lab.html",
  stories: [
    { id: "fy7eoMef3e8", badge: "DOCUMENTARY", duration: "5:21", first: "Shadows", second: "and Light Explained", author: "by Platform Studio", views: "2.2M views", desc: "Dive deep into the magical interplay between light sources and opaque objects. A beautifully animated introduction to optics." },
    { id: "4vUozykivNA", badge: "EXPLORE", duration: "3:36", first: "The Science", second: "of Shadows", author: "by Edtech Lab", views: "1.8M views", desc: "Learn how different light angles and intensities stretch and morph shadows, uncovering geometric visual perception." },
    { id: "cDaWohR_DVo", badge: "LESSON", duration: "3:58", first: "How Do We", second: "See Things?", author: "by Visual Science", views: "3.1M views", desc: "An engaging visual breakthrough exploring reflection, the human eye, and biological light vision mechanics." }
  ],
  experiments: [
    { badge: "3D LAB", likes: "♥ 50k", icon: "🌕", first: "Shadow", second: "Lab", desc: "Interactive WebGL optical ray simulation, umbra penumbra, and shadow formation models by Platform.", action: "Launch Lab", rating: "⭐ 4.9", extra: "featured", glow: "rgba(0, 240, 255, 0.45)", url: "Shadow_Lab.html" },
    { badge: "GAME", likes: "♥ 12k", icon: "🧬", first: "Laser", second: "Bounce", desc: "Reflective laser maze game with prism angles and optical reflection challenges by Edtech Lab.", action: "Play Game", rating: "⭐ 4.8", extra: "", glow: "rgba(168, 85, 247, 0.45)", url: null },
    { badge: "SIMULATION", likes: "♥ 21k", icon: "🎯", first: "Optics", second: "Simulator", desc: "Precision concave lens, convex mirror, and refraction laboratory visualizer by Physics Team.", action: "Launch Lab", rating: "⭐ 4.9", extra: "", glow: "rgba(236, 72, 153, 0.45)", url: null }
  ]
};

// Sleek Glassmorphic Coming Soon Panel for Empty Modality Sections
function ComingSoonPanel({ title = "Coming Soon", subtitle, icon = "🚀" }) {
  return (
    <div className="sol-tab-panel active" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "52vh" }}>
      <div className="glass-panel-card" style={{
        padding: "48px 56px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        borderRadius: "24px",
        position: "relative",
        overflow: "hidden",
        maxWidth: "520px",
        width: "92%",
        textAlign: "center",
        border: "1px solid rgba(56, 189, 248, 0.28)",
        background: "rgba(10, 18, 38, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.65)"
      }}>
        <div style={{
          position: "absolute",
          inset: "-50%",
          background: "radial-gradient(circle at center, rgba(56, 189, 248, 0.12) 0%, transparent 60%)",
          pointerEvents: "none"
        }} />
        <div style={{ zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{
            width: "76px",
            height: "76px",
            borderRadius: "22px",
            background: "linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(56, 189, 248, 0.25))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "18px",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            boxShadow: "0 0 24px rgba(56, 189, 248, 0.25)",
            fontSize: "2.6rem"
          }}>
            {icon}
          </div>
          <span style={{
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#38bdf8",
            background: "rgba(56, 189, 248, 0.12)",
            padding: "4px 14px",
            borderRadius: "20px",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            marginBottom: "14px"
          }}>
            Coming Soon
          </span>
          <h3 style={{ fontSize: "1.85rem", fontWeight: 800, color: "#ffffff", marginBottom: "10px", letterSpacing: "0.5px" }}>
            {title}
          </h3>
          <p style={{ color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.6, maxWidth: "380px", margin: "0 auto" }}>
            {subtitle || "This interactive section is currently being prepared. Check back soon!"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Coming Soon Modal / Toast for action buttons
function ComingSoonModal({ isOpen, onClose, featureName }) {
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
          {featureName ? `${featureName} is currently in development for this chapter.` : "This chapter feature is currently being prepared and will be available soon."}
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

function ExperiencePanel({ data, onComingSoon }) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const frontVisuals = data?.front_visuals_url || data?.scene_3d_model_url;
  const isCustomHtml = frontVisuals && (frontVisuals.endsWith(".html") || frontVisuals.includes(".html"));
  const navigate = useNavigate();

  const handleLaunchExperience = () => {
    if (data.experience_url && (data.experience_url.startsWith("http") || data.experience_url.endsWith(".html"))) {
      window.open(data.experience_url.startsWith("http") || data.experience_url.startsWith("/") ? data.experience_url : `/${data.experience_url}`, "_blank");
    } else if (data.isLightAndShadows) {
      window.open("/Chapter_experience_L_S.html", "_blank");
    } else {
      onComingSoon("Full Interactive Experience");
    }
  };

  const resolveFrontVisualUrl = (rawUrl) => {
    if (!rawUrl) return null;
    const trimmed = String(rawUrl).trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
      return trimmed;
    }
    return `/${trimmed}`;
  };

  const iframeSrc = resolveFrontVisualUrl(frontVisuals);

  return (
    <div className="sol-tab-panel active">
      <div className="sol-experience-layout">
        <div className="sol-canvas-wrap" style={{ position: "relative" }}>
          {iframeSrc ? (
            <>
              {iframeLoading && (
                <div className="canvas-loading-overlay">
                  <div className="loading-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                  <p className="loading-dots-label" style={{ marginTop: "12px", fontSize: "11px" }}>Loading 3D Visual Scene...</p>
                </div>
              )}
              <iframe
                src={iframeSrc}
                title="Front 3D Scene"
                className="sol-canvas-inner"
                style={{ width: "100%", height: "100%", border: 0, borderRadius: "16px", background: "#040812" }}
                allow="autoplay; fullscreen"
                loading="eager"
                onLoad={() => setIframeLoading(false)}
              />
            </>
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#040812", borderRadius: "16px" }}>
              <ComingSoonPanel title="3D Front Visuals Coming Soon" subtitle="Interactive 3D model is being uploaded for this chapter." icon="🪐" />
            </div>
          )}
        </div>
        <div className="sol-description-wrap">
          <p className="sol-description-text">{data.description}</p>
          <div style={{ marginTop: "16px" }}>
            <button className="sol-start-btn" type="button" onClick={handleLaunchExperience}>
              Launch Experience ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExperimentsPanel({ data }) {
  const navigate = useNavigate();
  const [experimentStart, setExperimentStart] = useState(0);

  const cards = (data.experiments && data.experiments.length > 0)
    ? data.experiments
    : (data.isLightAndShadows ? DEFAULT_LIGHT_SHADOWS_DATA.experiments : null);

  if (!cards || cards.length === 0) {
    return (
      <ComingSoonPanel
        icon="🧪"
        title="Experiments Coming Soon"
        subtitle={`Interactive 3D virtual experiments and laboratory simulations for ${data.title || "this chapter"} are coming soon.`}
      />
    );
  }

  const lastExperimentStart = Math.max(0, cards.length - 3);
  const visibleCards = cards.slice(experimentStart, experimentStart + 3);

  return (
    <div className="sol-tab-panel active">
      <div className="experiments-carousel-container">
        <div className="exp-section-header">
          <div className="exp-header-badge"><span className="badge-dot" /> 🧪 INTERACTIVE VIRTUAL LABS &amp; GAMES</div>
          <h2 className="experiments-carousel-title">Interactive 3D Science Experiments</h2>
          <p className="exp-header-desc">Hands-on WebGL simulations, real-time light ray interactions, and virtual laboratory games.</p>
        </div>
        <div className="carousel-wrapper">
          <button className="carousel-nav left" type="button" onClick={() => setExperimentStart(index => Math.max(0, index - 1))} disabled={experimentStart === 0} aria-label="Show previous experiments">❮</button>
          <div className="experiments-carousel">
            {visibleCards.map((exp, i) => (
              <article className={`experiment-card ${exp.extra || ""}`} key={i}>
                <div className="experiment-card-stage">
                  <div className="exp-stage-floor-glow" style={{ background: `radial-gradient(ellipse at 50% 80%, ${exp.glow || "rgba(0, 240, 255, 0.45)"} 0%, rgba(99, 102, 241, 0.15) 50%, transparent 75%)` }} />
                  <div className="exp-top-tag-bar"><span className="exp-badge-pill">{exp.badge || "LAB"}</span><span className="exp-likes-pill">{exp.likes || "★ 4.9"}</span></div>
                  <div className="exp-stage-asset-wrap"><span className="exp-asset-icon">{exp.icon || "🧪"}</span></div>
                </div>
                <div className="experiment-card-body">
                  <div>
                    <h3 className="exp-v2-title">{exp.first} <em>{exp.second}</em></h3>
                    <p className="exp-v2-desc">{exp.desc}</p>
                  </div>
                  <div className="exp-v2-footer">
                    <button className="exp-v2-btn" type="button" onClick={() => exp.url ? (exp.url.startsWith("http") ? window.open(exp.url, "_blank") : navigate("/lab")) : null}>
                      {exp.action || "Launch Lab"} <span className="pill-arrow">→</span>
                    </button>
                    <span className="exp-v2-rating">{exp.rating || "⭐ 4.9"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <button className="carousel-nav right" type="button" onClick={() => setExperimentStart(index => Math.min(lastExperimentStart, index + 1))} disabled={experimentStart === lastExperimentStart} aria-label="Show next experiments">❯</button>
        </div>
      </div>
    </div>
  );
}

function StoriesPanel({ data }) {
  const [playing, setPlaying] = useState(null);
  const [storyStart, setStoryStart] = useState(0);

  const stories = (data.stories && data.stories.length > 0)
    ? data.stories
    : (data.isLightAndShadows ? DEFAULT_LIGHT_SHADOWS_DATA.stories : null);

  if (!stories || stories.length === 0) {
    return (
      <ComingSoonPanel
        icon="🎬"
        title="Video Stories Coming Soon"
        subtitle={`Curated animated science lessons and documentaries for ${data.title || "this chapter"} are coming soon.`}
      />
    );
  }

  const lastStoryStart = Math.max(0, stories.length - 3);
  const visibleStories = stories.slice(storyStart, storyStart + 3);

  if (playing) {
    return (
      <div className="sol-tab-panel active">
        <div style={{ padding: "24px", width: "100%" }}>
          <button className="sol-nav-btn" type="button" onClick={() => setPlaying(null)}>
            ← Back to Stories
          </button>
          <iframe
            title="Story video"
            src={playing}
            style={{ width: "100%", height: "min(65dvh, 640px)", marginTop: "18px", border: 0, borderRadius: "20px" }}
            allow="autoplay; fullscreen"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="sol-tab-panel active">
      <div className="story-section-header">
        <div className="story-header-badge"><span className="badge-dot" /> 🎬 VISUAL STORIES &amp; DOCUMENTARIES</div>
        <h2 className="stories-carousel-title">Interactive Science Video Stories</h2>
        <p className="story-header-desc">Animated optical narratives, documentary visualizers, and historical science lessons.</p>
      </div>
      <div className="carousel-wrapper">
        <button className="carousel-nav left" type="button" onClick={() => setStoryStart(index => Math.max(0, index - 1))} disabled={storyStart === 0} aria-label="Show previous stories">❮</button>
        <div className="stories-carousel">
          {visibleStories.map((story) => (
            <article className="story-card" key={story.id} onClick={() => setPlaying(story.url || `https://www.youtube.com/embed/${story.id}?autoplay=1&rel=0&modestbranding=1`)}>
              <div className="story-card-stage">
                <div className="story-thumb-fallback" aria-hidden="true">🎬</div>
                <img
                  className="story-thumb-img"
                  src={story.thumbnail_url || `https://img.youtube.com/vi/${story.id}/hqdefault.jpg`}
                  alt={`${story.first} ${story.second}`}
                  onError={event => { event.currentTarget.style.display = "none"; }}
                />
                <div className="story-stage-overlay" />
                <span className="story-badge-pill">{story.badge || "LESSON"}</span>
                <span className="story-duration-pill">⏱ {story.duration || "5:00"}</span>
                <div className="story-play-glass">
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                </div>
              </div>
              <div className="story-card-body">
                <div>
                  <h3 className="story-card-title">{story.first} <em>{story.second}</em></h3>
                  <div className="story-meta-row">
                    <span className="story-author-name">{story.author}</span>
                    <span className="story-views-tag">{story.views}</span>
                  </div>
                  <p className="story-card-desc">{story.desc}</p>
                </div>
                <div className="story-card-footer">
                  <button className="exp-v2-btn" type="button">
                    Watch Story <span className="pill-arrow">→</span>
                  </button>
                  <span className="exp-v2-rating">⭐ 4.9</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        <button className="carousel-nav right" type="button" onClick={() => setStoryStart(index => Math.min(lastStoryStart, index + 1))} disabled={storyStart === lastStoryStart} aria-label="Show next stories">❯</button>
      </div>
    </div>
  );
}

function SimplePanel({ type, data }) {
  const navigate = useNavigate();
  if (type === "quiz") {
    if (data.isLightAndShadows) {
      return (
        <div className="sol-tab-panel active">
          <div className="sol-unlocked-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div className="glass-panel-card" style={{ padding: "50px 80px", display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "24px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: "-50%", background: "radial-gradient(circle at center, rgba(34,211,238,0.15) 0%, transparent 50%)", pointerEvents: "none" }} />
              <div style={{ zIndex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(34,211,238,0.1), rgba(59,130,246,0.1))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px", border: "1px solid rgba(34,211,238,0.3)", boxShadow: "0 0 30px rgba(34,211,238,0.2)", fontSize: "3.5rem" }}>📝</div>
                <h3 className="sol-unlocked-title" style={{ fontSize: "2.2rem", fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)", letterSpacing: "0.5px" }}>{data.title || "Chapter"} Quiz</h3>
                <p className="sol-unlocked-desc" style={{ color: "var(--text-muted)", marginBottom: "30px", fontSize: "1.15rem" }}>Test your mastery on {data.title || "this chapter"}.</p>
                <div style={{ display: "flex", gap: "16px", marginBottom: "40px", flexWrap: "wrap", justifyContent: "center" }}>
                  <span className="glass-mini" style={{ padding: "8px 16px", color: "#cbd5e1" }}>☷ 10 Questions</span>
                  <span className="glass-mini" style={{ padding: "8px 16px", color: "#cbd5e1" }}>◷ 15 Mins</span>
                  <span className="glass-mini" style={{ padding: "8px 16px", color: "#cbd5e1" }}>★ +50 XP</span>
                </div>
                <button
                  className="sol-start-btn"
                  type="button"
                  onClick={() => navigate("/quiz")}
                  aria-label="Start Quiz"
                >
                  Start Quiz <span style={{ marginLeft: "8px" }}>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <ComingSoonPanel
        icon="📝"
        title="Quiz Coming Soon"
        subtitle={`Adaptive knowledge checks and interactive quizzes for ${data.title || "this chapter"} are coming soon.`}
      />
    );
  }

  if (type === "mixed-reality") {
    if (data.isLightAndShadows) {
      return (
        <div className="sol-tab-panel active">
          <div className="sol-locked-panel">
            <div className="sol-lock-icon">🥽</div>
            <h3 className="sol-locked-title">Content Locked</h3>
            <p className="sol-locked-desc">Complete the Experience and Experiments to unlock this section.</p>
          </div>
        </div>
      );
    }
    return (
      <ComingSoonPanel
        icon="🥽"
        title="Mixed Reality Coming Soon"
        subtitle={`Immersive WebXR and spatial 3D experiences for ${data.title || "this chapter"} are coming soon.`}
      />
    );
  }

  return <ComingSoonPanel icon="✦" title="Coming Soon" subtitle="This section is currently being prepared." />;
}

export default function UniversalChapterView({ studentContext }) {
  const { chapterId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("experience");
  const [chapterData, setChapterData] = useState(DEFAULT_LIGHT_SHADOWS_DATA);
  const [loading, setLoading] = useState(true);
  const [comingSoonModal, setComingSoonModal] = useState({ open: false, feature: "" });

  const handleOpenComingSoon = (featureName) => {
    setComingSoonModal({ open: true, feature: featureName });
  };

  useEffect(() => {
    async function loadChapterFromSupabase() {
      if (!chapterId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId);
        let query = supabase.from("course_chapters").select("*");
        if (isUUID) {
          query = query.eq("id", chapterId);
        } else {
          const altSlug = chapterId === 'light-shadows' ? 'light-and-shadows' : (chapterId === 'space-solar' ? 'space-and-solar-system' : chapterId.replace('-and-', '-'));
          query = query.or(`chapter_slug.eq.${chapterId},chapter_slug.eq.${altSlug},chapter_slug.ilike.%${chapterId}%`);
        }
        const { data, error } = await query.maybeSingle();

        const isLight = chapterId === "light-and-shadows" || chapterId === "light-shadows" || data?.chapter_slug === "light-and-shadows";
        const isSpace = (chapterId && (chapterId.includes("space") || chapterId.includes("solar"))) || (data?.chapter_slug && data.chapter_slug.includes("space"));

        if (data && !error) {
          const defaultTitle = isLight ? "LIGHT AND SHADOWS" : (isSpace ? "SPACE AND SOLAR SYSTEM" : (data.title || "CHAPTER"));
          const defaultDesc = isLight
            ? DEFAULT_LIGHT_SHADOWS_DATA.description
            : (isSpace ? "Explore the 3D heliocentric orbital dynamics of our Solar System. Observe the central Sun, planetary orbits from Mercury to Neptune, axial spins, relative velocities, and Keplerian orbital mechanics in interactive real time." : "Explore interactive concepts and 3D simulation models for this chapter.");
          const defaultVisual = isLight
            ? "https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/courses/class-6th/science/light-and-shadows/front_visuals/Light_Shadows_Optics_3D.html"
            : (isSpace ? "https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/courses/class-6th/science/space-and-solar-system/front_visuals/Space_Solar_System_3D.html" : null);

          setChapterData({
            isLightAndShadows: isLight,
            title: data.title || defaultTitle,
            subject: data.subject_name || "Science",
            description: (data.description && data.description.trim()) ? data.description : defaultDesc,
            front_visuals_url: data.front_visuals_url || data.scene_3d_model_url || data.modality_urls?.front_visuals || defaultVisual,
            experience_url: data.experience_url || (isLight ? "Chapter_experience_L_S.html" : null),
            experiments_url: data.experiments_url || null,
            quiz_url: data.quiz_url || null,
            mixed_reality_url: data.mixed_reality_url || null,
            stories_url: data.stories_url || null,
            stories: data.custom_modalities?.stories || (isLight ? DEFAULT_LIGHT_SHADOWS_DATA.stories : []),
            experiments: data.custom_modalities?.experiments || (isLight ? DEFAULT_LIGHT_SHADOWS_DATA.experiments : [])
          });
        } else if (isSpace) {
          setChapterData({
            isLightAndShadows: false,
            title: "SPACE AND SOLAR SYSTEM",
            subject: "Science",
            description: "Explore the 3D heliocentric orbital dynamics of our Solar System. Observe the central Sun, planetary orbits from Mercury to Neptune, axial spins, relative velocities, and Keplerian orbital mechanics in interactive real time.",
            front_visuals_url: "https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev/courses/class-6th/science/space-and-solar-system/front_visuals/Space_Solar_System_3D.html",
            experience_url: null,
            experiments_url: null,
            quiz_url: null,
            mixed_reality_url: null,
            stories_url: null,
            stories: [],
            experiments: []
          });
        } else {
          setChapterData({
            isLightAndShadows: isLight,
            title: isLight ? DEFAULT_LIGHT_SHADOWS_DATA.title : "CHAPTER",
            subject: "Science",
            description: isLight ? DEFAULT_LIGHT_SHADOWS_DATA.description : "Explore interactive concepts and 3D simulation models.",
            front_visuals_url: isLight ? DEFAULT_LIGHT_SHADOWS_DATA.front_visuals_url : null,
            experience_url: isLight ? DEFAULT_LIGHT_SHADOWS_DATA.experience_url : null,
            experiments_url: isLight ? DEFAULT_LIGHT_SHADOWS_DATA.experiments_url : null,
            stories: isLight ? DEFAULT_LIGHT_SHADOWS_DATA.stories : [],
            experiments: isLight ? DEFAULT_LIGHT_SHADOWS_DATA.experiments : []
          });
        }
        if (chapterId) {
          recordRecentChapter(chapterId, {
            title: data?.title || (isSpace ? "SPACE & SOLAR SYSTEM" : (isLight ? "LIGHT & SHADOWS" : chapterId)),
            subject: data?.subject_name || "Science"
          });
        }
      } catch (err) {
        console.warn("[UniversalChapterView] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadChapterFromSupabase();
  }, [chapterId]);

  const content = activeTab === "experience"
    ? <ExperiencePanel data={chapterData} onComingSoon={handleOpenComingSoon} />
    : activeTab === "experiments"
    ? <ExperimentsPanel data={chapterData} />
    : activeTab === "stories"
    ? <StoriesPanel data={chapterData} />
    : <SimplePanel type={activeTab} data={chapterData} />;

  return (
    <div className="study-island-app">
      <TopControls />
      <section className="screen active" style={{ backgroundImage: `url("${chapterBackground}")` }}>
        <div className="bg-overlay dark-overlay" />
        <div className="screen-content chapter-detail-content">
          <div className="solar-chapter-header">
            <div className="solar-chapter-accent-line" />
            <h2 className="solar-chapter-title">{chapterData.title.toUpperCase()}</h2>
          </div>
          <div className="chapter-main-panel glass-panel-card">
            <div className="chapter-tab-nav" role="tablist" aria-label="Chapter sections">
              {TABS.map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={`sol-tab ${activeTab === id ? "active-tab" : ""}`}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  role="tab"
                  aria-selected={activeTab === id}
                >
                  <Icon className="sol-tab-solo-icon" />
                  <span className="sol-tab-label">{label}</span>
                </button>
              ))}
            </div>
            <div className="tab-panels-area">
              {loading ? (
                <div style={{ minHeight: "360px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <LoadingDots text="Initializing Chapter Experience..." />
                </div>
              ) : (
                content
              )}
            </div>
          </div>
          <div className="sol-bottom-nav-row">
            <button
              className="sol-nav-btn"
              type="button"
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate("/?screen=chapters");
                }
              }}
            >
              ← Back
            </button>
            <button className="sol-nav-btn" type="button" onClick={() => navigate("/")}>
              ⌂ Home
            </button>
          </div>
        </div>
      </section>
      <SmartboardOverlay />
      <AITutorWidget />
      <ComingSoonModal
        isOpen={comingSoonModal.open}
        featureName={comingSoonModal.feature}
        onClose={() => setComingSoonModal({ open: false, feature: "" })}
      />
    </div>
  );
}
