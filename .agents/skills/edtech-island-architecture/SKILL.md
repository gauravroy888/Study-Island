---
name: edtech-island-architecture
description: Architecture standards, persistent invariants, and design patterns for the EdTech Island platform (Study Island, Portals, Aria AI Bot, and Standalone Experiences).
---

# EdTech Island Architecture & Persistent Invariants

This skill provides permanent guidelines and architectural rules for working on EdTech Island.

## 1. Study Island Architecture
- **Framework:** React 18 + Tailwind CSS application shell (`study-island/src/`).
- **Build Output:** Bundled by Vite into `study-island/dist-react/` and synchronized to `study-island/assets/` via `npm run build:study-island`.
- **Standalone Experience Integration:**
  - Standalone experiences (`Chapter_experience_L_S.html`, `Shadow_Lab.html`, `quiz.html`) are hosted statically in `/study-island/`.
  - Embedded inside React routes via `<LegacyHtmlView file="..." />` in fullscreen iframes.
  - **Never rewrite standalone HTML experiences into React** unless explicitly authorized by the human user.

## 2. Aria AI Bot Invariants
- **Strict Singleton:** Exactly ONE bot instance is rendered per page session.
- **Iframe Isolation:** Bot must never mount inside iframes:
  ```js
  if (typeof window !== "undefined" && window.self !== window.top) return null;
  ```
- **Deep Screen Context Detection:**
  `getScreenContent()` in `src/hooks/useGeminiChat.js` inspects:
  1. Top-level window route & hash (`#/experience`, `#/lab`, `#/quiz`, `#/chapter/:id`).
  2. Active iframe's `contentDocument` to extract active chapter headings (e.g. `11.1 SOURCES OF LIGHT`), active subtopics, and current lesson text.
  3. Vision mode state (tells student to tap eye icon if vision is off and they ask what she sees).

## 3. Evidence & Telemetry Pipeline
- Raw analytics telemetry (`analytics_events`) is immutable.
- Never alter versioned heuristics (`MASTERY_V1`, `FLUENCY_V1`, `INDEPENDENCE_V1`) without explicit human instruction.

## 4. Verification Workflow
After modifying any frontend or hook code:
1. `npm run build:study-island` (if `study-island/` was touched).
2. `npm run build:student` (if `Student portal/` was touched).
3. Verify live endpoints at `http://localhost:3000/`.
