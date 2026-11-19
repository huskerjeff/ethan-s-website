# AGENTS.md — Ethan's Arena project workflow

## Purpose
Maintain Ethan's sports-and-adventure site using a **Muse reviews → ChatGPT implements → GitHub tracks → Muse verifies** cycle. Preserve source review artifacts, traceability, and child privacy.

## Handling completed Muse tasks
1. Read the latest Muse result and the task's original acceptance criteria. Do not confuse **review completed** with **recommendations implemented**.
2. Record the source task/result filename or link and map findings to a prioritized implementation checklist.
3. Implement approved improvements on a separate GitHub feature branch. Commit coherent changes, validate them, and open a pull request into `main`. Never claim browser or deploy testing unless performed.
4. Keep the original Muse review and result as permanent records. After the implementation has been verified and merged, update the task to **Completed — Implemented**, referencing the PR, merge commit, changed features, tests, and any deferred issues.
5. Move the fully completed task **out of Muse's active inbox** into the existing Completed/Archive directory. Prefer moving rather than deleting or duplicating. Do not archive a partially implemented task as implemented.
6. Create a **new** Muse review task for the changed website, including the live preview URL if verified, the merged commit, desktop/mobile/keyboard testing criteria, and request a comparison against Muse's original 5/10 source-review baseline.
7. On follow-up review, log remaining defects and start another cycle rather than silently reusing the completed task.

## Safety and quality
- Do not disclose Ethan's last name, school, age, home address, exact routines, or private photos.
- Keep gameplay state local to the device; no user profiles, tracking, analytics, advertising, or forms.
- Preserve reduced-motion fallback, keyboard functionality, and a static experience if WebGL or a CDN fails.
- Do not confuse code committed to a branch with a deployed production website.
- Do not enable public deployment or change repository visibility without checking the user's intended exposure.
- Verify dates, sports facts, and licensing before publishing.
