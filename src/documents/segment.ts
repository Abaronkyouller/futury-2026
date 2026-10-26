import { REPEATED_LINE_SHARE, SECTION_MAX_CHARS } from "../config/documents";
import type { DocSection } from "../types/document";

/**
 * Splits extracted document text into addressable sections.
 *
 * PDFs: numbered headings ("3.12 Datenbaustein DBVO …") are detected per line.
 * Tables of contents and change histories repeat heading numbers out of order,
 * so only the longest strictly increasing chain of heading numbers is kept
 * (the real document structure). Long sections are split into parts.
 *
 * DOCX/text: heading paragraphs (by style) start sections; otherwise the text
 * is chunked by paragraphs. All functions are pure.
 */

/** Text lines of one page, in reading order. */
export type PageLines = string[];

/** A heading candidate found in the page stream. */
type Heading = { line: number; number: string; parts: number[]; title: string; lineCount?: number };

const HEADING = /^(\d{1,2}(?:\.\d{1,3}){0,4})\.?\s+(\S.{1,160})$/;
/** Table-of-contents entries end with a dot leader and a page number. */
const TOC_LEADER = /(?:(?:\.\s?){4,}|…+)\s*\d+\s*$/;
/** Chapter titles start with a capital letter; lines starting with a quote are inline field references. */
const TITLE_START = /^[A-ZÄÖÜ]/;

/** Number of lines at the top and bottom of a page checked for running headers/footers. */
const EDGE_LINES = 4;

/** Replaces digits so "Seite 3 von 168" and "Seite 4 von 168" count as the same line. */
const lineKey = (line: string) => line.replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

/**
 * Removes running headers/footers: lines that appear (digit-insensitive) on at
 * least REPEATED_LINE_SHARE of the pages. Returns the cleaned pages and the
 * patterns that were removed.
 */
export function removeRepeatedLines(pages: PageLines[]): { pages: PageLines[]; removed: string[] } {
  if (pages.length < 4) return { pages, removed: [] };
  // Only the first and last lines of a page can be running headers/footers;
  // repeated words inside the body (e.g. "Lösung:") are content and stay.
  const isEdge = (page: PageLines, i: number) => i < EDGE_LINES || i >= page.length - EDGE_LINES;
  const counts = new Map<string, number>();
  for (const page of pages) {
    const keys = new Set(page.filter((_, i) => isEdge(page, i)).map(lineKey));
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.ceil(pages.length * REPEATED_LINE_SHARE));
  const repeated = new Set([...counts].filter(([k, n]) => k && n >= threshold).map(([k]) => k));
  return {
    pages: pages.map((p) => p.filter((l, i) => !(isEdge(p, i) && repeated.has(lineKey(l))))),
    removed: [...repeated],
  };
}

/** Compares two heading numbers as tuples: 3.4 < 3.12 < 4. */
function compareParts(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

/** Longest strictly increasing subsequence of heading numbers (O(n²), n is small). */
function longestIncreasingChain(cands: Heading[]): Heading[] {
  const n = cands.length;
  const len = new Array<number>(n).fill(1);
  const prev = new Array<number>(n).fill(-1);
  let best = -1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (compareParts(cands[j].parts, cands[i].parts) < 0 && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
    }
    if (best === -1 || len[i] > len[best]) best = i;
  }
  const chain: Heading[] = [];
  for (let i = best; i !== -1; i = prev[i]) chain.unshift(cands[i]);
  return chain;
}

/** True if a line looks like a numbered heading (not a TOC entry or a sentence). */
function headingFrom(line: string, index: number): Heading | null {
  const m = HEADING.exec(line.trim());
  if (!m) return null;
  const [, number, rawTitle] = m;
  const title = rawTitle.trim();
  if (!TITLE_START.test(title) || TOC_LEADER.test(title) || /[.,;:]$/.test(title)) return null;
  const parts = number.split(".").map(Number);
  if (parts[0] === 0 || parts[0] > 30) return null;
  return { line: index, number, parts, title };
}

/** Splits a long section into parts at paragraph (or sentence) boundaries. */
export function splitLong(section: DocSection, max = SECTION_MAX_CHARS): DocSection[] {
  if (section.text.length <= max) return [section];
  const chunks: string[] = [];
  let current = "";
  for (const para of section.text.split(/\n(?=\S)/)) {
    if (current && current.length + para.length + 1 > max) {
      chunks.push(current);
      current = "";
    }
    if (para.length > max) {
      // A single huge paragraph: cut at sentence ends.
      for (const piece of para.match(new RegExp(`[\\s\\S]{1,${max}}(?:[.!?]\\s|$)`, "g")) ?? [para]) {
        if (current) chunks.push(current);
        current = piece;
      }
    } else {
      current = current ? `${current}\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((text, i) => ({
    ...section,
    id: `${section.id}-T${i + 1}`,
    part: { index: i + 1, total: chunks.length },
    text,
  }));
}

/**
 * Joins PDF lines into running text. Words hyphenated at a line end
 * ("Arbeitsunfähigkeitsbescheini-" + "gung") are rejoined; other line breaks stay.
 */
export function joinLines(lines: string[]): string {
  let out = "";
  for (const line of lines) {
    if (out.endsWith("-") && /\p{L}-$/u.test(out) && /^\p{Ll}/u.test(line)) out = out.slice(0, -1) + line;
    else out = out ? `${out}\n${line}` : line;
  }
  return out;
}

/** Builds sections from PDF pages. Text before the first heading becomes "Vorspann". */
export function segmentPages(pages: PageLines[], docId: string): DocSection[] {
  const stream: { text: string; page: number }[] = [];
  pages.forEach((lines, i) => lines.forEach((text) => stream.push({ text, page: i + 1 })));

  const candidates = stream
    .map((l, i) => headingFrom(l.text, i))
    .filter((h): h is Heading => h !== null)
    .map((h) => {
      // Titles hyphenated across two lines: "… Erkrankung/Verlet-" + "zung …".
      const next = stream[h.line + 1]?.text;
      if (!h.title.endsWith("-") || !next) return h;
      const joined = /^\p{Ll}/u.test(next) ? h.title.slice(0, -1) + next : h.title + next;
      return { ...h, title: joined, lineCount: 2 };
    });
  const headings = longestIncreasingChain(candidates);

  // Running chapter headers repeat a heading title at the top of later pages
  // ("Datenbaustein DBVO – Vorerkrankungszeiten"); they are dropped from the text.
  const runningHeaders = new Set(headings.map((h) => h.title));

  const sections: DocSection[] = [];
  let counter = 0;
  const push = (from: number, to: number, number: string | undefined, title: string) => {
    const lines = stream.slice(from, to).filter((l) => !runningHeaders.has(l.text));
    if (!lines.some((l) => l.text.trim())) return;
    counter += 1;
    const id = `${docId}-S${String(counter).padStart(3, "0")}`;
    // Long sections are split by lines so every part keeps its own page range.
    const chunks: (typeof lines)[] = [[]];
    let size = 0;
    for (const line of lines) {
      if (size + line.text.length > SECTION_MAX_CHARS && chunks[chunks.length - 1].length > 0) {
        chunks.push([]);
        size = 0;
      }
      chunks[chunks.length - 1].push(line);
      size += line.text.length + 1;
    }
    chunks.forEach((chunk, i) =>
      sections.push({
        id: chunks.length > 1 ? `${id}-T${i + 1}` : id,
        number,
        title,
        pageStart: chunk[0].page,
        pageEnd: chunk[chunk.length - 1].page,
        part: chunks.length > 1 ? { index: i + 1, total: chunks.length } : undefined,
        text: joinLines(chunk.map((l) => l.text)).trim(),
      }),
    );
  };

  const first = headings[0]?.line ?? stream.length;
  push(0, first, undefined, "Vorspann (Titel, Änderungen, Inhaltsverzeichnis)");
  headings.forEach((h, i) => {
    const end = headings[i + 1]?.line ?? stream.length;
    // The heading line(s) become the title, not part of the text.
    push(h.line + (h.lineCount ?? 1), end, h.number, h.title);
  });
  return sections;
}

/** A paragraph of a DOCX/text document; `heading` marks heading-styled paragraphs. */
export type Paragraph = { text: string; heading?: boolean };

/** Builds sections from paragraphs (DOCX or plain text). */
export function segmentParagraphs(paragraphs: Paragraph[], docId: string, fallbackTitle: string): DocSection[] {
  const groups: { title: string; paras: string[] }[] = [];
  for (const p of paragraphs) {
    if (p.heading || groups.length === 0) {
      groups.push({ title: p.heading ? p.text : fallbackTitle, paras: p.heading ? [] : [p.text] });
    } else {
      groups[groups.length - 1].paras.push(p.text);
    }
  }
  return groups
    .filter((g) => g.paras.join("").trim())
    .map((g, i) => ({
      id: `${docId}-S${String(i + 1).padStart(3, "0")}`,
      title: g.title,
      text: g.paras.join("\n"),
    }))
    .flatMap((s) => splitLong(s));
}

/** Finds a version as printed in the first pages, e.g. "Version 13.4". Never guesses. */
export function detectVersion(text: string): string | undefined {
  return /\bVersion\s+\d+(?:\.\d+)+\b/.exec(text)?.[0];
}

/** Finds a status/issue date as printed, e.g. "Stand: 10.03.2026" or "in der Fassung vom 10.12.2025". */
export function detectStand(text: string): string | undefined {
  return (
    /\bStand:?\s*\d{2}\.\d{2}\.\d{4}/.exec(text)?.[0] ??
    /\bin der Fassung vom\s+\d{2}\.\d{2}\.\d{4}/.exec(text)?.[0]
  );
}
