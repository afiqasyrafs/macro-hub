# Macro Hub: operating rules

Public dashboard of Kenanga Economics house forecasts, served by GitHub Pages from `main`.
Owner: Afiq Asyraf. Every push to `main` goes live to the public within minutes. Treat it as publishing.

## Layout
- `index.html`: the page. Reads `data/dashboard.json` at load. Holds no numbers.
- `data/dashboard.json`: single source of truth (indicators, reports, BNM monitor).
- `data/changelog.json`: append-only history. Written by the update script only.
- `scripts/apply-update.mjs`: the only way to change data.
- `scripts/validate.mjs`: must pass before any push.

## Updating numbers, views, reasoning (owner uploads a report PDF in chat)
1. Read the whole PDF. Take only figures and views the report states. Never infer or carry over a number from memory.
2. Write a patch file outside the repo (format documented at the top of `scripts/apply-update.mjs`).
   - `source` = report title and date. `date` = publication date.
   - Consensus changes only when the owner supplies it or the report prints it.
   - Reasoning: one line, 15 words or fewer where possible, UK English, no em dashes, names the driver, repeats no numbers.
   - Add the report to `addReports` only when the owner gives the public kenanga.com.my link. Never guess a URL.
3. Run `node scripts/apply-update.mjs patch.json --dry-run` and show the owner the before/after table.
4. Wait for the owner's explicit approval. House-call changes are his to confirm, not yours.
5. Apply without `--dry-run`, run `node scripts/validate.mjs`, commit (`data: <source>`), push to `main`.
6. Confirm the live site shows the change.

Never hand-edit the JSON files. Never use `--force` unless the owner confirms the specific large move.
Never commit report PDFs, the BNM workfile, raw model data, or anything not meant for the public.

## BNM Monetary Policy Monitor (weekly)
Owner supplies the refreshed input data. Rerun the owner's model as he specifies; do not substitute a different model.
Probabilities are rounded to the nearest 5 and must sum to 100 (validation enforces both).
Publish via the `bnm` block of a patch. Old probabilities move to `prev` automatically.
Only publish inputs the owner has cleared for public display.

## Changing the page (enhancements)
Edit `index.html`, keep the existing look (dark cards, red section titles, filter chips).
Check desktop and 390px mobile before pushing. Data changes and design changes go in separate commits.

## Rollback
`git revert <commit>` and push. Do not rewrite history on `main`.
