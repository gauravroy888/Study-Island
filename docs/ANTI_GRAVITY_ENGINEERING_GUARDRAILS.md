# EdTech Island — Anti-Gravity Engineering Guardrails

> **Mandatory instruction for Anti-Gravity, Gemini, Copilot, and all AI coding agents working on this repository.**
>
> This document exists to prevent system-level security, architecture, data-integrity, Supabase, and deployment mistakes. It supplements the Engineering Constitution, Project Context, and `docs/AGENTS.md`. If instructions conflict, the stricter security and data-integrity rule wins.

## 1. Non-negotiable operating rules

Before changing code, the agent MUST:

1. Read:
   - `docs/EDTECH_ISLAND_AI_ENGINEERING_CONSTITUTION.md`
   - `docs/PROJECT_CONTEXT.md`
   - `docs/AGENTS.md`
   - this document
2. Inspect the repository structure and current git status.
3. Find the callers, consumers, database tables, routes, migrations, and tests affected by the requested change.
4. Verify every database table and column against the live Supabase schema or an existing verified schema-contract test.
5. Define the requested change in one sentence before editing.
6. Identify the security boundary, tenant boundary, identity boundary, and data-integrity boundary affected by the change.
7. Run a baseline test/build check when the work is more than a trivial documentation edit.

The agent MUST NOT:

- Guess table names, columns, routes, policies, roles, API contracts, or analytics formulas.
- Use localStorage, query parameters, request bodies, email addresses, or client-supplied roles as proof of authorization.
- Add a fallback identity such as `guest_student`, `global`, `default-user`, or a synthetic UUID.
- Use a Supabase anon/publishable key as an `Authorization: Bearer` user token.
- Expose a service-role key, secret key, R2 secret, Gemini secret, or management token to frontend code.
- Change historical analytics events or versioned mastery formulas without explicit authorization.
- Edit an already-applied migration in place to repair production state.
- Add a permissive RLS policy merely to make a frontend query work.
- Add a new package or framework when an existing helper or standard browser/Node API is sufficient.
- Perform a framework migration, folder rewrite, or broad refactor without explicit authorization.
- Run `git push`.

If the agent cannot verify an assumption, it must stop that branch of work, state what is unknown, and inspect the repository, schema, tests, or documentation before proceeding.

## 1.1 Platform evolution rule

EdTech Island is an actively evolving platform. These guardrails protect security, tenancy, identity, data integrity, and operational reliability; they do not freeze the current folder structure, schema, route names, UI, framework versions, or product behavior forever.

Intentional platform changes are allowed when they are handled explicitly:

1. Identify whether the change is an additive change, a replacement, a deprecation, or a breaking change.
2. Record the intended new contract in the relevant project documentation or an architecture decision record.
3. Inspect all callers, consumers, policies, migrations, tests, and deployment workflows affected by the new contract.
4. Introduce compatibility behavior or a staged migration when existing users, data, clients, or deployed bundles still depend on the old contract.
5. Update the schema, code, tests, documentation, and live verification plan together.
6. Remove deprecated behavior only after confirming that no supported caller still depends on it.
7. Re-run security and tenant-boundary checks against the new design.

The agent MUST NOT preserve an obsolete table, column, route, abstraction, or fallback merely because it appears in an older example in this document. Current examples are evidence of the presently verified platform, not permanent architectural commandments.

When the platform intentionally changes, the agent must say in its final report:

- What contract changed.
- Why the change was required.
- Which old callers or data were affected.
- How compatibility was preserved or intentionally broken.
- Which migration and rollback/forward-repair path was used.
- Which security invariants remain unchanged.

## 2. Platform architecture map

Treat the repository as five connected systems:

### Backend

- `server.js` is the HTTP and WebSocket entry point.
- `server/auth.js` owns JWT verification and role/tenant resolution.
- `server/upload.js` owns authenticated file upload authorization and R2 interaction.
- `server/ai.js` owns the server-side AI boundary, grounding, PII redaction, and assessment protections.
- `server/audit.js` owns privileged audit logging.
- `server/superadmin.js` owns privileged SuperAdmin operations.
- `server/websocket.js` owns authenticated real-time rooms and tenant isolation.
- `server/health.js` owns liveness, readiness, metrics protection, and operational status.

### Frontend portals

- `portals/student` — student experience.
- `portals/teacher` — teacher experience.
- `portals/admin` — school administration.
- `portals/superadmin` — platform-wide administration.
- `study-island` — interactive curriculum and learning experience.

### Shared code

- `shared` contains shared Supabase access, services, components, and theme helpers.
- Shared helpers must not silently weaken authorization for a specific portal.

### Database

- `database-migrations` is the current canonical migration directory unless repository inspection proves that the platform has intentionally moved to another migration system.
- Migrations are ordered, replayable, idempotent, and reviewed as security code.
- RLS is part of the application architecture, not a database afterthought.

### Legacy/standalone pages

- `study-island/quiz.html` and other standalone HTML pages may duplicate behavior for runtime reasons.
- Duplicated security-sensitive logic requires an automated synchronization or parity test.

## 3. Identity and authentication rules

### Server authentication

Every protected server endpoint MUST:

1. Require an `Authorization` header containing a real user JWT.
2. Reject missing, malformed, expired, or invalid tokens.
3. Reject the Supabase anon/publishable key when supplied as a bearer token.
4. Resolve the user from verified Supabase identity.
5. Resolve role and tenant from the trusted database profile, not from client input.
6. Fail closed when the profile, role, or required tenant is missing.
7. Perform role normalization against an explicit allowlist.

Valid authorization evidence is:

- A verified Supabase JWT.
- `auth.uid()` inside a database policy/function.
- A database profile linked to `auth_id`.
- A database membership/assignment row.

Invalid authorization evidence includes:

- `localStorage` values.
- URL query parameters.
- Form fields such as `role`, `isAdmin`, or `institution_id`.
- Email matching.
- User-editable `user_metadata` claims.
- A client-provided `student_id`.

### Frontend session handling

Frontend code may use localStorage only for non-authoritative UI state. It MUST NOT use localStorage to grant privileges, identify an account for database ownership, or decide SuperAdmin access.

Supabase access tokens may be read from the Supabase client/session flow when necessary, but:

- The real access token must be used as `Authorization: Bearer <token>`.
- The anon/publishable key may be sent as `apikey`.
- The anon/publishable key MUST NEVER be sent as an Authorization bearer token.

## 4. Tenant isolation and authorization

Every tenant-scoped request must answer all four questions:

1. Who is the authenticated user?
2. What is the user’s verified role?
3. What institution/tenant does the user belong to?
4. What database relationship authorizes access to this specific record?

A role check alone is not enough.

`TO authenticated` means only that the request is authenticated. It does not provide row authorization.

Bad:

```sql
CREATE POLICY "read_anything_authenticated"
ON public.some_table
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
```

Good policies must also enforce ownership, tenant, assignment, enrollment, or an intentional platform-wide rule:

```sql
CREATE POLICY "read_own_records"
ON public.some_table
FOR SELECT TO authenticated
USING (
  owner_id = public.get_my_profile_id()
  OR public.is_admin_for_tenant(institution_id)
);
```

For every tenant-scoped table:

- Students see only their own records and permitted enrolled content.
- Teachers see only assigned classes/students and permitted tenant content.
- School admins see only their institution.
- SuperAdmins receive cross-tenant access only where explicitly required.
- Rows with a null or empty tenant must fail closed for tenant-scoped access.
- No hardcoded fallback tenant may be used.

For class access, verify the actual relationship table:

- `class_students` for student enrollment.
- `class_teachers` for teacher assignment.
- `classes.institution_id` for class tenancy.

Do not invent alternatives such as `student_enrollments`, `classes.department`, or `course_chapters.chapter_name`.

## 5. Supabase RLS requirements

All exposed public-schema tables MUST have RLS enabled and policies matching the real access model.

### Policy requirements

- Use explicit policy roles: `TO anon`, `TO authenticated`, or an intentionally restricted role.
- Do not use `auth.role() = 'authenticated'` in new policy code.
- Do not use `USING (true)` or `WITH CHECK (true)` for protected data.
- Do not grant public `FOR ALL` access to user, tenant, analytics, audit, class, or configuration tables.
- Do not use `TO authenticated` as the only authorization condition.
- Every UPDATE policy must include both `USING` and `WITH CHECK`.
- The `USING` condition must prevent selecting/updating a row the caller does not own or manage.
- The `WITH CHECK` condition must prevent moving a row into another user or tenant.
- DELETE must be explicitly denied or explicitly authorized.
- INSERT must validate the authenticated owner/tenant instead of trusting request fields.

### Security-definer functions

`SECURITY DEFINER` is privileged database code. Use it only when necessary.

Every such function must:

- Use `SET search_path = public` or a stricter fixed search path.
- Validate `auth.uid()` or another trusted authentication condition.
- Validate role and tenant inside the function.
- Never trust user-editable metadata for authorization.
- Have `EXECUTE` revoked from `PUBLIC` where appropriate.
- Grant execution only to the required role.
- Avoid accepting actor identity, tenant identity, or ownership as an unchecked argument.

After changing privileged SQL, inspect policies and function privileges in the live database when credentials permit.

## 6. Migration discipline

Before creating or changing a migration:

1. Inspect all existing migrations in numerical order.
2. Identify whether the target migration is already applied.
3. Query the live schema or migration history when credentials are available.
4. Never edit an already-applied historical migration to change production behavior.
5. Create the next migration using the project’s established naming convention.
6. Make the migration idempotent where safe:
   - `IF EXISTS`
   - `IF NOT EXISTS`
   - guarded function/policy replacement
   - safe constraint/index checks
7. Do not silently swallow SQL failures.
8. Stop migration execution after the first failure.
9. Do not mark a migration as applied unless the database operation succeeded.
10. Never include secrets in migration logs.

Every migration change requires:

- Static SQL review.
- Migration ordering test.
- Replay/idempotence test.
- Policy and function security review.
- Live schema verification when credentials are available.
- A rollback/forward-repair explanation for destructive or irreversible operations.

Migration scripts must:

- Discover all canonical migrations.
- Execute in numeric order.
- Detect already-applied migrations.
- Validate non-2xx responses.
- Fail with a non-zero exit code on errors.
- Support dry-run mode.
- Never claim success when the management API failed.

## 7. Analytics and learning-data integrity

Historical analytics are evidence, not disposable application state.

The agent MUST preserve:

- Raw event immutability.
- Versioned scoring formulas.
- Mastery formula semantics.
- Learning-objective evidence.
- Attempt idempotency.
- Stable session IDs.
- Auditability of retries and dead-letter events.

Cloud analytics writes MUST:

- Require a verified authenticated Supabase identity.
- Derive `student_id` from the authenticated identity.
- Reject or locally queue unauthenticated events.
- Never insert `student_id: null` into cloud analytics tables.
- Never retry an unauthenticated event as if it had an owner.
- Never trust a client-supplied student ID over the verified session ID.

If both React and standalone implementations exist:

- Maintain one canonical source where practical.
- Otherwise synchronize automatically.
- Add parity tests for security, payload shape, formulas, and identity handling.

Never “fix” analytics by deleting old events, changing historical formulas, fabricating scores, or defaulting missing learners to a synthetic identity.

## 8. AI and Aria security

All AI requests must pass through the server-side security boundary when external model access or sensitive data is involved.

The AI boundary must:

- Require authentication where the product contract requires it.
- Redact email addresses, names, phone numbers, and unnecessary identifiers.
- Detect common prompt-injection attempts.
- Treat curriculum data as untrusted until verified from the database.
- Fail closed or mark the request ungrounded when chapter/subject context cannot be verified.
- Prevent direct answer leakage during assessments when assessment mode is active.
- Never expose provider API keys to frontend bundles.
- Apply rate limits and bounded request sizes.

Aria must be a singleton per page session:

- Do not mount duplicate widgets through route changes, iframes, or portal wrappers.
- Preserve iframe/top-level guards.
- Preserve lifecycle cleanup.
- Verify singleton behavior with browser tests.

## 9. Uploads, storage, and file handling

R2 configuration is intentionally outside this document’s current remediation scope, but the security rules remain mandatory:

- R2 credentials are server-only.
- Missing credentials must fail closed with a safe 503 response.
- Students cannot upload curriculum content.
- Teachers require verified class assignment.
- Admins require same-tenant authorization.
- SuperAdmins must derive tenant/class information from the database.
- File destinations must be server-derived.
- Filenames must be sanitized and randomized.
- Path traversal must be impossible.
- File size must be checked before and during buffering.
- MIME type must be verified using magic bytes, not only the filename.
- Upload errors must not leak secrets or internal stack traces.

## 10. WebSocket and real-time rules

WebSocket authentication must occur through an initial authenticated message or another verified session mechanism. Do not accept bearer tokens in query strings.

For every room join or broadcast:

- Verify the JWT.
- Resolve role and tenant from trusted data.
- Verify the class exists.
- Reject null-tenant classes.
- Verify teacher assignment or student enrollment.
- Prevent cross-tenant room joins.
- Derive broadcast tenant IDs from the database, not from client payloads.
- Limit payload size and apply rate limits.

## 11. Schema contract discipline

Before writing a query, verify actual columns and relationships.

The following are the currently verified examples, not immutable forever-rules. If the platform intentionally changes them, update the schema contract, callers, migrations, and tests in the same change:

- `classes.institution_id`, not `classes.department`.
- `course_chapters.title`, not `course_chapters.chapter_name`.
- `course_chapters.subject_id` joined to `subjects`.
- No `profiles.password`.
- No `profiles.login_id`.
- No deprecated `course_chapters.subject_name` after its removal migration.

When a query fails because a column is absent:

1. Stop and inspect the schema.
2. Find the canonical replacement.
3. Update all callers and tests.
4. Add or update a schema-contract test.
5. Verify the live endpoint.

Never add a fake compatibility column merely to silence an error.

## 12. Frontend architecture and maintainability

Before adding a helper, component, hook, or service:

- Search for an existing implementation.
- Check shared code and portal-specific code.
- Check whether the behavior already exists in standalone HTML.
- Reuse existing browser APIs and utilities where sufficient.
- Avoid broad duplication of authentication, analytics, or authorization logic.

If duplication is unavoidable:

- State why it is necessary.
- Establish a synchronization mechanism.
- Add parity tests.
- Document which source is canonical.

Do not solve a local bug by introducing a second authorization system.

## 13. Testing requirements

Every non-trivial change must run the relevant checks.

### Mandatory local checks

```text
npm test
npm run build:all
npm run lint:all
npm run verify:secrets
npm run verify:diff
```

### Security changes additionally require

- Anonymous denial tests.
- Authenticated same-tenant tests.
- Authenticated cross-tenant denial tests.
- SuperAdmin boundary tests.
- Schema-contract tests.
- Migration replay tests.
- Browser/E2E tests for affected routes.

### Live-test rules

- Live Supabase tests must state when network access is unavailable.
- Tests must not silently convert missing credentials into a false security pass in CI.
- CI must set explicit required flags for authenticated RLS tests.
- Non-production JWTs must be used.
- Mutation probes must use safe sentinel records or nonexistent IDs.
- Never delete or alter real production data during verification.

Skipped security tests must be reported as skipped, not described as passed.

## 14. Required change workflow

Use this exact sequence:

### Step 1 — Understand

- Read governance documents.
- Inspect git status.
- Identify affected files, callers, schema, routes, and tests.

### Step 2 — Model the boundary

Write down:

- Authenticated actor.
- Role.
- Tenant.
- Resource owner.
- Allowed operation.
- Denied operation.
- Failure behavior.

### Step 3 — Implement minimally

- Reuse existing abstractions.
- Preserve public contracts.
- Avoid unrelated refactoring.
- Add migration only when database state must change.

### Step 4 — Add regression tests

Test both the intended success path and the nearest dangerous failure path.

### Step 5 — Verify

Run tests, builds, lint, secrets, diff checks, and live checks appropriate to the change.

### Step 6 — Independent audit

Review the diff again as if trying to break it. Specifically inspect:

- Authentication bypasses.
- Tenant leaks.
- BOLA/IDOR conditions.
- Null/default identity fallbacks.
- Schema drift.
- Analytics mutation/fabrication.
- Secret exposure.
- Migration replay behavior.
- Unhandled errors.
- Skipped tests.

### Step 7 — Report honestly

The final report must state:

- Files changed.
- Commands executed.
- Exact pass/fail/skip counts.
- Live verification performed.
- Known limitations.
- Remaining risks.
- A clear PASS, CONDITIONAL PASS, or FAIL verdict.

Never call a task complete merely because the code compiles.

## 15. Severity and stop conditions

### P0 — Stop immediately

- Authentication bypass.
- Privilege escalation.
- Cross-tenant data exposure.
- Service-role or secret-key exposure.
- Cloud write with unauthenticated/null ownership.
- Public write access to protected tables.
- Destructive migration with no recovery path.
- Raw analytics mutation or formula corruption.

### P1 — Do not sign off for production

- Missing tenant checks.
- Unsafe `SECURITY DEFINER` function.
- Broad `TO authenticated` policy without ownership/tenant predicates.
- Unverified live migration state.
- Missing authenticated RLS coverage.
- Broken upload, AI, audit, or SuperAdmin authorization boundary.

### P2 — Must be tracked

- Schema-contract drift.
- Duplicated security-sensitive logic.
- Lint warnings in security-critical code.
- CI skipping required security gates.
- Missing parity or replay tests.
- Weak operational error reporting.

### P3 — Clean before release when practical

- Formatting failures.
- Node warnings.
- Stale generated artifacts.
- Inconsistent documentation.
- Non-blocking accessibility or performance cleanup.

## 16. Final anti-mistake checklist

Before sign-off, answer YES to every applicable question:

- Did I inspect before editing?
- Did I verify every table and column?
- Did I use a real authenticated identity?
- Did I derive role and tenant from trusted data?
- Does every tenant query enforce tenant/ownership boundaries?
- Does every UPDATE policy have both `USING` and `WITH CHECK`?
- Did I avoid `auth.role()` in new policies?
- Did I avoid `USING (true)` and `WITH CHECK (true)`?
- Did I secure every `SECURITY DEFINER` function?
- Did I avoid exposing secrets?
- Did I preserve analytics immutability and formulas?
- Did I protect AI grounding and assessment behavior?
- Did I prevent duplicate Aria widgets?
- Did I keep R2 server-only and fail-closed?
- Did I test anonymous denial and authenticated access?
- Did I verify cross-tenant denial?
- Did I run the correct builds?
- Did I run lint, secret, and diff checks?
- Did I inspect skipped tests?
- Did I independently audit the final diff?

If any answer is NO or UNKNOWN, do not claim completion.
