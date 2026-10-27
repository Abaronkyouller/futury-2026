/**
 * Change log of rules/specifications (Änderungsprotokoll → Regeln &
 * Spezifikationen). When a document is analysed, its extracted rules are
 * compared with those of its predecessor version (AGENTS.md instruction 7:
 * keep the prior version and timestamp, identify affected cases, never
 * overwrite the baseline silently).
 */

export const RULE_CHANGE_KINDS = ["Neu", "Geändert", "Entfallen"] as const;
export type RuleChangeKind = (typeof RULE_CHANGE_KINDS)[number];

/** How a new rule was paired with its predecessor rule. */
export type RuleMatch = "Kriterium-ID" | "Abschnitt + Text" | "Text";

/** One version of a rule as extracted from a document. */
export type RuleVersion = {
  requirementId: string;
  documentId: string;
  documentName: string;
  /** Version/Stand as printed, if any. */
  documentVersion?: string;
  sectionLabel: string;
  quote: string;
};

export type RuleChange = {
  id: string;
  runId: string;
  detectedAt: string; // ISO timestamp
  kind: RuleChangeKind;
  /** Human-readable rule name: criterion id or section, plus the start of the rule. */
  rule: string;
  criterionId?: string;
  before?: RuleVersion;
  after?: RuleVersion;
  matchedBy?: RuleMatch;
  /** Text similarity of before/after quote (0–1), for "Geändert". */
  similarity?: number;
  /** Concrete differences, e.g. "Schwellenwert: mindestens 30 Tage → mindestens 42 Tage". */
  differences: string[];
  /** Test cases generated from the earlier rule that must be checked again. */
  affectedCaseIds: string[];
  /** True for the illustrative sample history (src/data/ruleChanges.ts), never for detected changes. */
  sample?: boolean;
};

/** One comparison of a document with its predecessor (summary shown as a timeline). */
export type RuleChangeRun = {
  id: string;
  detectedAt: string; // ISO timestamp
  documentId: string;
  documentName: string;
  documentVersion?: string;
  predecessorId?: string;
  predecessorName?: string;
  predecessorVersion?: string;
  /** Why no comparison was possible, e.g. no predecessor version. */
  note?: string;
  counts: { neu: number; geaendert: number; entfallen: number; unveraendert: number };
  /** True for the illustrative sample history, never for real comparisons. */
  sample?: boolean;
};
