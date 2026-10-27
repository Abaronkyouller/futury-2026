import { COMPARE_MODEL, OPEN_VALUE_MARKER } from "../config/ai";
import {
  COMPARE_FEEDBACK_MAX,
  COMPARE_MAX_TOKENS,
  COMPARE_TEMPERATURE,
  RAW_REPLY_KEEP_CHARS,
  RESULT_CHAR_BUDGET,
  RULE_ASSESSOR_LABEL,
} from "../config/validation";
import { normalizeForMatch, quoteOccursIn, tokenize, truncate } from "../documents/text";
import type { ExpectedField, GeneratedTestCase } from "../types/review";
import type {
  Assessment,
  Consensus,
  FieldAssessment,
  FieldVerdict,
  OverallVerdict,
  PayrollResult,
  ModelRating,
  ResultComparison,
} from "../types/validation";
import { MODEL_RATINGS } from "../types/validation";
import { visibleFields } from "../utils/caseText";
import { buildNotesBlock } from "../feedback/collect";
import { chatCompletion } from "./client";
import { newRunId } from "./generate";
import { extractJson, isObj, str } from "./parse";
import type { ChatMessage } from "./prompt";

/**
 * H5/H6: compares an imported payroll result with the expected values of one
 * test case. The model ("KI") and a deterministic line matcher assess
 * independently and are set side by side. Afterwards every model statement is
 * checked locally: is the quoted evidence really in the result, was every
 * expected field assessed, does the overall verdict follow from the field
 * verdicts?
 * The model is not an oracle; the examiner decides (AGENTS.md instruction 4).
 */

const SCHEMA = `{
  "fields": [
    {
      "field": "Feldname genau wie in der Liste der erwarteten Werte",
      "observed": "im Ergebnis gelesener Wert, leer wenn nicht vorhanden",
      "quote": "wörtlicher Auszug aus dem Ergebnis, der den Wert belegt, sonst leer",
      "verdict": "Übereinstimmung | Abweichung | Nicht feststellbar",
      "explanation": "ein kurzer Satz"
    }
  ],
  "overall": "Bestanden | Nicht bestanden | Unklar",
  "summary": "zwei bis drei Sätze für den Prüfbericht"
}`;

const SYSTEM_PROMPT = `Du prüfst im Verfahren DTA EEL (Entgeltersatzleistungen), ob ein exportiertes Ergebnis einer Entgeltabrechnungssoftware zu den erwarteten Werten eines Testfalls passt.

Verbindliche Regeln:
1. Bewerte nur, was im Ergebnistext steht. Rate nicht und schließe nicht aus Plausibilität.
2. Bewerte jeden erwarteten Wert genau einmal und übernimm den Feldnamen unverändert.
3. "quote" ist eine wörtliche Kopie aus dem Ergebnistext. Steht der Wert nicht im Ergebnis, ist "verdict" = "Nicht feststellbar" und "quote" leer.
4. Ist der erwartete Wert "${OPEN_VALUE_MARKER}", ist "verdict" = "Nicht feststellbar".
5. "overall": "Bestanden" nur, wenn alle Werte übereinstimmen; "Nicht bestanden", sobald ein Wert abweicht; sonst "Unklar".
6. Passt die im Ergebnis beschriebene Ausgangslage (z. B. AU-Zeiten, Szenario) erkennbar nicht zum Testfall, nenne das in "summary".
7. Antworte ausschließlich mit einem gültigen JSON-Objekt nach diesem Schema, ohne Markdown:
${SCHEMA}`;

/** Expected values of a case as shown to the examiner (condition bookkeeping rows excluded). */
export function expectedOf(c: GeneratedTestCase): ExpectedField[] {
  return visibleFields(c.expectedFields);
}

/** Overall verdict that follows from the field verdicts (rule 5 of the prompt). */
export function deriveOverall(fields: { verdict: FieldVerdict }[]): OverallVerdict {
  if (fields.length === 0) return "Unklar";
  if (fields.some((f) => f.verdict === "Abweichung")) return "Nicht bestanden";
  return fields.every((f) => f.verdict === "Übereinstimmung") ? "Bestanden" : "Unklar";
}

/** Tolerant mapping of model wording onto the three field verdicts. */
function toFieldVerdict(v: unknown): FieldVerdict {
  const s = normalizeForMatch(str(v)).replace(/ü/g, "ue");
  if (s.includes("uebereinstimm")) return "Übereinstimmung";
  if (s.includes("abweich")) return "Abweichung";
  return "Nicht feststellbar";
}

function toOverall(v: unknown, fallback: OverallVerdict): OverallVerdict {
  const s = normalizeForMatch(str(v));
  if (s.startsWith("nicht bestanden") || s.includes("nicht bestanden")) return "Nicht bestanden";
  if (s.startsWith("bestanden")) return "Bestanden";
  if (s.startsWith("unklar")) return "Unklar";
  return fallback;
}

/** Earlier examiner decisions rendered as guidance (in-context learning, no training). */
export function buildCompareFeedbackBlock(history: ResultComparison[]): string {
  const reviewed = history.filter((h) => h.feedback).slice(-COMPARE_FEEDBACK_MAX);
  if (reviewed.length === 0) return "";
  const lines = reviewed.map((h) => {
    const f = h.feedback!;
    const models = h.assessments
      .filter((a) => a.ok)
      .map((a) => `${a.label} „${a.overall}“`)
      .join(", ");
    const corrections = h.assessments
      .filter((a) => a.kind === "model" && a.ok)
      .flatMap((a) => a.fields.filter((x) => f.fieldVerdicts[x.field] && f.fieldVerdicts[x.field] !== x.verdict)
        .map((x) => `${a.label} hielt „${x.field}“ für „${x.verdict}“, richtig ist „${f.fieldVerdicts[x.field]}“`));
    return `- Ergebnis „${h.resultName}“ gegen Testfall ${h.testCaseId}: ${models || "keine Antwort"} → Prüfer: „${f.verdict}“ (zutreffend: ${f.rating})${corrections.length ? `. ${corrections.join("; ")}` : ""}${f.comment ? `. Kommentar: „${f.comment}“` : ""}`;
  });
  return `Frühere Entscheidungen des Prüfers zu Abgleichen (übernimm die Bewertungsmaßstäbe, wiederhole korrigierte Fehler nicht):\n${lines.join("\n")}`;
}

/** Test case block of the prompt. */
function caseBlock(c: GeneratedTestCase, expected: ExpectedField[]): string[] {
  return [
    `Testfall ${c.id}${c.title ? ` – ${c.title}` : ""} (Technik ${c.technique || "–"})`,
    `GEGEBEN: ${c.given || "–"}`,
    `WENN: ${c.when || "–"}`,
    `DANN: ${c.then || "–"}`,
    ...(visibleFields(c.testData).length ? ["Testdaten:", ...visibleFields(c.testData).map((f) => `  - ${f.field}: ${f.value}`)] : []),
    ...(c.steps.length
      ? ["Erwartete Nachrichtenfolge:", ...c.steps.map((s, i) => `  ${i + 1}. ${s.actor}: ${s.action}${s.abgabegrund ? ` (Abgabegrund ${s.abgabegrund})` : ""}`)]
      : []),
    "Erwartete Werte (jeden genau einmal bewerten):",
    ...expected.map((f) => `  - ${f.field}: ${f.value}`),
  ];
}

export function buildCompareMessages(
  c: GeneratedTestCase,
  result: PayrollResult,
  history: ResultComparison[],
  notes: string[] = [],
): ChatMessage[] {
  const expected = expectedOf(c);
  const feedback = [buildCompareFeedbackBlock(history), buildNotesBlock(notes)].filter(Boolean).join("\n\n");
  const user = [
    ...caseBlock(c, expected),
    "",
    `Ergebnis der Entgeltabrechnungssoftware (Datei „${result.name}“):`,
    `"""\n${truncate(result.text, RESULT_CHAR_BUDGET)}\n"""`,
    ...(feedback ? ["", feedback] : []),
  ].join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}

/** Finds the model's entry for an expected field: exact name first, then containment. */
function findField(list: Record<string, unknown>[], field: string): Record<string, unknown> | undefined {
  const key = normalizeForMatch(field);
  return (
    list.find((x) => normalizeForMatch(str(x.field)) === key) ??
    list.find((x) => {
      const k = normalizeForMatch(str(x.field));
      return Boolean(k) && (k.includes(key) || key.includes(k));
    })
  );
}

/** Parses a model reply and runs the deterministic checks on it. */
export function parseAssessment(
  reply: string,
  expected: ExpectedField[],
  resultText: string,
): Pick<Assessment, "overall" | "summary" | "fields" | "notes"> {
  const json = extractJson(reply);
  if (!isObj(json)) throw new Error("Die Modellantwort ist kein JSON-Objekt.");
  const list = (Array.isArray(json.fields) ? json.fields : []).filter(isObj);
  const notes: string[] = [];

  const fields: FieldAssessment[] = expected.map((e) => {
    const item = findField(list, e.field);
    if (!item) {
      notes.push(`„${e.field}“ wurde vom Modell nicht bewertet.`);
      return { field: e.field, expected: e.value, observed: "", quote: "", verdict: "Nicht feststellbar", explanation: "Vom Modell nicht bewertet.", quoteFound: false };
    }
    const quote = str(item.quote);
    const quoteFound = Boolean(quote) && quoteOccursIn(quote, resultText);
    const verdict = e.value.includes(OPEN_VALUE_MARKER) ? "Nicht feststellbar" : toFieldVerdict(item.verdict);
    if (verdict !== "Nicht feststellbar" && !quoteFound) {
      notes.push(`Beleg für „${e.field}“ steht so nicht im Ergebnis – Urteil am Dokument prüfen.`);
    }
    return { field: e.field, expected: e.value, observed: str(item.observed), quote, verdict, explanation: str(item.explanation), quoteFound };
  });

  const derived = deriveOverall(fields);
  const overall = toOverall(json.overall, derived);
  if (overall !== derived) notes.push(`Gesamturteil „${overall}“ folgt nicht aus den Feldurteilen (abgeleitet: „${derived}“).`);
  const extra = list.filter((x) => !expected.some((e) => findField([x], e.field)));
  if (extra.length) notes.push(`${extra.length} zusätzliche(s) Feld(er) ohne erwarteten Wert ignoriert.`);
  return { overall, summary: str(json.summary), fields, notes };
}

/** Text lines, with whitespace collapsed, for the rule-based matcher. */
function lines(text: string): string[] {
  return text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** True if `value` occurs in `observed` as a whole word sequence (case-insensitive). */
function sameValue(observed: string, value: string): boolean {
  const o = normalizeForMatch(observed);
  const v = normalizeForMatch(value);
  if (!v) return false;
  if (o === v) return true;
  const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u").test(o);
}

/**
 * Deterministic reference: for each expected field, take the last line of the
 * result that starts with the field name (the result block comes last in a
 * log) and compare the rest of that line with the expected value.
 */
export function ruleAssessment(expected: ExpectedField[], resultText: string): Assessment {
  const started = Date.now();
  const all = lines(resultText);
  const fields: FieldAssessment[] = expected.map((e) => {
    const key = normalizeForMatch(e.field);
    const line = [...all].reverse().find((l) => normalizeForMatch(l).startsWith(key));
    const base = { field: e.field, expected: e.value };
    if (e.value.includes(OPEN_VALUE_MARKER)) {
      return { ...base, observed: "", quote: line ?? "", verdict: "Nicht feststellbar", explanation: "Erwarteter Wert ist offen.", quoteFound: Boolean(line) };
    }
    if (!line) {
      return { ...base, observed: "", quote: "", verdict: "Nicht feststellbar", explanation: "Feldname kommt im Ergebnis nicht als Zeilenanfang vor.", quoteFound: false };
    }
    const observed = line.slice(e.field.length).replace(/^[\s:=–-]+/, "").trim();
    if (!observed) {
      return { ...base, observed, quote: line, verdict: "Nicht feststellbar", explanation: "Feld gefunden, aber ohne Wert.", quoteFound: true };
    }
    const match = sameValue(observed, e.value);
    return {
      ...base,
      observed,
      quote: line,
      verdict: match ? "Übereinstimmung" : "Abweichung",
      explanation: match ? "Wert steht in derselben Zeile wie der Feldname." : "In der Zeile des Feldnamens steht ein anderer Wert.",
      quoteFound: true,
    };
  });
  const overall = deriveOverall(fields);
  return {
    label: RULE_ASSESSOR_LABEL,
    kind: "regelbasiert",
    model: "regelbasiert",
    ok: true,
    overall,
    summary: `Zeilenabgleich: ${fields.filter((f) => f.verdict === "Übereinstimmung").length} Übereinstimmung(en), ${fields.filter((f) => f.verdict === "Abweichung").length} Abweichung(en), ${fields.filter((f) => f.verdict === "Nicht feststellbar").length} nicht feststellbar.`,
    fields,
    notes: ["Vergleicht nur Feldname und Wert in derselben Zeile; erkennt keine Umschreibungen."],
    rawReply: "",
    durationMs: Date.now() - started,
  };
}

/** One model call; a failure becomes an assessment with ok=false instead of an exception. */
async function assessWithModel(
  label: string,
  model: string,
  messages: ChatMessage[],
  expected: ExpectedField[],
  resultText: string,
): Promise<Assessment> {
  const started = Date.now();
  let rawReply = "";
  try {
    rawReply = await chatCompletion(model, messages, COMPARE_TEMPERATURE, COMPARE_MAX_TOKENS);
    const parsed = parseAssessment(rawReply, expected, resultText);
    return { label, kind: "model", model, ok: true, ...parsed, rawReply: truncate(rawReply, RAW_REPLY_KEEP_CHARS), durationMs: Date.now() - started };
  } catch (e) {
    return {
      label, kind: "model", model, ok: false, error: (e as Error).message, overall: "Unklar", summary: "", fields: [], notes: [],
      rawReply: truncate(rawReply, RAW_REPLY_KEEP_CHARS), durationMs: Date.now() - started,
    };
  }
}

/**
 * Agreement of KI and rule-based matcher per field and overall. If the model
 * failed, the rule-based verdict stands alone and nothing counts as agreed.
 */
function agreement(ki: Assessment, rule: Assessment, expected: ExpectedField[]) {
  const fieldAgreement: Record<string, boolean> = {};
  for (const e of expected) {
    const v = (x: Assessment) => x.fields.find((f) => f.field === e.field)?.verdict;
    fieldAgreement[e.field] = ki.ok && v(ki) === v(rule);
  }
  const consensus: Consensus = !ki.ok ? rule.overall : ki.overall === rule.overall ? ki.overall : "Uneinig";
  return { fieldAgreement, consensus };
}

export type CompareInput = {
  testCase: GeneratedTestCase;
  result: PayrollResult;
  /** All earlier comparisons; those with examiner feedback are fed into the prompt. */
  history: ResultComparison[];
  /** Active maintainer notes for comparisons (Feedback page). */
  notes?: string[];
};

/** Runs the model and the rule-based reference and assembles the comparison. */
export async function compareResult({ testCase, result, history, notes = [] }: CompareInput): Promise<ResultComparison> {
  const expected = expectedOf(testCase);
  if (expected.length === 0) throw new Error(`Testfall ${testCase.id} hat kein erwartetes Ergebnis – ein Abgleich ist nicht möglich.`);
  const messages = buildCompareMessages(testCase, result, history, notes);
  const ki = await assessWithModel(COMPARE_MODEL.label, COMPARE_MODEL.model, messages, expected, result.text);
  const rule = ruleAssessment(expected, result.text);
  const now = new Date();
  const runId = newRunId(now);
  return {
    id: `VG-${runId.slice(1)}`,
    runId,
    createdAt: now.toISOString(),
    resultId: result.id,
    resultName: result.name,
    testCaseId: testCase.id,
    requirementId: testCase.requirementId,
    caseLabel: testCase.title || testCase.technique || testCase.id,
    expected,
    assessments: [ki, rule],
    ...agreement(ki, rule, expected),
  };
}

/**
 * Brings a comparison saved by the earlier two-model version onto the current
 * shape: keeps Modell A as "KI" and the rule-based assessment, drops Modell B,
 * recomputes the agreement and maps the old rating ("Modell A" → "KI").
 */
export function normalizeComparison(c: ResultComparison): ResultComparison {
  const ki = { ...c.assessments[0], label: COMPARE_MODEL.label };
  const rule = { ...c.assessments[c.assessments.length - 1], label: RULE_ASSESSOR_LABEL };
  const rating = c.feedback?.rating as string | undefined;
  const mapped: ModelRating = rating === "Modell A"
    ? "KI"
    : rating === "Modell B" || rating === "Regelbasiert"
      ? "Regelbasiert"
      : (MODEL_RATINGS as readonly string[]).includes(rating ?? "")
        ? (rating as ModelRating)
        : "Keines";
  return {
    ...c,
    assessments: [ki, rule],
    ...agreement(ki, rule, c.expected),
    feedback: c.feedback ? { ...c.feedback, rating: mapped } : undefined,
  };
}

/**
 * Ranks test cases by how well their scenario fits a result, so the likely case
 * is preselected. Only the constellation counts (test-data values, title and
 * GEGEBEN words, expected field names, Abgabegründe) – never whether the
 * result agrees with the expected values, which would bias the choice toward
 * a passing case. A hint only: the examiner chooses the case.
 */
export function suggestCases(result: PayrollResult, cases: GeneratedTestCase[]): { testCase: GeneratedTestCase; score: number }[] {
  const text = normalizeForMatch(result.text);
  // The scenario entry of a result log describes its constellation most directly. It may wrap onto
  // following lines in a PDF, so it is read up to the next field ("Bezug") or a blank line.
  const scenario = (/\bSzenario\b([\s\S]{0,400}?)(?:\n\s*Bezug\b|\n\s*\n|$)/i.exec(result.text)?.[1] ?? "").replace(/\s+/g, " ");
  const stem = (t: string) => t.slice(0, 6);
  const scenarioStems = new Set(tokenize(scenario).filter((t) => t.length >= 5).map(stem));
  const resultStems = new Set(tokenize(result.text).filter((t) => t.length >= 5).map(stem));
  const failed = /bedingung\s+(\d+)\s+nicht\s+erf/i.exec(scenario)?.[1];
  const allMet = /alle\s+(voraussetzungen|bedingungen)\s+(sind\s+)?erf/i.test(scenario);

  return cases
    .filter((c) => expectedOf(c).length > 0)
    .map((c) => {
      let score = 0;
      // Raw test data on purpose: the condition rows ("Bedingung 2 … nicht erfüllt") describe the constellation.
      const describing = [c.title, c.given, ...c.testData.map((f) => `${f.field} ${f.value}`)].join(" ");
      const stems = new Set(tokenize(describing).filter((t) => t.length >= 5).map(stem));
      for (const t of stems) {
        if (scenarioStems.has(t)) score += 2;
        else if (resultStems.has(t)) score += 0.25;
      }
      for (const m of describing.matchAll(/\b\d+\s+(?:Tage|Monate|Wochen)\b/g)) if (normalizeForMatch(scenario).includes(normalizeForMatch(m[0]))) score += 3;
      for (const f of visibleFields(c.testData)) if (f.value && text.includes(normalizeForMatch(f.value))) score += 1;
      for (const s of c.steps) if (s.abgabegrund && text.includes(s.abgabegrund)) score += 0.5;
      const notMet = c.testData.filter((f) => /^Bedingung\s+\d+/i.test(f.field) && /^nicht erfüllt$/i.test(f.value.trim()));
      if (failed && notMet.some((f) => new RegExp(`^Bedingung\\s+${failed}\\b`, "i").test(f.field))) score += 6;
      if (allMet && notMet.length === 0 && c.technique === "Äquivalenzklasse") score += 4;
      return { testCase: c, score: Math.round(score * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score);
}
