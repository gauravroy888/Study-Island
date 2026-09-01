/**
 * useAriaSession.js
 * Persists Aria context across portals (Student Portal <-> Study Island)
 * and across days (daily rollover with yesterday summary).
 *
 * localStorage keys (accessible on same host, cross-page):
 *   aria_session   -> today { date, topics, summary, messageCount }
 *   aria_yesterday -> { date, summary }
 */

const SESSION_KEY   = "aria_session";
const YESTERDAY_KEY = "aria_yesterday";
const MODEL         = "gemini-3.6-flash";

function getApiKey() {
  return localStorage.getItem("aria_gemini_key") || (typeof window !== "undefined" ? window.ARIA_GEMINI_KEY : "") || "";
}

function todayStr() { return new Date().toLocaleDateString("en-CA"); }

function rollover() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.date && s.date !== todayStr()) {
      if (s.summary || (s.topics && s.topics.length)) {
        localStorage.setItem(YESTERDAY_KEY, JSON.stringify({
          date: s.date,
          summary: s.summary || ("Studied: " + (s.topics || []).join(", ")),
        }));
      }
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {}
}

export function getSession() {
  rollover();
  try { const r = localStorage.getItem(SESSION_KEY); if (r) return JSON.parse(r); } catch {}
  const fresh = { date: todayStr(), topics: [], summary: "", messageCount: 0 };
  localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
  return fresh;
}

export function patchSession(updates) {
  const next = { ...getSession(), ...updates };
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return next;
}

export function trackTopic(topic) {
  if (!topic || topic.length < 2) return;
  const s = getSession();
  const topics = s.topics || [];
  if (!topics.includes(topic)) patchSession({ topics: [...topics, topic] });
}

export function incrementMessages() {
  const s = getSession(); patchSession({ messageCount: (s.messageCount || 0) + 1 });
}

export function getYesterdaySummary() {
  try { const r = localStorage.getItem(YESTERDAY_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

export function buildSessionContext() {
  const s    = getSession();
  const yest = getYesterdaySummary();
  const parts = [];
  if (s.summary)                    parts.push(`Today so far: ${s.summary}`);
  else if (s.topics && s.topics.length) parts.push(`Topics today: ${s.topics.join(", ")}.`);
  if (yest?.summary)                parts.push(`Yesterday (${yest.date}): ${yest.summary}`);
  return parts.join(" ");
}

export async function refreshSessionSummary(messages) {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === "YOUR_KEY_HERE" || !messages || messages.length < 4) return;
  const convo = messages
    .filter(m => m.text && !m.text.startsWith("⚠️") && m.text.length > 3)
    .slice(-12)
    .map(m => `${m.role === "user" ? "Student" : "Aria"}: ${m.text}`)
    .join("\n");
  if (!convo) return;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role:"user", parts:[{ text:
            `Summarize in 1-2 sentences what this student studied and asked about. Plain text only.\n\n${convo}`
          }]}],
          generationConfig: { maxOutputTokens: 70, temperature: 0.2 },
        }),
      }
    );
    const d = await res.json();
    const summary = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (summary) patchSession({ summary });
  } catch {}
}
