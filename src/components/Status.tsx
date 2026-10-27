/** Status values mapped to badge colours. Unlisted values render neutral. */
const STATUS_CLASS: Record<string, "good" | "bad" | "warn"> = {
  Bestanden: "good",
  Erledigt: "good",
  Akzeptiert: "good",
  Genehmigt: "good",
  Fehlgeschlagen: "bad",
  Abgelehnt: "bad",
  Offen: "warn",
  "Prüfung nötig": "warn",
  "In Bearbeitung": "warn",
  "In Überprüfung": "warn",
  // Validierung & Bericht
  Übereinstimmung: "good",
  Abweichung: "bad",
  "Nicht bestanden": "bad",
  "Nicht feststellbar": "warn",
  Unklar: "warn",
  Uneinig: "warn",
};

export function Status({ value }: { value: string }) {
  return <span className={"status " + (STATUS_CLASS[value] ?? "neutral")}>{value}</span>;
}
