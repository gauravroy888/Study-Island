# EdTech Island — Local Development Guide

> **Developer Onboarding, Environment Setup, Build Scripts & Testing Standards.**

---

## 1. Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ / v24 recommended)
- **NPM**: v9.0.0 or later
- **Operating System**: Windows / Linux / macOS (Windows commands must use `cmd /c` prefix for npm execution in PowerShell)
- **Browser**: Google Chrome or Microsoft Edge

### Step 1: Clone and Install Root Dependencies
```powershell
# In PowerShell:
cmd /c npm install
```

### Step 2: Configure Environment Variables
Create or verify `.env` in the repository root:
```ini
# Supabase Database & Auth
VITE_SUPABASE_URL="https://qmyrxvtbzlbnvzxypnus.supabase.co"
VITE_SUPABASE_ANON_KEY="[YOUR_ANON_KEY]"

# Gemini AI (Server-Side Proxy)
GEMINI_API_KEY="[YOUR_GEMINI_KEY]"
GEMINI_MODEL="gemini-2.5-flash"

# Cloudflare R2 Storage ($0 Egress CDN)
CLOUDFLARE_R2_BUCKET_NAME="edtechplatform"
CLOUDFLARE_R2_PUBLIC_URL="https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev"
CLOUDFLARE_ACCOUNT_ID="[ACCOUNT_ID]"
CLOUDFLARE_R2_ACCESS_KEY_ID="[ACCESS_KEY]"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="[SECRET_KEY]"
CLOUDFLARE_R2_ENDPOINT="https://[ACCOUNT_ID].r2.cloudflarestorage.com"
```

### Step 3: Build All Workspaces
Build all 5 portal applications simultaneously:
```powershell
cmd /c npm run build:all
```

### Step 4: Start Local Unified Server
```powershell
cmd /c npm start
```
The server starts at `http://localhost:3000`:
- **Landing Page:** `http://localhost:3000/index.html`
- **Login Portal:** `http://localhost:3000/login.html`
- **Student Portal:** `http://localhost:3000/student/`
- **Teacher Portal:** `http://localhost:3000/teacher/`
- **Admin Portal:** `http://localhost:3000/admin/`
- **SuperAdmin Portal:** `http://localhost:3000/superadmin/`
- **Study Island 3D:** `http://localhost:3000/study-island/`

---

## 2. Workspace Structure

```
Study Island/
├── portals/
│   ├── student/        # Vite + React Student Dashboard & Learning Views
│   ├── teacher/        # Vite + React Teacher Analytics & Heatmap Views
│   ├── admin/          # Vite + React Tenant & Curriculum Management
│   └── superadmin/     # Vite + React Platform Operations & Telemetry
├── study-island/       # Three.js / React 3D Virtual Science Island
├── shared/             # Shared React components (ProfilePhotoModal, etc.)
├── server/             # Modular Node.js backend services
│   ├── static.js       # SPA static serving, caching & routing
│   ├── upload.js       # Cloudflare R2 upload handler + magic bytes
│   ├── ai.js           # Server-side Gemini AI proxy + PII scrubber
│   ├── audit.js        # Server-side audit logging RPC
│   ├── websocket.js    # Native room-isolated WebSocket presence
│   ├── health.js       # /api/health, /live, /ready, /metrics
│   ├── logger.js       # Structured logging & X-Request-Id
│   ├── metrics.js      # In-memory operational metrics
│   └── rateLimit.js    # In-memory IP/User rate limiters
├── tests/              # Node.js native test runner suites
└── docs/               # Platform architecture & governance specs
```

---

## 3. Testing Standards & Verification Commands

All test files are executed via the Node.js native test runner:
```powershell
# Run all test suites
cmd /c npm test

# Run specific suite
node --test tests/rls-matrix.test.js
node --test tests/accessibility.test.js
node --test tests/ai-grounding.test.js
node --test tests/abuse.test.js
node --test tests/analytics-replay.test.js
node --test tests/observability.test.js

# Secret leak scan
cmd /c node scripts/scan-secrets.js
```

---

## 4. Engineering Discipline & Governance Rules

1. **NO GIT PUSH**: Never run `git push` automatically. Changes remain local until explicit user permission is given.
2. **ZERO GUESSING**: Never invent table names, columns, or API routes. Verify against live schema.
3. **ARIA SINGLETON**: Exactly one Aria AI widget may be active per session. Never embed nested Aria widgets inside iframes.
4. **TELEMETRY IMMUTABILITY**: Never execute UPDATE or DELETE on historical `analytics_events`.
