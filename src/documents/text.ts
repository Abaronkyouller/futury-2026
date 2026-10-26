import { STOPWORDS } from "../config/documents";

/**
 * Text helpers shared by segmentation, search and quote verification.
 * All functions are pure so they can be tested outside the browser.
 */

/**
 * Normalizes text for comparison: unifies quotes and dashes, removes soft
 * hyphens, joins words hyphenated across PDF lines ("Vorerkran-\nkung"),
 * collapses whitespace and lower-cases.
 */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/­/g, "")
    .replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, "$1$2")
    .replace(/[„“”"«»‚‘’']/g, '"')
    .replace(/[–—‑−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Lower-cases, folds umlauts and splits into search tokens without stopwords. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .split(/[^a-z0-9§]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Checks whether a quote occurs verbatim (after normalization) in a text.
 * Quotes that the model shortened with "…" / "..." are accepted when every
 * fragment of at least 12 characters is found in order.
 */
export function quoteOccursIn(quote: string, text: string): boolean {
  const q = normalizeForMatch(quote);
  const t = normalizeForMatch(text);
  if (!q) return false;
  if (t.includes(q)) return true;
  const fragments = q
    .split(/\s*(?:…|\.\.\.|\[\.\.\.\])\s*/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 12);
  if (fragments.length < 2) return false;
  let from = 0;
  for (const f of fragments) {
    const at = t.indexOf(f, from);
    if (at === -1) return false;
    from = at + f.length;
  }
  return true;
}

/** Shortens text to a maximum length at a word boundary and marks the cut. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > max * 0.8 ? space : max)} […]`;
}

/** Start of a criterion UUID, e.g. "f41c7278-…" in the DBVO criteria table. */
const UUID_START = "[0-9a-f]{8}-[0-9a-f]{4}-";

/**
 * Splits text into sentences; keeps bullet lists attached to the sentence that
 * introduces them. A line break after ".", "!", "?" or ":" always ends a
 * sentence (table rows and headings), and a line starting with a criterion
 * UUID starts a new one.
 */
export function splitSentences(text: string): string[] {
  const withBullets = text.replace(/\s*\n\s*•\s*/g, " • ");
  return withBullets
    .split(new RegExp(`(?<=[.!?:])\\s*\\n|\\s*\\n(?=${UUID_START})`, "i"))
    .flatMap((block) =>
      block
        .replace(/\s+/g, " ")
        .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"(])/)
        .map((s) => s.trim()),
    )
    .filter(Boolean);
}

/** Short stable hash (FNV-1a, base 36) used for document ids. */
export function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).toUpperCase().slice(0, 5);
}
