import { MAX_FILE_BYTES } from "../config/documents";
import { readDocxParagraphs } from "../documents/extractDocx";
import { formatOf } from "../documents/ingest";
import { joinLines } from "../documents/segment";
import { shortHash } from "../documents/text";
import type { PayrollResult } from "../types/validation";

/**
 * Reads a result file exported from the payroll software into plain text,
 * locally in the browser. Unlike specifications, results are not segmented:
 * the comparison needs the whole log, page by page in reading order.
 */
export async function ingestResult(file: File): Promise<PayrollResult> {
  const format = formatOf(file.name);
  if (!format) throw new Error(`„${file.name}“: Nur PDF, DOCX, TXT und MD werden unterstützt.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`„${file.name}“ ist größer als ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  const data = await file.arrayBuffer();
  const warnings: string[] = [];
  let text: string;
  let pageCount: number | undefined;

  if (format === "pdf") {
    const { readPdfPages } = await import("../documents/extractPdf");
    const pages = await readPdfPages(data);
    pageCount = pages.length;
    const empty = pages.filter((p) => p.length === 0).length;
    if (empty === pages.length) throw new Error(`„${file.name}“ enthält keine Textebene (gescanntes PDF?).`);
    if (empty > 0) warnings.push(`${empty} Seite(n) ohne Text – deren Inhalt fehlt im Abgleich.`);
    text = pages.map((lines, i) => `[Seite ${i + 1}]\n${joinLines(lines)}`).join("\n\n");
  } else if (format === "docx") {
    text = readDocxParagraphs(data).map((p) => p.text).join("\n");
  } else {
    text = new TextDecoder().decode(data);
  }
  if (!text.trim()) throw new Error(`„${file.name}“ enthält keinen lesbaren Text.`);
  if (!/DEMO-DATEN|fiktiv/i.test(text)) {
    warnings.push("Kein Demo-Kennzeichen gefunden – Ergebnisse echter Abrechnungen enthalten personenbezogene Daten und werden an das Modell gesendet.");
  }
  const uploadedAt = new Date().toISOString();
  return {
    id: `E${shortHash(`${file.name}|${file.size}|${uploadedAt}`)}`,
    name: file.name,
    format,
    sizeBytes: file.size,
    uploadedAt,
    pageCount,
    text,
    warnings,
  };
}
