import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Link } from "react-router-dom";
import { Download, FileText, Printer, Scale, Trash2, Upload } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";
import { ComparisonView } from "../components/ComparisonView";
import { CaseCombobox } from "../components/CaseCombobox";
import { COMPARE_MODEL } from "../config/ai";
import { RESULT_FILE_TYPES } from "../config/validation";
import { compareResult, suggestCases } from "../ai/compare";
import { useReviewStore } from "../state/reviewContext";
import { useResults } from "../state/useResults";
import type { OverallVerdict, ResultComparison } from "../types/validation";
import { download } from "../utils/download";
import { formatDateTime, toCsv } from "../utils/format";

/** Suggested test cases shown above the full list in the case picker. */
const SUGGESTIONS_SHOWN = 5;

/** Binding verdict of a comparison: the examiner's, else the models' consensus (provisional). */
function finalVerdict(c: ResultComparison): { value: OverallVerdict | "Uneinig"; confirmed: boolean } {
  return c.feedback ? { value: c.feedback.verdict, confirmed: true } : { value: c.consensus, confirmed: false };
}

/** One row per comparison and field, so the report can be filtered in a spreadsheet. */
function exportReport(comparisons: ResultComparison[]) {
  const rows = comparisons.flatMap((c) =>
    c.expected.map((e) => {
      const [ki, rule] = c.assessments;
      const v = (x: typeof ki) => (x.ok ? x.fields.find((f) => f.field === e.field)?.verdict ?? "" : `Fehler: ${x.error ?? ""}`);
      const read = (x: typeof ki) => x.fields.find((f) => f.field === e.field)?.observed ?? "";
      return [
        c.id, c.createdAt, c.resultName, c.testCaseId, c.requirementId, e.field, e.value,
        v(ki), read(ki), v(rule), read(rule), c.fieldAgreement[e.field] ? "ja" : "nein", c.consensus,
        c.feedback?.fieldVerdicts[e.field] ?? "", c.feedback?.verdict ?? "", c.feedback?.comment ?? "",
      ];
    }),
  );
  download(
    "pruefbericht-abgleiche.csv",
    toCsv([
      ["Abgleich", "Zeitpunkt", "Ergebnisdatei", "Testfall", "Anforderung", "Feld", "Erwartet",
        "KI Urteil", "KI gelesen", "Regelbasiert Urteil", "Regelbasiert gelesen", "KI und Regel einig", "Gesamt (KI ↔ Regel)",
        "Prüfer Feld", "Prüfer gesamt", "Prüfer Kommentar"],
      ...rows,
    ]),
  );
}

/**
 * H5/H6 – "Validierung & Bericht": payroll results are imported, compared
 * with the expected values of a test case by the KI and a rule-based line
 * matcher side by side, decided by the examiner and summarised in the report.
 */
export function Validation() {
  const store = useReviewStore();
  const { results, ready, storageWarning, addFiles, remove } = useResults();
  const [resultId, setResultId] = useState<string>("");
  const [caseId, setCaseId] = useState<string>("");
  const [selectedComparison, setSelectedComparison] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hover, setHover] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const result = results.find((r) => r.id === resultId) ?? results[results.length - 1];
  const candidates = useMemo(() => store.cases.filter((c) => c.review.decision !== "Abgelehnt"), [store.cases]);
  const ranked = useMemo(() => (result ? suggestCases(result, candidates) : []), [result, candidates]);
  const suggested = ranked.slice(0, SUGGESTIONS_SHOWN).filter((x) => x.score > 0);
  const testCase = candidates.find((c) => c.id === caseId) ?? suggested[0]?.testCase ?? ranked[0]?.testCase;
  const suggestedIds = new Set(suggested.map((x) => x.testCase.id));
  const caseOptions = ranked.map((x) => ({ ...x, suggested: suggestedIds.has(x.testCase.id) }));
  const comparisons = store.comparisons;
  const active = comparisons.find((c) => c.id === selectedComparison) ?? comparisons[comparisons.length - 1];

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadErrors([]);
    const { added, errors } = await addFiles([...files]);
    setUploading(false);
    setUploadErrors(errors);
    if (added.length) {
      setResultId(added[added.length - 1].id);
      setCaseId("");
    }
  }
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setHover(false);
    void handleFiles(e.dataTransfer.files);
  };

  async function run() {
    if (!result || !testCase) return;
    setBusy(true);
    setError("");
    try {
      const comparison = await compareResult({ testCase, result, history: comparisons });
      store.addComparison(comparison);
      setSelectedComparison(comparison.id);
      const failed = comparison.assessments.filter((a) => !a.ok);
      if (failed.length) setError(`${failed.map((a) => `${a.label}: ${a.error}`).join(" · ")}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Report figures: examiner verdict where given, otherwise the common verdict of KI and rule (provisional).
  const finals = comparisons.map(finalVerdict);
  const count = (v: string) => finals.filter((f) => f.value === v).length;
  const reviewed = comparisons.filter((c) => c.feedback);
  const kiAnswered = comparisons.filter((c) => c.assessments[0].ok);
  const agreed = kiAnswered.filter((c) => c.consensus !== "Uneinig").length;
  const accuracy = [COMPARE_MODEL.label, "Regelbasiert"].map((label, i) => ({
    label,
    right: reviewed.filter((c) => c.assessments[i]?.ok && c.assessments[i].overall === c.feedback!.verdict).length,
  }));

  return (
    <>
      <Header
        title="Validierung & Prüfbericht"
        subtitle="Ergebnisse aus der Entgeltabrechnungssoftware hochladen und mit den erwarteten Werten eines Testfalls abgleichen. Die KI und ein regelbasierter Zeilenabgleich bewerten unabhängig voneinander und werden gegenübergestellt; die Entscheidung trifft der Prüfer."
        action={
          <div className="actions">
            <button onClick={() => window.print()} disabled={!comparisons.length}><Printer size={15} /> Drucken / PDF</button>
            <button className="primary" onClick={() => exportReport(comparisons)} disabled={!comparisons.length}><Download size={15} /> Prüfbericht (CSV)</button>
          </div>
        }
      />
      <div className="chips">
        <span>1 Ergebnis hochladen</span>
        <span>2 Testfall wählen & abgleichen</span>
        <span>3 Entscheidung speichern</span>
        <span>{COMPARE_MODEL.label}: {COMPARE_MODEL.model}</span>
        <span className="warm">KI und Regelabgleich schlagen vor – keine Regel-Engine angebunden</span>
      </div>
      {storageWarning && <div className="notice">{storageWarning}</div>}

      <div className="valgrid">
        <Panel>
          <h3><span className="stepno">1</span> Ergebnisse der Entgeltabrechnung</h3>
          <label
            className={"upload dropzone " + (hover ? "hover" : "")}
            onDragOver={(e) => { e.preventDefault(); setHover(true); }}
            onDragLeave={() => setHover(false)}
            onDrop={onDrop}
          >
            <Upload size={24} />
            <b>Ergebnisdatei hochladen</b>
            <span>{uploading ? "Wird gelesen …" : "PDF, DOCX oder TXT · z. B. demo1.pdf bis demo3.pdf aus dem Ordner demo-ergebnisse/"}</span>
            <input type="file" multiple accept={RESULT_FILE_TYPES} disabled={uploading} onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }} />
          </label>
          {uploadErrors.length > 0 && <div className="notice errorbox"><b>Nicht verarbeitet</b><ul>{uploadErrors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
          {!ready && <p className="muted">Gespeicherte Ergebnisse werden geladen …</p>}
          {ready && !results.length && <p className="muted">Noch keine Ergebnisse hochgeladen.</p>}
          {results.map((r) => (
            <div key={r.id} className={"resultitem " + (result?.id === r.id ? "chosen" : "")}>
              <button className="docname" onClick={() => { setResultId(r.id); setCaseId(""); }}>
                <FileText size={17} />
                <span>
                  <b>{r.name}</b>
                  <small>{r.pageCount ? `${r.pageCount} Seite(n) · ` : ""}{r.text.length.toLocaleString("de-DE")} Zeichen · {formatDateTime(r.uploadedAt)} · {comparisons.filter((c) => c.resultId === r.id).length} Abgleich(e)</small>
                </span>
              </button>
              <div className="actions">
                <button className="link" onClick={() => setPreview(preview === r.id ? null : r.id)}>{preview === r.id ? "Text ausblenden" : "Text"}</button>
                <button title="Ergebnis entfernen" onClick={() => { if (window.confirm(`„${r.name}“ entfernen? Gespeicherte Abgleiche bleiben erhalten.`)) remove(r.id); }}><Trash2 size={15} /></button>
              </div>
              {r.warnings.length > 0 && <ul className="warnings">{r.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
              {preview === r.id && <div className="sourcetext">{r.text}</div>}
            </div>
          ))}
        </Panel>

        <Panel>
          <h3><span className="stepno">2</span> Abgleich mit einem Testfall</h3>
          {!candidates.length ? (
            <p className="muted">Noch keine Testfälle. Erzeugen Sie zuerst unter <Link to="/documents">Dokumente & Testfälle</Link> Testfälle aus einer Spezifikation.</p>
          ) : !result ? (
            <p className="muted">Laden Sie links ein Ergebnis hoch.</p>
          ) : (
            <>
              <label className="field">
                Ergebnis
                <select value={result.id} onChange={(e) => { setResultId(e.target.value); setCaseId(""); }}>
                  {results.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <div className="field">
                Testfall
                <CaseCombobox options={caseOptions} value={testCase} onChange={setCaseId} />
              </div>
              {testCase && (
                <table className="detail compact">
                  <tbody>
                    <tr><th>Gegeben</th><td>{testCase.given || "–"}</td></tr>
                    <tr><th>Dann</th><td>{testCase.then || "–"}</td></tr>
                    {testCase.expectedFields.map((f) => <tr key={f.field}><th>Erwartet</th><td><b>{f.field}:</b> {f.value}</td></tr>)}
                  </tbody>
                </table>
              )}
              <div className="actions spaced">
                <button className="primary" disabled={busy || !testCase} onClick={() => void run()}>
                  <Scale size={15} /> {busy ? "KI prüft …" : "Abgleichen"}
                </button>
              </div>
              {error && <div className="notice errorbox"><b>Hinweis zum Abgleich</b><p>{error}</p></div>}
            </>
          )}
        </Panel>
      </div>

      {active && (
        <Panel>
          <h3><span className="stepno">3</span> Ergebnis des Abgleichs</h3>
          <ComparisonView key={active.id} c={active} />
        </Panel>
      )}

      <Panel>
        <div className="paneltop">
          <h3>Prüfbericht</h3>
          <small>Verbindlich ist die Prüferentscheidung; ohne sie gilt das gemeinsame Urteil von KI und Regelabgleich nur vorläufig.</small>
        </div>
        <div className="metrics">
          {[
            ["Abgleiche", comparisons.length, `${reviewed.length} vom Prüfer entschieden`, ""],
            ["Bestanden", count("Bestanden"), "inkl. vorläufiger", "green"],
            ["Nicht bestanden", count("Nicht bestanden"), "inkl. vorläufiger", "red"],
            ["Unklar / uneinig", count("Unklar") + count("Uneinig"), `KI und Regel einig in ${agreed} von ${kiAnswered.length}`, ""],
          ].map(([label, n, desc, cls]) => (
            <div key={label as string} className="panel">
              <small>{label}</small>
              <div className={"metric " + cls}>{n}</div>
              <small>{desc}</small>
            </div>
          ))}
        </div>
        {reviewed.length > 0 && (
          <p className="muted small">
            Treffer gegenüber der Prüferentscheidung: {accuracy.map((x) => `${x.label} ${x.right}/${reviewed.length}`).join(" · ")}. Diese Entscheidungen fließen als Beispiele in künftige Abgleiche ein.
          </p>
        )}
        {!comparisons.length ? (
          <p className="muted">Noch keine Abgleiche.</p>
        ) : (
          <div className="tablepanel">
            <table>
              <thead>
                <tr>
                  {["Abgleich", "Ergebnis", "Testfall", COMPARE_MODEL.label, "Regelbasiert", "KI ↔ Regel", "Prüfer"].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...comparisons].reverse().map((c) => (
                  <tr key={c.id} className={active?.id === c.id ? "highlight" : ""} onClick={() => setSelectedComparison(c.id)}>
                    <td><code>{c.id}</code><br /><small className="muted">{formatDateTime(c.createdAt)}</small></td>
                    <td>{c.resultName}</td>
                    <td>{c.testCaseId}<br /><small className="muted">{c.caseLabel}</small></td>
                    {c.assessments.map((a) => <td key={a.label}>{a.ok ? <Status value={a.overall} /> : <span className="status bad">Fehler</span>}</td>)}
                    <td><Status value={c.consensus} /></td>
                    <td>{c.feedback ? <Status value={c.feedback.verdict} /> : <span className="muted small">offen</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
