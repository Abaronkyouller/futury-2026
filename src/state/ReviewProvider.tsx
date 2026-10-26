import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "../config/ai";
import type { ChangeLogEntry, GenerationSettings } from "../types/review";
import { ReviewContext } from "./reviewContext";
import type { ReviewState, ReviewStore } from "./reviewContext";

const EMPTY: ReviewState = { cases: [], changelog: [], settings: DEFAULT_SETTINGS };

/** Reads persisted state; storage can be missing or blocked, so failures fall back to empty. */
function load(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ReviewState>;
    return {
      cases: parsed.cases ?? [],
      changelog: parsed.changelog ?? [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
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
function entry(fields: Omit<ChangeLogEntry, "id" | "timestamp">): ChangeLogEntry {
  entryCounter += 1;
  return { id: `CL-${Date.now()}-${entryCounter}`, timestamp: new Date().toISOString(), ...fields };
}

/** Lists the settings keys whose values differ, as "key: old → new". */
function diffSettings(a: GenerationSettings, b: GenerationSettings): string[] {
  return (Object.keys(b) as (keyof GenerationSettings)[])
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => `${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
}

/**
 * Holds generated cases, examiner feedback and the change log for the whole app.
 * There is no backend: everything lives in this browser's localStorage.
 */
export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReviewState>(load);

  useEffect(() => save(state), [state]);

  const addRun = useCallback<ReviewStore["addRun"]>((requirementId, runId, cases) => {
    setState((s) => ({
      ...s,
      cases: [...s.cases, ...cases],
      changelog: [
        ...s.changelog,
        entry({
          kind: "Generierung",
          requirementId,
          summary: `${cases.length} test case(s) generated in run ${runId} (${cases[0]?.origin.model ?? "?"})`,
          after: cases.map((c) => c.id).join(", "),
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
          c.id === caseId
            ? { ...c, review: { decision, comment, reviewedAt: new Date().toISOString() } }
            : c,
        ),
        changelog: [
          ...s.changelog,
          entry({
            kind: "Prüfung",
            requirementId: target.requirementId,
            testCaseId: caseId,
            summary: `${caseId} marked "${decision}"`,
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
          entry({ kind: "Einstellungen", summary: "Generation settings changed", after: changes.join("; ") }),
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
          summary: `${s.cases.length} generated case(s) and their feedback removed`,
          before: s.cases.map((c) => c.id).join(", "),
        }),
      ],
    }));
  }, []);

  const store = useMemo<ReviewStore>(
    () => ({ ...state, addRun, reviewCase, updateSettings, resetCases }),
    [state, addRun, reviewCase, updateSettings, resetCases],
  );

  return <ReviewContext.Provider value={store}>{children}</ReviewContext.Provider>;
}
