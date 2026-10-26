import type { Req } from "../types/requirement";
import { OPEN_VALUE_MARKER } from "../config/ai";

/**
 * Canned reply in the model's JSON format, used to demonstrate the UI when the
 * gateway is unreachable. Results built from it are labelled "Offline demo"
 * and are never presented as a model output. Values that would need domain
 * rules are deliberately left open instead of invented.
 */
export function offlineDemoReply(req: Req): string {
  const ref = `${req.source} · ${req.id}`;
  return JSON.stringify({
    testCases: [
      {
        title: `Regelfall: ${req.title}`,
        technique: "Äquivalenzklasse",
        given: `Beschäftigte Person, Leistung ${req.benefit}, Abrechnung vollständig.`,
        when: "Die Krankenkasse fordert die Entgeltbescheinigung an.",
        then: "Die Software erstellt den Datensatz gemäß der Anforderung.",
        expectedFields: [{ field: "Datensatz erstellt", value: "ja" }],
        priority: "Mittel",
        priorityReason: "Regelfall; Fehler betreffen viele Bescheinigungen.",
        reasoning: [
          { text: `Die Anforderung lautet: "${req.title}".`, basis: "Quelle", sourceRef: ref },
          { text: "Regelfall als Äquivalenzklasse gewählt.", basis: "Generiert" },
        ],
        sourceRefs: [ref],
        openQuestions: [],
      },
      {
        title: "Grenzfall am Monatswechsel",
        technique: "Grenzwert",
        given: "Beschäftigung beginnt zur Monatsmitte.",
        when: "Das auslösende Ereignis fällt auf den ersten Tag eines Monats.",
        then: "Die Software verhält sich gemäß der Anforderung.",
        expectedFields: [{ field: "Ergebnis laut Regel", value: OPEN_VALUE_MARKER }],
        priority: "Hoch",
        priorityReason: "Grenzfall; Monatswechsel sind typische Fehlerquellen.",
        reasoning: [
          { text: "Monatswechsel sind typische Fehlerquellen.", basis: "Annahme" },
          { text: "Der erwartete Wert hängt von einer nicht bestätigten Regel ab.", basis: "Generiert" },
        ],
        sourceRefs: [ref],
        openQuestions: ["Welche Regel gilt am Monatswechsel für diese Anforderung?"],
      },
    ],
  });
}
