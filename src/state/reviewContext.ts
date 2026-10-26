import { createContext, useContext } from "react";
import type { ExtractionMethod, Req, RequirementStatus } from "../types/requirement";
import type {
  ChangeKind,
  ChangeLogEntry,
  GeneratedTestCase,
  GenerationSettings,
  ReviewDecision,
} from "../types/review";

/** Persisted part of the review state (localStorage, this browser only). */
export type ReviewState = {
  /** Illustrative sample requirements plus requirements extracted from uploaded documents. */
  requirements: Req[];
  cases: GeneratedTestCase[];
  changelog: ChangeLogEntry[];
  settings: GenerationSettings;
  /** Version marker for one-time migrations of persisted priority assignments. */
  priorityAssignmentVersion: number;
};

/** Fields of a change-log entry a caller provides; id and timestamp are added by the store. */
export type LogInput = Omit<ChangeLogEntry, "id" | "timestamp">;

export type ReviewStore = ReviewState & {
  /** Adds requirements of one extraction run and logs it. */
  addRequirements: (documentName: string, runId: string, method: ExtractionMethod, reqs: Req[]) => void;
  /** Records an examiner decision/comment on a requirement; the previous value is logged. */
  reviewRequirement: (id: string, status: RequirementStatus, comment: string) => void;
  /** Adds the cases of one generation run and logs it. */
  addRun: (requirementId: string, runId: string, cases: GeneratedTestCase[], feedbackCaseId?: string) => void;
  /** Records an examiner decision/comment; previous values are kept in the change log. */
  reviewCase: (caseId: string, decision: ReviewDecision, comment: string) => void;
  /** Persists feedback before a replacement case is generated. */
  submitCaseFeedback: (caseId: string, comment: string) => void;
  /** Updates generation settings and logs what changed. */
  updateSettings: (next: GenerationSettings) => void;
  /** Removes all generated cases and feedback; the reset itself is logged. */
  resetCases: () => void;
  /** Appends a free change-log entry (used for document events). */
  logEvent: (kind: ChangeKind, fields: Omit<LogInput, "kind">) => void;
};

export const ReviewContext = createContext<ReviewStore | null>(null);

/** Access the review store. Must be used inside <ReviewProvider>. */
export function useReviewStore(): ReviewStore {
  const store = useContext(ReviewContext);
  if (!store) throw new Error("useReviewStore muss innerhalb von <ReviewProvider> verwendet werden.");
  return store;
}
