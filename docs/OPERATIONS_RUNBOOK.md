# EdTech Island — Operations & Incident Response Runbook

> **Scope:** Production Operations, Secret Rotation, Incident Triage, Release Verification, and Rollback Procedures.

---

## 1. Incident Severity Classification & Escalation Matrix

| Severity | Definition | Response SLA | Examples | Escalation Contacts |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core platform down; data breach / unauthorized RLS data leak; active security compromise. | < 15 minutes | Supabase RLS bypass, private profile data exposed, full server outage. | Incident Commander, Security Officer, Lead Engineer |
| **SEV-2 (High)** | Degradation of critical feature affecting multiple classes/tenants; AI or Upload endpoint outage. | < 1 hour | Cloudflare R2 upload failing, AI chat returning 500s across platform, WebSocket room partition. | Platform Engineer, Cloud Infrastructure Lead |
| **SEV-3 (Medium)** | Non-blocking bug; isolated view defect; intermittent latency spikes. | < 4 hours | Score visual rendering mismatch, single chapter asset loading slowly. | Portal Frontend Engineer |
| **SEV-4 (Low)** | Minor cosmetic or documentation issues. | Next Sprint | CSS alignment flaw, typo in help modal. | Assigned Developer |

---

## 2. Emergency Incident Response Procedures

### 2.1 Triage & Containment
1. **Verify Health Probes:**
   ```bash
   curl -I http://localhost:3000/api/health
   curl http://localhost:3000/api/health/ready
   curl http://localhost:3000/api/metrics
   ```
2. **Inspect Structured Server Logs:**
   - Filter by correlation `X-Request-Id` or category: `AUTH`, `RLS`, `UPLOAD`, `AI`.
   - All server logs automatically redact bearer tokens and student PII.
3. **Emergency Isolation (Maintenance Mode):**
   - If a database breach or severe vulnerability is detected, temporarily disable unauthenticated requests via server configuration or environment flag `MAINTENANCE_MODE=true`.

---

## 3. Secret Rotation Standard Operating Procedures (SOP)

### 3.1 Supabase Service Role Key & Database Password Rotation
1. **Generate New Key in Supabase Dashboard:**
   - Navigate to `Settings` -> `API` -> `Project API Keys`.
   - Generate replacement `service_role` or database credentials.
2. **Update Environment Files & Secrets Manager:**
   - Update `.env` file on deployment targets.
   - Update GitHub Actions Repository Secrets / Netlify Environment Variables.
3. **Verify Zero Leaks:**
   ```bash
   cmd /c node scripts/scan-secrets.js
   cmd /c npm test
   ```

### 3.2 Gemini AI API Key Rotation
1. **Generate New API Key in Google AI Studio / GCP Console.**
2. **Update Server Environment:**
   - Set `GEMINI_API_KEY="[NEW_KEY]"` in production `.env`.
   - Ensure the key is NEVER exposed to client code (verified by `tests/ai-grounding.test.js`).
3. **Restart Server:**
   ```bash
   node server.js
   ```

### 3.3 Cloudflare R2 Token Rotation (Excluded Scope Note)
*Note: In accordance with repository governance rules, active R2 credentials are intentionally managed outside automated tasks. When manually rotated by the human owner, update `CLOUDFLARE_R2_ACCESS_KEY_ID` and `CLOUDFLARE_R2_SECRET_ACCESS_KEY` in `.env` and verify using `tests/upload.test.js`.*

---

## 4. Release Checklist & Rollback Procedures

### 4.1 Pre-Release Verification Checklist (Mandatory Gates)
- [ ] **Tests Pass:** `cmd /c npm test` exits 0 (all test suites pass).
- [ ] **Portal Builds Clean:** `cmd /c npm run build:all` completes with 0 errors across all 5 applications.
- [ ] **Secret Scan Clean:** `cmd /c node scripts/scan-secrets.js` reports 0 detected violations.
- [ ] **Lint Clean:** No unhandled syntax or ESLint errors in any portal.
- [ ] **Aria AI Singleton Verified:** Exactly one active Aria widget per session.
- [ ] **Git Push Policy:** Do NOT run `git push` unless explicitly authorized by the user.

### 4.2 Rollback Procedure
If a production release exhibits regressions:
1. Re-deploy the last known-good build artifact from Git tag or Netlify deployment history.
2. Invalidate CDN cache: HTML is served `no-cache`, ensuring instant rollback visibility.
3. Re-run `node --test tests/rls-matrix.test.js` to ensure RLS policies remained intact.
