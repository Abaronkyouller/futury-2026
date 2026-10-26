import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { useReviewStore } from "../state/reviewContext";
import type { ChangeKind } from "../types/review";
import { download } from "../utils/download";
import { formatDateTime, toCsv } from "../utils/format";

const KINDS: ChangeKind[] = ["Generierung", "Prüfung", "Einstellungen", "Zurücksetzen"];

/** CSS modifier per change kind, so the timeline is scannable at a glance. */
const KIND_CLASS: Record<ChangeKind, string> = {
  Generierung: "kind-gen",
  Prüfung: "kind-review",
  Einstellungen: "kind-settings",
  Zurücksetzen: "kind-reset",
};

/**
 * Timestamped change log (brainstorm: "timestamp for change log"). Every
 * generation, review decision and settings change is recorded with its
 * previous value, newest first. Stored in this browser only.
 */
export function ChangeLog() {
  const { changelog, cases, resetCases } = useReviewStore();
  const [kind, setKind] = useState<ChangeKind | "Alle">("Alle");
  const entries = [...changelog]
    .reverse()
    .filter((e) => kind === "Alle" || e.kind === kind);

  const exportCsv = () =>
    download(
      "change-log.csv",
      toCsv([
        ["Zeitpunkt", "Art", "Anforderung", "Testfall", "Zusammenfassung", "Vorher", "Nachher"],
        ...changelog.map((e) => [e.timestamp, e.kind, e.requirementId, e.testCaseId, e.summary, e.before, e.after]),
      ]),
    );

  return (
    <>
      <Header
        title="Change log"
        subtitle="Every generation run, examiner decision and settings change with timestamp and previous value. Nothing is overwritten silently."
        action={
          <div className="actions">
            <button onClick={exportCsv} disabled={changelog.length === 0}>
              <Download size={15} /> Export CSV
            </button>
            <button
              disabled={cases.length === 0}
              onClick={() => {
                if (window.confirm(`Remove all ${cases.length} generated cases and their feedback? The log keeps a record.`)) resetCases();
              }}
            >
              <Trash2 size={15} /> Reset generated cases
            </button>
          </div>
        }
      />
      <div className="filters">
        {(["Alle", ...KINDS] as const).map((k) => (
          <button key={k} className={kind === k ? "selected" : ""} onClick={() => setKind(k)}>
            {k} · {k === "Alle" ? changelog.length : changelog.filter((e) => e.kind === k).length}
          </button>
        ))}
      </div>
      <Panel>
        {entries.length === 0 && (
          <p className="muted">No entries yet. Generate or review test cases in the AI generator.</p>
        )}
        <ol className="timeline">
          {entries.map((e) => (
            <li key={e.id}>
              <time>{formatDateTime(e.timestamp)}</time>
              <div>
                <span className={"kind " + KIND_CLASS[e.kind]}>{e.kind}</span>
                <b>{e.summary}</b>
                <div className="tags">
                  {e.requirementId && <span>{e.requirementId}</span>}
                  {e.testCaseId && <span>{e.testCaseId}</span>}
                </div>
                {(e.before || e.after) && (
                  <table className="detail compact">
                    <tbody>
                      {e.before && <tr><th>Before</th><td>{e.before}</td></tr>}
                      {e.after && <tr><th>After</th><td>{e.after}</td></tr>}
                    </tbody>
                  </table>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}
