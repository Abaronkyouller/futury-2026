/** Test result of a case for a software (German labels shown in the UI, filters and PDF). */
export const TEST_OUTCOMES = ["Test erfolgreich", "Test fehlgeschlagen", "Test noch nicht durchgeführt"] as const;
export type TestOutcome = (typeof TEST_OUTCOMES)[number];

/**
 * Test report (Testbericht) for one payroll software under test: which test
 * cases are assigned to it. Results come from the comparisons on
 * "Validierung & Bericht"; the report itself stores only the assignment.
 */
export type TestReport = {
  /** Local time of the first save, YYYYMMDDHHMMSS (suffix "-2" … if two reports are saved in the same second). */
  id: string;
  /** Name of the payroll software under test (required). */
  software: string;
  vendor: string;
  examiner: string;
  /** Assigned test-case ids, in the order they were assigned. */
  caseIds: string[];
  /** Results set by the examiner for this software (case id → result); without an entry the comparison decides. */
  outcomes?: Record<string, TestOutcome>;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
};
