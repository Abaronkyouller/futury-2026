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

/** Result of one deterministic structural check run over a model output. */
export type CheckResult = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type ReviewDecision = "Offen" | "Akzeptiert" | "Abgelehnt";

/** Where a generated case came from. "offline-demo" is a canned response, never a model call. */
export type OriginKind = "model" | "offline-demo";

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
  expectedFields: ExpectedField[];
  priority: Priority;
  priorityReason: string;
  reasoning: ReasoningStep[];
  sourceRefs: string[];
  openQuestions: string[];
  checks: CheckResult[];
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

export type ChangeKind = "Generierung" | "Prüfung" | "Einstellungen" | "Zurücksetzen";

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
