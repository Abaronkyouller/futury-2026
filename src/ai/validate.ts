import type { Req } from "../types/requirement";
import type { CheckResult, GenerationSettings } from "../types/review";
import type { RawCase } from "./parse";
import { OPEN_VALUE_MARKER } from "../config/ai";

/**
 * Deterministic, rule-based checks over a model proposal (brainstorm: "use a
 * rule-based model to verify the outputs of another model").
 *
 * These checks verify STRUCTURE and TRACEABILITY only. They do not prove that
 * an expected payroll value is correct; that needs approved domain rules
 * (AGENTS.md instruction 4).
 */

/** Matches German dates like 02.10.2026. */
const DATE_PATTERN = /\b(\d{2})\.(\d{2})\.(\d{4})\b/g;

/** True if every DD.MM.YYYY in the text is a real calendar date. */
function datesAreValid(text: string): { ok: boolean; bad: string[] } {
  const bad: string[] = [];
  for (const m of text.matchAll(DATE_PATTERN)) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
      bad.push(m[0]);
    }
  }
  return { ok: bad.length === 0, bad };
}

/** True if a cited reference points at the requirement or its known source. */
function refMatches(ref: string, req: Req): boolean {
  const r = ref.toLowerCase();
  return r.includes(req.id.toLowerCase()) || r.includes(req.source.toLowerCase());
}

export function runChecks(c: RawCase, req: Req, settings: GenerationSettings): CheckResult[] {
  const sourceSteps = c.reasoning.filter((s) => s.basis === "Quelle");
  const unmatchedRefs = [
    ...c.sourceRefs,
    ...sourceSteps.map((s) => s.sourceRef ?? ""),
  ].filter((ref) => ref && !refMatches(ref, req));
  const allText = [c.given, c.when, c.then, ...c.expectedFields.map((f) => f.value)].join(" ");
  const dates = datesAreValid(allText);
  const openValues = c.expectedFields.filter((f) => f.value.includes(OPEN_VALUE_MARKER)).length;

  return [
    {
      id: "gwt",
      label: "GIVEN / WHEN / THEN complete",
      passed: Boolean(c.given && c.when && c.then),
    },
    {
      id: "expected",
      label: "Expected result has at least one field",
      passed: c.expectedFields.length > 0,
      detail: openValues > 0 ? `${openValues} value(s) marked open by the model` : undefined,
    },
    {
      id: "priority",
      label: "Priority is Hoch / Mittel / Niedrig",
      passed: c.priority !== null,
    },
    {
      id: "technique",
      label: "Technique is one of the selected ones",
      passed: settings.techniques.some((t) => c.technique.includes(t)),
      detail: c.technique || "none given",
    },
    {
      id: "reasoning",
      label: "Reasoning is present",
      passed: c.reasoning.length > 0,
    },
    {
      id: "source",
      label: "Cited sources match the requirement",
      passed: unmatchedRefs.length === 0,
      detail: unmatchedRefs.length
        ? `Not in requirement: ${[...new Set(unmatchedRefs)].join("; ")}`
        : undefined,
    },
    {
      id: "dates",
      label: "Dates are valid calendar dates",
      passed: dates.ok,
      detail: dates.ok ? undefined : `Invalid: ${dates.bad.join(", ")}`,
    },
  ];
}
