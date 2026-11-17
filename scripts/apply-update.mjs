#!/usr/bin/env node
// Applies a patch file to data/dashboard.json, safely.
//
//   node scripts/apply-update.mjs patch.json --dry-run   show the before/after table only
//   node scripts/apply-update.mjs patch.json             apply, log, validate
//   node scripts/apply-update.mjs patch.json --force     allow moves larger than the guard
//
// Patch format (every block optional except source and date):
// {
//   "source": "Ringgit Weekly (13 November 2026)",
//   "date": "2026-11-13",
//   "indicators": [ { "id": "usdmyr", "set": { "latest": "4.05", "view": "Bullish", "reasoning": "..." } } ],
//   "addIndicators": [ { full indicator object without 'updated' } ],
//   "removeIndicators": [ "id" ],
//   "addReports": [ { "title": "...", "link": "https://...", "category": "FX", "date": "2026-11-13" } ],
//   "bnm": { any BNM fields; new probs automatically move the old ones to prev }
// }
//
// Safety rules: unknown ids and unknown fields are rejected; a change in 'latest' moves the old
// value to 'previous'; a numeric move above MAX_MOVE needs --force; the result must pass
// validation or nothing is written.
import { readFileSync, writeFileSync } from "node:fs";
import { DATA, LOG, load, validate, num, isIsoDate, todayKL } from "./lib.mjs";

const MAX_MOVE = 0.25; // 25% change in latest or consensus triggers the guard
const SETTABLE = ["indicator", "category", "horizon", "latest", "consensus", "view", "reasoning"];

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const dry = args.includes("--dry-run");
const force = args.includes("--force");
const die = m => { console.error("REJECTED: " + m); process.exit(1); };
if (!file) die("usage: node scripts/apply-update.mjs patch.json [--dry-run] [--force]");

let patch;
try { patch = JSON.parse(readFileSync(file, "utf8")); } catch (e) { die("patch is not valid JSON: " + e.message); }
if (typeof patch.source !== "string" || !patch.source.trim()) die("patch.source is required (report title or 'manual')");
if (!isIsoDate(patch.date)) die("patch.date must be YYYY-MM-DD");
if (patch.date > todayKL()) die("patch.date is in the future");

const data = load(DATA);
const log = load(LOG);
const changes = [];
const rec = (target, field, from, to) => changes.push({ date: patch.date, source: patch.source, target, field, from, to });

for (const p of patch.indicators || []) {
  const row = data.indicators.find(r => r.id === p.id);
  if (!row) die(`no indicator with id '${p.id}'. Known ids: ${data.indicators.map(r => r.id).join(", ")}`);
  if (!p.set || typeof p.set !== "object") die(`indicator '${p.id}': 'set' is required`);
  let touched = false;
  for (const [k, v] of Object.entries(p.set)) {
    if (!SETTABLE.includes(k)) die(`indicator '${p.id}': field '${k}' cannot be set (allowed: ${SETTABLE.join(", ")})`);
    if (typeof v !== "string") die(`indicator '${p.id}': '${k}' must be a string, e.g. "4.05"`);
    if (row[k] === v) continue;
    if ((k === "latest" || k === "consensus") && !force) {
      const a = num(row[k]), b = num(v);
      if (a !== null && b !== null && a !== 0 && Math.abs(b - a) / Math.abs(a) > MAX_MOVE) {
        die(`indicator '${p.id}': ${k} ${row[k]} -> ${v} is a move above ${MAX_MOVE * 100}%. Check the number, then rerun with --force if it is right.`);
      }
    }
    if (k === "latest") { rec(p.id, "previous", row.previous, row.latest); row.previous = row.latest; }
    rec(p.id, k, row[k], v);
    row[k] = v;
    touched = true;
  }
  if (touched) row.updated = patch.date;
}

for (const r of patch.addIndicators || []) {
  if (data.indicators.some(x => x.id === r.id)) die(`indicator '${r.id}' already exists`);
  data.indicators.push({ ...r, updated: patch.date });
  rec(r.id, "added", "", r.latest);
}

for (const id of patch.removeIndicators || []) {
  const i = data.indicators.findIndex(r => r.id === id);
  if (i === -1) die(`cannot remove '${id}': not found`);
  rec(id, "removed", data.indicators[i].latest, "");
  data.indicators.splice(i, 1);
}

for (const r of patch.addReports || []) {
  if (data.reports.some(x => x.link === r.link)) { console.log(`skip: report already listed (${r.title})`); continue; }
  data.reports.push(r);
  rec("report", "added", "", r.title);
}
data.reports.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first

if (patch.bnm) {
  const old = data.bnm;
  const next = { ...(old || {}), ...patch.bnm };
  if (patch.bnm.probs && old && old.probs && JSON.stringify(old.probs) !== JSON.stringify(patch.bnm.probs)) {
    next.prev = { ...old.probs, date: old.modelAsOf };
  }
  for (const k of Object.keys(patch.bnm)) {
    const a = JSON.stringify(old ? old[k] : undefined), b = JSON.stringify(patch.bnm[k]);
    if (a !== b && k !== "inputs") rec("bnm", k, old && old[k] !== undefined ? old[k] : "", patch.bnm[k]);
    if (a !== b && k === "inputs") rec("bnm", "inputs", "(table)", "(table updated)");
  }
  data.bnm = next;
}

if (!changes.length) { console.log("No changes: the dashboard already matches this patch."); process.exit(0); }

const show = v => (typeof v === "object" ? JSON.stringify(v) : String(v));
const clip = s => (s.length > 60 ? s.slice(0, 57) + "..." : s);
console.log(`\nSource: ${patch.source}   Date: ${patch.date}\n`);
console.log(["TARGET".padEnd(12), "FIELD".padEnd(11), "BEFORE".padEnd(60), "AFTER"].join("  "));
for (const c of changes) console.log([c.target.padEnd(12), c.field.padEnd(11), clip(show(c.from)).padEnd(60), clip(show(c.to))].join("  "));

const { errors, warnings } = validate(data);
warnings.forEach(w => console.log("WARN   " + w));
if (errors.length) { errors.forEach(e => console.error("ERROR  " + e)); die("result fails validation. Nothing written."); }

if (dry) { console.log("\nDry run only. Nothing written."); process.exit(0); }
writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");
writeFileSync(LOG, JSON.stringify(log.concat(changes), null, 2) + "\n");
console.log(`\nApplied ${changes.length} change(s). Run: node scripts/validate.mjs`);
