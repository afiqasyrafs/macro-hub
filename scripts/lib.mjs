// Shared rules for validate.mjs and apply-update.mjs. No dependencies.
import { readFileSync } from "node:fs";

export const DATA = new URL("../data/dashboard.json", import.meta.url);
export const LOG = new URL("../data/changelog.json", import.meta.url);

export const CATEGORIES = ["Macro", "FX", "Rates", "Central Banks"];
export const VIEWS = ["Bullish", "Bearish", "Optimistic", "Pessimistic", "Hawkish", "Dovish", "Neutral"];
export const IND_FIELDS = ["id", "indicator", "category", "horizon", "latest", "previous", "consensus", "view", "reasoning", "updated"];
export const STALE_DAYS = 45;
export const MAX_REASONING_WORDS = 25;

export const load = url => JSON.parse(readFileSync(url, "utf8"));
export const isStr = v => typeof v === "string";
export const num = v => { const n = parseFloat(String(v).replace(/,/g, "")); return isNaN(n) ? null : n; };

export function isIsoDate(s) {
  if (!isStr(s) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

// Today in Kuala Lumpur, as YYYY-MM-DD.
export function todayKL() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export function validate(data) {
  const errors = [], warnings = [];
  const today = todayKL();
  const E = m => errors.push(m), W = m => warnings.push(m);

  if (!data || typeof data !== "object") return { errors: ["Top level is not an object"], warnings };
  if (!Array.isArray(data.indicators) || !data.indicators.length) E("indicators: must be a non-empty array");
  if (!Array.isArray(data.reports)) E("reports: must be an array");

  const ids = new Set();
  (data.indicators || []).forEach((r, i) => {
    const tag = `indicators[${i}]${r && r.id ? " (" + r.id + ")" : ""}`;
    if (!r || typeof r !== "object") return E(`${tag}: not an object`);
    for (const f of IND_FIELDS) if (!isStr(r[f])) E(`${tag}: '${f}' must be a string`);
    for (const k of Object.keys(r)) if (!IND_FIELDS.includes(k)) E(`${tag}: unknown field '${k}'`);
    for (const f of ["id", "indicator", "latest", "view"]) if (isStr(r[f]) && !r[f].trim()) E(`${tag}: '${f}' is blank`);
    if (isStr(r.id)) {
      if (!/^[a-z0-9-]+$/.test(r.id)) E(`${tag}: id must be lowercase letters, digits, hyphens`);
      if (ids.has(r.id)) E(`${tag}: duplicate id`);
      ids.add(r.id);
    }
    if (isStr(r.category) && !CATEGORIES.includes(r.category)) E(`${tag}: category '${r.category}' not in ${CATEGORIES.join(", ")}`);
    if (isStr(r.view) && !VIEWS.includes(r.view)) E(`${tag}: view '${r.view}' not in ${VIEWS.join(", ")}`);
    if (isStr(r.latest) && r.latest.trim() && num(r.latest) === null) E(`${tag}: latest '${r.latest}' is not numeric`);
    if (isStr(r.consensus) && r.consensus.trim() && num(r.consensus) === null) E(`${tag}: consensus '${r.consensus}' is not numeric`);
    if (!isIsoDate(r.updated)) E(`${tag}: updated must be YYYY-MM-DD`);
    else {
      if (r.updated > today) E(`${tag}: updated ${r.updated} is in the future`);
      const age = Math.round((Date.parse(today) - Date.parse(r.updated)) / 86400000);
      if (age > STALE_DAYS) W(`${tag}: last updated ${age} days ago`);
    }
    if (isStr(r.reasoning)) {
      if (!r.reasoning.trim()) W(`${tag}: reasoning is blank`);
      if (r.reasoning.includes("—")) E(`${tag}: reasoning contains an em dash`);
      const words = r.reasoning.trim().split(/\s+/).filter(Boolean).length;
      if (words > MAX_REASONING_WORDS) W(`${tag}: reasoning is ${words} words (target ${MAX_REASONING_WORDS} or fewer)`);
    }
    if (isStr(r.consensus) && !r.consensus.trim()) W(`${tag}: consensus is blank`);
  });

  const links = new Set();
  (data.reports || []).forEach((r, i) => {
    const tag = `reports[${i}]`;
    if (!r || typeof r !== "object") return E(`${tag}: not an object`);
    for (const f of ["title", "link", "category", "date"]) if (!isStr(r[f]) || !r[f].trim()) E(`${tag}: '${f}' missing`);
    if (isStr(r.category) && !CATEGORIES.includes(r.category)) E(`${tag}: category '${r.category}' not allowed`);
    if (isStr(r.link) && !/^https:\/\/\S+$/.test(r.link)) E(`${tag}: link must be an https URL`);
    if (isStr(r.link)) { if (links.has(r.link)) E(`${tag}: duplicate link`); links.add(r.link); }
    if (!isIsoDate(r.date)) E(`${tag}: date must be YYYY-MM-DD`);
    else if (r.date > today) E(`${tag}: date ${r.date} is in the future`);
  });

  const b = data.bnm;
  if (b !== null && b !== undefined) {
    if (typeof b !== "object") E("bnm: must be null or an object");
    else {
      for (const f of ["currentOPR", "houseCall", "taylorRate", "commentary"]) if (!isStr(b[f])) E(`bnm.${f}: must be a string`);
      if (!isIsoDate(b.nextMPC)) E("bnm.nextMPC: must be YYYY-MM-DD");
      else if (b.nextMPC < today) W(`bnm.nextMPC ${b.nextMPC} has passed`);
      if (!isIsoDate(b.modelAsOf)) E("bnm.modelAsOf: must be YYYY-MM-DD");
      else if (b.modelAsOf > today) E("bnm.modelAsOf is in the future");
      const checkProbs = (p, tag) => {
        if (!p || typeof p !== "object") return E(`${tag}: missing`);
        let sum = 0;
        for (const k of ["hike", "hold", "cut"]) {
          const v = p[k];
          if (typeof v !== "number" || v < 0 || v > 100) { E(`${tag}.${k}: must be a number from 0 to 100`); continue; }
          if (v % 5 !== 0) E(`${tag}.${k}: ${v} is not a multiple of 5 (house style)`);
          sum += v;
        }
        if (sum !== 100) E(`${tag}: hike + hold + cut = ${sum}, must be 100`);
      };
      checkProbs(b.probs, "bnm.probs");
      if (b.prev) { checkProbs(b.prev, "bnm.prev"); if (!isIsoDate(b.prev.date)) E("bnm.prev.date: must be YYYY-MM-DD"); }
      if (b.inputs) {
        const t = b.inputs;
        if (!Array.isArray(t.headers) || !Array.isArray(t.rows)) E("bnm.inputs: needs headers[] and rows[]");
        else t.rows.forEach((r, i) => { if (!Array.isArray(r) || r.length !== t.headers.length) E(`bnm.inputs.rows[${i}]: needs ${t.headers.length} cells`); });
      }
      if (isStr(b.commentary) && b.commentary.includes("—")) E("bnm.commentary contains an em dash");
    }
  }
  return { errors, warnings };
}
