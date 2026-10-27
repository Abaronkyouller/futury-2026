import type { TestOutcome } from "../types/testReport";
import type { ResultComparison } from "../types/validation";

/** Where a shown result comes from. */
export type OutcomeSource = "manuell" | "Abgleich" | "kein Abgleich";

/** CSS status modifier per result (green / red / grey). */
export const OUTCOME_CLASS: Record<TestOutcome, "good" | "bad" | "neutral"> = {
  "Test erfolgreich": "good",
  "Test fehlgeschlagen": "bad",
  "Test noch nicht durchgeführt": "neutral",
};

/** Latest comparison per test case (Validierung & Bericht). */
export function latestComparisons(comparisons: ResultComparison[]): Map<string, ResultComparison> {
  const latest = new Map<string, ResultComparison>();
  for (const cmp of comparisons) latest.set(cmp.testCaseId, cmp);
  return latest;
}

/**
 * Result from the comparison: only the examiner's binding verdict counts
 * ("Bestanden" → erfolgreich, "Nicht bestanden" → fehlgeschlagen). Without a
 * verdict (no comparison, model consensus only, "Unklar") the test counts as
 * not yet performed.
 */
export function comparisonOutcome(cmp: ResultComparison | undefined): TestOutcome {
  if (cmp?.feedback?.verdict === "Bestanden") return "Test erfolgreich";
  if (cmp?.feedback?.verdict === "Nicht bestanden") return "Test fehlgeschlagen";
  return "Test noch nicht durchgeführt";
}

/** Result of a case: the examiner's manual setting for a software, else the comparison. */
export function caseOutcome(caseId: string, manual: Record<string, TestOutcome> | undefined, latest: Map<string, ResultComparison>): { outcome: TestOutcome; source: OutcomeSource } {
  const set = manual?.[caseId];
  if (set) return { outcome: set, source: "manuell" };
  const cmp = latest.get(caseId);
  return { outcome: comparisonOutcome(cmp), source: cmp?.feedback ? "Abgleich" : "kein Abgleich" };
}

/** Number of cases per result. */
export function countOutcomes(outcomes: TestOutcome[]): Record<TestOutcome, number> {
  return {
    "Test erfolgreich": outcomes.filter((o) => o === "Test erfolgreich").length,
    "Test fehlgeschlagen": outcomes.filter((o) => o === "Test fehlgeschlagen").length,
    "Test noch nicht durchgeführt": outcomes.filter((o) => o === "Test noch nicht durchgeführt").length,
  };
}
