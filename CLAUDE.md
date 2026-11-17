# Macro Hub: operating rules

Public dashboard of Kenanga Economics house forecasts, served by GitHub Pages from `main`.
Owner: Afiq Asyraf. Every push to `main` goes live to the public within minutes. Treat it as publishing.

## Layout
- `index.html`: the page. Reads `data/dashboard.json` at load. Holds no numbers.
- `data/dashboard.json`: single source of truth (indicators, reports, BNM monitor).
- `data/changelog.json`: append-only history. Written by the update script only.
- `scripts/apply-update.mjs`: the only way to change data.
- `scripts/validate.mjs`: must pass before any push.

## Publishing mode: fully automatic
On 17 Nov 2026 the owner chose fully automatic publishing. No approval step is needed for changes that
follow the rules below. The scripts' guards are the safety net: if a guard rejects a change, do not work
around it. Leave that change out, publish the rest, and tell the owner.

## Source of reports
Public feed (JSON): `https://www.kenanga.com.my/wp-content/uploads/json/insights/posts/en/daily-research-reports/page-1.json`
- `posts[]` are the daily "Kenanga Today" pages (about 15, newest first). Each `permalink` page links that day's PDFs.
- Economic Viewpoint PDFs are the links whose file name starts with `EV_`. The six digits before `-Kenanga` are the publication date (YYMMDD).
- `data/processed.json` lists PDFs already handled (`processed`) and PDFs to handle on the next run even if they have left the feed (`pending`).
- Work only from the PDF's extracted text. If the text cannot be extracted, do not read numbers off an image: skip the report, leave it unprocessed, and tell the owner.

## Updating from a report (scheduled run, or a PDF the owner sends in chat)
1. Read the whole PDF. Take only figures the report prints. Never infer, interpolate or carry a number from memory.
2. Map the report to the dashboard:
   | Report (file name contains) | Slot | Indicators it may update |
   |---|---|---|
   | Ringgit-Weekly | ringgit-weekly | usdmyr, and usdcny / usdjpy only if their forecasts are printed |
   | Bond_Market_Weekly | bond-weekly | mgs, ust |
   | BNM_MPC, or a BNM thematic | bnm | bnm |
   | US-FOMC | fed | fed |
   | Bank-of-Japan | boj | boj |
   | CPI | my-cpi | my-cpi |
   | GDP | my-gdp | my-gdp |
   | any other EV | none | an indicator only if the report prints a revised house forecast for it |
3. For each indicator:
   - `latest`: the house forecast for the horizon already shown on the card. If the report does not print that
     horizon, leave the card unchanged and tell the owner. Never switch a card's horizon without the owner.
   - `view`: change only when the report states the stance in so many words. Otherwise leave it.
   - `reasoning`: one line from the driver the report gives. 15 words or fewer where possible, UK English,
     no em dashes, no numbers repeated from the card.
   - `consensus`: only when the report prints it or the owner supplies it.
4. Reports list: add the report with its slot (the newest report replaces the older one in that slot).
   Title style: `Ringgit Weekly (16 November 2026)`, `MY CPI (Sep-26)`. Link = the exact PDF URL from the feed. Never guess a URL.
5. Write one patch per report, outside the repo (format at the top of `scripts/apply-update.mjs`).
   `source` = report title, `date` = publication date, `markProcessed` = the PDF URL.
6. `node scripts/apply-update.mjs patch.json --dry-run`, then apply, then `node scripts/validate.mjs`.
7. Commit (`data: <source>`) and push to `main`. One commit per report.
8. Tell the owner what changed: the before/after table, anything skipped, and why.

Never hand-edit the JSON files. Never use `--force` in an unattended run; in chat, only when the owner confirms that specific move.
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
