import { strFromU8, unzipSync } from "fflate";
import type { Paragraph } from "./segment";

/**
 * Reads the body of a DOCX file (word/document.xml) in the browser.
 * Paragraphs keep their order; heading styles are flagged; list items get a
 * bullet; each table row becomes one line with cells separated by " | " so
 * tabular test constellations (Abgabegrund, DSID, …) stay readable.
 */

/** Paragraph styles treated as headings ("Heading 1", "Überschrift 2", "Titel"). */
const HEADING_STYLE = /heading|berschrift|title|titel/i;

/** Direct children of an element with the given local name (namespace-agnostic). */
function children(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === name);
}

/** Text of a paragraph: runs, tabs and line breaks. */
function paragraphText(p: Element): string {
  let text = "";
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.localName === "t") text += child.textContent ?? "";
      else if (child.localName === "tab") text += "\t";
      else if (child.localName === "br") text += "\n";
      else walk(child);
    }
  };
  walk(p);
  return text.replace(/[ \t]+/g, " ").trim();
}

function paragraphInfo(p: Element): Paragraph | null {
  const text = paragraphText(p);
  if (!text) return null;
  const pPr = children(p, "pPr")[0];
  const style = pPr ? children(pPr, "pStyle")[0]?.getAttribute("w:val") ?? "" : "";
  const isList = Boolean(pPr && (children(pPr, "numPr").length > 0 || /liste|list/i.test(style)));
  return { text: isList ? `• ${text}` : text, heading: HEADING_STYLE.test(style) };
}

function tableRows(tbl: Element): Paragraph[] {
  return children(tbl, "tr")
    .map((tr) =>
      children(tr, "tc")
        .map((tc) => children(tc, "p").map(paragraphText).filter(Boolean).join(" "))
        .join(" | ")
        .trim(),
    )
    .filter((row) => row.replace(/[|\s]/g, ""))
    .map((text) => ({ text }));
}

/** Extracts paragraphs from a DOCX file. Throws if the file is not a valid DOCX. */
export function readDocxParagraphs(data: ArrayBuffer): Paragraph[] {
  const files = unzipSync(new Uint8Array(data), { filter: (f) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("Die Datei enthält kein word/document.xml – ist es eine gültige DOCX-Datei?");
  const doc = new DOMParser().parseFromString(strFromU8(xml), "application/xml");
  const body = Array.from(doc.getElementsByTagName("*")).find((el) => el.localName === "body");
  if (!body) throw new Error("Der Dokumentinhalt (w:body) wurde nicht gefunden.");

  const result: Paragraph[] = [];
  for (const el of Array.from(body.children)) {
    if (el.localName === "p") {
      const p = paragraphInfo(el);
      if (p) result.push(p);
    } else if (el.localName === "tbl") {
      result.push(...tableRows(el));
    }
  }
  return result;
}
