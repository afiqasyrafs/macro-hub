# Macro Hub

Kenanga Economics house forecasts: macro, FX, rates and central banks.

Static site. All content lives in `data/dashboard.json`. See `CLAUDE.md` for the update procedure.

    node scripts/validate.mjs
    node scripts/apply-update.mjs patch.json --dry-run
