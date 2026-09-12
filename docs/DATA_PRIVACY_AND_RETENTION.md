# EdTech Island — Data Privacy, Retention & Compliance Framework

> **Status:** Production Grounded  
> **Applicability:** All Portals (Student, Teacher, Admin, SuperAdmin) & Study Island Experiences  
> **Regulatory Mapping:** FERPA (US), COPPA (US), GDPR (EU/UK), DPDP Act 2023 (India)

---

## 1. Executive Summary & Data Governance Charter

EdTech Island handles educational records, student cognitive telemetry, virtual laboratory activity, and institutional administrative data. This document outlines the authoritative Data Catalog across 11 data categories, the immutable retention lifecycle schedules, deletion and export methods, and legal/regulatory compliance engineering guarantees.

### Core Data Principles:
1. **Purpose Limitation:** Student telemetry and activity records are captured strictly to compute formative cognitive mastery, pedagogical fluency, and teacher intervention alerts. Data is never monetized, sold, or shared with third-party advertisers.
2. **Telemetry Immutability:** Historical analytics events (`analytics_events`) are write-once, append-only records. Corrective recomputations rebuild derived read-models without mutating the historical audit trail.
3. **Data Minimization & Sanitization:** AI prompts and external cloud queries undergo automated PII redaction (email, full name, phone number) before external egress.
4. **Tenant Isolation:** Multi-tenancy is enforced at the database layer via PostgreSQL Row Level Security (RLS). Institutional data cannot be accessed across tenant boundaries.

---

## 2. Comprehensive 11-Category Data Catalog

| Category ID | Category Name | Primary Storage Table / Asset | Data Attributes Captured | Data Owner | Access Roles | Retention Schedule | Deletion Method | Export Format | Encryption Boundary | Subprocessors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DC-01** | Profile Data | `public.profiles` | `id`, `auth_id`, `email`, `name`, `role`, `avatar_url`, `department` (tenant), `age`, `timetable`, `is_archived` | User / School | Self, Tenant Admin, SuperAdmin | Duration of active enrollment + 1 year | Soft-archive (`is_archived: true`) or Hard delete via Admin RPC | JSON, CSV | TLS 1.3 in-transit, AES-256 at rest | Supabase (AWS eu-central / us-east) |
| **DC-02** | Authentication Data | `auth.users` | `id`, `email`, encrypted password hash (Bcrypt), OAuth provider tokens, last sign-in timestamp | User | Self, Supabase Auth Service | Active account lifecycle | Hard purge cascade upon account deletion | JSON (OAuth claims) | TLS 1.3, Bcrypt + Salt, AES-256 | Supabase Auth |
| **DC-03** | Student Learning Records | `public.test_submissions`, `public.learning_summaries` | `student_id`, `test_id`, `chapter_id`, `score_pct`, `best_mastery`, `average_accuracy`, `best_lo_scores`, timestamps | Student / School | Student, Instructing Teacher, Tenant Admin | 5 years (Academic transcript preservation) | Anonymization or Tenant De-registration purge | JSON, CSV | TLS 1.3, AES-256 | Supabase DB |
| **DC-04** | Analytics & Cognitive Telemetry | `public.analytics_events` | `id`, `student_id`, `session_id`, `event_type`, `chapter_key`, `payload` (checkpoints, response times, bloom weights, hint usage) | Platform / School | Student (own), Instructing Teacher, Tenant Admin | 3 years active; 7 years aggregated | Scheduled archival partition drop | JSON Lines (`.jsonl`) | TLS 1.3, AES-256 | Supabase DB |
| **DC-05** | Chat & Communications | `public.messages`, `public.conversations` | `id`, `conversation_id`, `sender_id`, `content`, `created_at` | Participants / School | Conversation participants, Tenant Admin (compliance review) | 1 school year (365 days) | Automatic chronological cascade purge | JSON | TLS 1.3, AES-256 | Supabase DB |
| **DC-06** | AI Context & Memory | `public.aria_ai_sessions`, `localStorage` | `student_id`, `session_date`, `topics`, `summary`, `message_count` | Student | Student, System Aria Agent | 7-day rolling window | Automatic daily rollover purge (`session_date < now() - 7 days`) | JSON | TLS 1.3, AES-256 | Google Cloud (Gemini API — transient, zero training retention) |
| **DC-07** | Educator / Teacher Data | `public.teachers`, `public.class_teachers` | `id`, `email`, `name`, `department`, `classes_assigned`, `created_at` | Teacher / School | Teacher (own), Tenant Admin, SuperAdmin | Employment tenure + 2 years | Administrative de-provisioning | CSV, JSON | TLS 1.3, AES-256 | Supabase DB |
| **DC-08** | School & Tenant Data | `public.school_branding`, `public.classes`, `public.subjects` | `institution_id`, `school_name`, `school_tagline`, `logo_url`, `theme_preset`, class rosters | Institution / District | Tenant Admin, SuperAdmin | Contract duration + 90-day grace period | Complete tenant schema partition purge | ZIP package (CSVs + Assets) | TLS 1.3, AES-256 | Supabase DB |
| **DC-09** | Uploaded Media Assets | Cloudflare R2 (`avatars/`, `curriculum/`, `submissions/`) | Binary image/media objects, Content-Type, Content-Length, MD5 etag | Uploader / Institution | Authorized CDN egress, Authenticated uploader | Avatars: User lifecycle; Submissions: 3 years | S3 API deleteObject | Binary object stream | TLS 1.3, Server-side AES-256 | Cloudflare R2 |
| **DC-10** | System & Security Audit Logs | `public.system_audit_logs` | `id`, `title`, `actor_email`, `actor_role`, `target_resource`, `action_type`, `ip_address`, `details`, `created_at` | Platform Security Officer | SuperAdmin only (Read-only); System RPC (Append-only) | 7 years (Statutory compliance & forensic audit) | Immutable; WORM storage policy | JSON, SIEM CEF export | TLS 1.3, AES-256 | Supabase DB |
| **DC-11** | Real-time WebSocket Presence | Memory buffer (`server/websocket.js`) | `tenant_id`, `class_id`, `user_id`, socket channel reference | Transient session | Connected room peers | Duration of socket connection (Ephemerality: 0 sec on disconnect) | In-memory disconnect event garbage collection | N/A (Ephemeral) | WSS (TLS 1.3) | Native Node.js Server |

---

## 3. Regulatory Compliance Engineering Matrix

### 3.1 Family Educational Rights and Privacy Act (FERPA — 34 CFR Part 99)
- **Educational Record Definition:** `test_submissions`, `learning_summaries`, and teacher rosters constitute student education records.
- **Access Rights (§ 99.10):** Parents and eligible students can inspect their complete records via the Student Portal Progress View or through JSON data export requests.
- **Directory Information Opt-Out (§ 99.37):** Student profiles default to restricted visibility (only classmate peers in assigned classes and designated teachers have visibility). Public directory querying is blocked by RLS.
- **School Official Exception (§ 99.31):** EdTech Island operates as a Contractor/School Official under direct control of the educational agency with legitimate educational interests.

### 3.2 Children’s Online Privacy Protection Act (COPPA — 16 CFR Part 312)
- **Under-13 Verifiable Parental / School Consent:** School accounts for students under 13 are provisioned exclusively through authorized school administrators/teachers acting as school agents.
- **Prohibition on Behavioral Advertising:** No tracking cookies, external advertising scripts, or third-party behavioral pixels exist anywhere in the codebase.
- **Operator Contact Information:** Disclosed in the platform footer and privacy notice.
- **Parental Review & Deletion Requests:** Tenant administrators can immediately export or delete student data upon parental inquiry.

### 3.3 General Data Protection Regulation (GDPR — Regulation (EU) 2016/679)
- **Right of Access (Article 15) & Portability (Article 20):** API endpoint `/api/student/export-data` and Student Portal UI allow full structured JSON exports of all user records.
- **Right to Erasure / "To Be Forgotten" (Article 17):** Account deletion executes cascade anonymization: PII in `profiles` is expunged, while historical analytics telemetry retains de-identified tokens for curriculum efficacy verification.
- **Privacy by Design & Default (Article 25):** Passwords and plaintext login IDs were removed from public tables; least-privilege RLS defaults to zero access without explicit authorization.
- **Processor Agreements & Data Transfers (Articles 28 & 44-50):** Supabase and Cloudflare operate under EU Standard Contractual Clauses (SCCs) with at-rest AES-256 encryption.

### 3.4 Digital Personal Data Protection Act, 2023 (DPDP — India)
- **Notice & Consent (Section 5 & 6):** Explicit, clear consent notice provided at onboarding explaining data collected for educational progress tracking.
- **Processing of Children's Personal Data (Section 9):** No processing that causes detrimental effect on children's well-being. Zero targeted behavioral advertising. Verifiable consent obtained via school authorization.
- **Right to Grievance Redressal (Section 13):** Contact email `privacy@cognitiveisland.edu` designated as Grievance Officer channel.

---

## 4. Operational Retention & Purge Procedures

### 4.1 7-Day AI Memory Purge Automation
The `aria_ai_sessions` table uses a rolling 7-day retention schedule. Queries retrieve only records where `session_date >= now() - interval '7 days'`. A scheduled cron job executes:
```sql
DELETE FROM public.aria_ai_sessions 
WHERE created_at < NOW() - INTERVAL '7 days';
```

### 4.2 Account Deletion Cascade (Right to Erasure)
When an administrator executes a user erasure request:
1. Revoke active auth tokens and delete user from `auth.users`.
2. Clear profile records from `public.profiles` and `public.teachers`.
3. Anonymize student references in `analytics_events` (`student_id -> 'ANON_' || encode(sha256(student_id::bytea), 'hex')`).
4. Delete uploaded avatar object from Cloudflare R2 bucket (`edtechplatform/avatars/...`).
5. Log the deletion action in `system_audit_logs` (recording actor, target user ID, and timestamp without retaining expunged PII).
