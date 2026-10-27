/**
 * Types for H5/H6: importing results exported from the payroll software and
 * comparing them with the expected values of a generated test case.
 *
 * One language model ("KI") and a local deterministic rule-based matcher
 * assess every comparison independently, and their results are set side by
 * side. Every value the model claims to have observed is re-checked against
 * the imported text (`quoteFound`), so it cannot invent evidence unnoticed. The examiner's
 * verdict is stored separately and is the only binding result (AGENTS.md
 * instructions 4–6).
 */
import type { DocFormat } from "./document";
import type { ExpectedField } from "./review";

/** A result file exported from the payroll software (stored in IndexedDB). */
export type PayrollResult = {
  id: string;
  name: string;
  format: DocFormat;
  sizeBytes: number;
  uploadedAt: string; // ISO timestamp
  pageCount?: number;
  /** Full extracted text; the comparison works on this text only. */
  text: string;
  warnings: string[];
};

export const FIELD_VERDICTS = ["Übereinstimmung", "Abweichung", "Nicht feststellbar"] as const;
export type FieldVerdict = (typeof FIELD_VERDICTS)[number];

export const OVERALL_VERDICTS = ["Bestanden", "Nicht bestanden", "Unklar"] as const;
export type OverallVerdict = (typeof OVERALL_VERDICTS)[number];

/** Assessment of one expected field by one assessor (model or rule-based matcher). */
export type FieldAssessment = {
  field: string;
  expected: string;
  /** Value the assessor read from the result, "" if none. */
  observed: string;
  /** Verbatim excerpt of the result the assessor relies on. */
  quote: string;
  verdict: FieldVerdict;
  explanation: string;
  /** Deterministic check: the quote occurs in the imported result text. */
  quoteFound: boolean;
};

/** Who produced an assessment. */
export type AssessorKind = "model" | "regelbasiert";

export type Assessment = {
  /** Display label: "KI" or "Regelbasiert". */
  label: string;
  kind: AssessorKind;
  /** Model id, or "regelbasiert". */
  model: string;
  /** False when the call failed; then `error` explains why and the fields are empty. */
  ok: boolean;
  error?: string;
  overall: OverallVerdict;
  summary: string;
  fields: FieldAssessment[];
  /** Deterministic notes on the assessment (missing fields, inconsistent overall verdict, …). */
  notes: string[];
  /** Raw reply, truncated, so the examiner can inspect what the model said. */
  rawReply: string;
  durationMs: number;
};

/** Overall agreement of KI and rule-based matcher; "Uneinig" leaves the decision to the examiner. */
export type Consensus = OverallVerdict | "Uneinig";

/** Which assessment the examiner considered right. */
export const MODEL_RATINGS = ["KI", "Regelbasiert", "Beide", "Keines"] as const;
export type ModelRating = (typeof MODEL_RATINGS)[number];

/** Examiner's binding decision on one comparison; fed back into later comparison prompts. */
export type ComparisonFeedback = {
  verdict: OverallVerdict;
  /** Final verdict per expected field (keyed by field name). */
  fieldVerdicts: Record<string, FieldVerdict>;
  rating: ModelRating;
  comment: string;
  reviewedAt: string; // ISO timestamp
};

export type ResultComparison = {
  id: string;
  runId: string;
  createdAt: string; // ISO timestamp
  resultId: string;
  resultName: string;
  testCaseId: string;
  requirementId: string;
  caseLabel: string;
  expected: ExpectedField[];
  /** The KI assessment and the rule-based one, in that order. */
  assessments: Assessment[];
  /** Per expected field: true if KI and rule-based matcher gave the same verdict. */
  fieldAgreement: Record<string, boolean>;
  consensus: Consensus;
  feedback?: ComparisonFeedback;
};
