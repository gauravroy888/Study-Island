/**
 * useAriaSession.js
 * Persists Aria context across portals (Student Portal <-> Study Island)
 * and across days with Supabase cloud backup and automatic 7-day retention.
 *
 * Storage layers:
 *   1. Supabase table `aria_ai_sessions` (Cloud sync with 7-day retention for authenticated users)
 *   2. localStorage (instant client-side fallback/cache)
 */

import { supabase } from "../supabase.js";

const DEFAULT_SESSION_KEY   = "aria_session";
const DEFAULT_YESTERDAY_KEY = "aria_yesterday";
function todayStr() { return new Date().toLocaleDateString("en-CA"); }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(val) {
  return typeof val === "string" && UUID_REGEX.test(val.trim());
}

let cachedAuthUserId = null;

// Listen for Supabase auth changes to cache verified user ID
if (supabase?.auth?.onAuthStateChange) {
  try {
    supabase.auth.onAuthStateChange((_event, session) => {
      cachedAuthUserId = session?.user?.id && isValidUuid(session.user.id) ? session.user.id : null;
    });
  } catch {
    /* ignore */
  }
}

/**
 * Returns verified authenticated student ID directly from the active Supabase session.
 * STRICT IDENTITY RULE: Never trust mutable localStorage for database ownership or cloud queries.
 */
export async function getVerifiedStudentId() {
  if (!supabase?.auth?.getSession) return null;
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (uid && isValidUuid(uid)) {
      cachedAuthUserId = uid;
      return uid;
    }
  } catch {
    // Ignore auth session retrieval failure
  }
  return null;
}

/**
 * Synchronous student identity resolver for UI display context.
 * Checks cached Supabase user ID first, then Supabase JWT token.
 * NOTE: For database operations, callers MUST use getVerifiedStudentId().
 */
export function getStudentId() {
  if (cachedAuthUserId) return cachedAuthUserId;

  // Inspect Supabase auth storage token synchronously
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
          const raw = window.localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            const uid = parsed?.user?.id || parsed?.currentSession?.user?.id;
            if (uid && isValidUuid(uid)) {
              cachedAuthUserId = uid;
              return uid;
            }
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  // Client-side UI cache fallback (validated against synthetic IDs)
  try {
    const rawStudent = typeof localStorage !== "undefined" ? localStorage.getItem("edtech_student_user") : null;
    if (rawStudent) {
      const u = JSON.parse(rawStudent);
      const testId = u?.id || u?.uid;
      if (testId && typeof testId === "string" && !testId.includes("guest")) return testId;
    }
    const rawUser = typeof localStorage !== "undefined" ? localStorage.getItem("edtech_user") : null;
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const testId = u?.id || u?.uid;
      if (testId && typeof testId === "string" && !testId.includes("guest")) return testId;
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

/**
 * Returns namespaced session key per user for multi-tenant / multi-user isolation on local machine
 */
export function getSessionKey(userId = null) {
  const uid = userId || getStudentId();
  return uid ? `aria_session_${uid}` : DEFAULT_SESSION_KEY;
}

export function getYesterdayKey(userId = null) {
  const uid = userId || getStudentId();
  return uid ? `aria_yesterday_${uid}` : DEFAULT_YESTERDAY_KEY;
}

function rollover(userId = null) {
  const sKey = getSessionKey(userId);
  const yKey = getYesterdayKey(userId);
  try {
    const raw = localStorage.getItem(sKey);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.date && s.date !== todayStr()) {
      if (s.summary || (s.topics && s.topics.length)) {
        localStorage.setItem(yKey, JSON.stringify({
          date: s.date,
          summary: s.summary || ("Studied: " + (s.topics || []).join(", ")),
        }));
      }
      localStorage.removeItem(sKey);
    }
  } catch {
    /* ignore storage error */
  }
}

export function getSession(userId = null) {
  rollover(userId);
  const sKey = getSessionKey(userId);
  try {
    const r = localStorage.getItem(sKey);
    if (r) return JSON.parse(r);
  } catch {
    /* ignore storage error */
  }
  const fresh = { date: todayStr(), topics: [], summary: "", messageCount: 0 };
  try {
    localStorage.setItem(sKey, JSON.stringify(fresh));
  } catch {
    /* ignore storage error */
  }
  return fresh;
}

export function patchSession(updates, userId = null) {
  const next = { ...getSession(userId), ...updates };
  const sKey = getSessionKey(userId);
  try {
    localStorage.setItem(sKey, JSON.stringify(next));
  } catch {
    /* ignore storage error */
  }
  syncToSupabase(next);
  return next;
}

export function trackTopic(topic, userId = null) {
  if (!topic || topic.length < 2) return;
  const s = getSession(userId);
  const topics = s.topics || [];
  if (!topics.includes(topic)) patchSession({ topics: [...topics, topic] }, userId);
}

export function incrementMessages(userId = null) {
  const s = getSession(userId);
  patchSession({ messageCount: (s.messageCount || 0) + 1 }, userId);
}

export function getYesterdaySummary(userId = null) {
  const yKey = getYesterdayKey(userId);
  try {
    const r = localStorage.getItem(yKey);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

export function buildSessionContext(userId = null) {
  const s    = getSession(userId);
  const yest = getYesterdaySummary(userId);
  const parts = [];
  if (s.summary)                    parts.push(`Today so far: ${s.summary}`);
  else if (s.topics && s.topics.length) parts.push(`Topics today: ${s.topics.join(", ")}.`);
  if (yest?.summary)                parts.push(`Yesterday (${yest.date}): ${yest.summary}`);
  return parts.join(" ");
}

/* ── Supabase Cloud Sync & 7-Day Retention Enforcement ── */
async function syncToSupabase(session) {
  // CRITICAL SECURITY: Authenticate student identity directly from Supabase session (auth.uid()).
  // Never trust client-controlled localStorage for database ownership.
  const studentId = await getVerifiedStudentId();
  if (!studentId || !supabase) return; // Fail closed: unauthenticated or guest sessions never write to cloud DB
  try {
    await supabase.from("aria_ai_sessions").upsert({
      student_id: studentId,
      session_date: session.date || todayStr(),
      topics: session.topics || [],
      summary: session.summary || "",
      message_count: session.messageCount || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: "student_id,session_date" });
  } catch (err) {
    console.warn("Supabase session sync:", err.message);
  }
}

/** Pull last 7 days of memory from Supabase on student login/mount and clean expired rows */
export async function loadSupabaseSession() {
  // CRITICAL SECURITY: Strictly uses authenticated student ID from Supabase session
  const studentId = await getVerifiedStudentId();
  if (!studentId || !supabase) return;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Automatic 7-day retention cleanup: purge obsolete sessions older than 7 days
    try {
      await supabase
        .from("aria_ai_sessions")
        .delete()
        .eq("student_id", studentId)
        .lt("session_date", sevenDaysAgo);
    } catch {
      // Non-critical retention purge failure
    }

    const { data, error } = await supabase
      .from("aria_ai_sessions")
      .select("session_date, topics, summary, message_count")
      .eq("student_id", studentId)
      .gte("session_date", sevenDaysAgo)
      .order("session_date", { ascending: false });

    if (error || !data || !data.length) return;

    const today = todayStr();
    const todayRow = data.find(r => r.session_date === today);
    const pastRows  = data.filter(r => r.session_date !== today);

    if (todayRow) {
      const current = getSession(studentId);
      patchSession({
        topics: Array.from(new Set([...(current.topics || []), ...(todayRow.topics || [])])),
        summary: todayRow.summary || current.summary,
        messageCount: Math.max(current.messageCount || 0, todayRow.message_count || 0)
      }, studentId);
    }

    if (pastRows.length > 0) {
      const yestRow = pastRows[0];
      const yKey = getYesterdayKey(studentId);
      try {
        localStorage.setItem(yKey, JSON.stringify({
          date: yestRow.session_date,
          summary: yestRow.summary || ("Studied: " + (yestRow.topics || []).join(", "))
        }));
      } catch {
        /* ignore storage error */
      }
    }
  } catch (err) {
    console.warn("Supabase session load:", err.message);
  }
}

export async function refreshSessionSummary(messages) {
  if (!messages || messages.length < 4) return;
  const convo = messages
    .filter(m => m.text && !m.text.startsWith("⚠️") && m.text.length > 3)
    .slice(-12)
    .map(m => `${m.role === "user" ? "Student" : "Aria"}: ${m.text}`)
    .join("\n");
  if (!convo) return;

  try {
    let token = null;
    if (supabase?.auth?.getSession) {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token || null;
    }

    if (!token) {
      // Unauthenticated state: do not call /api/ai/chat (fails closed without 401 log noise)
      const userQuestions = messages
        .filter(m => m.role === "user" && m.text && !m.text.startsWith("⚠️"))
        .slice(-2)
        .map(m => m.text.replace(/\s+/g, ' ').trim().slice(0, 60));
      if (userQuestions.length > 0) {
        patchSession({ summary: `Explored: ${userQuestions.join('; ')}` });
      }
      return;
    }

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        message: `Summarize in 1-2 sentences what this student studied and asked about. Plain text only.\n\n${convo}`,
        chapter_id: "SCI6-CH10"
      })
    });
    if (!res.ok) return;
    const d = await res.json();
    const summary = d?.text?.trim();
    if (summary) patchSession({ summary });
  } catch { /* ignore summarization failure */ }
}
