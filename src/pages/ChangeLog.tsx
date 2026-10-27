import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { useReviewStore } from "../state/reviewContext";
import { CHANGE_KINDS } from "../types/review";
import type { ChangeKind } from "../types/review";
import { download } from "../utils/download";
import { formatDateTime, toCsv } from "../utils/format";

/** CSS modifier per change kind, so the timeline is scannable at a glance. */
const KIND_CLASS: Record<ChangeKind, string> = {
  Dokument: "kind-doc",
  Extraktion: "kind-extract",
  Anforderung: "kind-req",
  Generierung: "kind-gen",
  Prüfung: "kind-review",
  Validierung: "kind-validation",
  Einstellungen: "kind-settings",
  Zurücksetzen: "kind-reset",
};

/**
 * Timestamped change log (brainstorm: "timestamp for change log"). Every
 * upload, extraction, examiner decision, generation run and settings change
 * is recorded with its previous value, newest first. Stored in this browser only.
 */
export function ChangeLog() {
  const { changelog, cases, resetCases } = useReviewStore();
  const [kind, setKind] = useState<ChangeKind | "Alle">("Alle");
  const entries = [...changelog].reverse().filter((e) => kind === "Alle" || e.kind === kind);

  const exportCsv = () =>
    download(
      "aenderungsprotokoll.csv",
      toCsv([
        ["Zeitpunkt", "Art", "Anforderung", "Testfall", "Zusammenfassung", "Vorher", "Nachher"],
        ...changelog.map((e) => [e.timestamp, e.kind, e.requirementId, e.testCaseId, e.summary, e.before, e.after]),
      ]),
    );

  return (
    <>
      <Header
        title="Änderungsprotokoll"
        subtitle="Jeder Upload, jede Extraktion, Prüferentscheidung, Generierung und Einstellungsänderung mit Zeitstempel und vorherigem Wert. Nichts wird stillschweigend überschrieben."
        action={
          <div className="actions">
            <button onClick={exportCsv} disabled={changelog.length === 0}>
              <Download size={15} /> CSV exportieren
            </button>
            <button
              disabled={cases.length === 0}
              onClick={() => {
                if (window.confirm(`Alle ${cases.length} erzeugten Testfälle samt Rückmeldungen entfernen? Das Protokoll behält einen Eintrag.`)) resetCases();
              }}
            >
              <Trash2 size={15} /> Erzeugte Testfälle zurücksetzen
            </button>
          </div>
        }
      />
      <div className="filters">
        {(["Alle", ...CHANGE_KINDS] as const).map((k) => (
          <button key={k} className={kind === k ? "selected" : ""} onClick={() => setKind(k)}>
            {k} · {k === "Alle" ? changelog.length : changelog.filter((e) => e.kind === k).length}
          </button>
        ))}
      </div>
      <Panel>
        {entries.length === 0 && <p className="muted">Noch keine Einträge. Laden Sie ein Dokument hoch oder erzeugen Sie Testfälle.</p>}
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
                      {e.before && <tr><th>Vorher</th><td className="prewrap">{e.before}</td></tr>}
                      {e.after && <tr><th>Nachher</th><td className="prewrap">{e.after}</td></tr>}
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
