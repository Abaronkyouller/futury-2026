import type { ChangeLogEntry } from "../types/review";
import type { RuleChange } from "../types/ruleChange";

/**
 * History of test cases (Änderungsprotokoll → Testfälle): every creation,
 * regeneration, review, feedback switch, comparison and rule change that
 * affects a case, one row per case and event, with timestamp. Built from the
 * persisted change log and the detected rule changes; nothing is stored twice.
 */

export const CASE_CHANGE_KINDS = [
  "Erzeugt",
  "Neu erzeugt aus Feedback",
  "Bewertet",
  "Feedback eingereicht",
  "Feedback geschaltet",
  "Abgeglichen",
  "Regel geändert – prüfen",
  "Zurückgesetzt",
] as const;
export type CaseChangeKind = (typeof CASE_CHANGE_KINDS)[number];

export type CaseChangeRow = {
  id: string;
  timestamp: string; // ISO timestamp
  caseId: string;
  requirementId?: string;
  kind: CaseChangeKind;
  summary: string;
  before?: string;
  after?: string;
};

/** "AI-001-…-1 · Titel" lines written by addRun → [id, title]. */
function generatedCases(after: string | undefined): [string, string][] {
  return (after ?? "")
    .split("\n")
    .map((line) => line.split(" · "))
    .filter((parts) => parts[0]?.trim())
    .map((parts) => [parts[0].trim(), parts.slice(1).join(" · ").trim()]);
}

export function buildCaseHistory(changelog: ChangeLogEntry[], ruleChanges: RuleChange[]): CaseChangeRow[] {
  const rows: CaseChangeRow[] = [];
  for (const e of changelog) {
    if (e.kind === "Generierung") {
      for (const [caseId, title] of generatedCases(e.after)) {
        const fromFeedback = Boolean(e.testCaseId);
        rows.push({
          id: `${e.id}-${caseId}`, timestamp: e.timestamp, caseId, requirementId: e.requirementId,
          kind: fromFeedback ? "Neu erzeugt aus Feedback" : "Erzeugt",
          // "4 Testfall/Testfälle in Lauf R… erzeugt (…)" → "In Lauf R… erzeugt (…)" per case row.
          summary: fromFeedback ? `Ersatz für ${e.testCaseId}` : e.summary.replace(/^\d+ Testfall\/Testfälle in /, "In "),
          before: fromFeedback ? e.testCaseId : undefined,
          after: title || undefined,
        });
      }
    } else if (e.kind === "Prüfung" && e.testCaseId) {
      rows.push({
        id: e.id, timestamp: e.timestamp, caseId: e.testCaseId, requirementId: e.requirementId,
        kind: e.summary.startsWith("Feedback zu") ? "Feedback eingereicht" : "Bewertet",
        summary: e.summary, before: e.before, after: e.after,
      });
    } else if (e.kind === "Validierung" && e.testCaseId) {
      rows.push({ id: e.id, timestamp: e.timestamp, caseId: e.testCaseId, requirementId: e.requirementId, kind: "Abgeglichen", summary: e.summary, before: e.before, after: e.after });
    } else if (e.kind === "Feedback") {
      // "Feedback FB-<case id> aktiviert/deaktiviert"
      const m = /Feedback FB-((?:AI|RB)-\S+) (aktiviert|deaktiviert)/.exec(e.summary);
      if (m) rows.push({ id: e.id, timestamp: e.timestamp, caseId: m[1], kind: "Feedback geschaltet", summary: `Rückmeldung ${m[2]}`, before: e.before, after: e.after });
    } else if (e.kind === "Zurücksetzen") {
      rows.push({ id: e.id, timestamp: e.timestamp, caseId: "alle", kind: "Zurückgesetzt", summary: e.summary, before: e.before });
    }
  }
  for (const c of ruleChanges) {
    for (const caseId of c.affectedCaseIds) {
      rows.push({
        id: `${c.id}-${caseId}`, timestamp: c.detectedAt, caseId, requirementId: c.before?.requirementId,
        kind: "Regel geändert – prüfen",
        summary: `${c.kind}: ${c.rule}`,
        before: c.before ? `${c.before.documentName} (${c.before.documentVersion ?? "ohne Version"})` : undefined,
        after: c.after ? `${c.after.documentName} (${c.after.documentVersion ?? "ohne Version"}) · ${c.differences.join("; ")}` : c.differences.join("; "),
      });
    }
  }
  return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
