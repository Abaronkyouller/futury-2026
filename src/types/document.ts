/**
 * Types for uploaded source documents (government specifications, technical
 * procedure descriptions, example test constellations).
 *
 * Traceability (AGENTS.md instruction 1): every section keeps the file name,
 * the detected version/date (never invented) and its page range or section
 * number, so an extracted requirement can always point back to its origin.
 */

/**
 * Document kind (brainstorm bonus idea: distinguish government specifications
 * from technical documents). Determined by a transparent keyword heuristic; the
 * matched keywords are stored alongside it as evidence.
 * - Fachlich: legal/business rules (Gesetz, Rundschreiben, Grundsätze)
 * - Technisch: procedure or data-record description (Datenbaustein, Feld, Abgabegrund)
 * - Testkonstellation: example scenario or test constellation
 */
export const DOC_KINDS = ["Fachlich", "Technisch", "Testkonstellation"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

/**
 * What kind of source the document is. Both roles are sources for test-case
 * generation; the label only records what the document contains.
 * - Spezifikation: fachliche Vorgaben (Gesetz, Rundschreiben, Grundsätze)
 * - Technische Informationen: Verfahrens- oder Datensatzbeschreibung
 */
export const DOC_ROLES = ["Spezifikation", "Technische Informationen"] as const;
export type DocRole = (typeof DOC_ROLES)[number];

export type DocFormat = "pdf" | "docx" | "text";

/** One addressable part of a document (a numbered chapter, or a chunk). */
export type DocSection = {
  /** Stable id inside the app, e.g. "D3F9-S042". */
  id: string;
  /** Section number as printed in the document, e.g. "3.12"; absent for unnumbered chunks. */
  number?: string;
  title: string;
  /** 1-based page range in the original PDF; absent for DOCX/text. */
  pageStart?: number;
  pageEnd?: number;
  /** Set when a long section was split: part index (1-based) and total parts. */
  part?: { index: number; total: number };
  text: string;
};

/** Result of the keyword heuristic, kept so the classification is explainable. */
export type DocClassification = {
  kind: DocKind;
  /** Keyword hits per kind. */
  scores: Record<DocKind, number>;
  /** Most frequent matched keywords, e.g. "Datenbaustein ×41". */
  evidence: string[];
};

export type SourceDocument = {
  id: string;
  name: string;
  format: DocFormat;
  sizeBytes: number;
  uploadedAt: string; // ISO timestamp
  pageCount?: number;
  /** Version as printed in the document (e.g. "Version 13.4"); undefined if not found. */
  version?: string;
  /** Status date as printed (e.g. "Stand: 10.03.2026"); undefined if not found. */
  stand?: string;
  sections: DocSection[];
  classification: DocClassification;
  role: DocRole;
  charCount: number;
  /** Extraction notes the examiner should see (e.g. pages without text). */
  warnings: string[];
};
