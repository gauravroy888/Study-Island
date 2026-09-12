# Mandatory Post-Task Independent Audit Gate

1. **Always invoke an independent Audit Agent upon task completion:**
   Whenever any task, feature, bug fix, or refactor is completed, you MUST NEVER conclude the turn or report completion based solely on internal self-assessment.
2. **Dedicated Audit Subagent:**
   Spawn an independent QA & Verification subagent to audit all changes:
   - Review code modifications and newly created files for bugs, scale mismatches (e.g. 0.0-1.0 vs 0-100), syntax errors, or regressions.
   - Run compilation and build verification across all affected workspaces (`cmd /c npm run build`).
   - Validate live database schemas, Supabase migrations, RLS security policies, and payload contracts.
3. **Audit Verdict Required:**
   Only declare the task completed after the audit agent issues an unvarnished PASS verdict with verified proof.
