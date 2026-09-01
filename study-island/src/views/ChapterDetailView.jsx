import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FlaskConical, Glasses, Lightbulb, ListChecks } from "lucide-react";
import useThreeScene from "../hooks/useThreeScene";
import AITutorWidget from "../components/AITutorWidget";
import { SmartboardOverlay, TopControls } from "./StudyIslandView";
import chapterBackground from "../../assets/chapter background lowres.jpg";

const tabs = [
  ["experience", "Experience", Lightbulb],
  ["experiments", "Experiments", FlaskConical],
  ["quiz", "Quiz", ListChecks],
  ["mixed-reality", "Mixed Reality", Glasses],
  ["stories", "Stories", BookOpen],
];

function ExperiencePanel() {
  const navigate = useNavigate();
  return (
    <div className="sol-tab-panel active">
      <div className="sol-experience-layout">
        <div className="sol-canvas-wrap">
          <iframe
            src="/Light_Shadows_Optics_3D.html"
            title="3D Optics Scene"
            className="sol-canvas-inner"
            style={{ width: "100%", height: "100%", border: 0, borderRadius: "16px", background: "#040812" }}
            allow="autoplay; fullscreen"
          />
        </div>
        <div className="sol-description-wrap">
          <p className="sol-description-text">The light and shadow simulation model provides interactive exploration of fundamental optical principles. Visualize the formation of complex shadow patterns, examine umbra and penumbra regions, and observe how light propagates to form shadows based on object shape and distance.</p>
          <div style={{ marginTop: "16px" }}>
            <button className="sol-start-btn" type="button" onClick={() => window.open("Chapter_experience_L_S.html", "_blank")}>Launch Experience ↗</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExperimentsPanel() {
  const navigate = useNavigate();
  const [experimentStart, setExperimentStart] = useState(0);
  const cards = [
    ["3D LAB", "♥ 50k", "🌕", "Shadow", "Lab", "Interactive WebGL optical ray simulation, umbra penumbra, and shadow formation models by Platform.", "Launch Lab", "⭐ 4.9", "featured", "rgba(0, 240, 255, 0.45)", () => navigate("/lab")],
    ["GAME", "♥ 12k", "🧬", "Laser", "Bounce", "Reflective laser maze game with prism angles and optical reflection challenges by Edtech Lab.", "Play Game", "⭐ 4.8", "", "rgba(168, 85, 247, 0.45)", null],
    ["SIMULATION", "♥ 21k", "🎯", "Optics", "Simulator", "Precision concave lens, convex mirror, and refraction laboratory visualizer by Physics Team.", "Launch Lab", "⭐ 4.9", "", "rgba(236, 72, 153, 0.45)", null],
  ];
  const lastExperimentStart = Math.max(0, cards.length - 3);
  const visibleCards = cards.slice(experimentStart, experimentStart + 3);
  return <div className="sol-tab-panel active"><div className="experiments-carousel-container"><div className="exp-section-header"><div className="exp-header-badge"><span className="badge-dot" /> 🧪 INTERACTIVE VIRTUAL LABS &amp; GAMES</div><h2 className="experiments-carousel-title">Interactive 3D Science Experiments</h2><p className="exp-header-desc">Hands-on WebGL simulations, real-time light ray interactions, and virtual laboratory games.</p></div><div className="carousel-wrapper"><button className="carousel-nav left" type="button" onClick={() => setExperimentStart(index => Math.max(0, index - 1))} disabled={experimentStart === 0} aria-label="Show previous experiments">❮</button><div className="experiments-carousel">{visibleCards.map(([badge, likes, icon, first, second, desc, action, rating, extra, glow, onOpen]) => <article className={`experiment-card ${extra}`} key={first} onClick={onOpen || undefined}><div className="experiment-card-stage"><div className="exp-stage-floor-glow" style={{ background: `radial-gradient(ellipse at 50% 80%, ${glow} 0%, rgba(99, 102, 241, 0.15) 50%, transparent 75%)` }} /><div className="exp-top-tag-bar"><span className="exp-badge-pill">{badge}</span><span className="exp-likes-pill">{likes}</span></div><div className="exp-stage-asset-wrap"><span className="exp-asset-icon">{icon}</span></div></div><div className="experiment-card-body"><div><h3 className="exp-v2-title">{first} <em>{second}</em></h3><p className="exp-v2-desc">{desc}</p></div><div className="exp-v2-footer"><button className="exp-v2-btn" type="button" onClick={onOpen || undefined}>{action} <span className="pill-arrow">→</span></button><span className="exp-v2-rating">{rating}</span></div></div></article>)}</div><button className="carousel-nav right" type="button" onClick={() => setExperimentStart(index => Math.min(lastExperimentStart, index + 1))} disabled={experimentStart === lastExperimentStart} aria-label="Show next experiments">❯</button></div></div></div>;
}

function StoriesPanel() {
  const [playing, setPlaying] = useState(null);
  const [storyStart, setStoryStart] = useState(0);
  const stories = [
    ["fy7eoMef3e8", "DOCUMENTARY", "5:21", "Shadows", "and Light Explained", "by Platform Studio", "2.2M views", "Dive deep into the magical interplay between light sources and opaque objects. A beautifully animated introduction to optics."],
    ["4vUozykivNA", "EXPLORE", "3:36", "The Science", "of Shadows", "by Edtech Lab", "1.8M views", "Learn how different light angles and intensities stretch and morph shadows, uncovering geometric visual perception."],
    ["cDaWohR_DVo", "LESSON", "3:58", "How Do We", "See Things?", "by Visual Science", "3.1M views", "An engaging visual breakthrough exploring reflection, the human eye, and biological light vision mechanics."],
    ["fvKpqIS9k9Y", "SCIENCE LAB", "10:30", "Characteristics", "of Light", "by Physics Team", "950K views", "A comprehensive breakdown of core light properties, straight-line propagation, speeds, beams, and rays."],
  ];
  const lastStoryStart = Math.max(0, stories.length - 3);
  const visibleStories = stories.slice(storyStart, storyStart + 3);
  if (playing) return <div className="sol-tab-panel active"><div style={{ padding: "24px", width: "100%" }}><button className="sol-nav-btn" type="button" onClick={() => setPlaying(null)}>← Back to Stories</button><iframe title="Story video" src={playing} style={{ width: "100%", height: "min(65dvh, 640px)", marginTop: "18px", border: 0, borderRadius: "20px" }} allow="autoplay; fullscreen" /></div></div>;
  return <div className="sol-tab-panel active"><div className="story-section-header"><div className="story-header-badge"><span className="badge-dot" /> 🎬 VISUAL STORIES &amp; DOCUMENTARIES</div><h2 className="stories-carousel-title">Interactive Science Video Stories</h2><p className="story-header-desc">Animated optical narratives, documentary visualizers, and historical science lessons.</p></div><div className="carousel-wrapper"><button className="carousel-nav left" type="button" onClick={() => setStoryStart(index => Math.max(0, index - 1))} disabled={storyStart === 0} aria-label="Show previous stories">❮</button><div className="stories-carousel">{visibleStories.map(([id, badge, duration, first, second, author, views, desc]) => <article className="story-card" key={id} onClick={() => setPlaying(`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`)}><div className="story-card-stage"><div className="story-thumb-fallback" aria-hidden="true">🎬</div><img className="story-thumb-img" src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt={`${first} ${second}`} onError={event => { event.currentTarget.style.display = "none"; }} /><div className="story-stage-overlay" /><span className="story-badge-pill">{badge}</span><span className="story-duration-pill">⏱ {duration}</span><div className="story-play-glass"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></div></div><div className="story-card-body"><div><h3 className="story-card-title">{first} <em>{second}</em></h3><div className="story-meta-row"><span className="story-author-name">{author}</span><span className="story-views-tag">{views}</span></div><p className="story-card-desc">{desc}</p></div><div className="story-card-footer"><button className="exp-v2-btn" type="button">Watch Story <span className="pill-arrow">→</span></button><span className="exp-v2-rating">⭐ 4.9</span></div></div></article>)}</div><button className="carousel-nav right" type="button" onClick={() => setStoryStart(index => Math.min(lastStoryStart, index + 1))} disabled={storyStart === lastStoryStart} aria-label="Show next stories">❯</button></div></div>;
}

function SimplePanel({ type }) {
  const navigate = useNavigate();
  if (type === "quiz") return <div className="sol-tab-panel active"><div className="sol-unlocked-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><div className="glass-panel-card" style={{ padding: "50px 80px", display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "24px", position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", inset: "-50%", background: "radial-gradient(circle at center, rgba(34,211,238,0.15) 0%, transparent 50%)", pointerEvents: "none" }} /><div style={{ zIndex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}><div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(34,211,238,0.1), rgba(59,130,246,0.1))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px", border: "1px solid rgba(34,211,238,0.3)", boxShadow: "0 0 30px rgba(34,211,238,0.2)", fontSize: "3.5rem" }}>📝</div><h3 className="sol-unlocked-title" style={{ fontSize: "2.2rem", fontWeight: 700, marginBottom: "12px", color: "var(--text-primary)", letterSpacing: "0.5px" }}>Interactive Quiz</h3><p className="sol-unlocked-desc" style={{ color: "var(--text-muted)", marginBottom: "30px", fontSize: "1.15rem" }}>Test your mastery on Light and Shadows.</p><div style={{ display: "flex", gap: "16px", marginBottom: "40px", flexWrap: "wrap", justifyContent: "center" }}><span className="glass-mini" style={{ padding: "8px 16px", color: "#cbd5e1" }}>☷ 10 Questions</span><span className="glass-mini" style={{ padding: "8px 16px", color: "#cbd5e1" }}>◷ 15 Mins</span><span className="glass-mini" style={{ padding: "8px 16px", color: "#cbd5e1" }}>★ +50 XP</span></div><button className="sol-start-btn" type="button" onClick={() => navigate("/quiz")} aria-label="Start Quiz">Start Quiz <span style={{ marginLeft: "8px" }}>→</span></button></div></div></div></div>;
  return <div className="sol-tab-panel active"><div className="sol-locked-panel"><div className="sol-lock-icon">🥽</div><h3 className="sol-locked-title">Content Locked</h3><p className="sol-locked-desc">Complete the Experience and Experiments to unlock this section.</p></div></div>;
}

export default function ChapterDetailView() {
  const [activeTab, setActiveTab] = useState("experience");
  const navigate = useNavigate();
  const content = activeTab === "experience" ? <ExperiencePanel /> : activeTab === "experiments" ? <ExperimentsPanel /> : activeTab === "stories" ? <StoriesPanel /> : <SimplePanel type={activeTab} />;
  return <div className="study-island-app"><TopControls /><section className="screen active" style={{ backgroundImage: `url("${chapterBackground}")` }}><div className="bg-overlay dark-overlay" /><div className="screen-content chapter-detail-content">
    <div className="solar-chapter-header"><div className="solar-chapter-accent-line" /><h2 className="solar-chapter-title">LIGHT AND SHADOWS</h2></div>
    <div className="chapter-main-panel glass-panel-card"><div className="chapter-tab-nav" role="tablist" aria-label="Chapter sections">{tabs.map(([id, label, Icon]) => <button key={id} className={`sol-tab ${activeTab === id ? "active-tab" : ""}`} type="button" onClick={() => setActiveTab(id)} role="tab" aria-selected={activeTab === id}><Icon className="sol-tab-solo-icon" /><span className="sol-tab-label">{label}</span></button>)}</div><div className="tab-panels-area">{content}</div></div>
    <div className="sol-bottom-nav-row"><button className="sol-nav-btn" type="button" onClick={() => { if (window.history.state && window.history.state.idx > 0) { navigate(-1); } else { navigate("/?screen=chapters"); } }}>← Back</button><button className="sol-nav-btn" type="button" onClick={() => navigate("/")}>⌂ Home</button></div>
  </div></section><SmartboardOverlay /><AITutorWidget /></div>;
}
