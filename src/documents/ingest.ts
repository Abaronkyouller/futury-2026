import { MAX_FILE_BYTES } from "../config/documents";
import type { DocFormat, DocSection, SourceDocument } from "../types/document";
import { classifyDocument } from "./classify";
import { readDocxParagraphs } from "./extractDocx";
import { detectStand, detectVersion, removeRepeatedLines, segmentPages, segmentParagraphs } from "./segment";
import type { Paragraph } from "./segment";
import { shortHash } from "./text";

/**
 * Upload pipeline: file -> text -> sections -> classification.
 * Everything runs locally in the browser; no document content leaves the
 * machine until the examiner starts an extraction run.
 */

/** Title of DOCX/text content that is not below a heading. */
const UNTITLED_SECTION = "Dokumenttext (ohne Überschrift)";

export type IngestProgress = { stage: string; done?: number; total?: number };

function formatOf(name: string): DocFormat | null {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt" || ext === "md") return "text";
  return null;
}

/** Plain text: blank lines separate paragraphs; Markdown "#" lines are headings. */
function textParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/^#{1,6}\s/.test(p) ? { text: p.replace(/^#+\s*/, ""), heading: true } : { text: p }));
}

export async function ingestFile(file: File, onProgress: (p: IngestProgress) => void): Promise<SourceDocument> {
  const format = formatOf(file.name);
  if (!format) throw new Error(`„${file.name}“: Nur PDF, DOCX, TXT und MD werden unterstützt.`);
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`„${file.name}“ ist größer als ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  const uploadedAt = new Date().toISOString();
  const id = `D${shortHash(`${file.name}|${file.size}|${uploadedAt}`)}`;
  const warnings: string[] = [];
  let sections: DocSection[];
  let pageCount: number | undefined;
  let headText: string;

  onProgress({ stage: "Datei wird gelesen" });
  const data = await file.arrayBuffer();

  if (format === "pdf") {
    // Loaded on demand: pdf.js is large and only needed for PDF uploads.
    const { readPdfPages } = await import("./extractPdf");
    const raw = await readPdfPages(data, (done, total) => onProgress({ stage: "PDF-Seiten werden gelesen", done, total }));
    pageCount = raw.length;
    const empty = raw.filter((p) => p.length === 0).length;
    if (empty === raw.length) {
      throw new Error(`„${file.name}“ enthält keine Textebene (gescanntes PDF?). Texterkennung (OCR) ist nicht eingebaut.`);
    }
    if (empty > 0) warnings.push(`${empty} Seite(n) ohne Text (z. B. Grafiken oder Scans) – deren Inhalt fehlt.`);
    // Running headers/footers are still removed, but the removed patterns are
    // no longer reported to the examiner (the notice proved too noisy).
    const { pages } = removeRepeatedLines(raw);
    headText = raw.slice(0, 3).flat().join("\n");
    onProgress({ stage: "Abschnitte werden erkannt" });
    sections = segmentPages(pages, id);
    if (!sections.some((s) => s.number)) {
      warnings.push("Keine nummerierten Überschriften erkannt – der Text wurde in gleich große Teile zerlegt.");
    }
  } else {
    const paragraphs = format === "docx" ? readDocxParagraphs(data) : textParagraphs(new TextDecoder().decode(data));
    headText = paragraphs.slice(0, 30).map((p) => p.text).join("\n");
    // Text before the first heading (or a document without headings) gets a neutral title,
    // so references read "Datei · Dokumenttext" instead of repeating the file name.
    sections = segmentParagraphs(paragraphs, id, UNTITLED_SECTION);
  }

  if (sections.length === 0) throw new Error(`„${file.name}“ enthält keinen lesbaren Text.`);
  const fullText = sections.map((s) => s.text).join("\n");
  const version = detectVersion(headText);
  const stand = detectStand(headText);
  if (!version && !stand) warnings.push("Keine Version und kein Stand im Dokumentkopf gefunden – bitte manuell prüfen.");

  const classification = classifyDocument(fullText);
  return {
    id,
    name: file.name,
    format,
    sizeBytes: file.size,
    uploadedAt,
    pageCount,
    version,
    stand,
    sections,
    classification,
    // Example constellations are shown to the model as structure reference by default.
    role: classification.kind === "Testkonstellation" ? "Formatbeispiel" : "Spezifikation",
    charCount: fullText.length,
    warnings,
  };
}

/** Reference label for a section, e.g. "3.12 Datenbaustein DBVO … · Teil 2/6 · S. 136–137". */
export function sectionLabel(s: DocSection): string {
  const pages =
    s.pageStart === undefined ? "" : s.pageStart === s.pageEnd ? ` · S. ${s.pageStart}` : ` · S. ${s.pageStart}–${s.pageEnd}`;
  const part = s.part ? ` · Teil ${s.part.index}/${s.part.total}` : "";
  return `${s.number ? `${s.number} ` : ""}${s.title}${part}${pages}`;
}

/** Version info as printed, or an explicit "not stated" marker (never invented). */
export function versionLabel(d: SourceDocument): string {
  return [d.version, d.stand].filter(Boolean).join(" · ") || "Version/Stand nicht angegeben";
}
