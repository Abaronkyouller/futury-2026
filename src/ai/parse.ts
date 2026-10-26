import type {
  Basis,
  ExpectedField,
  Priority,
  ReasoningStep,
} from "../types/review";
import { BASES, PRIORITIES } from "../types/review";

/** A test case as returned by the model, after defensive normalization. */
export type RawCase = {
  title: string;
  technique: string;
  given: string;
  when: string;
  then: string;
  expectedFields: ExpectedField[];
  /** null when the model returned an unknown priority; the validator flags it. */
  priority: Priority | null;
  priorityReason: string;
  reasoning: ReasoningStep[];
  sourceRefs: string[];
  openQuestions: string[];
};

/**
 * Extracts the JSON object from a model reply. Handles `<think>` blocks,
 * Markdown code fences and stray text around the object.
 * Throws with a readable message if no JSON object can be parsed.
 */
export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("The model reply contains no JSON object.");
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    throw new Error(`The model reply is not valid JSON: ${(e as Error).message}`);
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function toPriority(v: unknown): Priority | null {
  const s = str(v);
  return (PRIORITIES as readonly string[]).includes(s) ? (s as Priority) : null;
}

function toBasis(v: unknown): Basis {
  const s = str(v);
  // Unknown basis is treated as "Generiert" so it is never mistaken for a source-backed claim.
  return (BASES as readonly string[]).includes(s) ? (s as Basis) : "Generiert";
}

function toCase(v: unknown): RawCase | null {
  if (!isObj(v)) return null;
  const expected = Array.isArray(v.expectedFields) ? v.expectedFields : [];
  const reasoning = Array.isArray(v.reasoning) ? v.reasoning : [];
  return {
    title: str(v.title) || "(ohne Titel)",
    technique: str(v.technique),
    given: str(v.given),
    when: str(v.when),
    then: str(v.then),
    expectedFields: expected
      .filter(isObj)
      .map((f) => ({ field: str(f.field), value: str(f.value) }))
      .filter((f) => f.field),
    priority: toPriority(v.priority),
    priorityReason: str(v.priorityReason),
    reasoning: reasoning.filter(isObj).map((r) => ({
      text: str(r.text),
      basis: toBasis(r.basis),
      sourceRef: str(r.sourceRef) || undefined,
    })),
    sourceRefs: strList(v.sourceRefs),
    openQuestions: strList(v.openQuestions),
  };
}

/** Parses a model reply into normalized cases. Invalid entries are dropped. */
export function parseCases(text: string): RawCase[] {
  const json = extractJson(text);
  const list = isObj(json) && Array.isArray(json.testCases) ? json.testCases : null;
  if (!list) throw new Error('The JSON has no "testCases" array.');
  const cases = list.map(toCase).filter((c): c is RawCase => c !== null);
  if (cases.length === 0) throw new Error("The model returned no usable test cases.");
  return cases;
}
