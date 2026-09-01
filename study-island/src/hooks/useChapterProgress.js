/**
 * useChapterProgress.js
 * Read and write chapter/modality completion to Supabase.
 * Mirrors the table structure used by the Student Portal (Courses.jsx).
 *
 * Tables used:
 *   chapter_modalities  – rows have { id, chapter_id, modality_type, content_status }
 *   student_progress    – rows have { student_id, modality_id, completed_at, score }
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase.js";

/**
 * Returns { progress, markComplete }
 *
 * progress  – Map<modalityType, { completed, score }>
 * markComplete(modalityType, score?) – upserts a completion row
 */
export default function useChapterProgress({ studentId, chapterId }) {
  const [progress, setProgress] = useState(new Map());

  // ── Fetch existing progress ──────────────────────────────────────────────
  useEffect(() => {
    if (!studentId || !chapterId) return;

    async function fetchProgress() {
      try {
        // 1. Get modality IDs for this chapter
        const { data: modalities, error: modErr } = await supabase
          .from("chapter_modalities")
          .select("id, modality_type")
          .eq("chapter_id", chapterId);

        if (modErr || !modalities?.length) return;

        const modalityIds = modalities.map((m) => m.id);

        // 2. Get student progress rows for those modalities
        const { data: rows, error: progErr } = await supabase
          .from("student_progress")
          .select("modality_id, completed_at, score")
          .eq("student_id", studentId)
          .in("modality_id", modalityIds);

        if (progErr) return;

        // 3. Build Map<modalityType, { completed, score }>
        const progressMap = new Map();
        const completedSet = new Set((rows || []).map((r) => r.modality_id));

        modalities.forEach((m) => {
          const row = (rows || []).find((r) => r.modality_id === m.id);
          progressMap.set(m.modality_type, {
            completed: completedSet.has(m.id),
            score: row?.score ?? null,
            completed_at: row?.completed_at ?? null,
          });
        });

        setProgress(progressMap);
      } catch (err) {
        console.warn("[useChapterProgress] fetch error:", err);
      }
    }

    fetchProgress();
  }, [studentId, chapterId]);

  // ── Write completion ─────────────────────────────────────────────────────
  const markComplete = useCallback(
    async (modalityType, score = null) => {
      if (!studentId || !chapterId) return;

      try {
        // Find the modality row for this chapter + type
        const { data: modalities } = await supabase
          .from("chapter_modalities")
          .select("id")
          .eq("chapter_id", chapterId)
          .eq("modality_type", modalityType)
          .maybeSingle();

        if (!modalities?.id) return;

        // Upsert a completion record
        await supabase.from("student_progress").upsert(
          {
            student_id:  studentId,
            modality_id: modalities.id,
            score:       score,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "student_id,modality_id" }
        );

        // Update local state optimistically
        setProgress((prev) => {
          const next = new Map(prev);
          next.set(modalityType, { completed: true, score, completed_at: new Date().toISOString() });
          return next;
        });
      } catch (err) {
        console.warn("[useChapterProgress] markComplete error:", err);
      }
    },
    [studentId, chapterId]
  );

  return { progress, markComplete };
}
