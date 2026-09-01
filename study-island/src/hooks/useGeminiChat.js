import { useState, useCallback, useRef } from "react";
import {
  buildSessionContext, trackTopic, incrementMessages,
  refreshSessionSummary
} from "./useAriaSession";
import { screenCapture } from "./useScreenCapture";

const MODEL = "gemini-3.5-flash-lite";

function getApiKey() {
  return localStorage.getItem("aria_gemini_key")
      || (typeof window !== "undefined" ? window.ARIA_GEMINI_KEY : "")
      || (import.meta.env?.VITE_GEMINI_API_KEY || "")
      || "";
}

const MAX_HISTORY = 8;
const SUMMARY_EVERY = 5;

/* ── Deep, fast context extraction of exact active view & 3D island state ── */
function getDetailedScreenContext() {
  try {
    const parts = [];
    const path = window.location.pathname;
    const hash = window.location.hash;
    const title = document.title || "Study Island";

    // 1. Identify Portal & Active Navigation Route
    if (path.includes('/student')) {
      parts.push(`Platform: Student Portal (Delhi Public School)`);
      if (path.includes('/dashboard')) parts.push(`Current Screen/Option: Dashboard (Overview, Assigned Courses, XP, Active Modules)`);
      else if (path.includes('/courses')) parts.push(`Current Screen/Option: Courses Catalog (Physics, Biology, Chemistry, Custom Modules)`);
      else if (path.includes('/timetable')) parts.push(`Current Screen/Option: Timetable & Class Schedule`);
      else if (path.includes('/tests')) parts.push(`Current Screen/Option: Online Classes & Assessment Tests`);
      else if (path.includes('/chats')) parts.push(`Current Screen/Option: Messages & Teacher Q&A`);
      else if (path.includes('/teachers')) parts.push(`Current Screen/Option: Faculty & Teachers Directory`);
      else if (path.includes('/analytics')) parts.push(`Current Screen/Option: Academic Analytics & Mastery Reports`);
      else if (path.includes('/settings')) parts.push(`Current Screen/Option: Profile & App Settings`);
      else parts.push(`Current Screen: Student Deck (${path})`);
    } else if (path.includes('/study-island') || title.includes('Study Island') || title.includes('EdTech Island')) {
      parts.push(`Platform: EdTech Island (3D Immersive Simulation World)`);
      if (hash.includes('/chapter/')) parts.push(`Current Screen/Option: Chapter Deep Dive (${hash.replace('#/chapter/', '')})`);
      else if (hash.includes('/experience') || path.includes('/experience')) parts.push(`Current Screen/Option: 3D Interactive Physics Simulation (Light, Shadows & Optics)`);
      else if (hash.includes('/lab') || path.includes('Shadow_Lab')) parts.push(`Current Screen/Option: Virtual 3D Optics Lab`);
      else if (hash.includes('/quiz') || path.includes('quiz.html')) parts.push(`Current Screen/Option: Chapter Quiz & Assessment`);
      else parts.push(`Current Screen/Option: 3D Island Main World Exploration`);
    }

    // 2. Active Tab from Sidebar/Navbar
    const activeNav = document.querySelector('nav a.active, .nav-item.active, button.active, .tab-btn.active, [aria-current="page"]');
    if (activeNav?.textContent?.trim()) {
      parts.push(`Selected Menu Item: "${activeNav.textContent.trim().replace(/\s+/g, ' ')}"`);
    }

    // 3. Active Learning Module / Highlighted Card
    const activeModule = document.querySelector('[class*="ActiveLearning"], [class*="activeModule"], [class*="active-module"]');
    if (activeModule) {
      const modText = activeModule.textContent.replace(/\s+/g, ' ').trim().slice(0, 140);
      parts.push(`Active Learning Module: "${modText}"`);
    }

    // 4. Content Counts & Visible Items
    const contentCards = Array.from(document.querySelectorAll('.course-card, .chapter-card, .experiment-card, .story-card, article, [class*="CourseCard"], [class*="Card"]'));
    if (contentCards.length > 0) {
      const titles = contentCards.slice(0, 6).map(c => c.querySelector('h3, h4, .title, strong, em')?.textContent?.trim()).filter(Boolean);
      parts.push(`Visible Content Count: ${contentCards.length} items/cards on screen${titles.length ? ` (including: ${titles.join(', ')})` : ''}`);
    }

    // 5. On-Screen Headings & Topic Context
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, [class*="title"], [class*="card-title"]'))
      .map(el => el.textContent.replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 3 && t.length < 80 && !parts.some(p => p.includes(t)))
      .slice(0, 4);
    if (headings.length) {
      parts.push(`Visible Topics: ${headings.join(' | ')}`);
    }

    // 5. Deep Iframe Inspection (for 3D Labs & Legacy HTML Experiences)
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          const frameTitle = doc.title || iframe.title || '';
          const frameH = doc.querySelector('h1, h2, .topic-title, .chapter-title, #topicName, .active')?.textContent?.trim();
          const frameActive = doc.querySelector('.active, [class*="current"], [class*="selected"]')?.textContent?.trim();
          const simInfo = [frameTitle, frameH, frameActive].filter(Boolean).join(' - ');
          if (simInfo) {
            parts.push(`Active 3D Simulation State: ${simInfo.slice(0, 160)}`);
            break;
          }
        }
      } catch (e) {
        if (iframe.title || iframe.src) {
          parts.push(`Embedded 3D Simulation: "${iframe.title || iframe.src}"`);
        }
      }
    }

    // 6. Active Quiz Question (if on quiz view)
    const quizQuestion = document.querySelector('.quiz-question, .question-text, [class*="questionText"], [id*="question"]');
    if (quizQuestion?.textContent?.trim()) {
      parts.push(`Active Quiz Question: "${quizQuestion.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)}"`);
    }

    return parts.join('\n');
  } catch (e) {
    return `Page: "${document.title}" (${window.location.pathname})`;
  }
}

/* ── Student info ── */
function getStudentInfo() {
  try {
    const u = JSON.parse(localStorage.getItem("edtech_user") || "{}");
    const b = JSON.parse(localStorage.getItem("edtech_school_branding") || "{}");
    return { name: u.name || "Student", cls: u.class_name || "Class 6", school: b.school_name || "EdTech Island" };
  } catch { return { name: "Student", cls: "Class 6", school: "EdTech Island" }; }
}

/* ── Parse SSE line ── */
function parseSSE(line) {
  if (!line.startsWith("data: ")) return "";
  const j = line.slice(6).trim();
  if (!j || j === "[DONE]") return "";
  try { return JSON.parse(j)?.candidates?.[0]?.content?.parts?.[0]?.text || ""; }
  catch { return ""; }
}

let _id = 0;

export default function useGeminiChat() {
  const [messages,  setMessages ] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError    ] = useState(null);
  const historyRef = useRef([]);
  const msgCountRef = useRef(0);

  const sendMessage = useCallback(async (userText, screenshotBase64 = null, audioPayload = null) => {
    const text = userText?.trim() || "";
    if (!text && !audioPayload) return null;

    const apiKey = getApiKey();
    if (!apiKey || apiKey === "YOUR_KEY_HERE" || apiKey === "YOUR_GEMINI_API_KEY") {
      const w = "Gemini API key not set. Please provide your Gemini API key.";
      setMessages(prev => [...prev, { role:"user", text: text || "🎤 Spoken question" }, { role:"model", text: w }]);
      return null;
    }

    const autoFrame = screenshotBase64 ?? (screenCapture.isActive() ? screenCapture.capture() : null);
    const screen    = getDetailedScreenContext();
    const displayText = text || "🎤 (Voice question)";

    setMessages(prev => [...prev, { role:"user", text: displayText, hasScreenshot: !!autoFrame }]);
    setIsLoading(true);
    setError(null);

    if (document.title) trackTopic(document.title);
    incrementMessages();

    const userParts = [
      { text: `[CURRENT STUDENT SCREEN CONTEXT]:\n${screen}` },
    ];
    if (text) {
      userParts.push({ text });
    } else {
      userParts.push({ text: "The student asked the following question via microphone audio. Please listen directly to their voice audio and answer Socratically, warmly, and concisely." });
    }
    if (audioPayload?.data) {
      userParts.push({
        inline_data: {
          mime_type: audioPayload.mimeType || "audio/webm",
          data: audioPayload.data
        }
      });
    }
    if (autoFrame) {
      userParts.push({ inline_data: { mime_type: "image/jpeg", data: autoFrame } });
    }

    historyRef.current.push({ role: "user", parts: [{ text: displayText }] });
    if (historyRef.current.length > MAX_HISTORY) historyRef.current = historyRef.current.slice(-MAX_HISTORY);

    const contents = [
      ...historyRef.current.slice(0, -1),
      { role: "user", parts: userParts },
    ];

    const s = getStudentInfo();
    const sess = buildSessionContext();

    const systemText =
`You are Aria, an intelligent Socratic AI tutor for ${s.school}, tutoring ${s.name} (${s.cls}).
${sess ? sess + "\n" : ""}
CRITICAL CONTEXT AWARENESS:
- You receive [CURRENT STUDENT SCREEN CONTEXT] with the student's exact active portal, page, selected menu option, and active learning chapter.
- Always know exactly which section or option the student is looking at (e.g. Dashboard, Courses, Timetable, Light & Shadows module, 3D Study Island).
- If the student asks "where am I?", "what is this?", or mentions an option on screen, reference their exact current option and topic accurately!

RULES:
- Provide intuitive Socratic guidance: Help the student explore concepts.
- NO markdown asterisks (*, **), NO hashtags (#), NO bullet lists. Write in clean spoken conversational sentences.
- Keep replies brief (under 45 words) and end with a guiding thought or encouragement.`;

    const streamId = ++_id;
    setMessages(prev => [...prev, { role:"model", text:"", streaming:true, id:streamId }]);
    setIsLoading(false);

    let accumulated = "";
    try {
      const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const res = await fetch(streamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 100,
            topP: 0.85
          },
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const errDetail = e?.error?.message || `HTTP ${res.status}`;
        if (res.status === 401) {
          throw new Error("Authentication failed (401). Please verify Generative Language API is enabled for this key at https://aistudio.google.com/apikey");
        }
        throw new Error(errDetail);
      }

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          const tok = parseSSE(line);
          if (tok) {
            accumulated += tok;
            setMessages(prev => prev.map(m => m.id === streamId ? { ...m, text: accumulated } : m));
          }
        }
      }

      setMessages(prev => prev.map(m => m.id === streamId ? { ...m, streaming: false } : m));
      if (accumulated) historyRef.current.push({ role:"model", parts:[{ text: accumulated }] });

      msgCountRef.current++;
      if (msgCountRef.current % SUMMARY_EVERY === 0) {
        const allMsgs = [...historyRef.current.map(h => ({ role: h.role, text: h.parts[0].text }))];
        refreshSessionSummary(allMsgs).catch(() => {});
      }

      return accumulated || null;

    } catch (err) {
      const msg = `Could not get a response: ${err.message}`;
      setError(msg);
      setMessages(prev => prev.map(m => m.id === streamId ? { ...m, text: msg, streaming: false } : m));
      return null;
    }
  }, []);

  const clearHistory = useCallback(() => {
    try { localStorage.removeItem("aria_chat_history"); } catch {}
    setMessages([]);
    historyRef.current = [];
    msgCountRef.current = 0;
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearHistory };
}
