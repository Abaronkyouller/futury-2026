import type { Req } from "../types/requirement";
import type { ReasoningCase, RuleTrace } from "../types/reasoning";
import { OPEN_VALUE_MARKER } from "../config/ai";
import { boundaryValues, findAbgabegrund, findThresholds, parseRestriction } from "../documents/conditions";
import { normalizeForMatch, truncate } from "../documents/text";

/** Builds readable deterministic rules and marks their evidence status. */
export function buildRules(req: Req, c: ReasoningCase, origin: { kind: string; model: string }): RuleTrace[] {
  const o = req.origin;
  const quote = o?.quote ?? "";
  const ref = o ? `${o.documentName} · ${o.sectionLabel}` : req.source;
  const rules: RuleTrace[] = [{ id: "R-SRC", label: "Quellenzitat", expression: "Die Anforderung muss im angegebenen Abschnitt belegt sein.", status: o?.quoteVerified ? "belegt" : "offen", evidence: o?.quoteVerified ? "Zitat wurde im Abschnitt gefunden." : "Zitat am Original prüfen.", sourceRef: ref }];
  const restriction = parseRestriction(quote);
  const conditions = o?.conditions.length ? o.conditions : restriction?.conditions ?? [];
  conditions.forEach((condition, index) => {
    const verbatim = normalizeForMatch(quote).includes(normalizeForMatch(condition));
    rules.push({ id: `R-COND-${index + 1}`, label: `Bedingung ${index + 1}`, expression: truncate(condition, 260), status: verbatim ? "belegt" : "abgeleitet", evidence: verbatim ? "Wörtlich im Quellzitat." : "Aus der strukturierten Modellauslegung.", sourceRef: ref });
    for (const threshold of findThresholds(condition)) {
      const [inside, outside] = boundaryValues(threshold);
      rules.push({ id: `R-LIMIT-${index + 1}-${threshold.value}`, label: `Grenzwert ${threshold.text}`, expression: `${inside.label}: erfüllt; ${outside.label}: nicht erfüllt.`, status: "abgeleitet", evidence: "Grenzwert aus der Quelle; Zählweise bleibt prüferpflichtig.", sourceRef: ref });
    }
  });
  for (const code of new Set(c.steps.map((s) => s.abgabegrund).filter((x): x is string => Boolean(x)))) {
    const backed = findAbgabegrund(quote) === code;
    rules.push({ id: `R-CODE-${code}`, label: `Abgabegrund ${code}`, expression: `Nachrichtenfolge verwendet Abgabegrund ${code}.`, status: backed ? "belegt" : "widerspruch", evidence: backed ? "Im Quellzitat gefunden." : "Nicht im Quellzitat gefunden.", sourceRef: ref });
  }
  const open = c.expectedFields.filter((f) => f.value.includes(OPEN_VALUE_MARKER)).length;
  rules.push({ id: "R-EXPECTED", label: "Erwartete Werte", expression: `${c.expectedFields.length} Feld(er), davon ${open} offen.`, status: open ? "offen" : "abgeleitet", evidence: open ? "Offene Werte muss der Prüfer festlegen." : "Abgeleitet, nicht durch Payroll-Ausführung bestätigt.", sourceRef: ref });
  if (origin.kind === "model") rules.push({ id: "R-MODEL", label: "Modellbegründung", expression: "Testidee und Begründung stammen aus dem Sprachmodell.", status: "offen", evidence: "Fachliche Richtigkeit ist nicht automatisch bestätigt.", sourceRef: ref });
  return rules;
}
