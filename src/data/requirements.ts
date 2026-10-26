import type { Req } from "../types/requirement";

/**
 * Illustrative sample requirements shipped with the prototype. They are not
 * extracted from a real source and carry no original text; the UI labels them
 * "Beispieldaten". Requirements from uploaded documents are added at runtime.
 */
export const initial: Req[] = [
  {
    id: "REQ-EEL-031",
    title: "Bemessungszeitraum umfasst mindestens vier Wochen",
    benefit: "Krankengeld",
    source: "§ 47 SGB V",
    confidence: 0.71,
    status: "Offen",
  },
  {
    id: "REQ-EEL-047",
    title: "Für Mutterschaftsgeld sind die Daten der Schutzfrist zu melden",
    benefit: "Mutterschaftsgeld",
    source: "EEL-Spezifikation",
    confidence: 0.63,
    status: "Offen",
  },
  {
    id: "REQ-EEL-052",
    title: "Einmalzahlungen werden getrennt vom laufenden Entgelt gemeldet",
    benefit: "Krankengeld",
    source: "EEL-Spezifikation",
    confidence: 0.68,
    status: "Offen",
  },
  {
    id: "REQ-EEL-028",
    title: "Bemessungszeitraum ist der letzte abgerechnete Entgeltabrechnungszeitraum vor Beginn der Arbeitsunfähigkeit",
    benefit: "Krankengeld",
    source: "§ 47 SGB V",
    confidence: 0.99,
    status: "Genehmigt",
    rule: "R-028",
  },
  {
    id: "REQ-EEL-012",
    title: "Entgeltbescheinigung wird nach Anforderung der Krankenkasse elektronisch übermittelt",
    benefit: "Alle Leistungen",
    source: "EEL-Spezifikation",
    confidence: 0.98,
    status: "Genehmigt",
    rule: "R-012",
  },
];
