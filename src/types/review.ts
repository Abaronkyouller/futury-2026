import type { CaseTrace } from "./reasoning";

/**
 * Shared types for AI-generated test cases, examiner feedback and the change log.
 *
 * Traceability chain (AGENTS.md, "Traceability and verification instructions"):
 *   source -> requirement -> rule/criterion -> test case -> expected -> observed -> finding
 * Every generated item records where it came from so a reviewer can tell
 * source-backed statements apart from model proposals.
 */

/** Test-design techniques the model may use. German labels are shown in the UI and sent to the model. */
export const TECHNIQUES = [
  "Grenzwert",
  "Äquivalenzklasse",
  "Kombination",
  "Negativtest",
] as const;
export type Technique = (typeof TECHNIQUES)[number];

/** Impact/priority flag so the examiner knows where to look first (brainstorm: "Impact/Prior"). */
export const PRIORITIES = ["Hoch", "Mittel", "Niedrig"] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * Evidence basis of one reasoning step.
 * - Quelle: restates the given requirement/source
 * - Annahme: an assumption the examiner must confirm
 * - Generiert: a derived test idea
 */
export const BASES = ["Quelle", "Annahme", "Generiert"] as const;
export type Basis = (typeof BASES)[number];

export type ReasoningStep = {
  text: string;
  basis: Basis;
  /** Source reference the step cites; only meaningful when basis is "Quelle". */
  sourceRef?: string;
};

export type ExpectedField = { field: string; value: string };

/**
 * One step of the test procedure, typically a message exchanged between the
 * payroll software (Arbeitgeber) and the health insurer (Krankenkasse), e.g.
 * "Arbeitgeber sendet DBVO mit Abgabegrund 41".
 */
export type TestStep = {
  /** Who acts: "Arbeitgeber", "Krankenkasse", "Prüfer", … */
  actor: string;
  action: string;
  /** Abgabegrund of the message, if the step sends one (e.g. "41"). */
  abgabegrund?: string;
};

/** Result of one deterministic structural check run over a model output. */
export type CheckResult = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type ReviewDecision = "Offen" | "Akzeptiert" | "Abgelehnt";

/**
 * Where a generated case came from.
 * - model: language-model proposal via the gateway
 * - regelbasiert: derived deterministically from the verbatim source quote (no model call)
 * - offline-demo: canned response for the illustrative sample requirements, never a model call
 */
export type OriginKind = "model" | "regelbasiert" | "offline-demo";

/** UI labels per origin kind. */
export const ORIGIN_LABEL: Record<OriginKind, string> = {
  model: "KI-Vorschlag",
  regelbasiert: "Regelbasiert abgeleitet",
  "offline-demo": "Offline-Demo (simuliert)",
};

export type GenerationOrigin = {
  kind: OriginKind;
  model: string;
  runId: string;
  generatedAt: string; // ISO timestamp
};

/** Execution state. Generated cases are never executed in this prototype. */
export type ExecutionState = "Nicht ausgeführt";

export type GeneratedTestCase = {
  id: string;
  requirementId: string;
  title: string;
  technique: string;
  given: string;
  when: string;
  then: string;
  /** Concrete input data of the test constellation (e.g. AU periods). */
  testData: ExpectedField[];
  /** Ordered procedure / message flow; empty when not applicable. */
  steps: TestStep[];
  expectedFields: ExpectedField[];
  /** Criterion identifiers from the source that this case covers (e.g. UUIDs). */
  criteriaIds: string[];
  priority: Priority;
  priorityReason: string;
  reasoning: ReasoningStep[];
  sourceRefs: string[];
  openQuestions: string[];
  checks: CheckResult[];
  /** Deterministic source/ontology/graph/rule provenance details. */
  trace?: CaseTrace;
  origin: GenerationOrigin;
  review: { decision: ReviewDecision; comment: string; reviewedAt?: string };
  execution: ExecutionState;
};

export type ReasoningDetail = "kurz" | "ausführlich";

export const PRIORITY_FOCUSES = [
  "Ausgewogen",
  "Zahlbetrag & Meldung",
  "Grenzwerte",
] as const;
export type PriorityFocus = (typeof PRIORITY_FOCUSES)[number];

/** Everything the examiner can adjust before a generation run. */
export type GenerationSettings = {
  model: string;
  temperature: number;
  maxCases: number;
  techniques: Technique[];
  reasoningDetail: ReasoningDetail;
  priorityFocus: PriorityFocus;
  /** Include earlier examiner feedback in the prompt (in-context learning, no model training). */
  useFeedback: boolean;
};

export const CHANGE_KINDS = [
  "Dokument",
  "Extraktion",
  "Anforderung",
  "Generierung",
  "Prüfung",
  "Einstellungen",
  "Zurücksetzen",
] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export type ChangeLogEntry = {
  id: string;
  timestamp: string; // ISO timestamp
  kind: ChangeKind;
  summary: string;
  requirementId?: string;
  testCaseId?: string;
  /** Previous value, kept so a change is reviewable instead of silently overwritten. */
  before?: string;
  after?: string;
};
