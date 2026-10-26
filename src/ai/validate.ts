import type { Req } from "../types/requirement";
import type { CheckResult, GenerationSettings } from "../types/review";
import type { RawCase } from "./parse";
import type { GenerationContext } from "./prompt";
import { OPEN_VALUE_MARKER } from "../config/ai";
import { normalizeForMatch } from "../documents/text";

/**
 * Deterministic, rule-based checks over a proposal (brainstorm: "use a
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

/** Identifiers a citation may name: requirement id, sample source, document, section. */
function allowedRefs(req: Req): string[] {
  const refs = [req.id, req.source];
  if (req.origin) {
    const o = req.origin;
    const section = o.sectionLabel.split(" · ")[0];
    refs.push(o.documentName, o.documentName.replace(/\.[^.]+$/, ""), section);
    // Section number alone, e.g. "3.12".
    const num = /^\d+(?:\.\d+)*/.exec(section)?.[0];
    if (num) refs.push(num);
    if (o.criterionId) refs.push(o.criterionId);
  }
  return refs.filter(Boolean).map((r) => r.toLowerCase());
}

/** True if a cited reference points at the requirement or its known source. */
function refMatches(ref: string, allowed: string[]): boolean {
  const r = ref.toLowerCase();
  return allowed.some((a) => r.includes(a));
}

/** Source text of the requirement (quote + section); the only evidence for cited values. */
function sourceText(req: Req): string {
  const parts = [req.title, req.source];
  if (req.origin) parts.push(req.origin.quote, req.origin.sectionText, req.origin.criterionId ?? "");
  return normalizeForMatch(parts.join("\n"));
}

/**
 * True if a two-digit Abgabegrund occurs as a standalone number. Digits and
 * dots around it are excluded so date parts ("31.03.2026") never count.
 */
function codeInText(code: string, text: string): boolean {
  return new RegExp(`(^|[^0-9.])${code}([^0-9.]|$)`).test(text);
}

export function runChecks(
  c: RawCase,
  req: Req,
  settings: GenerationSettings,
  context: GenerationContext,
): CheckResult[] {
  const allowed = allowedRefs(req);
  const known = sourceText(req);
  const formats = normalizeForMatch(context.formatExamples.map((f) => f.text).join("\n"));
  const sourceSteps = c.reasoning.filter((s) => s.basis === "Quelle");
  const unmatchedRefs = [...c.sourceRefs, ...sourceSteps.map((s) => s.sourceRef ?? "")].filter(
    // References the source text itself makes (e.g. "3.12" cited in an example document) are accepted too.
    (ref) => ref && !refMatches(ref, allowed) && !known.includes(normalizeForMatch(ref)),
  );
  const allText = [
    c.given,
    c.when,
    c.then,
    ...c.testData.map((f) => f.value),
    ...c.expectedFields.map((f) => f.value),
  ].join(" ");
  const dates = datesAreValid(allText);
  const openValues = c.expectedFields.filter((f) => f.value.includes(OPEN_VALUE_MARKER)).length;

  const codes = [...new Set(c.steps.map((s) => s.abgabegrund).filter((g): g is string => Boolean(g)))];
  const unknownCodes = codes.filter((g) => !codeInText(g, known));
  const unknownCriteria = c.criteriaIds.filter((id) => !known.includes(id.toLowerCase()));

  return [
    {
      id: "gwt",
      label: "GEGEBEN / WENN / DANN vollständig",
      passed: Boolean(c.given && c.when && c.then),
    },
    {
      id: "expected",
      label: "Erwartetes Ergebnis hat mindestens ein Feld",
      passed: c.expectedFields.length > 0,
      detail: openValues > 0 ? `${openValues} Wert(e) als offen markiert` : undefined,
    },
    {
      id: "priority",
      label: "Priorität ist Hoch / Mittel / Niedrig",
      passed: c.priority !== null,
    },
    {
      id: "technique",
      label: "Technik ist eine der ausgewählten",
      passed: settings.techniques.some((t) => c.technique.includes(t)),
      detail: c.technique || "keine angegeben",
    },
    {
      id: "reasoning",
      label: "Begründung vorhanden",
      passed: c.reasoning.length > 0,
    },
    {
      id: "source",
      label: "Zitierte Quellen passen zur Anforderung",
      passed: unmatchedRefs.length === 0,
      detail: unmatchedRefs.length
        ? `Nicht in der Anforderung: ${[...new Set(unmatchedRefs)].join("; ")}`
        : undefined,
    },
    {
      id: "codes",
      label: "Abgabegründe der Nachrichtenfolge kommen im Quelltext vor",
      passed: unknownCodes.length === 0,
      detail: codes.length === 0
        ? "keine Abgabegründe angegeben"
        : unknownCodes.length
          ? `Nicht im Quelltext: ${unknownCodes
              .map((g) => (codeInText(g, formats) ? `${g} (nur im Formatbeispiel)` : g))
              .join(", ")}`
          : `Belegt: ${codes.join(", ")}`,
    },
    {
      id: "criteria",
      label: "Kriterium-IDs kommen im Quelltext vor",
      passed: unknownCriteria.length === 0,
      detail: unknownCriteria.length ? `Nicht belegt: ${unknownCriteria.join(", ")}` : undefined,
    },
    {
      id: "dates",
      label: "Datumsangaben sind gültige Kalenderdaten",
      passed: dates.ok,
      detail: dates.ok ? undefined : `Ungültig: ${dates.bad.join(", ")}`,
    },
  ];
}
