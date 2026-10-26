import type { DocSection } from "../types/document";
import { tokenize } from "./text";

/**
 * Ranks document sections against the examiner's focus terms (H1: identify
 * relevant requirements). Okapi BM25 with prefix matching, so the query
 * "Vorerkrankung" also matches the German compounds "Vorerkrankungszeiten" and
 * "Vorerkrankungsanfrage". Title hits count extra. Deterministic and
 * explainable: the matched terms are returned with each score.
 */

const K1 = 1.2;
const B = 0.75;
/** Weight of a term occurring in the section title/number. */
const TITLE_BOOST = 3;
/** Query tokens shorter than this must match exactly (no prefix matching). */
const MIN_PREFIX_LEN = 4;

export type RankedSection = {
  section: DocSection;
  score: number;
  /** Query terms found in this section with their counts. */
  matched: { term: string; count: number }[];
};

type Indexed = { section: DocSection; tf: Map<string, number>; title: Set<string>; length: number };

function index(section: DocSection): Indexed {
  const tokens = tokenize(section.text);
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return {
    section,
    tf,
    title: new Set(tokenize(`${section.number ?? ""} ${section.title}`)),
    length: tokens.length,
  };
}

/** Occurrences of a query term in a section (prefix match for longer terms). */
function termCount(doc: Indexed, term: string): number {
  if (term.length < MIN_PREFIX_LEN) return doc.tf.get(term) ?? 0;
  let n = 0;
  for (const [token, c] of doc.tf) if (token.startsWith(term)) n += c;
  return n;
}

function inTitle(doc: Indexed, term: string): boolean {
  if (term.length < MIN_PREFIX_LEN) return doc.title.has(term);
  for (const t of doc.title) if (t.startsWith(term)) return true;
  return false;
}

/**
 * Returns sections sorted by relevance. With an empty query the original
 * order is kept and every score is 0.
 */
export function rankSections(sections: DocSection[], query: string): RankedSection[] {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return sections.map((section) => ({ section, score: 0, matched: [] }));

  const docs = sections.map(index);
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / Math.max(docs.length, 1) || 1;
  const df = new Map(terms.map((t) => [t, docs.filter((d) => termCount(d, t) > 0).length]));

  return docs
    .map((d) => {
      let score = 0;
      const matched: RankedSection["matched"] = [];
      for (const term of terms) {
        const count = termCount(d, term);
        const titleHit = inTitle(d, term);
        if (count === 0 && !titleHit) continue;
        const n = df.get(term) ?? 0;
        const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
        const tfPart = (count * (K1 + 1)) / (count + K1 * (1 - B + (B * d.length) / avgLen));
        score += idf * (tfPart + (titleHit ? TITLE_BOOST : 0));
        matched.push({ term, count });
      }
      return { section: d.section, score: Math.round(score * 100) / 100, matched };
    })
    .sort((a, b) => b.score - a.score);
}
