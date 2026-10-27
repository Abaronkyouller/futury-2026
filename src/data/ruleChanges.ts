import type { RuleChange, RuleChangeRun, RuleVersion } from "../types/ruleChange";

/**
 * Illustrative sample history for "Änderungsprotokoll → Regeln &
 * Spezifikationen". FICTIONAL demo specifications, not real DTA EEL changes;
 * every entry carries `sample: true`; the UI shows it only while "Beispieldaten anzeigen" is on.
 * The DBVO entries mirror demo-spezifikationen/DEMO_Spezifikation_DBVO_*.pdf.
 */

const EB = "DEMO_Spezifikation_Entgeltbescheinigung";
const DBVO = "DEMO_Spezifikation_DBVO";

const v = (doc: string, version: string, stand: string, section: string, quote: string, id: string): RuleVersion => ({
  requirementId: id,
  documentId: `SAMPLE-${doc}-${version}`,
  documentName: `${doc}_Version_${version}.pdf`,
  documentVersion: `Version ${version} · Stand: ${stand}`,
  sectionLabel: section,
  quote,
});

export const SAMPLE_RULE_RUNS: RuleChangeRun[] = [
  {
    id: "SAMPLE-RUN-1", sample: true, detectedAt: "2026-01-15T09:10:00.000Z",
    documentId: `SAMPLE-${EB}-2.0`, documentName: `${EB}_Version_2.0.pdf`, documentVersion: "Version 2.0 · Stand: 15.01.2026",
    note: "Keine Vorgängerversion – 5 Regel(n) als Ausgangsstand erfasst.",
    counts: { neu: 0, geaendert: 0, entfallen: 0, unveraendert: 0 },
  },
  {
    id: "SAMPLE-RUN-2", sample: true, detectedAt: "2026-04-01T08:30:00.000Z",
    documentId: `SAMPLE-${EB}-2.1`, documentName: `${EB}_Version_2.1.pdf`, documentVersion: "Version 2.1 · Stand: 01.04.2026",
    predecessorId: `SAMPLE-${EB}-2.0`, predecessorName: `${EB}_Version_2.0.pdf`, predecessorVersion: "Version 2.0 · Stand: 15.01.2026",
    counts: { neu: 1, geaendert: 2, entfallen: 1, unveraendert: 1 },
  },
  {
    id: "SAMPLE-RUN-3", sample: true, detectedAt: "2026-07-01T10:00:00.000Z",
    documentId: `SAMPLE-${DBVO}-1.0`, documentName: `${DBVO}_Version_1.0.pdf`, documentVersion: "Version 1.0 · Stand: 01.07.2026",
    note: "Keine Vorgängerversion – 6 Regel(n) als Ausgangsstand erfasst.",
    counts: { neu: 0, geaendert: 0, entfallen: 0, unveraendert: 0 },
  },
  {
    id: "SAMPLE-RUN-4", sample: true, detectedAt: "2026-10-01T07:45:00.000Z",
    documentId: `SAMPLE-${DBVO}-1.1`, documentName: `${DBVO}_Version_1.1.pdf`, documentVersion: "Version 1.1 · Stand: 01.10.2026",
    predecessorId: `SAMPLE-${DBVO}-1.0`, predecessorName: `${DBVO}_Version_1.0.pdf`, predecessorVersion: "Version 1.0 · Stand: 01.07.2026",
    counts: { neu: 1, geaendert: 3, entfallen: 1, unveraendert: 2 },
  },
];

const EB20 = (section: string, quote: string, id: string) => v(EB, "2.0", "15.01.2026", section, quote, id);
const EB21 = (section: string, quote: string, id: string) => v(EB, "2.1", "01.04.2026", section, quote, id);
const DB10 = (section: string, quote: string, id: string) => v(DBVO, "1.0", "01.07.2026", section, quote, id);
const DB11 = (section: string, quote: string, id: string) => v(DBVO, "1.1", "01.10.2026", section, quote, id);

const DBVO_21 = (days: number) =>
  `Die Vorerkrankungsanfrage (3.1.18 „Abgabegrund“ = „41“) darf nur dann durch den Arbeitgeber ausgelöst werden, wenn • dem Arbeitgeber für die aktuelle Arbeitsunfähigkeit eine Arbeitsunfähigkeitsbescheinigung vorliegt, • zusätzlich in den letzten 6 Monaten vor Beginn der aktuellen Arbeitsunfähigkeit mindestens eine bescheinigte potentielle Vorerkrankung im Datenbestand vorliegt und • die kumulierten Zeiten aller potentiellen Vorerkrankungen in den letzten 12 Monaten zusammen mit der aktuellen Arbeitsunfähigkeit zum Zeitpunkt der Meldung mindestens ${days} Tage umfassen.`;
const CRIT_6M = (months: number) =>
  `0cefe80e-4fd9-41e1-be4f-3ae1ecbde646 Es ist maschinell sichergestellt, dass die Meldung mit Abgabegrund „41“ nur erzeugt werden kann, wenn zwischen dem Beginn der aktuellen Arbeitsunfähigkeit und dem Ende der letzten attestierten Arbeitsunfähigkeit nicht mehr als ${months} Monate liegen.`;
const CRIT_30 = (days: number) =>
  `9c8c9b58-4d0f-4066-98ac-973095418d63 Es ist systemseitig sichergestellt, dass eine Meldung mit Abgabegrund „41“ nur erzeugt werden kann, wenn die systemseitig vorliegenden Vorerkrankungszeiten zusammen mit der aktuellen AU-Zeit mindestens ${days} Tage umfassen.`;

export const SAMPLE_RULE_CHANGES: RuleChange[] = [
  // --- Entgeltbescheinigung 2.0 -> 2.1 (01.04.2026) ---
  {
    id: "SAMPLE-RUN-2-1", runId: "SAMPLE-RUN-2", sample: true, detectedAt: "2026-04-01T08:30:00.000Z", kind: "Geändert",
    rule: "Abschnitt 4.2 · Die Entgeltbescheinigung ist nach Anforderung durch die Krankenkasse zu übermitteln …",
    before: EB20("4.2 Übermittlungsfrist · S. 7", "Die Entgeltbescheinigung ist nach Anforderung durch die Krankenkasse innerhalb von 14 Tagen zu übermitteln.", "BSP-EB-001"),
    after: EB21("4.2 Übermittlungsfrist · S. 7", "Die Entgeltbescheinigung ist nach Anforderung durch die Krankenkasse innerhalb von 10 Tagen zu übermitteln.", "BSP-EB-101"),
    matchedBy: "Abschnitt + Text", similarity: 0.91,
    differences: ["Frist: innerhalb von 14 Tagen → innerhalb von 10 Tagen"],
    affectedCaseIds: ["TC-028-01", "TC-028-02"],
  },
  {
    id: "SAMPLE-RUN-2-2", runId: "SAMPLE-RUN-2", sample: true, detectedAt: "2026-04-01T08:30:00.000Z", kind: "Geändert",
    rule: "Abschnitt 5.1 · Einmalzahlungen sind im Bemessungszeitraum getrennt auszuweisen …",
    before: EB20("5.1 Einmalzahlungen · S. 9", "Einmalzahlungen sind im Bemessungszeitraum getrennt vom laufenden Arbeitsentgelt auszuweisen.", "BSP-EB-002"),
    after: EB21("5.1 Einmalzahlungen · S. 9", "Einmalzahlungen sind im Bemessungszeitraum getrennt vom laufenden Arbeitsentgelt auszuweisen; Nachzahlungen sind dem Monat zuzuordnen, für den sie geleistet werden.", "BSP-EB-102"),
    matchedBy: "Abschnitt + Text", similarity: 0.62,
    differences: ["Ergänzung: Zuordnung von Nachzahlungen zum Leistungsmonat"],
    affectedCaseIds: ["TC-028-05"],
  },
  {
    id: "SAMPLE-RUN-2-3", runId: "SAMPLE-RUN-2", sample: true, detectedAt: "2026-04-01T08:30:00.000Z", kind: "Neu",
    rule: "Abschnitt 6.3 · Bei einer Stornierung (Abgabegrund 88) ist die DSID der ursprünglichen Meldung anzugeben …",
    after: EB21("6.3 Stornierung · S. 12", "Bei einer Stornierung (Abgabegrund „88“) ist im Feld DSID-UR die DSID der ursprünglichen Meldung anzugeben.", "BSP-EB-103"),
    differences: ["Regel kommt in der Vorgängerversion nicht vor"],
    affectedCaseIds: [],
  },
  {
    id: "SAMPLE-RUN-2-4", runId: "SAMPLE-RUN-2", sample: true, detectedAt: "2026-04-01T08:30:00.000Z", kind: "Entfallen",
    rule: "Abschnitt 4.4 · Eine Übermittlung in Papierform ist zulässig, wenn …",
    before: EB20("4.4 Ersatzverfahren · S. 8", "Eine Übermittlung in Papierform ist zulässig, wenn das elektronische Verfahren nachweislich gestört ist.", "BSP-EB-004"),
    differences: ["Regel steht nicht mehr im Dokument"],
    affectedCaseIds: ["TC-028-03"],
  },
  // --- DBVO 1.0 -> 1.1 (01.10.2026), wie in demo-spezifikationen/ ---
  {
    id: "SAMPLE-RUN-4-1", runId: "SAMPLE-RUN-4", sample: true, detectedAt: "2026-10-01T07:45:00.000Z", kind: "Geändert",
    rule: "Abschnitt 2.1 · Die Vorerkrankungsanfrage (3.1.18 „Abgabegrund“ = „41“) darf nur dann durch den […]",
    before: DB10("2.1 Voraussetzung · S. 1", DBVO_21(30), "BSP-DBVO-001"),
    after: DB11("2.1 Voraussetzung · S. 1", DBVO_21(42), "BSP-DBVO-101"),
    matchedBy: "Abschnitt + Text", similarity: 0.95,
    differences: ["Schwellenwert: mindestens 30 Tage → mindestens 42 Tage"],
    affectedCaseIds: [],
  },
  {
    id: "SAMPLE-RUN-4-2", runId: "SAMPLE-RUN-4", sample: true, detectedAt: "2026-10-01T07:45:00.000Z", kind: "Geändert",
    rule: "Kriterium 0cefe80e… · Es ist maschinell sichergestellt, dass die Meldung mit Abgabegrund „41“ nur erzeugt […]",
    criterionId: "0cefe80e-4fd9-41e1-be4f-3ae1ecbde646",
    before: DB10("2.2 Ergänzende Kriterien · S. 1", CRIT_6M(6), "BSP-DBVO-003"),
    after: DB11("2.2 Ergänzende Kriterien · S. 1", CRIT_6M(3), "BSP-DBVO-103"),
    matchedBy: "Kriterium-ID", similarity: 0.96,
    differences: ["Schwellenwert: nicht mehr als 6 Monate → nicht mehr als 3 Monate"],
    affectedCaseIds: [],
  },
  {
    id: "SAMPLE-RUN-4-3", runId: "SAMPLE-RUN-4", sample: true, detectedAt: "2026-10-01T07:45:00.000Z", kind: "Geändert",
    rule: "Kriterium 9c8c9b58… · Es ist systemseitig sichergestellt, dass eine Meldung mit Abgabegrund „41“ nur erzeugt […]",
    criterionId: "9c8c9b58-4d0f-4066-98ac-973095418d63",
    before: DB10("2.2 Ergänzende Kriterien · S. 1", CRIT_30(30), "BSP-DBVO-005"),
    after: DB11("2.2 Ergänzende Kriterien · S. 1", CRIT_30(42), "BSP-DBVO-105"),
    matchedBy: "Kriterium-ID", similarity: 0.96,
    differences: ["Schwellenwert: mindestens 30 Tage → mindestens 42 Tage"],
    affectedCaseIds: [],
  },
  {
    id: "SAMPLE-RUN-4-4", runId: "SAMPLE-RUN-4", sample: true, detectedAt: "2026-10-01T07:45:00.000Z", kind: "Neu",
    rule: "Kriterium 5b1e2c3d… · Es ist systemseitig sichergestellt, dass eine Stornierung mit Abgabegrund „88“ nur […]",
    criterionId: "5b1e2c3d-7a8f-4c21-9d3e-0f1a2b3c4d5e",
    after: DB11("2.2 Ergänzende Kriterien · S. 1", "5b1e2c3d-7a8f-4c21-9d3e-0f1a2b3c4d5e Es ist systemseitig sichergestellt, dass eine Stornierung mit Abgabegrund „88“ nur erzeugt werden kann, wenn zuvor eine Entgeltbescheinigung mit Abgabegrund „01“ übermittelt wurde.", "BSP-DBVO-106"),
    differences: ["Regel kommt in der Vorgängerversion nicht vor"],
    affectedCaseIds: [],
  },
  {
    id: "SAMPLE-RUN-4-5", runId: "SAMPLE-RUN-4", sample: true, detectedAt: "2026-10-01T07:45:00.000Z", kind: "Entfallen",
    rule: "Kriterium aade0289… · AU-Zeiten vor Beginn der aktuellen Arbeitsunfähigkeit werden nur dann in die Meldung mit […]",
    criterionId: "aade0289-e8f9-4e12-9c49-464cf6cd0789",
    before: DB10("2.2 Ergänzende Kriterien · S. 1", "aade0289-e8f9-4e12-9c49-464cf6cd0789 AU-Zeiten vor Beginn der aktuellen Arbeitsunfähigkeit werden nur dann in die Meldung mit Abgabegrund „41“ aufgenommen, wenn jeweils zwischen dem Beginn einer AU-Zeit und dem Ende der vorhergehenden AU-Zeit nicht mehr als 6 Monate liegen.", "BSP-DBVO-004"),
    differences: ["Regel steht nicht mehr im Dokument"],
    affectedCaseIds: [],
  },
];
