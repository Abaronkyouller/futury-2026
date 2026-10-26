/**
 * Illustrative sample test cases (tuples read by position):
 * [ID, Szenario, Technik, Erwarteter Bemessungszeitraum, Status].
 * Consumers: Tests page, traceability graph, CSV export.
 */
export const cases = [
  ["TC-028-01", "Monatsentgelt, Vormonat abgerechnet", "Äquivalenzklasse", "Vorheriger Kalendermonat", "Bestanden"],
  ["TC-028-02", "Arbeitsunfähigkeit beginnt am 1. eines Monats", "Grenzwert", "Vorheriger Kalendermonat", "Bestanden"],
  ["TC-028-03", "Wochenlohn, vier Wochen abgerechnet", "Äquivalenzklasse", "Letzte vier abgerechnete Wochen", "Bestanden"],
  ["TC-028-04", "Letzter Monat bei Beginn der AU noch nicht abgerechnet", "Grenzwert", "Monat vor dem nicht abgerechneten Monat", "Fehlgeschlagen"],
  ["TC-028-05", "Einmalzahlung im Bemessungszeitraum", "Kombination · R-052", "Vormonat, Einmalzahlung getrennt", "Nicht ausgeführt"],
  ["TC-028-06", "Beschäftigungsbeginn zur Monatsmitte", "Grenzwert", "[Erwarteter Wert aus der Regel-Engine]", "Nicht ausgeführt"],
] as const;
