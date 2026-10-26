/** Any generated title/text describing a numbered condition as not fulfilled. */
const HIDDEN_CONDITION_FAILURE = /\bbedingung\s+\d+\s+(?:ist\s+)?nicht\s+erfüllt\b/i;

/** True when the complete case entry must be hidden from Dokumente & Testfälle. */
export function isHiddenCaseTitle(title: string): boolean {
  return HIDDEN_CONDITION_FAILURE.test(title.normalize("NFKC").replace(/\s+/g, " "));
}

type ConditionCase = {
  title: string;
  given?: string;
  technique?: string;
  testData?: { field: string; value: string }[];
};

/**
 * Detects condition-failure cases even when an older migration already cleared
 * their title. The test-data fallback targets only numbered condition rows and
 * does not hide unrelated negative tests.
 */
export function isHiddenConditionFailureCase(item: ConditionCase): boolean {
  if (isHiddenCaseTitle(item.title) || HIDDEN_CONDITION_FAILURE.test(item.given ?? "")) return true;
  return item.technique === "Negativtest" && Boolean(item.testData?.some(
    (field) => /^Bedingung\s+\d+/i.test(field.field) && /nicht\s+erfüllt/i.test(field.value),
  ));
}

/** Removes a specifically retired generated title while preserving the case itself. */
export function sanitizeCaseTitle(title: string): string {
  return isHiddenCaseTitle(title) ? "" : title;
}

/** Numbered condition row produced by the rule-based derivation ("Bedingung 2: …"). */
const CONDITION_ROW = /^Bedingung\s+\d+\b/i;

/**
 * True for the condition bookkeeping rows ("erfüllt" / "nicht erfüllt") that the
 * rule-based derivation adds per source condition. They restate the source and
 * are neither test data nor an expected result, so they are not shown.
 */
export function isConditionStatusRow(row: { field: string; value: string }): boolean {
  return CONDITION_ROW.test(row.field) && /^(nicht\s+)?erfüllt$/i.test(row.value.trim());
}

/** Field rows a reviewer sees: without the condition bookkeeping rows. */
export function visibleFields<T extends { field: string; value: string }>(rows: T[]): T[] {
  return rows.filter((row) => !isConditionStatusRow(row));
}
