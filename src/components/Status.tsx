/** Status values mapped to badge colours. Unlisted values render neutral. */
const STATUS_CLASS: Record<string, "good" | "bad" | "warn"> = {
  Approved: "good",
  Passed: "good",
  Done: "good",
  Akzeptiert: "good",
  Genehmigt: "good",
  Failed: "bad",
  Abgelehnt: "bad",
  Pending: "warn",
  "Needs review": "warn",
  Offen: "warn",
  "In Bearbeitung": "warn",
  "In Überprüfung": "warn",
};

export function Status({ value }: { value: string }) {
  return <span className={"status " + (STATUS_CLASS[value] ?? "neutral")}>{value}</span>;
}
