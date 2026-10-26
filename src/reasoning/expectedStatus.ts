import { OPEN_VALUE_MARKER } from "../config/ai";
import { ORIGIN_LABEL } from "../types/review";
import type { GeneratedTestCase } from "../types/review";
import type { Req } from "../types/requirement";

/**
 * Evidence status of the expected values of one generated case.
 *
 * The heading of the "Erwartetes Ergebnis" block is not a fixed sentence. It is
 * derived from what actually produced the values (AI proposal, rule-based
 * derivation or offline demo) and from the source evidence of the requirement
 * (an uploaded document with a verified quote, an unverified quote, or sample
 * data without any source text). Nothing here confirms a payroll result: the
 * rule engine is not connected (AGENTS.md instruction 4).
 */

export type ExpectedStatus = {
  /** Second part of the block heading, e.g. "KI-VORSCHLAG · QUELLZITAT GEPRÜFT". */
  label: string;
  /** One sentence explaining where the values come from and what is still open. */
  detail: string;
  /** False when the case carries no expected value at all. */
  present: boolean;
};

/** Short heading part for the source evidence of the requirement. */
function sourceLabel(req: Req | undefined): string {
  if (!req?.origin) return "OHNE QUELLE (BEISPIELDATEN)";
  return req.origin.quoteVerified ? "QUELLZITAT GEPRÜFT" : "ZITAT UNGEPRÜFT";
}

/** Sentence describing the source evidence of the requirement. */
function sourceSentence(req: Req | undefined): string {
  const o = req?.origin;
  if (!o) return "Die Anforderung stammt aus den Beispieldaten; ein Originaltext liegt im Prototyp nicht vor.";
  return `Aus „${o.documentName}“${o.quoteVerified ? " (Zitat im Abschnitt gefunden)" : " (Zitat nicht wörtlich gefunden – am Original prüfen)"}.`;
}

/**
 * Computes label and explanation for the expected-result block of one case.
 * Everything is derived from the case's origin and the requirement's source.
 */
export function expectedStatus(c: GeneratedTestCase, req: Req | undefined): ExpectedStatus {
  const fields = c.expectedFields;

  if (fields.length === 0) {
    return {
      present: false,
      label: "FEHLT",
      detail: "Der Fall enthält kein erwartetes Ergebnis – vor der Ausführung ergänzen.",
    };
  }

  const open = fields.filter((f) => f.value.includes(OPEN_VALUE_MARKER)).length;
  const producer = ORIGIN_LABEL[c.origin.kind].toUpperCase();
  const label = open === fields.length ? `${producer} · OFFEN` : `${producer} · ${sourceLabel(req)}`;

  const parts = [
    `Herkunft der Werte: ${ORIGIN_LABEL[c.origin.kind]}.`,
    sourceSentence(req),
    open > 0
      ? `${open} von ${fields.length} ${fields.length === 1 ? "Wert ist" : "Werten sind"} als offen markiert und vom Prüfer festzulegen.`
      : "",
    "Eine Regel-Engine ist nicht angebunden; die Werte bleiben Vorschläge.",
  ].filter(Boolean);

  return { present: true, label, detail: parts.join(" ") };
}
