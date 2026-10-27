import { findAbgabegrund, findThresholds, parseRestriction } from "../documents/conditions";
import { versionLabel } from "../documents/ingest";
import { normalizeForMatch, quoteOccursIn, tokenize, truncate } from "../documents/text";
import type { SourceDocument } from "../types/document";
import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import type { RuleChange, RuleChangeRun, RuleMatch, RuleVersion } from "../types/ruleChange";

/**
 * Detects how the rules of a document changed compared with its predecessor
 * version. Everything is deterministic and explainable:
 *  1. pair rules by criterion id, else by section number + text similarity,
 *     else by text similarity alone;
 *  2. a paired rule with different wording is "Geändert", with the concrete
 *     differences (thresholds, Abgabegrund, number of conditions);
 *  3. an unpaired new rule is "Neu" unless its quote occurs verbatim in the
 *     predecessor's text (then the earlier extraction just missed it);
 *  4. an unpaired old rule is "Entfallen" unless its quote still occurs in the
 *     new document's text.
 * Pure functions; the caller stores the result.
 */

/** Minimum token similarity to pair two rules by text alone. */
const TEXT_MATCH = 0.55;
/** Lower similarity is enough when both rules are in the same numbered section. */
const SECTION_TEXT_MATCH = 0.35;
/** Rule names in the table are shortened to this many characters. */
const RULE_LABEL_CHARS = 90;

/** File name without extension, versions, dates and filler words – identifies a document family. */
export function documentStem(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/\b(version|vers|v|stand|endfassung|entwurf|final|ab|gültig|gueltig)\b/g, " ")
    .replace(/\d+([._-]\d+)*/g, " ")
    .replace(/[^a-zäöüß]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** The most recently uploaded earlier document of the same family, if any. */
export function findPredecessor(doc: SourceDocument, documents: SourceDocument[]): SourceDocument | undefined {
  const stem = documentStem(doc.name);
  if (!stem) return undefined;
  return documents
    .filter((d) => d.id !== doc.id && d.uploadedAt < doc.uploadedAt && documentStem(d.name) === stem)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];
}

/** Token-set similarity (Jaccard) of two texts, 0–1. */
export function similarity(a: string, b: string): number {
  const x = new Set(tokenize(a));
  const y = new Set(tokenize(b));
  if (!x.size && !y.size) return 1;
  let common = 0;
  for (const t of x) if (y.has(t)) common++;
  return common / (x.size + y.size - common);
}

/** Leading section number of a label, e.g. "2.1" from "2.1 Voraussetzung · S. 1". */
const sectionNo = (label: string) => /^\d+(?:\.\d+)*/.exec(label)?.[0];

/** Removes a leading criterion UUID so the rule wording itself is compared. */
const wording = (quote: string) => quote.replace(/^\s*[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\s*(?:=\s*\S+\s*)?/i, "").trim();

/** Short name of a rule for the table. */
function ruleName(r: Req): string {
  const o = r.origin!;
  const where = o.criterionId ? `Kriterium ${o.criterionId.slice(0, 8)}…` : sectionNo(o.sectionLabel) ? `Abschnitt ${sectionNo(o.sectionLabel)}` : o.sectionLabel;
  return `${where} · ${truncate(wording(o.quote), RULE_LABEL_CHARS)}`;
}

function versionOf(r: Req, doc: SourceDocument | undefined): RuleVersion {
  const o = r.origin!;
  return {
    requirementId: r.id,
    documentId: o.documentId,
    documentName: o.documentName,
    documentVersion: doc ? versionLabel(doc) : o.documentVersion,
    sectionLabel: o.sectionLabel,
    quote: o.quote,
  };
}

/** Concrete, explainable differences between two versions of a rule. */
export function describeDifferences(before: Req, after: Req): string[] {
  const a = before.origin!;
  const b = after.origin!;
  const out: string[] = [];
  const ta = findThresholds(a.quote).map((t) => t.text);
  const tb = findThresholds(b.quote).map((t) => t.text);
  if (ta.join("|") !== tb.join("|")) {
    const removed = ta.filter((t) => !tb.includes(t));
    const added = tb.filter((t) => !ta.includes(t));
    if (removed.length && added.length) out.push(`Schwellenwert: ${removed.join(", ")} → ${added.join(", ")}`);
    else if (added.length) out.push(`Neuer Schwellenwert: ${added.join(", ")}`);
    else if (removed.length) out.push(`Schwellenwert entfallen: ${removed.join(", ")}`);
  }
  const ga = findAbgabegrund(a.quote);
  const gb = findAbgabegrund(b.quote);
  if (ga !== gb) out.push(`Abgabegrund: ${ga ?? "–"} → ${gb ?? "–"}`);
  const ca = (a.conditions.length ? a.conditions : parseRestriction(a.quote)?.conditions ?? []).length;
  const cb = (b.conditions.length ? b.conditions : parseRestriction(b.quote)?.conditions ?? []).length;
  if (ca !== cb) out.push(`Anzahl Bedingungen: ${ca} → ${cb}`);
  if (sectionNo(a.sectionLabel) && sectionNo(b.sectionLabel) && sectionNo(a.sectionLabel) !== sectionNo(b.sectionLabel)) {
    out.push(`Abschnitt: ${sectionNo(a.sectionLabel)} → ${sectionNo(b.sectionLabel)}`);
  }
  if (out.length === 0) out.push("Formulierung geändert");
  return out;
}

/** Keeps one requirement per wording (repeated extractions produce duplicates). */
function uniqueRules(reqs: Req[]): Req[] {
  const seen = new Set<string>();
  return reqs.filter((r) => {
    if (!r.origin) return false;
    const key = normalizeForMatch(r.origin.quote);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const docText = (d: SourceDocument | undefined) => (d ? d.sections.map((s) => s.text).join("\n") : "");

export type DetectInput = {
  doc: SourceDocument;
  predecessor: SourceDocument | undefined;
  /** Rules extracted from `doc`. */
  newReqs: Req[];
  /** Rules extracted earlier from the predecessor. */
  oldReqs: Req[];
  cases: GeneratedTestCase[];
  now?: Date;
};

/** Compares the rules of a document with those of its predecessor. */
export function detectRuleChanges({ doc, predecessor, newReqs, oldReqs, cases, now = new Date() }: DetectInput): {
  run: RuleChangeRun;
  changes: RuleChange[];
} {
  const detectedAt = now.toISOString();
  const runId = `RA-${now.getTime()}`;
  const fresh = uniqueRules(newReqs);
  const run: RuleChangeRun = {
    id: runId,
    detectedAt,
    documentId: doc.id,
    documentName: doc.name,
    documentVersion: versionLabel(doc),
    predecessorId: predecessor?.id,
    predecessorName: predecessor?.name,
    predecessorVersion: predecessor ? versionLabel(predecessor) : undefined,
    counts: { neu: 0, geaendert: 0, entfallen: 0, unveraendert: 0 },
  };
  if (!predecessor) {
    run.note = `Keine Vorgängerversion – ${fresh.length} Regel(n) als Ausgangsstand erfasst.`;
    return { run, changes: [] };
  }
  const old = uniqueRules(oldReqs);
  if (old.length === 0) {
    run.note = `Vorgängerversion „${predecessor.name}“ wurde noch nicht analysiert – kein Vergleich möglich.`;
    return { run, changes: [] };
  }

  // 1. Candidate pairs with a score; greedy assignment, best pairs first.
  type Pair = { n: Req; o: Req; score: number; sim: number; by: RuleMatch };
  const pairs: Pair[] = [];
  for (const n of fresh) {
    for (const o of old) {
      const nc = n.origin!.criterionId;
      const sim = similarity(wording(n.origin!.quote), wording(o.origin!.quote));
      if (nc && nc === o.origin!.criterionId) {
        pairs.push({ n, o, score: 10 + sim, sim, by: "Kriterium-ID" });
        continue;
      }
      if (nc && o.origin!.criterionId) continue; // different criteria never pair
      const sameSection = Boolean(sectionNo(n.origin!.sectionLabel)) && sectionNo(n.origin!.sectionLabel) === sectionNo(o.origin!.sectionLabel);
      if (sameSection && sim >= SECTION_TEXT_MATCH) pairs.push({ n, o, score: 1 + sim, sim, by: "Abschnitt + Text" });
      else if (sim >= TEXT_MATCH) pairs.push({ n, o, score: sim, sim, by: "Text" });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedNew = new Set<string>();
  const usedOld = new Set<string>();
  const changes: RuleChange[] = [];
  const affected = (r: Req) => cases.filter((c) => c.requirementId === r.id).map((c) => c.id);
  let counter = 0;
  const id = () => `${runId}-${++counter}`;

  for (const p of pairs) {
    if (usedNew.has(p.n.id) || usedOld.has(p.o.id)) continue;
    usedNew.add(p.n.id);
    usedOld.add(p.o.id);
    if (normalizeForMatch(wording(p.n.origin!.quote)) === normalizeForMatch(wording(p.o.origin!.quote))) {
      run.counts.unveraendert++;
      continue;
    }
    run.counts.geaendert++;
    changes.push({
      id: id(), runId, detectedAt, kind: "Geändert", rule: ruleName(p.n), criterionId: p.n.origin!.criterionId,
      before: versionOf(p.o, predecessor), after: versionOf(p.n, doc), matchedBy: p.by,
      similarity: Math.round(p.sim * 100) / 100, differences: describeDifferences(p.o, p.n), affectedCaseIds: affected(p.o),
    });
  }

  // 3. Unpaired new rules: new, unless the predecessor's text already contained them.
  const oldText = docText(predecessor);
  for (const n of fresh) {
    if (usedNew.has(n.id)) continue;
    if (oldText && quoteOccursIn(wording(n.origin!.quote), oldText)) {
      run.counts.unveraendert++;
      continue;
    }
    run.counts.neu++;
    changes.push({
      id: id(), runId, detectedAt, kind: "Neu", rule: ruleName(n), criterionId: n.origin!.criterionId,
      after: versionOf(n, doc), differences: ["Regel kommt in der Vorgängerversion nicht vor"], affectedCaseIds: [],
    });
  }

  // 4. Unpaired old rules: dropped, unless the new text still contains them.
  const newText = docText(doc);
  for (const o of old) {
    if (usedOld.has(o.id)) continue;
    if (quoteOccursIn(wording(o.origin!.quote), newText)) {
      run.counts.unveraendert++;
      continue;
    }
    run.counts.entfallen++;
    changes.push({
      id: id(), runId, detectedAt, kind: "Entfallen", rule: ruleName(o), criterionId: o.origin!.criterionId,
      before: versionOf(o, predecessor), differences: ["Regel steht nicht mehr im Dokument"], affectedCaseIds: affected(o),
    });
  }
  return { run, changes };
}

/** One segment of a word-level diff. */
export type DiffPart = { text: string; op: "same" | "del" | "ins" };

/** Word-level diff (LCS) of two texts for the before/after display. */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (text: string, op: DiffPart["op"]) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ text, op });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push(a[i], "same"); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push(a[i], "del"); i++; }
    else { push(b[j], "ins"); j++; }
  }
  while (i < n) push(a[i++], "del");
  while (j < m) push(b[j++], "ins");
  return out;
}
