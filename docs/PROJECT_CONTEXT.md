# EdTech Island — Project Context & Architecture Overview

> **GOVERNANCE NOTICE:** Before editing any code, always consult [`EDTECH_ISLAND_AI_ENGINEERING_CONSTITUTION.md`](./EDTECH_ISLAND_AI_ENGINEERING_CONSTITUTION.md) and [`AGENTS.md`](./AGENTS.md).

---

## 1. Platform Summary

**EdTech Island** is an immersive, multi-tenant K-12 STEM learning ecosystem that blends 3D virtual experiments, gamified interactive chapters, adaptive assessments, teacher/admin management dashboards, and a multimodal AI tutor (**Aria**) powered by the Google Gemini API.

### Core Architectural Axiom:
```text
Raw Learner Action
       ↓
Activity Telemetry (Immutable Layer 1)
       ↓
Curriculum / Learning Objective Evidence (Layer 2 & 3)
       ↓
Performance Metrics & Mastery Profiles
       ↓
Teacher / Admin Dashboard Interpretation
       ↓
Gemini AI Remediation
```

---

## 2. Technology Stack & Infrastructure

- **Backend / Web Server:** Node.js Express server (`server.js`) running on port `3000`.
- **Real-Time Communication:** Native WebSocket server for presence, telemetry, and live sessions.
- **Frontend Architecture:**
  - **Study Island:** React 18 + Tailwind CSS + Three.js application shell (`study-island/src/`), bundling with Vite into `dist-react/` and served at `/study-island/`. Standalone HTML experiences (`Chapter_experience_L_S.html`, `Shadow_Lab.html`, `quiz.html`) are embedded via `LegacyHtmlView.jsx`.
  - **Student Portal:** React 18 / Vite app at `/student/`.
  - **Teacher Portal:** React 18 / Vite app at `/teacher/`.
  - **Admin Portal:** React 18 / Vite app at `/admin/`.
  - **SuperAdmin Hub:** React 18 / Vite app at `/superadmin/`.
- **Database & Auth:** Supabase / PostgreSQL 15 with pgvector / HNSW embeddings and Row Level Security (RLS).
- **Object Storage:** Cloudflare R2 (for 3D models, assets, labs, and media).
- **AI Model:** Google Gemini API (`gemini-3.5-flash` multimodal primary / `gemini-3.5-flash-lite` background memory) with native vision (screen-capture analysis), audio, and sub-second token streaming capabilities.

---

## 3. Active Portals & Live Endpoints

When the server is running (`node server.js` on port 3000):

| Portal | URL Path | Description |
| :--- | :--- | :--- |
| **Study Island** | `http://localhost:3000/study-island/` | Interactive student learning hub (Chapters, 3D Labs, Quizzes) |
| **Student Portal** | `http://localhost:3000/student/` | Student dashboard, courses, and progress tracking |
| **Teacher Portal** | `http://localhost:3000/teacher/` | Class management, assignment creator, timetable, analytics |
| **Admin Portal** | `http://localhost:3000/admin/` | Institutional management, teacher allocation, student rosters |
| **SuperAdmin Hub** | `http://localhost:3000/superadmin/` | Multi-tenant platform management, global configs |

---

## 4. Key Subsystems & Architecture Details

### A. Study Island & Standalone Experiences
- **Entry Points:** `study-island/index.html` mounts React root (`study-island/src/main.jsx`).
- **Routing:** `study-island/src/App.jsx` handles hash-based navigation:
  - `#/\` → `StudyIslandView`
  - `#/chapter/:chapterId` → `UniversalChapterView`
  - `#/experience` & `#/experience/light-shadows` → `<LegacyHtmlView file="Chapter_experience_L_S.html" />`
  - `#/lab` → `<LegacyHtmlView file="Shadow_Lab.html" />`
  - `#/quiz` → `<LegacyHtmlView file="quiz.html" />`
- **Single Bot Guarantee:** Standalone experience pages and `LegacyHtmlView` do **not** render their own bot. A single global `<AITutorWidget />` is mounted in `App.jsx`. Iframe guard checks prevent nested instances:
  `if (typeof window !== "undefined" && window.self !== window.top) return null;`

### B. Aria AI Bot (Multimodal & Context-Aware)
- **Hooks & Implementation:**
  - `src/hooks/useGeminiChat.js`: Core Gemini chat hook. Deeply inspects top-level route hashes and queries embedded `iframe.contentDocument` to identify active chapter (`11.1 SOURCES OF LIGHT`), active subtopics, and current explanation text.
  - `src/hooks/useScreenCapture.js`: Screen vision capture hook for high-resolution visual analysis when user enables the eye icon.
  - `src/hooks/useAriaSession.js`: LocalStorage conversation & context session persistence.
  - `src/hooks/useVoiceIO.js`: Web Speech API & TTS audio input/output.
- **Bot Widget:** `src/components/AITutorWidget.jsx` + `AITutorDrawer.jsx` + `AITutorWidget.css`.

### C. Build and Sync Pipeline
- **Study Island Build:**
  `npm run build:study-island`
  Runs Vite build from `study-island/` to `study-island/dist-react/` and copies bundle assets to `study-island/assets/` and `study-island/index.html`.
- **Student Portal Build:**
  `npm run build:student`
- **Root Dev Server:**
  `node server.js` (serves static files, uploads, and WebSocket).

---

## 5. Non-Negotiable Engineering Invariants

1. **Strict Git Push Policy:** NEVER run `git push` automatically. Only push when explicitly commanded by the user.
2. **Ponytail Discipline:** Use existing components, Web APIs, and native capabilities before adding any libraries or dependencies.
3. **No Unsolicited Rewrites:** Keep existing working code, interfaces, and file paths intact.
4. **Rule 0.1 (Do Not Guess):** Never invent API routes, schema columns, or mock behavior without verification.
5. **Verification Before Completion:** Always verify builds and endpoint availability before marking tasks complete.
