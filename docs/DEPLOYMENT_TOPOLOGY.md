# EdTech Island — Deployment Topology & Runtime Architecture

This document formalizes the deployment topology, runtime execution boundaries, and security barriers between static client hosting and dynamic backend services for the EdTech Island platform.

---

## 1. Architectural Topology Overview

EdTech Island operates a decoupled hybrid architecture:
1. **Static Client Layer (Static Hosting / GitHub Pages / CDN)**: Delivers pre-compiled single-page applications (SPAs), CSS, static curriculum assets, and web components.
2. **Direct Client-to-Database Layer (Supabase PaaS)**: High-speed, row-level security (RLS) guarded REST and Realtime data operations executed directly from the client browser using authenticated JWT sessions.
3. **Dynamic Backend API & Realtime Layer (Node.js Server / Netlify Functions / Container)**: Executes privileged cloud operations, server-side secret mediation, AI model proxies with PII redaction, and WebSocket presence routing.

```
                   ┌─────────────────────────────────────────┐
                   │           Client Web Browser            │
                   │ (Student / Teacher / Admin / SuperAdmin)│
                   └────┬─────────────────┬──────────────┬────┘
                        │                 │              │
           1. Static    │     2. Realtime │   3. Storage │
              Assets    │        & RLS    │      & AI    │
                        │                 │              │
                        ▼                 ▼              ▼
           ┌─────────────────┐ ┌───────────────┐ ┌───────────────┐
           │  GitHub Pages   │ │  Supabase DB  │ │  Node Server  │
           │  / Static CDN   │ │   & Realtime  │ │  (server.js)  │
           └─────────────────┘ └───────────────┘ └───────┬───────┘
                                                         │
                                             Privileged  │ API Keys &
                                             Credentials │ Secrets
                                                         ▼
                                                ┌─────────────────┐
                                                │ Cloudflare R2   │
                                                │ Google Gemini AI│
                                                └─────────────────┘
```

---

## 2. Static Frontend Tier (GitHub Pages)

### Characteristics:
- **Hosted Artifacts**: Root portal (`index.html`, `login.html`), `portals/admin/dist`, `portals/student/dist`, `portals/teacher/dist`, `portals/superadmin/dist`, and `study-island/dist`.
- **Runtime Model**: Pure client-side execution in the end-user's browser.
- **Security Boundary**: Publicly accessible. No secrets, credentials, or private keys may ever exist in static code or build bundles.

### Direct Database Interactions:
Client SPAs communicate directly with Supabase via `@supabase/supabase-js` using:
- `VITE_SUPABASE_URL`: Public project endpoint.
- `VITE_SUPABASE_ANON_KEY`: Public anonymous client key (unprivileged).
- Authorization: Bearer JWT tokens attached automatically from active user sessions.
- Multi-Tenancy & Integrity: Enforced 100% database-side via PostgreSQL Row Level Security (RLS) policies.

---

## 3. Dynamic Backend API Tier (`server.js` / Container / Netlify)

Static hosting providers (such as GitHub Pages) **cannot** host dynamic HTTP route handlers, maintain long-lived TCP socket connections, or protect private credentials. The dynamic backend tier provides these capabilities:

| Endpoint / Feature | Dynamic Requirement Reason |
| :--- | :--- |
| **`/api/upload-r2` / `/api/upload`** | Requires AWS/Cloudflare S3 credentials (`CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`). Client-side storage of these keys violates platform security. Enforces magic-byte file signature validation and path sanitization. |
| **`/api/ai/chat`** | Requires `GEMINI_API_KEY`. Enforces per-user rate limiting (20 req/min) and client PII redaction (email, phone, student name) before forwarding prompts to generative AI. |
| **`/api/audit-log`** | Authenticates user JWT and calls PostgreSQL Security Definer RPC `log_system_audit_event` to prevent client spoofing of audit log entries. |
| **WebSocket (`ws://` / `wss://`)** | Requires a persistent bidirectional TCP socket server. Provides tenant-partitioned presence (`presence_sync`), class-room isolation (`join_room`), and restricted timetable updates. |

---

## 4. Environment Variables & Secret Segregation

To prevent credential leakage across deployment tiers, configuration is partitioned:

### Client-Safe (Public) Variables
*Allowed in `.env` and compiled bundles:*
- `VITE_SUPABASE_URL` / `SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`
- `PORT` (local server port)

### Server-Only (Confidential) Variables
*Strictly prohibited from client bundles; held only by the server runtime:*
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_BUCKET`
- `CLOUDFLARE_R2_PUBLIC_URL`
- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

CI/CD automation (`.github/workflows/pages.yml`) executes `scripts/scan-secrets.js` on every build to guarantee zero server secrets leak into client bundles prior to deployment.

---

## 5. Production Topology Recommendations

When transitioning from local developer mode (`node server.js`) to production:

1. **Frontend**: Deploy static dist outputs to GitHub Pages, Netlify Static, AWS S3 + CloudFront, or Cloudflare Pages.
2. **API & WebSockets**: Deploy `server.js` to a containerized platform supporting WebSockets (e.g., Google Cloud Run with WebSockets enabled, AWS ECS, Fly.io, or Railway).
3. **Database & Auth**: Maintained on Supabase managed PaaS with strict RLS and JWT expiration.
4. **Static Media**: Stored in Cloudflare R2 bucket and served via custom CDN domain.
