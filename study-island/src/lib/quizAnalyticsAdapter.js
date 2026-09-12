/**
 * QuizAnalyticsAdapter
 * ─────────────────────────────────────────────────────────────────────────
 * QUIZ ENGINE → ANALYTICS ENGINE bridge.
 *
 * This adapter is the ONLY approved bridge between Quiz domain and Analytics
 * domain. It mirrors the architecture of Gaurav-Handover's quizAnalyticsAdapter.js.
 *
 * ARCHITECTURAL RULES:
 * - QuizView.jsx imports ONLY this adapter (not analytics-sdk directly)
 * - This adapter imports EduSDK from analytics-sdk
 * - Analytics services MUST NOT import this adapter
 * - If analytics is unavailable, quiz should continue normally
 */

import EduSDK from './analytics-sdk.js';

const QuizAnalyticsAdapter = {
  /**
   * Start a quiz analytics session.
   * Called by: QuizView.startGame()
   */
  startSession({ chapterId, totalQuestions, isChallengeMode, student, isImprovementMode = false, originalAttemptData = null }) {
    try {
      EduSDK.start({
        activity_id: chapterId || 'SCI6-CH10',
        activity_type: 'chapter_quiz',
        total_questions: totalQuestions,
        is_challenge_mode: Boolean(isChallengeMode),
        student_id: student?.id ?? null,
        student_email: student?.email ?? null,
        student_name: student?.name ?? null,
        is_improvement_mode: Boolean(isImprovementMode),
        original_attempt_data: originalAttemptData ?? null
      });
    } catch (err) {
      console.warn('[QuizAnalyticsAdapter] startSession failed (non-critical):', err);
    }
  },

  /**
   * Record a student answer checkpoint.
   * Called by: QuizView.handleSelectOption()
   */
  recordAnswer({ question, isCorrect, hintUsed, responseTimeMs }) {
    try {
      EduSDK.checkpoint({
        question_id: question.id,
        lo_id: question.lo_id,
        lo_title: question.lo_title,
        bloom_level: question.bloom_level || 'apply',
        difficulty: question.difficulty || 'medium',
        correct: Boolean(isCorrect),
        hint_used: Boolean(hintUsed),
        retry_count: 0,
        response_time_ms: Number(responseTimeMs) || 0
      });
    } catch (err) {
      console.warn('[QuizAnalyticsAdapter] recordAnswer failed (non-critical):', err);
    }
  },

  /**
   * Re-record a checkpoint with hint flag updated.
   * Called by: QuizView.handleTriggerHint() when answer was already selected.
   */
  updateAnswerWithHint({ question, isCorrect, responseTimeMs }) {
    try {
      EduSDK.checkpoint({
        question_id: question.id,
        lo_id: question.lo_id,
        lo_title: question.lo_title,
        bloom_level: question.bloom_level || 'apply',
        difficulty: question.difficulty || 'medium',
        correct: Boolean(isCorrect),
        hint_used: true,
        retry_count: 0,
        response_time_ms: Number(responseTimeMs) || 0
      });
    } catch (err) {
      console.warn('[QuizAnalyticsAdapter] updateAnswerWithHint failed (non-critical):', err);
    }
  },

  /**
   * Fill fallback (skipped) checkpoints for unanswered questions.
   * Called by: QuizView.confirmSubmit()
   */
  fillSkippedCheckpoints({ sections, answers, hintUsed }) {
    try {
      const existingCheckpoints = new Set(
        (EduSDK.getCurrentSession()?.checkpoints || []).map(c => String(c.question_id))
      );
      sections.forEach(sec => {
        sec.questions.forEach(q => {
          if (!existingCheckpoints.has(String(q.id))) {
            EduSDK.checkpoint({
              question_id: q.id,
              lo_id: q.lo_id,
              lo_title: q.lo_title,
              bloom_level: q.bloom_level || 'apply',
              difficulty: q.difficulty || 'medium',
              correct: false,
              hint_used: Boolean((hintUsed || {})[q.id]),
              retry_count: 0,
              response_time_ms: 0
            });
          }
        });
      });
    } catch (err) {
      console.warn('[QuizAnalyticsAdapter] fillSkippedCheckpoints failed (non-critical):', err);
    }
  },

  /**
   * Complete quiz session and receive analytics summary.
   * Called by: QuizView.confirmSubmit()
   * @returns {Object} frozen analytics summary
   */
  completeSession({ scorePct, totalQuestions, correctCount, timeSpentMs }) {
    try {
      return EduSDK.complete({
        score_pct: scorePct,
        questions_total: totalQuestions,
        questions_correct: correctCount,
        time_spent_ms: timeSpentMs
      });
    } catch (err) {
      console.warn('[QuizAnalyticsAdapter] completeSession failed:', err);
      // Return minimal summary so UI does not crash
      return {
        score_pct: scorePct,
        mastery_score: scorePct,
        fluency_score: 0,
        questions_total: totalQuestions,
        questions_correct: correctCount,
        state: 'completed',
        calculation_trace: null
      };
    }
  },

  /**
   * Abandon the quiz session.
   * Called by: QuizView.confirmExit()
   */
  abandonSession({ reason = 'user_exit_modal' } = {}) {
    try {
      EduSDK.abandon({ reason });
    } catch (err) {
      console.warn('[QuizAnalyticsAdapter] abandonSession failed (non-critical):', err);
    }
  }
};

export default QuizAnalyticsAdapter;
