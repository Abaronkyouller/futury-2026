import { createContext, useContext } from "react";
import type {
  ChangeLogEntry,
  GeneratedTestCase,
  GenerationSettings,
  ReviewDecision,
} from "../types/review";

/** Persisted part of the review state (localStorage, this browser only). */
export type ReviewState = {
  cases: GeneratedTestCase[];
  changelog: ChangeLogEntry[];
  settings: GenerationSettings;
};

export type ReviewStore = ReviewState & {
  /** Adds the cases of one generation run and logs it. */
  addRun: (requirementId: string, runId: string, cases: GeneratedTestCase[]) => void;
  /** Records an examiner decision/comment; previous values are kept in the change log. */
  reviewCase: (caseId: string, decision: ReviewDecision, comment: string) => void;
  /** Updates generation settings and logs what changed. */
  updateSettings: (next: GenerationSettings) => void;
  /** Removes all generated cases and feedback; the reset itself is logged. */
  resetCases: () => void;
};

export const ReviewContext = createContext<ReviewStore | null>(null);

/** Access the review store. Must be used inside <ReviewProvider>. */
export function useReviewStore(): ReviewStore {
  const store = useContext(ReviewContext);
  if (!store) throw new Error("useReviewStore must be used inside <ReviewProvider>.");
  return store;
}
