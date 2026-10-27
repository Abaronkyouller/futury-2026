/**
 * Feedback database (Nachweis → Feedback): every examiner or maintainer
 * statement that steers the models, in one table.
 *
 * Most entries are derived views of data that already lives elsewhere
 * (test-case reviews, comparison decisions, requirement comments); only
 * maintainer notes and the on/off switches are stored for this page. The
 * models "learn" in context: active entries are put into later prompts. No
 * model weights are changed.
 */

/** Where an entry comes from. */
export const FEEDBACK_AREAS = ["Testfall", "Abgleich", "Anforderung", "Hinweis"] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

/** Which prompts an entry flows into. */
export const FEEDBACK_SCOPES = ["Generierung", "Abgleich", "Extraktion", "Alle"] as const;
export type FeedbackScope = (typeof FEEDBACK_SCOPES)[number];

/** Scopes a maintainer can choose for a free note. */
export const NOTE_SCOPES = ["Generierung", "Abgleich", "Alle"] as const;
export type NoteScope = (typeof NOTE_SCOPES)[number];

/** Free guidance written by an examiner or maintainer, e.g. "Datumsangaben immer TT.MM.JJJJ". */
export type MaintainerNote = {
  id: string;
  createdAt: string; // ISO timestamp
  scope: NoteScope;
  text: string;
  author: string;
};

/** One row of the feedback table. */
export type FeedbackEntry = {
  /** Stable id: "FB-" + id of the reviewed item, or the note id. */
  id: string;
  area: FeedbackArea;
  timestamp: string; // ISO timestamp
  /** Reviewed item: test case, comparison, requirement or note id. */
  subjectId: string;
  requirementId?: string;
  documentName?: string;
  /** Decision as recorded (Akzeptiert, Abgelehnt, Bestanden, …) or "Hinweis". */
  decision: string;
  comment: string;
  /** Short description of what was reviewed. */
  detail: string;
  scope: FeedbackScope;
  /** False when a maintainer switched the entry off; it then reaches no prompt. */
  active: boolean;
};
