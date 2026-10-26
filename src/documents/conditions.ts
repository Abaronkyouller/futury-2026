/**
 * Structural parsing of normative sentences, without a model.
 *
 * Only the wording of the source is used: a restriction "X darf nur (dann) …,
 * wenn A, B und C" is split into the action X and the listed conditions; a
 * threshold "mindestens 30 Tage" is recognized as a boundary. Nothing is
 * inferred beyond the sentence. All functions are pure.
 */

/** A restriction of the form "… nur …, wenn <conditions>". */
export type Restriction = {
  /** Text before "wenn", e.g. "Die Vorerkrankungsanfrage (…) darf nur dann durch den Arbeitgeber ausgelöst werden". */
  action: string;
  /** Conditions as worded in the source, in order. */
  conditions: string[];
};

/** "nur" followed by "wenn" in the same sentence. */
const ONLY_IF = /\bnur\b[\s\S]*?\bwenn\b/i;

/** Removes list glue at the end of a condition: trailing comma, "und", "oder", full stop. */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/(?:,|;)?\s*(?:und|oder)?\s*$/i, "")
    .replace(/[.,;:\s]+$/, "")
    .trim();
}

/**
 * Splits a restriction sentence into its action and conditions. Conditions are
 * taken from a bullet list ("•"), from "sowohl … als auch …", or else the
 * whole "wenn" clause is one condition. Returns null for other sentences.
 */
export function parseRestriction(quote: string): Restriction | null {
  const m = ONLY_IF.exec(quote);
  if (!m) return null;
  const wennEnd = m.index + m[0].length;
  const action = tidy(quote.slice(0, wennEnd - "wenn".length))
    // A leading criterion UUID (kept separately as criterionId) and its label ("= Daumenkriterium").
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*(?:=\s*\S+\s*)?/i, "")
    // A leading one-word label from a table cell ("Voraussetzung: …").
    .replace(/^[A-ZÄÖÜ][\p{L}-]+:\s+/u, "");
  const clause = quote.slice(wennEnd).replace(/\s*\[…\]\s*$/, "");

  let conditions: string[];
  if (clause.includes("•")) {
    conditions = clause.split("•").map(tidy).filter(Boolean);
  } else {
    const both = /\bsowohl\b([\s\S]+?)\bals auch\b([\s\S]+)/i.exec(clause);
    conditions = both ? [tidy(both[1]), tidy(both[2])] : [tidy(clause)];
  }
  conditions = conditions.filter((c) => c.length > 3);
  return conditions.length ? { action, conditions } : null;
}

/** Comparison kind of a numeric threshold as worded in the source. */
export type Comparator = "mindestens" | "höchstens" | "mehr als" | "weniger als";

export type Threshold = {
  comparator: Comparator;
  value: number;
  /** Unit as printed, normalized to plural: "Tage", "Wochen", "Monate", "Jahre". */
  unit: string;
  /** The matched words, e.g. "mindestens 30 Tage". */
  text: string;
};

const NUMBER_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6,
  sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
};

const THRESHOLD =
  /\b(mindestens|nicht mehr als|höchstens|mehr als|weniger als)\s+(\d+|ein|eine|einen|einem|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+(Kalendertag(?:e|en)?|Tag(?:e|en)?|Woche(?:n)?|Monat(?:e|en)?|Jahr(?:e|en)?)\b/gi;

function unitOf(raw: string): string {
  const u = raw.toLowerCase();
  if (u.startsWith("kalendertag") || u.startsWith("tag")) return "Tage";
  if (u.startsWith("woche")) return "Wochen";
  if (u.startsWith("monat")) return "Monate";
  return "Jahre";
}

/** Finds numeric thresholds such as "mindestens 30 Tage" or "nicht mehr als 6 Monate". */
export function findThresholds(text: string): Threshold[] {
  const out: Threshold[] = [];
  for (const m of text.matchAll(THRESHOLD)) {
    const word = m[1].toLowerCase();
    const comparator: Comparator = word === "nicht mehr als" ? "höchstens" : (word as Comparator);
    const value = /^\d+$/.test(m[2]) ? Number(m[2]) : NUMBER_WORDS[m[2].toLowerCase()];
    out.push({ comparator, value, unit: unitOf(m[3]), text: m[0] });
  }
  return out;
}

/** A test value at or next to a threshold and whether it satisfies the condition. */
export type BoundaryValue = { label: string; satisfies: boolean };

/**
 * The two values that decide a threshold: the last value that satisfies it and
 * the first one that does not. For day units the neighbour is ±1 day; for
 * longer units it is "N <unit> ± 1 Tag", because the source does not say how
 * partial months are counted.
 */
export function boundaryValues(t: Threshold): [BoundaryValue, BoundaryValue] {
  const days = t.unit === "Tage";
  const plus = days ? `${t.value + 1} Tage` : `${t.value} ${t.unit} + 1 Tag`;
  const minus = days ? `${t.value - 1} Tage` : `${t.value} ${t.unit} − 1 Tag`;
  const exact = `genau ${t.value} ${t.unit}`;
  switch (t.comparator) {
    case "mindestens":
      return [{ label: exact, satisfies: true }, { label: minus, satisfies: false }];
    case "höchstens":
      return [{ label: exact, satisfies: true }, { label: plus, satisfies: false }];
    case "mehr als":
      return [{ label: plus, satisfies: true }, { label: exact, satisfies: false }];
    case "weniger als":
      return [{ label: minus, satisfies: true }, { label: exact, satisfies: false }];
  }
}

/** Two-digit Abgabegrund named in the text, e.g. „Abgabegrund“ = „41“ or Abgabegrund "41". */
export function findAbgabegrund(text: string): string | undefined {
  return /Abgabegrund\W{0,8}(?:=\W{0,4})?(\d{2})\b/i.exec(text)?.[1];
}

/** First UUID in the text, used as criterion identifier (e.g. in the DBVO criteria table). */
export function findCriterionId(text: string): string | undefined {
  return /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.exec(text)?.[0];
}
