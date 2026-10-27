import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { GeneratedCaseCard } from "../components/GeneratedCaseCard";
import { Pager } from "../components/Pager";
import { useReviewStore } from "../state/reviewContext";
import { ORIGIN_LABEL, PRIORITIES } from "../types/review";
import type { ChangeKind, ChangeLogEntry, GeneratedTestCase, Priority } from "../types/review";
import { download } from "../utils/download";
import { formatDateTime, toCsv } from "../utils/format";
import { sanitizeCaseTitle, visibleFields } from "../utils/caseText";

const REVIEW_FILTERS = ["Alle", "Offen", "Akzeptiert", "Abgelehnt"] as const;
type ReviewFilter = (typeof REVIEW_FILTERS)[number];
type PriorityFilter = "Alle" | Priority;
const TESTS_PER_PAGE = 10;

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

/** One CSV row per case; steps and fields are flattened so the vendor can follow them. */
function exportPlan(cases: GeneratedTestCase[], sourceOf: (id: string) => string) {
  const rows = cases.map((c) => [
    c.id,
    c.requirementId,
    sourceOf(c.requirementId),
    sanitizeCaseTitle(c.title),
    c.technique,
    c.priority,
    ORIGIN_LABEL[c.origin.kind],
    c.review.decision,
    c.given,
    c.when,
    c.then,
    visibleFields(c.testData).map((f) => `${f.field}: ${f.value}`).join(" | "),
    c.steps.map((s, i) => `${i + 1}. ${s.actor}: ${s.action}${s.abgabegrund ? ` (Abgabegrund ${s.abgabegrund})` : ""}`).join(" | "),
    c.expectedFields.map((f) => `${f.field}: ${f.value}`).join(" | "),
    c.criteriaIds.join(" | "),
    c.execution,
  ]);
  download(
    "testplan.csv",
    toCsv([
      ["ID", "Anforderung", "Quelle", "Titel", "Technik", "Priorität", "Herkunft", "Prüfung", "Gegeben", "Wenn", "Dann", "Testdaten", "Ablauf", "Erwartet", "Kriterien", "Ausführung"],
      ...rows,
    ]),
  );
}

/** Timeline entries directly related to one generated test case. */
function CaseHistory({ entries }: { entries: ChangeLogEntry[] }) {
  return <div className="casehistory">
    <h4>Änderungshistorie</h4>
    {entries.length === 0 ? <p className="muted small">Für diesen Testfall sind noch keine Änderungen protokolliert.</p> : (
      <ol className="timeline">
        {entries.map((entry) => <li key={entry.id}>
          <time>{formatDateTime(entry.timestamp)}</time>
          <div>
            <span className={`kind ${KIND_CLASS[entry.kind]}`}>{entry.kind}</span>
            <b>{entry.summary}</b>
            {(entry.before || entry.after) && <table className="detail compact"><tbody>
              {entry.before && <tr><th>Vorher</th><td className="prewrap">{entry.before}</td></tr>}
              {entry.after && <tr><th>Nachher</th><td className="prewrap">{entry.after}</td></tr>}
            </tbody></table>}
          </div>
        </li>)}
      </ol>
    )}
  </div>;
}

/** Paginated test plan with collapsible details, filters and per-case history. */
export function Tests() {
  const { cases, requirements, changelog } = useReviewStore();
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("Alle");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("Alle");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  const filtered = cases
    .filter((item) => reviewFilter === "Alle" || item.review.decision === reviewFilter)
    .filter((item) => priorityFilter === "Alle" || item.priority === priorityFilter)
    .filter((item) => !normalizedQuery || [item.id, item.requirementId, item.title, item.technique]
      .some((value) => value.toLocaleLowerCase("de-DE").includes(normalizedQuery)))
    .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(filtered.length / TESTS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageCases = filtered.slice((currentPage - 1) * TESTS_PER_PAGE, currentPage * TESTS_PER_PAGE);
  const sourceOf = (id: string) => requirements.find((r) => r.id === id)?.source ?? "";
  const exportable = cases.filter((c) => c.review.decision !== "Abgelehnt");
  const resetPage = () => { setPage(1); setSelected(null); };
  const historyFor = (item: GeneratedTestCase) => [...changelog].reverse().filter((entry) =>
    entry.testCaseId === item.id
    || (entry.kind === "Generierung" && entry.requirementId === item.requirementId && entry.after?.includes(item.id)),
  );

  return <>
    <Header
      title="Testfälle"
      subtitle="Testfälle filtern, aufklappen und gemeinsam mit ihrer Änderungshistorie prüfen. Maximal zehn Fälle werden je Seite angezeigt."
      action={<button className="primary" disabled={exportable.length === 0} onClick={() => exportPlan(exportable, sourceOf)}><Download size={15} /> Testplan für Hersteller exportieren (CSV)</button>}
    />

    {cases.length === 0 ? <Panel><p className="muted">
      Noch keine erzeugten Testfälle. Laden Sie unter <Link to="/documents">Dokumente & Testfälle</Link> eine Spezifikation hoch
      oder nutzen Sie den <Link to="/generate">Testfall-Generator</Link>.
    </p></Panel> : <>
      <Panel>
        <div className="search wide">
          <Search size={15} />
          <input placeholder="Testfall, Anforderung, Titel oder Technik suchen" value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} />
        </div>
        <div className="filters">
          <label className="field inline">Priorität
            <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value as PriorityFilter); resetPage(); }}>
              <option>Alle</option>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label className="field inline">Prüfstatus
            <select value={reviewFilter} onChange={(event) => { setReviewFilter(event.target.value as ReviewFilter); resetPage(); }}>
              {REVIEW_FILTERS.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <span className="muted small">{filtered.length} von {cases.length} Testfall/Testfällen</span>
          {(query || priorityFilter !== "Alle" || reviewFilter !== "Alle") && <button onClick={() => { setQuery(""); setPriorityFilter("Alle"); setReviewFilter("Alle"); resetPage(); }}>Filter zurücksetzen</button>}
        </div>

        {filtered.length === 0 ? <p className="muted">Keine Testfälle entsprechen den gewählten Filtern.</p> : <div className="casegroup">
          {pageCases.map((item) => <Fragment key={item.id}>
            <GeneratedCaseCard
              item={item}
              showReasoning
              collapsible
              expanded={selected === item.id}
              onExpandedChange={(open) => setSelected(open ? item.id : null)}
            />
            {selected === item.id && <CaseHistory entries={historyFor(item)} />}
          </Fragment>)}
          <Pager page={currentPage} pageCount={pageCount} total={filtered.length} onPage={(next) => { setPage(next); setSelected(null); }} />
        </div>}
      </Panel>
    </>}
  </>;
}
