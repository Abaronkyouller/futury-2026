import { Fragment, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Download, FileText, Search, X } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Pager } from "../components/Pager";
import { Status } from "../components/Status";
import { useDocuments } from "../state/documentContext";
import { useReviewStore } from "../state/reviewContext";
import { buildCoverage, COVERAGE_STATUSES, percent } from "../coverage/coverage";
import type { CoverageStatus, SectionCoverage } from "../coverage/coverage";
import { sanitizeCaseTitle } from "../utils/caseText";
import { download } from "../utils/download";
import { toCsv } from "../utils/format";
import { printCoverage } from "../utils/coveragePdf";

const PER_PAGE = 15;
const STATUS_CLASS: Record<CoverageStatus, string> = {
  Abgedeckt: "good",
  "Teilweise abgedeckt": "warn",
  "Anforderung ohne Testfall": "bad",
  "Keine Anforderung erkannt": "neutral",
};

/** Horizontal bar with percentage; colour by level. */
function Bar({ value }: { value: number }) {
  const level = value >= 80 ? "good" : value >= 40 ? "warn" : "bad";
  return (
    <div className="covbar" role="img" aria-label={`${value} %`}>
      <div className={`covfill cov-${level}`} style={{ width: `${value}%` }} />
    </div>
  );
}

/**
 * Testabdeckung: which test case maps to which source section, and how much
 * of the uploaded sources is covered by test cases (sections and requirements).
 */
export function CoveragePage() {
  const { documents } = useDocuments();
  // Coverage comes from the existing test cases; loaded documents only add sections without requirements.
  const { requirements, cases } = useReviewStore();
  const [acceptedOnly, setAcceptedOnly] = useState(false);
  const [docFilter, setDocFilter] = useState("Alle");
  const [statusFilter, setStatusFilter] = useState<"Alle" | CoverageStatus>("Alle");
  // Presentation view (default): only sections with at least one test case are listed.
  const [showUncovered, setShowUncovered] = useState(false);
  const [query, setQuery] = useState("");
  // Section picked from the list (exact filter); typing switches back to the free text search.
  const [sectionKey, setSectionKey] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const all = buildCoverage(documents, requirements, cases, acceptedOnly);
  const docs = all.filter((d) => docFilter === "Alle" || d.source.id === docFilter);
  const notLoaded = docs.filter((d) => !d.source.loaded && !d.source.sample);
  const sections = docs.flatMap((d) => d.sections);
  const totals = {
    sections: sections.length,
    sectionsWithCases: docs.reduce((n, d) => n + d.sectionsWithCases, 0),
    sectionsWithRequirements: docs.reduce((n, d) => n + d.sectionsWithRequirements, 0),
    requirements: docs.reduce((n, d) => n + d.requirements, 0),
    requirementsWithCases: docs.reduce((n, d) => n + d.requirementsWithCases, 0),
    cases: new Set(sections.flatMap((s) => s.cases.map((c) => c.id))).size,
  };

  const terms = query.trim().toLocaleLowerCase("de-DE").split(/\s+/).filter(Boolean);
  const haystack = (s: SectionCoverage) => [s.label, s.documentName, s.pages, ...s.requirements.flatMap((r) => [r.req.id, r.req.title, ...r.cases.flatMap((c) => [c.id, c.title])])].join(" ").toLocaleLowerCase("de-DE");
  const visibleSections = showUncovered ? sections : sections.filter((s) => s.cases.length > 0);
  const statusOptions = COVERAGE_STATUSES.filter((st) => showUncovered || st === "Abgedeckt" || st === "Teilweise abgedeckt");
  const filtered = visibleSections
    .filter((s) => statusFilter === "Alle" || s.status === statusFilter)
    .filter((s) => (sectionKey ? s.key === sectionKey : !terms.length || terms.every((t) => haystack(s).includes(t))));
  // Section list of the picker: the sections of the current view, narrowed by what is typed.
  const labelTerms = sectionKey ? [] : terms;
  const suggestions = visibleSections
    .filter((s) => statusFilter === "Alle" || s.status === statusFilter)
    .filter((s) => labelTerms.every((t) => `${s.label} ${s.documentName} ${s.pages}`.toLocaleLowerCase("de-DE").includes(t)))
    .slice(0, 50);
  const pickSection = (s: SectionCoverage) => {
    setSectionKey(s.key);
    setQuery(s.label);
    setListOpen(false);
    setPage(1);
    setOpen(s.key); // show its requirements and test cases right away
  };
  const onPickerKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setListOpen(true); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && listOpen && suggestions[active]) { e.preventDefault(); pickSection(suggestions[active]); }
    else if (e.key === "Escape") setListOpen(false);
  };
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const filtersActive = query || sectionKey || docFilter !== "Alle" || statusFilter !== "Alle";
  const reset = () => { setQuery(""); setSectionKey(null); setDocFilter("Alle"); setStatusFilter("Alle"); setPage(1); };

  /** One CSV row per section and test case (sections without cases get one row). */
  const exportCsv = () => download("testabdeckung.csv", "﻿" + toCsv([
    ["Dokument", "Abschnitt", "Seiten", "Status", "Anforderung", "Testfall", "Titel", "Prüfstatus"],
    ...filtered.flatMap((s) => {
      const rows = s.requirements.flatMap((r) => (r.cases.length ? r.cases : [undefined]).map((c) => [s.documentName, s.label, s.pages, s.status, `${r.req.id} · ${r.req.title}`, c?.id ?? "", c ? sanitizeCaseTitle(c.title) || c.technique : "", c?.review.decision ?? ""]));
      return rows.length ? rows : [[s.documentName, s.label, s.pages, s.status, "", "", "", ""]];
    }),
  ]));

  const kpis: [string, number, number, string][] = [
    ["Abschnitte mit Testfällen", totals.sectionsWithCases, totals.sections, "Anteil aller Abschnitte der Quelle, zu denen mindestens ein Testfall existiert."],
    ["Anforderungen mit Testfällen", totals.requirementsWithCases, totals.requirements, "Anteil der extrahierten Anforderungen mit mindestens einem Testfall."],
    ["Abschnitte mit Anforderungen abgedeckt", totals.sectionsWithCases, totals.sectionsWithRequirements, "Nur Abschnitte, aus denen Anforderungen extrahiert wurden (ohne Inhaltsverzeichnis, Einleitung o. Ä.)."],
  ];

  const [pdfError, setPdfError] = useState("");
  /** PDF of the current view: same document, status and search filters as the page. */
  const exportPdf = () => {
    const docName = all.find((d) => d.source.id === docFilter)?.source.name;
    const filters = [
      docFilter !== "Alle" && `Dokument: ${docName ?? docFilter}`,
      statusFilter !== "Alle" && `Status: ${statusFilter}`,
      query.trim() && (sectionKey ? `Abschnitt: ${query.trim()}` : `Suche: „${query.trim()}“`),
    ].filter((f): f is string => Boolean(f));
    try {
      printCoverage({ kpis: kpis.map(([label, part, whole, hint]) => ({ label, part, whole, hint })), caseCount: totals.cases, documents: docs, sections: filtered, filters, acceptedOnly, onlyCovered: !showUncovered });
      setPdfError("");
    } catch (e) { setPdfError((e as Error).message); }
  };

  return (
    <>
      <Header
        title="Testabdeckung"
        subtitle="Welcher Testfall zu welchem Abschnitt der Quelle gehört und wie viel der hochgeladenen Spezifikationen durch Testfälle abgedeckt ist."
        action={
          <div className="actions">
            <button className="primary" onClick={exportPdf} disabled={all.length === 0}><FileText size={15} /> Testabdeckung als PDF</button>
            <button onClick={exportCsv} disabled={filtered.length === 0}><Download size={15} /> Zuordnung als CSV</button>
          </div>
        }
      />

      {all.length === 0 ? (
        <Panel><p className="muted">Es gibt noch keine Testfälle mit Quellenbezug. Sobald unter <Link to="/tests">Testfälle</Link> Testfälle vorhanden sind, erscheint hier ihre Abdeckung.</p></Panel>
      ) : (
        <>
          <Panel>
            <div className="filters covtop">
              <label className="field inline">Dokument
                <select value={docFilter} onChange={(e) => { setDocFilter(e.target.value); setPage(1); }}>
                  <option value="Alle">Alle Dokumente</option>
                  {all.map((d) => <option key={d.source.id} value={d.source.id}>{d.source.name}</option>)}
                </select>
              </label>
              <label className="checkrow">
                <input type="checkbox" checked={acceptedOnly} onChange={(e) => setAcceptedOnly(e.target.checked)} />
                Nur akzeptierte Testfälle zählen (sonst alle außer abgelehnten)
              </label>
              <label className="checkrow">
                <input type="checkbox" checked={showUncovered} onChange={(e) => { setShowUncovered(e.target.checked); setStatusFilter("Alle"); setPage(1); }} />
                Abschnitte ohne Testfall anzeigen
              </label>
            </div>
            {pdfError && <p className="errortext">{pdfError}</p>}
            <div className="covkpis">
              {kpis.map(([label, part, whole, hint]) => (
                <div key={label} className="covkpi" title={hint}>
                  <small>{label}</small>
                  <b>{percent(part, whole)} %</b>
                  <Bar value={percent(part, whole)} />
                  <span className="muted small">{part} von {whole}</span>
                </div>
              ))}
              <div className="covkpi">
                <small>Testfälle zugeordnet</small>
                <b>{totals.cases}</b>
                <span className="muted small">{acceptedOnly ? "nur akzeptierte" : "ohne abgelehnte"}</span>
              </div>
            </div>
            <p className="muted small">
              Berechnet aus den vorhandenen Testfällen unter „Testfälle“ – es müssen keine neuen Testfälle erzeugt werden. Ein Abschnitt gilt als abgedeckt,
              sobald zu einer daraus extrahierten Anforderung ein Testfall existiert. Ob der Testfall die Anforderung fachlich vollständig prüft, sagt die Abdeckung nicht aus.
              {notLoaded.length > 0 && ` Für ${notLoaded.length} Dokument(e) ist das Original nicht geladen; dort sind nur Abschnitte mit Anforderungen bekannt. Laden Sie das Dokument unter „Testfall-Generator“ erneut hoch, um auch Abschnitte ohne Anforderungen mitzuzählen.`}
            </p>
          </Panel>

          {docs.length > 1 && (
            <Panel>
              <h3>Abdeckung je Dokument</h3>
              <div className="covdocs">
                {docs.map((d) => (
                  <button key={d.source.id} className="covdoc" onClick={() => { setDocFilter(d.source.id); setPage(1); }} title="Nur dieses Dokument anzeigen">
                    <span className="covdocname">{d.source.name}</span>
                    {/* {!d.source.loaded && <span className="muted small">{d.source.sample ? "ohne Quelldokument" : "Originaldokument nicht geladen – nur Abschnitte mit Anforderungen"}</span>} */}
                    <span className="muted small">Abschnitte {d.sectionsWithCases}/{d.sections.length}</span>
                    <Bar value={percent(d.sectionsWithCases, d.sections.length)} />
                    <b>{percent(d.sectionsWithCases, d.sections.length)} %</b>
                    <span className="muted small">Anforderungen {d.requirementsWithCases}/{d.requirements} · {percent(d.requirementsWithCases, d.requirements)} %</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          <Panel>
            <h3>Zuordnung Abschnitt → Anforderung → Testfall</h3>
            <div className="combobox sectionpicker">
              <div className="search wide">
                <Search size={15} />
                <input
                  role="combobox"
                  aria-expanded={listOpen}
                  aria-controls={listId}
                  aria-autocomplete="list"
                  placeholder="Abschnitt wählen oder Abschnitt, Anforderung bzw. Testfall suchen"
                  value={query}
                  onFocus={() => { setListOpen(true); setActive(0); }}
                  // Delay so a click on a list entry is handled before the list closes.
                  onBlur={() => window.setTimeout(() => setListOpen(false), 150)}
                  onChange={(e) => { setQuery(e.target.value); setSectionKey(null); setListOpen(true); setActive(0); setPage(1); }}
                  onKeyDown={onPickerKey}
                />
                {(query || sectionKey) && (
                  <button className="cellbtn" aria-label="Auswahl löschen" title="Auswahl löschen" onMouseDown={(e) => { e.preventDefault(); setQuery(""); setSectionKey(null); setPage(1); }}><X size={15} /></button>
                )}
              </div>
              {listOpen && (
                <ul className="combolist" id={listId} role="listbox">
                  {suggestions.length === 0 && <li className="comboempty">Kein Abschnitt passt zu „{query}“.</li>}
                  {suggestions.map((s, i) => (
                    <li
                      key={s.key}
                      role="option"
                      aria-selected={s.key === sectionKey}
                      className={(i === active ? "active " : "") + (s.key === sectionKey ? "selected" : "")}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => { e.preventDefault(); pickSection(s); }}
                    >
                      <span className="combomain">
                        <span className={`status ${STATUS_CLASS[s.status]}`}>{s.status}</span>
                        {s.label}
                      </span>
                      <small className="muted">{s.documentName}{s.pages ? ` · ${s.pages}` : ""} · {s.cases.length} Testfall/Testfälle</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="filters">
              <label className="field inline">Status
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as "Alle" | CoverageStatus); setPage(1); }}>
                  <option>Alle</option>
                  {statusOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <span className="muted small">{filtered.length} von {visibleSections.length} Abschnitt(en)</span>
              {filtersActive && <button onClick={reset}>Filter zurücksetzen</button>}
            </div>
            {filtered.length === 0 ? (
              <p className="muted">Keine Abschnitte entsprechen den gewählten Filtern.</p>
            ) : (
              <>
                <div className="tablepanel">
                  <table className="covtable">
                    <thead>
                      <tr>{["", "Abschnitt der Quelle", "Anforderungen", "Testfälle", "Status"].map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {shown.map((s) => {
                        const isOpen = open === s.key;
                        const reqsWithCases = s.requirements.filter((r) => r.cases.length).length;
                        return (
                          <Fragment key={s.key}>
                            <tr className={isOpen ? "highlight" : ""}>
                              <td>
                                {s.requirements.length > 0 && (
                                  <button className="cellbtn" aria-expanded={isOpen} aria-label={`Zuordnung für ${s.label} ${isOpen ? "zuklappen" : "anzeigen"}`} onClick={() => setOpen(isOpen ? null : s.key)}>
                                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </button>
                                )}
                              </td>
                              <td>
                                <b>{s.label}</b>
                                <div className="muted small">{s.documentName}{s.pages ? ` · ${s.pages}` : ""}</div>
                              </td>
                              <td>{s.requirements.length ? `${reqsWithCases} von ${s.requirements.length} mit Testfall` : "–"}</td>
                              <td>
                                {s.cases.length === 0 ? <span className="muted">–</span> : (
                                  <div className="covcases">
                                    {s.cases.slice(0, 4).map((c) => <code key={c.id}>{c.id}</code>)}
                                    {s.cases.length > 4 && <span className="muted small">+{s.cases.length - 4} weitere</span>}
                                  </div>
                                )}
                              </td>
                              <td><span className={`status ${STATUS_CLASS[s.status]}`}>{s.status}</span></td>
                            </tr>
                            {isOpen && (
                              <tr className="subrow">
                                <td />
                                <td colSpan={4}>
                                  <ul className="covreqs">
                                    {s.requirements.filter((r) => showUncovered || r.cases.length > 0).map(({ req, cases: rc }) => (
                                      <li key={req.id}>
                                        <div><b>{req.id}</b> · {req.title}</div>
                                        {rc.length === 0 ? (
                                          <p className="tracewarn small">Kein Testfall zu dieser Anforderung{acceptedOnly ? " (akzeptiert)" : ""}.</p>
                                        ) : (
                                          <ul>
                                            {rc.map((c) => (
                                              <li key={c.id}>
                                                <code>{c.id}</code> {sanitizeCaseTitle(c.title) || c.technique} <Status value={c.review.decision} />
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pager page={currentPage} pageCount={pageCount} total={filtered.length} unit="Abschnitt(e)" onPage={setPage} />
              </>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
