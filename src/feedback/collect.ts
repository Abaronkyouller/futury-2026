import { FEEDBACK_EXAMPLES_MAX } from "../config/ai";
import type { FeedbackEntry, MaintainerNote, NoteScope } from "../types/feedback";
import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import { ORIGIN_LABEL } from "../types/review";
import type { ResultComparison } from "../types/validation";

/**
 * Builds the feedback database from the review state and selects what goes
 * into a prompt. All functions are pure.
 */

/** Id of the feedback entry belonging to a reviewed item. */
export const feedbackId = (subjectId: string) => `FB-${subjectId}`;

/** True if an item's feedback may reach a prompt (not switched off on the Feedback page). */
export const isActive = (subjectId: string, excluded: readonly string[]) => !excluded.includes(feedbackId(subjectId));

export type FeedbackSources = {
  cases: GeneratedTestCase[];
  comparisons: ResultComparison[];
  requirements: Req[];
  notes: MaintainerNote[];
  excluded: readonly string[];
};

/** All feedback entries, newest first. */
export function collectFeedback({ cases, comparisons, requirements, notes, excluded }: FeedbackSources): FeedbackEntry[] {
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const entries: FeedbackEntry[] = [];

  for (const c of cases) {
    const comment = c.review.comment.trim();
    if (c.review.decision === "Offen" && !comment) continue;
    const req = reqById.get(c.requirementId);
    entries.push({
      id: feedbackId(c.id),
      area: "Testfall",
      timestamp: c.review.reviewedAt ?? c.origin.generatedAt,
      subjectId: c.id,
      requirementId: c.requirementId,
      documentName: req?.origin?.documentName,
      decision: c.review.decision === "Offen" ? "Kommentar" : c.review.decision,
      comment,
      detail: `${c.title || c.technique || "Testfall"} · ${ORIGIN_LABEL[c.origin.kind]}`,
      scope: "Generierung",
      active: isActive(c.id, excluded),
    });
  }

  for (const cmp of comparisons) {
    if (!cmp.feedback) continue;
    entries.push({
      id: feedbackId(cmp.id),
      area: "Abgleich",
      timestamp: cmp.feedback.reviewedAt,
      subjectId: cmp.id,
      requirementId: cmp.requirementId,
      documentName: cmp.resultName,
      decision: cmp.feedback.verdict,
      comment: cmp.feedback.comment,
      detail: `„${cmp.resultName}“ ↔ ${cmp.testCaseId} · zutreffend: ${cmp.feedback.rating}`,
      scope: "Abgleich",
      active: isActive(cmp.id, excluded),
    });
  }

  for (const r of requirements) {
    // Sample requirements ship with a status; only real examiner input counts.
    if (!r.comment && !(r.origin && r.status !== "Offen")) continue;
    entries.push({
      id: feedbackId(r.id),
      area: "Anforderung",
      timestamp: r.origin?.extractedAt ?? "",
      subjectId: r.id,
      requirementId: r.id,
      documentName: r.origin?.documentName,
      decision: r.status,
      comment: r.comment ?? "",
      detail: r.title,
      scope: "Extraktion",
      active: isActive(r.id, excluded),
    });
  }

  for (const n of notes) {
    entries.push({
      id: n.id,
      area: "Hinweis",
      timestamp: n.createdAt,
      subjectId: n.id,
      decision: "Hinweis",
      comment: n.text,
      detail: `von ${n.author}`,
      scope: n.scope,
      active: !excluded.includes(n.id),
    });
  }

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Reviewed test cases fed into a generation prompt for `req`: active ones
 * only, most relevant first (same requirement, then same document, then any),
 * newest first within each group, at most FEEDBACK_EXAMPLES_MAX. Returned in
 * chronological order so the prompt reads like a history.
 */
export function selectGenerationFeedback(
  cases: GeneratedTestCase[],
  req: Req,
  requirements: Req[],
  excluded: readonly string[],
): GeneratedTestCase[] {
  const doc = req.origin?.documentId;
  const docOf = new Map(requirements.map((r) => [r.id, r.origin?.documentId]));
  const relevance = (c: GeneratedTestCase) =>
    c.requirementId === req.id ? 2 : doc && docOf.get(c.requirementId) === doc ? 1 : 0;
  const time = (c: GeneratedTestCase) => c.review.reviewedAt ?? c.origin.generatedAt;
  return cases
    .filter((c) => c.review.decision !== "Offen" && isActive(c.id, excluded))
    .sort((a, b) => relevance(b) - relevance(a) || time(b).localeCompare(time(a)))
    .slice(0, FEEDBACK_EXAMPLES_MAX)
    .sort((a, b) => time(a).localeCompare(time(b)));
}

/** Texts of the active maintainer notes that apply to a prompt kind. */
export function activeNotes(notes: MaintainerNote[], excluded: readonly string[], kind: Exclude<NoteScope, "Alle">): string[] {
  return notes.filter((n) => !excluded.includes(n.id) && (n.scope === kind || n.scope === "Alle")).map((n) => n.text);
}

/** Prompt block with maintainer notes; empty string when there are none. */
export function buildNotesBlock(notes: string[]): string {
  if (notes.length === 0) return "";
  return `Hinweise der Prüfer und Maintainer (beachten, solange sie dem Quelltext nicht widersprechen):\n${notes.map((n) => `- ${n}`).join("\n")}`;
}
