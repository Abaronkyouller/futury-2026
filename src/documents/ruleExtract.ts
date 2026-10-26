import { MAX_QUOTE_CHARS, NORMATIVE_PATTERNS } from "../config/documents";
import type { DocSection } from "../types/document";
import { splitSentences, truncate } from "./text";

/**
 * Rule-based requirement candidates (works without a model).
 *
 * A sentence is a candidate when it matches one of the NORMATIVE_PATTERNS
 * ("darf … nur", "muss", "ist … zu übermitteln", "sichergestellt", …). The
 * sentence itself is the verbatim quote, so every candidate is source-backed
 * by construction. The interpretation fields stay empty: this extractor does
 * not paraphrase or infer conditions.
 */

export type RuleCandidate = {
  section: DocSection;
  quote: string;
  /** Which normative pattern matched, shown to the examiner. */
  trigger: string;
};

/**
 * Rows of a field table in the procedure description ("033- 040 008 n M
 * BEGINN-AU-…": positions, length, type, mandatory flag) are layout, not prose.
 */
const TABLE_ROW = /\b\d{3}\s?-\s?\d{3}\s+\d{3}\s+(?:an|n|a)\s+[MKmk]\b/;

/** Short human-readable name of a matched pattern, e.g. "darf … nur". */
function describe(match: RegExpExecArray): string {
  const words = match[0].split(/\s+/);
  return words.length > 3 ? `${words[0]} … ${words[words.length - 1]}` : match[0];
}

/** Number of normative sentences in a section; shown to the examiner and used to pick sections. */
export function countNormative(section: DocSection): number {
  return findNormativeSentences([section], Number.MAX_SAFE_INTEGER).length;
}

/** Finds normative sentences in the given sections, in document order. */
export function findNormativeSentences(sections: DocSection[], limit: number): RuleCandidate[] {
  const out: RuleCandidate[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    for (const sentence of splitSentences(section.text)) {
      if (sentence.length < 40 || seen.has(sentence) || TABLE_ROW.test(sentence)) continue;
      for (const pattern of NORMATIVE_PATTERNS) {
        const m = pattern.exec(sentence);
        if (m) {
          seen.add(sentence);
          out.push({ section, quote: truncate(sentence, MAX_QUOTE_CHARS), trigger: describe(m) });
          break;
        }
      }
      if (out.length >= limit) return out;
    }
  }
  return out;
}
