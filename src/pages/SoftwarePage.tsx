import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Download, FilePen, Search, Trash2 } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Pager } from "../components/Pager";
import { Status } from "../components/Status";
import { useReviewStore } from "../state/reviewContext";
import { useConfirm } from "../state/confirmContext";
import { TEST_OUTCOMES } from "../types/testReport";
import type { TestOutcome, TestReport } from "../types/testReport";
import { sanitizeCaseTitle } from "../utils/caseText";
import { formatDateTime, toCsv } from "../utils/format";
import { download } from "../utils/download";
import { printTestReport } from "../utils/testReportPdf";
import { caseOutcome, countOutcomes, latestComparisons, OUTCOME_CLASS } from "../utils/testOutcome";

/** "Ergebnis" filter: software that has at least one test case with this result. */
type ResultFilter = "Alle" | TestOutcome;
const PER_PAGE = 10;

/**
 * Software: every payroll software saved on the Testbericht page (one entry
 * per saved report) with its data, assigned test cases and results. Filters
 * as on the other pages; open, export as PDF or delete per entry.
 */
export function SoftwarePage() {
  const { testReports, cases, requirements, comparisons, deleteTestReport } = useReviewStore();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [vendor, setVendor] = useState("Alle");
  const [examiner, setExaminer] = useState("Alle");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("Alle");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  const latest = latestComparisons(comparisons);
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const summary = (r: TestReport) => {
    const own = r.caseIds.map((id) => caseById.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
    const results = own.map((c) => caseOutcome(c.id, r.outcomes, latest));
    const counts = countOutcomes(results.map((x) => x.outcome));
    return { own, results, counts };
  };
  const names = (pick: (r: TestReport) => string) => [...new Set(testReports.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
  const vendors = names((r) => r.vendor);
  const examiners = names((r) => r.examiner);

  const terms = query.trim().toLocaleLowerCase("de-DE").split(/\s+/).filter(Boolean);
  const filtered = [...testReports]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((r) => vendor === "Alle" || r.vendor === vendor)
    .filter((r) => examiner === "Alle" || r.examiner === examiner)
    .filter((r) => {
      if (resultFilter === "Alle") return true;
      return summary(r).counts[resultFilter] > 0;
    })
    .filter((r) => {
      const hay = [r.software, r.id, r.vendor, r.examiner, ...r.caseIds].join(" ").toLocaleLowerCase("de-DE");
      return terms.every((t) => hay.includes(t));
    });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const filtersActive = query || vendor !== "Alle" || examiner !== "Alle" || resultFilter !== "Alle";
  const reset = () => { setQuery(""); setVendor("Alle"); setExaminer("Alle"); setResultFilter("Alle"); setPage(1); };

  const exportPdf = (r: TestReport) => {
    try { printTestReport(r, summary(r).own, requirements, comparisons); setError(""); } catch (e) { setError((e as Error).message); }
  };
  const remove = async (r: TestReport) => {
    if (await confirm({ title: "Software löschen?", message: `„${r.software}“ (ID ${r.id}) und die Zuordnung der Testfälle werden gelöscht. Die Testfälle selbst bleiben erhalten.`, confirmLabel: "Löschen" })) deleteTestReport(r.id);
  };
  const exportCsv = () => download("software.csv", "﻿" + toCsv([
    ["ID", "Software", "Hersteller", "Prüfer/in", "Testfälle", ...TEST_OUTCOMES, "Angelegt", "Gespeichert"],
    ...filtered.map((r) => { const s = summary(r); return [r.id, r.software, r.vendor, r.examiner, String(s.own.length), ...TEST_OUTCOMES.map((o) => String(s.counts[o])), formatDateTime(r.createdAt), formatDateTime(r.updatedAt)]; }),
  ]));

  return (
    <>
      <Header
        title="Software"
        subtitle="Alle unter „Testbericht“ gespeicherten Entgeltabrechnungsprogramme mit ihren zugeordneten Testfällen und Ergebnissen."
        action={<button onClick={exportCsv} disabled={filtered.length === 0}><Download size={15} /> Liste als CSV</button>}
      />
      <Panel>
        {testReports.length === 0 ? (
          <p className="muted">Noch keine Software gespeichert. Legen Sie unter <Link to="/testbericht">Testbericht</Link> eine Software an, wählen Sie Testfälle aus und klicken Sie auf „Speichern“.</p>
        ) : (
          <>
            <div className="search wide">
              <Search size={15} />
              <input placeholder="Software, ID, Hersteller, Prüfer/in oder Testfall suchen" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
            </div>
            <div className="filters">
              <label className="field inline">Hersteller
                <select value={vendor} onChange={(e) => { setVendor(e.target.value); setPage(1); }}>
                  <option>Alle</option>
                  {vendors.map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label className="field inline">Prüfer/in
                <select value={examiner} onChange={(e) => { setExaminer(e.target.value); setPage(1); }}>
                  <option>Alle</option>
                  {examiners.map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label className="field inline">Ergebnis
                <select value={resultFilter} onChange={(e) => { setResultFilter(e.target.value as ResultFilter); setPage(1); }}>
                  <option>Alle</option>
                  {TEST_OUTCOMES.map((v) => <option key={v} value={v}>enthält: {v}</option>)}
                </select>
              </label>
              <span className="muted small">{filtered.length} von {testReports.length} Software</span>
              {filtersActive && <button onClick={reset}>Filter zurücksetzen</button>}
            </div>
            {error && <p className="errortext">{error}</p>}
            {filtered.length === 0 ? (
              <p className="muted">Keine Software entspricht den gewählten Filtern.</p>
            ) : (
              <>
                <div className="tablepanel">
                  <table className="softwaretable">
                    <thead>
                      <tr>{["", "Software", "ID", "Hersteller", "Prüfer/in", "Testfälle", "Ergebnis", "Gespeichert", ""].map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => {
                        const s = summary(r);
                        const isOpen = open === r.id;
                        return (
                          <Fragment key={r.id}>
                            <tr className={isOpen ? "highlight" : ""}>
                              <td>
                                <button className="cellbtn" aria-expanded={isOpen} aria-label={`Testfälle von ${r.software} ${isOpen ? "zuklappen" : "anzeigen"}`} onClick={() => setOpen(isOpen ? null : r.id)}>
                                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                              </td>
                              <td><b>{r.software}</b></td>
                              <td><code>{r.id}</code></td>
                              <td>{r.vendor || "–"}</td>
                              <td>{r.examiner || "–"}</td>
                              <td>{s.own.length}</td>
                              <td>
                                <div className="tags">
                                  {TEST_OUTCOMES.filter((o) => s.counts[o] > 0).map((o) => <span key={o} className={`status ${OUTCOME_CLASS[o]}`}>{s.counts[o]} {o}</span>)}
                                  {s.own.length === 0 && <span className="muted small">keine Testfälle</span>}
                                </div>
                              </td>
                              <td className="nowrap">{formatDateTime(r.updatedAt)}</td>
                              <td>
                                <div className="rowactions">
                                  <Link className="buttonlink" to={`/testbericht?bericht=${encodeURIComponent(r.id)}`} title="Im Testbericht bearbeiten"><FilePen size={15} /> Öffnen</Link>
                                  <button onClick={() => exportPdf(r)} disabled={s.own.length === 0} title="Gespeicherten Testbericht als PDF"><Download size={15} /> PDF</button>
                                  <button className="cellbtn" onClick={() => remove(r)} title="Software löschen" aria-label={`${r.software} löschen`}><Trash2 size={15} /></button>
                                </div>
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="subrow">
                                <td />
                                <td colSpan={8}>
                                  {s.own.length === 0 ? <p className="muted small">Keine Testfälle zugeordnet.</p> : (
                                    <ul className="softwarecases">
                                      {s.own.map((c, i) => (
                                        <li key={c.id}>
                                          <code>{c.id}</code> {sanitizeCaseTitle(c.title) || c.technique}
                                          <Status value={c.review.decision} />
                                          <span className={`status ${OUTCOME_CLASS[s.results[i].outcome]}`}>{s.results[i].outcome}</span>{s.results[i].source === "manuell" && <small className="muted">manuell gesetzt</small>}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  {r.caseIds.length > s.own.length && <p className="muted small">{r.caseIds.length - s.own.length} zugeordnete(r) Testfall/Testfälle existieren nicht mehr.</p>}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pager page={currentPage} pageCount={pageCount} total={filtered.length} unit="Software" onPage={setPage} />
              </>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
