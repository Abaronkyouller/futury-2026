import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Save, Search, Trash2 } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Pager } from "../components/Pager";
import { Status } from "../components/Status";
import { PriorityBadge } from "../components/GeneratedCaseCard";
import { useReviewStore } from "../state/reviewContext";
import { useConfirm } from "../state/confirmContext";
import { PRIORITIES } from "../types/review";
import type { Priority } from "../types/review";
import { TEST_OUTCOMES } from "../types/testReport";
import type { TestOutcome, TestReport } from "../types/testReport";
import { sanitizeCaseTitle } from "../utils/caseText";
import { formatDateTime } from "../utils/format";
import { printTestReport } from "../utils/testReportPdf";
import { caseOutcome, comparisonOutcome, countOutcomes, latestComparisons, OUTCOME_CLASS } from "../utils/testOutcome";

const REVIEW_FILTERS = ["Alle", "Offen", "Akzeptiert", "Abgelehnt"] as const;
type ReviewFilter = (typeof REVIEW_FILTERS)[number];
const ASSIGN_FILTERS = ["Alle", "Zugeordnet", "Nicht zugeordnet"] as const;
type AssignFilter = (typeof ASSIGN_FILTERS)[number];
const CASES_PER_PAGE = 10;

/** Editable state of the form; it reaches the store (and the PDF) only via "Speichern". */
type Draft = Pick<TestReport, "software" | "vendor" | "examiner" | "caseIds"> & { outcomes: Record<string, TestOutcome> };
const EMPTY_DRAFT: Draft = { software: "", vendor: "", examiner: "", caseIds: [], outcomes: {} };
type OutcomeFilter = "Alle" | TestOutcome;

/** Same manual results regardless of key order. */
const sameOutcomes = (a: Record<string, TestOutcome>, b: Record<string, TestOutcome> = {}) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

const pad = (n: number) => String(n).padStart(2, "0");
/** Report ID from the local save time: YYYYMMDDHHMMSS (suffix -2, -3 … if taken). */
function reportId(taken: string[]): string {
  const d = new Date();
  const base = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Testbericht: the examiner names a payroll software under test, assigns test
 * cases to it (same filters as on "Testfälle"), saves with "Speichern" and
 * exports the saved report as PDF. The ID (YYYYMMDDHHMMSS) is assigned on the
 * first save. Results per case come from the comparisons on "Validierung & Bericht".
 */
export function TestReportPage() {
  const { cases, requirements, comparisons, testReports, saveTestReport, deleteTestReport } = useReviewStore();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  // Without ?bericht=… the page starts with an empty new report (nothing pre-selected);
  // saved reports are opened via the dropdown or the Software page.
  const report = testReports.find((r) => r.id === params.get("bericht"));
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [draftFor, setDraftFor] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  // Filters (same as on the Testfälle page, plus the assignment state).
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"Alle" | Priority>("Alle");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("Alle");
  const [sourceFilter, setSourceFilter] = useState("Alle");
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("Alle");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("Alle");
  const [page, setPage] = useState(1);

  // The form shows the selected report; switching reports loads its saved state.
  if ((report?.id ?? "neu") !== (draftFor ?? "neu")) {
    setDraftFor(report?.id);
    setDraft(report ? { software: report.software, vendor: report.vendor, examiner: report.examiner, caseIds: report.caseIds, outcomes: report.outcomes ?? {} } : EMPTY_DRAFT);
  }
  const dirty = report
    ? (["software", "vendor", "examiner"] as const).some((k) => draft[k].trim() !== report[k]) || !sameIds(draft.caseIds, report.caseIds) || !sameOutcomes(draft.outcomes, report.outcomes)
    : Boolean(draft.software.trim() || draft.vendor.trim() || draft.examiner.trim() || draft.caseIds.length);

  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const sourceOf = (requirementId: string) => {
    const req = reqById.get(requirementId);
    return req?.origin?.documentName ?? req?.source ?? "Ohne Quellenangabe";
  };
  const sources = [...new Set(cases.map((c) => sourceOf(c.requirementId)))].sort((a, b) => a.localeCompare(b, "de"));
  const latest = latestComparisons(comparisons);
  const assigned = new Set(draft.caseIds);
  const q = query.trim().toLocaleLowerCase("de-DE");
  const filtered = cases
    .filter((c) => priorityFilter === "Alle" || c.priority === priorityFilter)
    .filter((c) => reviewFilter === "Alle" || c.review.decision === reviewFilter)
    .filter((c) => sourceFilter === "Alle" || sourceOf(c.requirementId) === sourceFilter)
    .filter((c) => assignFilter === "Alle" || (assignFilter === "Zugeordnet") === assigned.has(c.id))
    .filter((c) => outcomeFilter === "Alle" || caseOutcome(c.id, draft.outcomes, latest).outcome === outcomeFilter)
    .filter((c) => !q || [c.id, c.requirementId, c.title, c.technique, sourceOf(c.requirementId)].some((v) => v.toLocaleLowerCase("de-DE").includes(q)))
    .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(filtered.length / CASES_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage - 1) * CASES_PER_PAGE, currentPage * CASES_PER_PAGE);
  const filtersActive = query || priorityFilter !== "Alle" || reviewFilter !== "Alle" || sourceFilter !== "Alle" || assignFilter !== "Alle" || outcomeFilter !== "Alle";
  const resetFilters = () => { setQuery(""); setPriorityFilter("Alle"); setReviewFilter("Alle"); setSourceFilter("Alle"); setAssignFilter("Alle"); setOutcomeFilter("Alle"); setPage(1); };

  // Assigned cases that still exist (cases can be removed by "Testfälle zurücksetzen").
  const existing = (ids: string[]) => ids.map((id) => cases.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const draftCases = existing(draft.caseIds);
  const savedCases = existing(report?.caseIds ?? []);
  const missing = draft.caseIds.length - draftCases.length;
  const counts = countOutcomes(draftCases.map((c) => caseOutcome(c.id, draft.outcomes, latest).outcome));

  const setAssignment = (ids: string[], on: boolean) => {
    // Called only from a single checkbox – the selection is exactly what the examiner ticked.
    const change = ids.filter((id) => assigned.has(id) !== on);
    if (!change.length) return;
    setDraft((d) => {
      // Removing a case also drops its manual result.
      const outcomes = on ? d.outcomes : Object.fromEntries(Object.entries(d.outcomes).filter(([id]) => !change.includes(id)));
      return { ...d, caseIds: on ? [...d.caseIds, ...change] : d.caseIds.filter((id) => !change.includes(id)), outcomes };
    });
    setNotice("");
  };
  /** Sets the result of an assigned case for this software; the value from the comparison removes the manual entry. */
  const setOutcome = (caseId: string, outcome: TestOutcome) => {
    setDraft((d) => {
      const rest = Object.fromEntries(Object.entries(d.outcomes).filter(([id]) => id !== caseId));
      return { ...d, outcomes: outcome === comparisonOutcome(latest.get(caseId)) ? rest : { ...rest, [caseId]: outcome } };
    });
    setNotice("");
  };
  const save = () => {
    const d = { ...draft, software: draft.software.trim(), vendor: draft.vendor.trim(), examiner: draft.examiner.trim() };
    if (!d.software) {
      // Without a name nothing is saved: say so and take the user to the field.
      setError("Bitte zuerst einen Namen für die Software eingeben – ohne Namen kann der Testbericht nicht gespeichert werden.");
      nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameRef.current?.focus({ preventScroll: true });
      return;
    }
    setError("");
    if (report) {
      const added = d.caseIds.filter((id) => !report.caseIds.includes(id)).length;
      const removed = report.caseIds.filter((id) => !d.caseIds.includes(id)).length;
      const manual = Object.keys(d.outcomes).length;
      saveTestReport({ ...report, ...d }, `gespeichert (${d.caseIds.length} Testfälle${added ? `, +${added}` : ""}${removed ? `, −${removed}` : ""}${manual ? `, ${manual} Ergebnis(se) manuell gesetzt` : ""})`);
      setNotice(`Gespeichert: ${d.caseIds.length} Testfall/Testfälle.`);
    } else {
      const id = reportId(testReports.map((r) => r.id));
      const now = new Date().toISOString();
      saveTestReport({ id, ...d, createdAt: now, updatedAt: now }, `angelegt (${d.caseIds.length} Testfälle)`);
      setDraftFor(id); // keep the current draft; it equals the saved state
      setParams({ bericht: id });
      setNotice(`Testbericht mit ID ${id} angelegt.`);
    }
  };
  const discardChanges = async () =>
    !dirty || (await confirm({ title: "Ungespeicherte Änderungen verwerfen?", message: "Die Änderungen an diesem Testbericht wurden noch nicht gespeichert.", confirmLabel: "Verwerfen" }));
  const switchTo = async (id: string) => {
    if (await discardChanges()) { setNotice(""); setError(""); setParams({ bericht: id }); }
  };
  const remove = async () => {
    if (!report) return;
    if (await confirm({ title: "Testbericht löschen?", message: `Der Testbericht „${report.software}“ (ID ${report.id}) wird gelöscht. Die Testfälle selbst bleiben erhalten.`, confirmLabel: "Löschen" })) {
      deleteTestReport(report.id);
      setParams({});
    }
  };
  /** Exports the saved state, not the unsaved draft. */
  const exportPdf = () => {
    if (!report) return;
    try { printTestReport(report, savedCases, requirements, comparisons); setError(""); } catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <Header
        title="Testbericht"
        subtitle="Eine Entgeltabrechnungssoftware benennen, ihr Testfälle zuordnen und den Testbericht als PDF exportieren. Ergebnisse stammen aus dem Abgleich unter „Validierung & Bericht“."
        action={<button className="primary" disabled={!report || savedCases.length === 0} title="Exportiert den zuletzt gespeicherten Stand" onClick={exportPdf}><Download size={15} /> Gespeicherten Testbericht als PDF</button>}
      />

      <Panel>
        <div className="paneltop">
          <h3><span className="stepno">1</span>Software</h3>
          {testReports.length > 0 && (
            <div className="actions">
              <label className="field inline">Testbericht
                <select value={report?.id ?? "neu"} onChange={(e) => switchTo(e.target.value)}>
                  {[...testReports].reverse().map((r) => <option key={r.id} value={r.id}>{r.software} · ID {r.id} · {r.caseIds.length} Testfall/Testfälle</option>)}
                  <option value="neu">+ Neuer Testbericht</option>
                </select>
              </label>
            </div>
          )}
        </div>
        <div className="reportform">
          <label className="field">Name der Software *
            <input ref={nameRef} className={error && !draft.software.trim() ? "invalid" : ""} aria-invalid={Boolean(error && !draft.software.trim())} value={draft.software} placeholder="z. B. LohnPro Entgelt" onChange={(e) => { setDraft({ ...draft, software: e.target.value }); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
          </label>
          <label className="field">ID
            <input value={report?.id ?? ""} placeholder="wird beim Speichern vergeben" readOnly title="Automatisch: Zeitpunkt der ersten Speicherung (JJJJMMTTHHMMSS)" />
          </label>
          <label className="field">Hersteller
            <input value={draft.vendor} placeholder="optional" onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} />
          </label>
          <label className="field">Prüfer/in
            <input value={draft.examiner} placeholder="optional" onChange={(e) => setDraft({ ...draft, examiner: e.target.value })} />
          </label>
        </div>
        <div className="actions">
          <button className="primary" disabled={!dirty} onClick={save}><Save size={15} /> Speichern</button>
          {report && <button onClick={remove}><Trash2 size={15} /> Testbericht löschen</button>}
          {dirty ? <span className="status warn">Ungespeicherte Änderungen</span> : notice && <span className="status good">{notice}</span>}
          {report && <span className="muted small">Angelegt {formatDateTime(report.createdAt)} · zuletzt gespeichert {formatDateTime(report.updatedAt)}</span>}
        </div>
        {error && <p className="errortext">{error}</p>}
      </Panel>

      <Panel>
        <div className="paneltop">
          <h3><span className="stepno">2</span>Testfälle zuordnen{draft.software.trim() ? ` · ${draft.software.trim()}` : ""}</h3>
          {(

            <div className="tags">
              <span className="status neutral">{draftCases.length} zugeordnet</span>
              <span className="status good">{counts["Test erfolgreich"]} Test erfolgreich</span>
              <span className="status bad">{counts["Test fehlgeschlagen"]} Test fehlgeschlagen</span>
              <span className="status neutral">{counts["Test noch nicht durchgeführt"]} Test noch nicht durchgeführt</span>
            </div>
          )}
        </div>
        {cases.length === 0 ? (
          <p className="muted">Noch keine Testfälle vorhanden. Erzeugen Sie sie unter <Link to="/documents">Testfall-Generator</Link>.</p>
        ) : (
          <>
            {missing > 0 && <p className="muted small">{missing} zugeordnete(r) Testfall/Testfälle existieren nicht mehr (zurückgesetzt) und erscheinen nicht im Bericht.</p>}
            <div className="search wide">
              <Search size={15} />
              <input placeholder="Testfall, Anforderung, Titel, Technik oder Quelle suchen" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
            </div>
            <div className="filters">
              <label className="field inline">Priorität
                <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value as "Alle" | Priority); setPage(1); }}>
                  <option>Alle</option>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className="field inline">Prüfstatus
                <select value={reviewFilter} onChange={(e) => { setReviewFilter(e.target.value as ReviewFilter); setPage(1); }}>
                  {REVIEW_FILTERS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field inline">Quelle
                <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
                  <option>Alle</option>
                  {sources.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field inline">Zuordnung
                <select value={assignFilter} onChange={(e) => { setAssignFilter(e.target.value as AssignFilter); setPage(1); }}>
                  {ASSIGN_FILTERS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field inline">Ergebnis
                <select value={outcomeFilter} onChange={(e) => { setOutcomeFilter(e.target.value as OutcomeFilter); setPage(1); }}>
                  <option>Alle</option>
                  {TEST_OUTCOMES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <span className="muted small">{filtered.length} von {cases.length} Testfall/Testfällen</span>
              {filtersActive && <button onClick={resetFilters}>Filter zurücksetzen</button>}
            </div>
            <p className="muted small">Zugeordnet werden nur die Testfälle, deren Kästchen Sie selbst ankreuzen. Filter ändern nur die Ansicht, nicht die Auswahl. Das Ergebnis lässt sich für jeden zugeordneten Testfall festlegen; ohne eigene Angabe gilt die Prüferentscheidung aus „Validierung &amp; Bericht“.</p>
            {filtered.length === 0 ? (
              <p className="muted">Keine Testfälle entsprechen den gewählten Filtern.</p>
            ) : (
              <>
                <div className="tablepanel">
                  <table className="assigntable">
                    <thead>
                      <tr>
                        <th className="check">Auswahl</th>
                        {["Testfall", "Anforderung / Quelle", "Priorität", "Prüfstatus", "Ergebnis"].map((h) => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((c) => {
                        const on = assigned.has(c.id);
                        const result = caseOutcome(c.id, draft.outcomes, latest);
                        return (
                          <tr key={c.id} className={on ? "assigned" : ""}>
                            <td className="check">
                              <input type="checkbox" checked={on} aria-label={`${c.id} zuordnen`} onChange={(e) => setAssignment([c.id], e.target.checked)} />
                            </td>
                            <td><code>{c.id}</code><div>{sanitizeCaseTitle(c.title) || c.technique}</div></td>
                            <td><div>{c.requirementId}</div><small className="muted">{sourceOf(c.requirementId)}</small></td>
                            <td><PriorityBadge value={c.priority} /></td>
                            <td><Status value={c.review.decision} /></td>
                            <td>
                              {on ? (
                                <>
                                  <select className={`miniselect st-${OUTCOME_CLASS[result.outcome]}`} value={result.outcome} aria-label={`Ergebnis von ${c.id}`} onChange={(e) => setOutcome(c.id, e.target.value as TestOutcome)}>
                                    {TEST_OUTCOMES.map((o) => <option key={o}>{o}</option>)}
                                  </select>
                                  <small className="muted defaulthint">{result.source === "manuell" ? "manuell gesetzt" : result.source === "Abgleich" ? "aus dem Abgleich" : "kein Abgleich"}</small>
                                </>
                              ) : (
                                <span className={`status ${OUTCOME_CLASS[result.outcome]}`}>{result.outcome}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pager page={currentPage} pageCount={pageCount} total={filtered.length} onPage={setPage} />
              </>
            )}
          </>
        )}
      </Panel>

      {dirty && (
        <div className="savebar" role="status">
          {draft.software.trim()
            ? <span>Ungespeicherte Änderungen an „{draft.software.trim()}“ · {draft.caseIds.length} Testfall/Testfälle ausgewählt. Der PDF-Export enthält den zuletzt gespeicherten Stand.</span>
            : <span className="savebarwarn">{draft.caseIds.length} Testfall/Testfälle ausgewählt, aber noch <b>kein Name der Software</b> – bitte oben unter „1 · Software“ eintragen, dann speichern.</span>}
          <button className="primary" onClick={save}><Save size={15} /> Speichern</button>
        </div>
      )}
    </>
  );
}
