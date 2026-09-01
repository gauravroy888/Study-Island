# Git Workflow Rules

## Strict Git Push Restriction
1. **Never run `git push` autonomously.**
2. Do not include `git push` in chained commands (e.g. `npm run build && git push` or `git commit && git push`).
3. You may perform local verification, builds (`npm run build:all`), local staging (`git add`), and local commits if needed, but the remote repository must never be touched without explicit, verbatim user instructions to push.
