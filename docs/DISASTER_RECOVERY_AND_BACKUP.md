# EdTech Island — Disaster Recovery & Backup Runbook

> **Target Service Level Objectives:**  
> **Recovery Point Objective (RPO):** < 5 minutes for database data; 0 data loss for raw telemetry.  
> **Recovery Time Objective (RTO):** < 15 minutes for frontend static portals; < 30 minutes for core backend services.

---

## 1. System Architecture & Failure Domains

EdTech Island operates across four primary operational tiers:
1. **Frontend Tier:** Static single-page applications deployed via GitHub Pages / Netlify / Node.js static server.
2. **Backend API & Real-time Tier:** Native Node.js HTTP/WebSocket server (`server.js`, `server/`).
3. **Database & Auth Tier:** Managed PostgreSQL database & Supabase Auth (`qmyrxvtbzlbnvzxypnus.supabase.co`).
4. **Object Storage Tier:** Cloudflare R2 Global S3-compatible Object Storage (`edtechplatform`).

---

## 2. Supabase Database Recovery Runbook

### 2.1 Point-in-Time Recovery (PITR)
Supabase Pro tier maintains continuous Write-Ahead Log (WAL) archiving:
- **Retention Window:** Up to 7 days of continuous PITR.
- **Trigger Scenarios:** Catastrophic data corruption, accidental schema drops, rogue administrative mutations.
- **Execution Steps:**
  1. Open Supabase Management Console -> Database -> Backups.
  2. Select **Point in Time Recovery**.
  3. Select the target restoration timestamp (UTC) immediately preceding the incident.
  4. Confirm restoration. The database engine provisions a recovery replica and switches DNS routing upon completion.
  5. Verify RLS policies and table constraints via `node --test tests/rls-matrix.test.js`.

### 2.2 Logical Daily Schema & Data Exports
A scheduled backup script takes daily snapshots using `pg_dump`:
```bash
# Logical full database backup (excluding passwords)
pg_dump "postgres://postgres:[DB_PASSWORD]@db.qmyrxvtbzlbnvzxypnus.supabase.co:5432/postgres" \
  --format=custom \
  --schema=public \
  --file="backup_edtech_$(date +%Y%m%d_%H%M%S).dump"
```
To restore a logical dump into a recovery staging project:
```bash
pg_restore -d "postgres://..." --clean --if-exists backup_edtech_[TIMESTAMP].dump
```

---

## 3. Cloudflare R2 Object Storage Disaster Recovery

### 3.1 Object Versioning & Lifecycle
- **Bucket:** `edtechplatform`
- **Backup Strategy:** Weekly differential sync to cold storage replica:
```bash
# Automated cross-cloud replica sync using AWS CLI S3 compatible commands
aws s3 sync s3://edtechplatform s3://edtechplatform-backup-cold \
  --endpoint-url=https://21b75f7da0ec0dde4d08d3f19d2102f3.r2.cloudflarestorage.com
```

### 3.2 In-Flight Upload Recovery
If the Cloudflare R2 endpoint experiences degradation:
1. The platform automatically falls back to Supabase Storage (`avatars` bucket) via `ProfilePhotoModal.jsx:200`.
2. Local data URLs are retained temporarily in `localStorage` until background re-sync occurs.

---

## 4. Frontend & Backend Rollback Runbooks

### 4.1 Frontend Rollback (Static Portals)
Because frontend builds are content-hashed (e.g. `index.source-XEOUgZPo.js`), previous version chunks remain accessible:
1. **GitHub Pages / Netlify:**
   - To rollback immediately: revert the commit on the deployment branch or re-deploy the previous successful deployment in the Netlify Dashboard.
   - Run `cmd /c npm run build:all` locally to ensure no build regressions.
2. **Browser Cache Invalidation:**
   - HTML documents are served with `Cache-Control: no-cache, no-store, must-revalidate` (configured in `server/static.js:148`). Users receive the rollback version on next page load without waiting for browser TTLs.

### 4.2 Backend Rollback (Node.js Service)
If a defect occurs in `server/`:
```bash
# 1. Stop the active process
# 2. Check out the previous known-good release tag / commit
git checkout tags/v1.0.0-stable -- server.js server/

# 3. Verify syntax and tests
node --check server.js
npm test

# 4. Restart service
npm start
```

---

## 5. Telemetry Read-Model Replayability (Deterministic Rebuild)

### 5.1 The Telemetry Invariant
Historical telemetry in `public.analytics_events` is strictly immutable. In the event of a scoring corruption or database desynchronization, `public.learning_summaries` can be 100% deterministically recomputed from raw events without data loss.

### 5.2 Replay Recomputation Algorithm
For each student and chapter:
1. Query all `quiz_complete` events for `student_id` and `chapter_id` ordered chronologically:
   ```sql
   SELECT payload, created_at FROM public.analytics_events 
   WHERE student_id = :studentId AND event_type = 'quiz_complete' 
   ORDER BY created_at ASC;
   ```
2. Iterate through each attempt:
   - Compute `currentAccuracy = correctCount / totalQuestions`
   - Compute `currentMastery` via `calculateMastery(checkpoints)`
   - Compute `currentFluency` via `calculateFluency(checkpoints, duration)`
   - Aggregate `best_mastery = max(best_mastery, currentMastery)`
   - Aggregate `average_mastery = ((prevAvg * (n-1)) + currentMastery) / n`
3. Upsert the reconstructed record into `learning_summaries`.

---

## 6. Service Degradation & Outage Matrices

| Component | Failure State | User Experience | Automatic Mitigation |
| :--- | :--- | :--- | :--- |
| **Gemini AI API** | 503 / Rate Limit / Timeout | Aria displays: *"I am momentarily offline. Please review the chapter study notes while I reconnect."* | Local contextual study notes displayed; quiz scoring unaffected. |
| **WebSocket Presence** | Socket disconnect / Server crash | Portal indicator turns yellow (*"Offline mode"*); class roster reflects cached state. | Exponential reconnect backoff (2s, 4s, 8s, max 30s) automatically restores rooms. |
| **Cloudflare R2** | DNS / HTTP 5xx | Upload modal prompts: *"Cloud storage unavailable. Profile image saved locally."* | Local avatar fallback cached in `localStorage`; deferred background upload. |
| **Supabase DB** | Network outage / Read-only replica failover | Portals operate using `localStorage` WAL (Write-Ahead Log) queue. | Telemetry queued locally in `edtech_telemetry_wal` and drained on reconnect. |
