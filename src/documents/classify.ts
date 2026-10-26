import { KIND_KEYWORDS } from "../config/documents";
import { DOC_KINDS } from "../types/document";
import type { DocClassification, DocKind } from "../types/document";

/**
 * Transparent keyword heuristic for the document kind (brainstorm bonus idea:
 * "2 types of document – government vs. technical specification").
 *
 * Scores are keyword hits per 10,000 characters, so short and long documents
 * are comparable. The matched keywords are returned as evidence, and the
 * examiner can override the result. This is a hint for the reviewer, not a
 * legal classification.
 */

/** German calendar date, e.g. 14.07.2025. */
const DATE = /\b\d{2}\.\d{2}\.\d{4}\b/g;

/** Evidence label for the date feature. */
const DATE_LABEL = "Datumsangaben";

/** Weight of one date relative to one keyword hit. */
const DATE_WEIGHT = 0.5;

/** Counts non-overlapping occurrences of a keyword in lower-case text. */
function count(haystack: string, needle: string): number {
  let n = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) n++;
  return n;
}

export function classifyDocument(text: string): DocClassification {
  const lower = text.toLowerCase();
  const per10k = 10000 / Math.max(lower.length, 1);
  const hits: { kind: DocKind; word: string; n: number }[] = [];
  const scores = Object.fromEntries(DOC_KINDS.map((k) => [k, 0])) as Record<DocKind, number>;

  for (const kind of DOC_KINDS) {
    for (const word of KIND_KEYWORDS[kind]) {
      const n = count(lower, word);
      if (n > 0) {
        hits.push({ kind, word, n });
        scores[kind] += n * per10k;
      }
    }
  }
  // Concrete calendar dates are typical for example constellations ("AU vom 01.10.2025 bis …").
  const dates = lower.match(DATE)?.length ?? 0;
  if (dates > 0) {
    hits.push({ kind: "Testkonstellation", word: DATE_LABEL, n: dates });
    scores.Testkonstellation += dates * per10k * DATE_WEIGHT;
  }
  for (const k of DOC_KINDS) scores[k] = Math.round(scores[k] * 10) / 10;

  const kind = [...DOC_KINDS].sort((a, b) => scores[b] - scores[a])[0];
  const evidence = hits
    .filter((h) => h.kind === kind)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((h) => (h.word === DATE_LABEL ? `${h.word} ×${h.n}` : `„${h.word}“ ×${h.n}`));
  return { kind, scores, evidence };
}
