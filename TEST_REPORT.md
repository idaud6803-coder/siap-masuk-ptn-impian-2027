# SIAPP PTN — Final Test Report

## Static checks

- server.js: `node --check` PASS
- public/script.js: `node --check` PASS
- public/index.html contains `/script.js` and required analysis/payment IDs
- No duplicate IDs detected in index.html by static DOM scan
- No static getElementById references to missing IDs detected
- Admin page keeps the original visual CSS block; no style.css rewrite was introduced
- package.json and package-lock.json declare matching Express/Multer dependencies

## Security/logic checks

- `/api/analyze` requires requestId
- requestId must exist in payments.json
- payment status must be `approved`
- report is recalculated on server
- report requires 1–5 semester values per subject, all 0–100
- achievements may be empty; non-empty achievements require name/rank/level
- choices require 1–2 entries
- each choice requires PTN/prodi/peminat/kuota
- alumni requires 2024/2025/2026 per choice
- school ranking accepts 0 or integer 1–1000
- final weights are 50% + 25% + 25%
- competition is informational only
- two-choice results are calculated independently
- frontend disables analysis before payment approval
- rejected/pending payment clears visible analysis result and re-locks analysis

## Environment limitation

A live Express/Multer HTTP test cannot be executed in this packaging environment because the generated project does not contain node_modules and npm registry installation is unavailable here. On Windows, run `npm.cmd install` once, then `START_SIAPP.bat`.
