# EdTech Island — Dependency Consistency & Compatibility Report

This document records the dependency matrix, version boundaries, and runtime compatibility across all platform subsystems.

---

## 1. Subsystem Dependency Matrix

| Subsystem | Runtime / Framework | React Version | Vite Version | Key Dependencies | Role |
|---|---|---|---|---|---|
| **Root Server** | Node.js CommonJS | N/A | N/A | `@aws-sdk/client-s3 ^3.1110.0`, `@supabase/supabase-js ^2.116.0`, `ws ^8.21.3`, `dotenv ^17.4.2` | Static server, R2 uploads, AI proxy, WebSocket engine |
| **Study Island** | React SPA | **18.2.0** | **5.0.0** | `three ^0.160.0`, `react-router-dom ^7.6.3`, `lucide-react ^0.263.1` | 3D Interactive Science Learning Island & Quiz Engine |
| **Student Portal** | React SPA | **19.2.6** | **8.0.12** | `@supabase/supabase-js ^2.108.2`, `recharts ^3.8.1`, `lucide-react ^1.17.0`, `react-router-dom ^7.16.0` | Student dashboard, 7-dimension progress radar, courses, timetable |
| **Teacher Portal** | React SPA | **19.2.6** | **8.0.12** | `@supabase/supabase-js ^2.108.2`, `recharts ^3.8.1`, `lucide-react ^1.17.0`, `react-router-dom ^7.17.0` | Teacher dashboard, LO heatmap, student intervention alert drawer |
| **Admin Portal** | React SPA | **19.2.6** | **8.0.12** | `@supabase/supabase-js ^2.108.2`, `recharts ^3.8.1`, `lucide-react ^1.17.0`, `react-router-dom ^7.17.0` | School admin console, teachers, timetable scheduling |
| **SuperAdmin Portal** | React SPA | **19.2.8** | **8.2.2** | `@supabase/supabase-js ^2.112.4`, `@phosphor-icons/react ^2.1.10`, `tailwindcss ^4.3.3` | System telemetry, tenant management, audit event stream |
| **Shared Source** | ES Module | N/A | N/A | Peer-imported by portals | Theme presets, Supabase client, shared components and services |

---

## 2. Intentional Version Boundaries & Rationale

### A. React 18 vs React 19 Boundary
- **`study-island/` uses React 18.2.0**:
  - `study-island` deeply integrates Three.js 0.160.0, custom WebGL canvas lifecycles, and legacy canvas animations.
  - Three.js integration libraries and animation loops depend on React 18 render timing and fiber reconciler invariants.
  - **Governance Rule**: Per the Constitution and Ponytail discipline, do **NOT** attempt a premature migration of `study-island` to React 19 until Three.js bindings and shaders are formally verified in an isolated prototype branch.
- **Portals (`student`, `teacher`, `admin`, `superadmin`) use React 19**:
  - The 4 administrative and student management portals run cleanly on React 19 without third-party 3D engine dependencies.
  - They operate as independent SPAs with independent `node_modules` and lockfiles.

### B. Vite 5 vs Vite 8 Boundary
- `study-island` uses Vite 5.0.0 (`@vitejs/plugin-react ^4.2.1`).
- Portals use modern Vite 8 with native Rolldown bundler backend.
- Both build pipelines are self-contained and run cleanly in CI (`npm run build:all`).

### C. Icon Library Coexistence
- `lucide-react` is used across `student`, `teacher`, `admin`, and `study-island`.
- `@phosphor-icons/react` is used in `superadmin` matching its cyber-industrial control plane aesthetic.
- Both are chunked into vendor bundles (`vendor-icons`) preventing bundle bloat.

---

## 3. Maintenance & Safe Upgrade Guidelines

1. **Do Not Hoist Dependencies Globally**:
   - Each portal maintains its own `package.json` and `node_modules`. Do not hoist React or Vite to root `package.json` as it would create cross-version collisions between React 18 and React 19.
2. **Preserve CommonJS in `server.js`**:
   - `server.js` and `server/*` use standard Node.js CommonJS (`require` / `module.exports`) ensuring zero-transpilation production runtime compatibility with Node 18, 20, and 22.
3. **Continuous Secret & Integrity Scans**:
   - Standalone `scripts/scan-secrets.js` runs across all subdirectories and lockfiles on every CI run.
