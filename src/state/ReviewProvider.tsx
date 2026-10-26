import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AI_MODEL, DEFAULT_SETTINGS, STORAGE_KEY } from "../config/ai";
import { initial as sampleRequirements } from "../data/requirements";
import type { Req } from "../types/requirement";
import type { ChangeLogEntry, GeneratedTestCase, GenerationSettings } from "../types/review";
import { ReviewContext } from "./reviewContext";
import type { LogInput, ReviewState, ReviewStore } from "./reviewContext";
import { sanitizeCaseTitle } from "../utils/caseText";
import { redistributePriorities } from "../utils/priority";

const PRIORITY_ASSIGNMENT_VERSION = 1;

const EMPTY: ReviewState = {
  requirements: sampleRequirements,
  cases: [],
  changelog: [],
  settings: DEFAULT_SETTINGS,
  priorityAssignmentVersion: PRIORITY_ASSIGNMENT_VERSION,
};

/** Fills fields added in later versions so older persisted cases stay readable. */
function normalizeCase(c: GeneratedTestCase): GeneratedTestCase {
  const title = sanitizeCaseTitle(c.title);
  const original = c.criteriaIds ?? [];
  const criteriaIds = original.filter((id) => !/^ANF-/i.test(id));
  const checks = criteriaIds.length === 0 && criteriaIds.length !== original.length
    ? c.checks.map((check) => check.id === "criteria" ? { ...check, passed: true, detail: undefined } : check)
    : c.checks;
  return {
    ...c,
    title,
    // Rebuild old provenance details if they still contain the retired title.
    trace: title === c.title ? c.trace : undefined,
    testData: c.testData ?? [],
    steps: c.steps ?? [],
    criteriaIds,
    checks,
  };
}

/** Reads persisted state; storage can be missing or blocked, so failures fall back to empty. */
function load(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ReviewState>;
    const normalizedCases = (parsed.cases ?? []).map(normalizeCase);
    const resetPriorities = (parsed.priorityAssignmentVersion ?? 0) < PRIORITY_ASSIGNMENT_VERSION;
    return {
      requirements: parsed.requirements ?? sampleRequirements,
      cases: resetPriorities ? redistributePriorities(normalizedCases) : normalizedCases,
      changelog: parsed.changelog ?? [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings, model: AI_MODEL },
      priorityAssignmentVersion: PRIORITY_ASSIGNMENT_VERSION,
    };
  } catch {
    return EMPTY;
  }
}

function save(state: ReviewState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is a convenience only; the app keeps working in memory.
  }
}

let entryCounter = 0;
/** Creates a timestamped change-log entry. */
function entry(fields: LogInput): ChangeLogEntry {
  entryCounter += 1;
  return { id: `CL-${Date.now()}-${entryCounter}`, timestamp: new Date().toISOString(), ...fields };
}

/** German labels of the settings keys, used in change-log entries. */
const SETTING_LABEL: Record<keyof GenerationSettings, string> = {
  model: "Modell",
  temperature: "Kreativität",
  maxCases: "Max. Testfälle",
  techniques: "Techniken",
  reasoningDetail: "Begründungstiefe",
  priorityFocus: "Prioritätsfokus",
  useFeedback: "Rückmeldungen nutzen",
};

/** Lists the settings whose values differ, as "Label: alt → neu". */
function diffSettings(a: GenerationSettings, b: GenerationSettings): string[] {
  return (Object.keys(b) as (keyof GenerationSettings)[])
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => `${SETTING_LABEL[k]}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
}

const describeReq = (r: Req) => `${r.status}${r.comment ? ` · "${r.comment}"` : ""}`;

/**
 * Holds requirements, generated cases, examiner feedback and the change log
 * for the whole app. There is no backend: everything lives in this browser's
 * localStorage. Uploaded documents are kept separately (DocumentProvider).
 */
export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReviewState>(load);

  useEffect(() => save(state), [state]);

  const logEvent = useCallback<ReviewStore["logEvent"]>((kind, fields) => {
    setState((s) => ({ ...s, changelog: [...s.changelog, entry({ kind, ...fields })] }));
  }, []);

  const addRequirements = useCallback<ReviewStore["addRequirements"]>((documentName, runId, method, reqs) => {
    setState((s) => ({
      ...s,
      requirements: [...s.requirements, ...reqs],
      changelog: [
        ...s.changelog,
        entry({
          kind: "Extraktion",
          summary: `${reqs.length} Anforderung(en) aus „${documentName}“ extrahiert (${method === "model" ? reqs[0]?.origin?.model ?? "KI" : "regelbasiert"}, Lauf ${runId})`,
          after: reqs.map((r) => `${r.id} · ${r.origin?.sectionLabel ?? r.source}`).join("\n"),
        }),
      ],
    }));
  }, []);

  const reviewRequirement = useCallback<ReviewStore["reviewRequirement"]>((id, status, comment) => {
    setState((s) => {
      const target = s.requirements.find((r) => r.id === id);
      if (!target) return s;
      const next: Req = { ...target, status, comment: comment || undefined };
      const before = describeReq(target);
      const after = describeReq(next);
      if (before === after) return s;
      return {
        ...s,
        requirements: s.requirements.map((r) => (r.id === id ? next : r)),
        changelog: [
          ...s.changelog,
          entry({ kind: "Anforderung", requirementId: id, summary: `${id} auf „${status}“ gesetzt`, before, after }),
        ],
      };
    });
  }, []);

  const addRun = useCallback<ReviewStore["addRun"]>((requirementId, runId, cases) => {
    setState((s) => ({
      ...s,
      cases: [...s.cases, ...cases],
      changelog: [
        ...s.changelog,
        entry({
          kind: "Generierung",
          requirementId,
          summary: `${cases.length} Testfall/Testfälle in Lauf ${runId} erzeugt (${cases[0]?.origin.model ?? "?"})`,
          after: cases.map((c) => `${c.id} · ${c.title}`).join("\n"),
        }),
      ],
    }));
  }, []);

  const reviewCase = useCallback<ReviewStore["reviewCase"]>((caseId, decision, comment) => {
    setState((s) => {
      const target = s.cases.find((c) => c.id === caseId);
      if (!target) return s;
      const before = `${target.review.decision}${target.review.comment ? ` · "${target.review.comment}"` : ""}`;
      const after = `${decision}${comment ? ` · "${comment}"` : ""}`;
      if (before === after) return s;
      return {
        ...s,
        cases: s.cases.map((c) =>
          c.id === caseId ? { ...c, review: { decision, comment, reviewedAt: new Date().toISOString() } } : c,
        ),
        changelog: [
          ...s.changelog,
          entry({
            kind: "Prüfung",
            requirementId: target.requirementId,
            testCaseId: caseId,
            summary: `${caseId} als „${decision}“ markiert`,
            before,
            after,
          }),
        ],
      };
    });
  }, []);

  const updateSettings = useCallback<ReviewStore["updateSettings"]>((next) => {
    setState((s) => {
      const changes = diffSettings(s.settings, next);
      if (changes.length === 0) return s;
      return {
        ...s,
        settings: next,
        changelog: [
          ...s.changelog,
          entry({ kind: "Einstellungen", summary: "Generierungseinstellungen geändert", after: changes.join("\n") }),
        ],
      };
    });
  }, []);

  const resetCases = useCallback(() => {
    setState((s) => ({
      ...s,
      cases: [],
      changelog: [
        ...s.changelog,
        entry({
          kind: "Zurücksetzen",
          summary: `${s.cases.length} generierte(r) Testfall/Testfälle samt Rückmeldungen entfernt`,
          before: s.cases.map((c) => c.id).join(", "),
        }),
      ],
    }));
  }, []);

  const store = useMemo<ReviewStore>(
    () => ({ ...state, addRequirements, reviewRequirement, addRun, reviewCase, updateSettings, resetCases, logEvent }),
    [state, addRequirements, reviewRequirement, addRun, reviewCase, updateSettings, resetCases, logEvent],
  );

  return <ReviewContext.Provider value={store}>{children}</ReviewContext.Provider>;
}
