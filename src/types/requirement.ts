import type { DocKind } from "./document";

/** Examiner decision on a requirement. Only "Genehmigt" requirements may be compiled into rules. */
export const REQUIREMENT_STATUSES = ["Offen", "Genehmigt", "Abgelehnt"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

/** How a requirement was extracted from an uploaded document. */
export type ExtractionMethod = "model" | "regelbasiert";

/**
 * Link from an extracted requirement back to its source document (AGENTS.md
 * instructions 1 and 2). The original wording (`quote`) is kept next to the
 * interpretation (`statement`), and `quoteVerified` records whether the quote
 * was found verbatim in the cited section.
 */
export type RequirementOrigin = {
  documentId: string;
  documentName: string;
  /** Version/date as detected in the document; undefined if the document states none. */
  documentVersion?: string;
  documentKind: DocKind;
  sectionId: string;
  /** Human-readable reference, e.g. "3.12 Datenbaustein DBVO – Vorerkrankungszeiten · S. 134–135". */
  sectionLabel: string;
  /** Verbatim excerpt from the source. */
  quote: string;
  /** True if the quote was found in the cited section text (deterministic check). */
  quoteVerified: boolean;
  /** Note when the quote was found in a different section than the one the model cited. */
  quoteNote?: string;
  /** Model's interpretation in its own words. */
  statement: string;
  conditions: string[];
  dataFields: string[];
  ambiguities: string[];
  /** Criterion identifier printed in the source (e.g. a UUID), if any. */
  criterionId?: string;
  extractedBy: ExtractionMethod;
  model?: string;
  runId: string;
  extractedAt: string; // ISO timestamp
  /** Section text (truncated) given to the generator as context. */
  sectionText: string;
};

export type Req = {
  id: string;
  title: string;
  benefit: string;
  source: string;
  /** Extraction confidence; only present for the illustrative sample requirements. */
  confidence?: number;
  status: RequirementStatus;
  rule?: string;
  /** Examiner comment on the requirement (fed back into later extractions). */
  comment?: string;
  /** Present for requirements extracted from an uploaded document. */
  origin?: RequirementOrigin;
};
