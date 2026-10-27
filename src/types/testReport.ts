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
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
};
