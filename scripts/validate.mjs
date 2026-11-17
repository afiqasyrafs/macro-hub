#!/usr/bin/env node
// Usage: node scripts/validate.mjs      Exit code 1 on any error.
import { DATA, LOG, SEEN, load, validate } from "./lib.mjs";

let data;
try { data = load(DATA); } catch (e) { console.error("ERROR  dashboard.json is not valid JSON: " + e.message); process.exit(1); }
try { if (!Array.isArray(load(LOG))) throw new Error("not an array"); }
catch (e) { console.error("ERROR  changelog.json: " + e.message); process.exit(1); }

try {
  const seen = load(SEEN);
  for (const k of ["processed", "pending"]) {
    if (!Array.isArray(seen[k]) || seen[k].some(u => typeof u !== "string" || !u.startsWith("https://www.kenanga.com.my/"))) throw new Error(`'${k}' must be an array of kenanga.com.my URLs`);
  }
} catch (e) { console.error("ERROR  processed.json: " + e.message); process.exit(1); }

const { errors, warnings } = validate(data);
warnings.forEach(w => console.log("WARN   " + w));
errors.forEach(e => console.error("ERROR  " + e));
console.log(`\n${data.indicators.length} indicators, ${data.reports.length} reports, BNM monitor ${data.bnm ? "on" : "off"}`);
console.log(errors.length ? `FAILED: ${errors.length} error(s)` : `OK (${warnings.length} warning(s))`);
process.exit(errors.length ? 1 : 0);
