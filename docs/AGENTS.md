# EdTech Island — Project Guidelines & Governance

> **PRIMARY GOVERNANCE:** All agents must read and strictly obey [`EDTECH_ISLAND_AI_ENGINEERING_CONSTITUTION.md`](./EDTECH_ISLAND_AI_ENGINEERING_CONSTITUTION.md) and [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md).

## 🚫 Git Push Policy (STRICT & PERMANENT)
- **NEVER** run `git push` or push changes to GitHub or any remote repository automatically.
- **ONLY** run `git push` if the user explicitly instructs you to push with a direct command (e.g., *"push to github"*, *"git push"*, *"push changes"*).
- All changes must remain local (building, testing, local server running, and optional local commits) until explicit user permission is granted.

## 🛠️ Ponytail Coding Discipline & Engineering Standards
- **Zero-waste architecture:** Do not invent new packages, utilities, or abstractions when standard browser APIs (`BroadcastChannel`, `ResizeObserver`, standard Web APIs) or existing helpers exist.
- **Understand & Inspect First:** Read surrounding implementation and find callers before making any edits.
- **Minimal Reversible Change:** Make the smallest, cleanest change that solves the issue without touching unrelated files.
- **No Unsolicited Architecture Refactors:** Never migrate frameworks, rewrite working legacy code, or restructure folders without explicit authorization.

## 🔒 Platform Invariants & Rules
- **Rule 0.1 — DO NOT GUESS:** Never invent files, database tables, API routes, or analytics formulas. If unverified, stop and ask.
- **Live Web Verification Rule (Never Rely on Outdated Training Memory):** When dealing with evolving specifications, API key formats, model endpoints/names, external SDKs, shortcuts, or framework features, ALWAYS perform a live web search or documentation check before making assertions, diagnosing errors, or writing code. Never assume legacy constraints (such as old key prefix assumptions or deprecated model tags) apply without live verification.
- **Single AI Bot Singleton:** Maintain strictly one Aria AI widget per page session with deep `iframe` / route inspection (`getScreenContent()`).
- **Evidence & Analytics Pipeline:** Historical telemetry is immutable; never mutate raw analytics events or change versioned mastery formulas without explicit approval.
- **Verification Gate:** Always verify builds (`npm run build:study-island`, `npm run build:student`) and live endpoints before reporting completion. Never claim success without verification.
- **Mandatory Post-Task Independent Audit Gate (STRICT & PERMANENT):** Whenever any task, feature, bug fix, or refactor is completed, ALWAYS invoke a dedicated audit agent in the end to independently inspect modified files, execute verification commands/builds, check for regressions, verify mathematical integrity, and confirm everything is functioning perfectly and correctly before signing off.

## 🕵️‍♂️ Post-Task Audit Protocol
Every task completion MUST end with spawning/running an independent Audit Agent:
1. Review all modified and newly created files for defects, syntax errors, scale discrepancies, or unhandled edge cases.
2. Run build verification across affected workspaces (`cmd /c npm run build`).
3. Verify live DB schema, RLS policies, and telemetry payloads against expected contracts.
4. Provide an objective, unvarnished audit verdict (PASS / FAIL) before final sign-off.
