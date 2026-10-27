import { createContext, useContext } from "react";
import type { ExtractionMethod, Req, RequirementStatus } from "../types/requirement";
import type {
  ChangeKind,
  ChangeLogEntry,
  GeneratedTestCase,
  GenerationSettings,
  ReviewDecision,
} from "../types/review";
import type { ComparisonFeedback, ResultComparison } from "../types/validation";
import type { MaintainerNote, NoteScope } from "../types/feedback";
import type { RuleChange, RuleChangeRun } from "../types/ruleChange";

/** Persisted part of the review state (localStorage, this browser only). */
export type ReviewState = {
  /** Illustrative sample requirements plus requirements extracted from uploaded documents. */
  requirements: Req[];
  cases: GeneratedTestCase[];
  changelog: ChangeLogEntry[];
  settings: GenerationSettings;
  /** Comparisons of imported payroll results with test cases (Validierung & Bericht). */
  comparisons: ResultComparison[];
  /** Free guidance by examiners/maintainers (Feedback page). */
  feedbackNotes: MaintainerNote[];
  /** Feedback entries switched off on the Feedback page; they reach no prompt. */
  feedbackExcluded: string[];
  /** Detected changes of rules between document versions (Änderungsprotokoll → Regeln). */
  ruleChanges: RuleChange[];
  /** One entry per comparison of a document with its predecessor. */
  ruleChangeRuns: RuleChangeRun[];
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
  /** Restores quote-verified requirements and cases from the document cache. */
  restoreCachedGeneration: (documentName: string, cachedAt: string, requirements: Req[], cases: GeneratedTestCase[]) => void;
  /** Records an examiner decision/comment; previous values are kept in the change log. */
  reviewCase: (caseId: string, decision: ReviewDecision, comment: string) => void;
  /** Persists feedback before a replacement case is generated. */
  submitCaseFeedback: (caseId: string, comment: string) => void;
  /** Stores one two-model comparison and logs it. */
  addComparison: (comparison: ResultComparison) => void;
  /** Records the examiner's binding verdict on a comparison; the previous value is logged. */
  reviewComparison: (id: string, feedback: ComparisonFeedback) => void;
  /** Adds a maintainer note that is fed into the chosen prompts. */
  addFeedbackNote: (scope: NoteScope, text: string, author: string) => void;
  /** Deletes a maintainer note (derived entries can only be switched off). */
  removeFeedbackNote: (id: string) => void;
  /** Switches a feedback entry on or off for future prompts; logged. */
  setFeedbackActive: (entryId: string, active: boolean, label: string) => void;
  /** Stores the result of comparing a document's rules with its predecessor; logged. */
  recordRuleChanges: (run: RuleChangeRun, changes: RuleChange[]) => void;
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
