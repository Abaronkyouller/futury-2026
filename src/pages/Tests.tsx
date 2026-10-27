import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { GeneratedCaseCard } from "../components/GeneratedCaseCard";
import { Pager } from "../components/Pager";
import { useReviewStore } from "../state/reviewContext";
import { PRIORITIES } from "../types/review";
import type { ChangeKind, ChangeLogEntry, GeneratedTestCase, Priority } from "../types/review";
import { formatDateTime } from "../utils/format";
import { printTestCasesAsPdf } from "../utils/testCasePdf";

const REVIEW_FILTERS = ["Alle", "Offen", "Akzeptiert", "Abgelehnt"] as const;
type ReviewFilter = (typeof REVIEW_FILTERS)[number];
type PriorityFilter = "Alle" | Priority;
const TESTS_PER_PAGE = 10;

const KIND_CLASS: Record<ChangeKind, string> = {
  Dokument: "kind-doc",
  Extraktion: "kind-extract",
  Regeländerung: "kind-rulechange",
  Anforderung: "kind-req",
  Generierung: "kind-gen",
  Prüfung: "kind-review",
  Validierung: "kind-validation",
  Feedback: "kind-feedback",
  Einstellungen: "kind-settings",
  Zurücksetzen: "kind-reset",
};

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
  const [sourceFilter, setSourceFilter] = useState("Alle");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  const requirementsById = new Map(requirements.map((req) => [req.id, req]));
  const sourceOf = (requirementId: string) => {
    const req = requirementsById.get(requirementId);
    return req?.origin?.documentName ?? req?.source ?? "Ohne Quellenangabe";
  };
  const sources = [...new Set(cases.map((item) => sourceOf(item.requirementId)))].sort((a, b) => a.localeCompare(b, "de"));
  const filtered = cases
    .filter((item) => reviewFilter === "Alle" || item.review.decision === reviewFilter)
    .filter((item) => priorityFilter === "Alle" || item.priority === priorityFilter)
    .filter((item) => sourceFilter === "Alle" || sourceOf(item.requirementId) === sourceFilter)
    .filter((item) => !normalizedQuery || [item.id, item.requirementId, item.title, item.technique, sourceOf(item.requirementId)]
      .some((value) => value.toLocaleLowerCase("de-DE").includes(normalizedQuery)))
    .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(filtered.length / TESTS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageCases = filtered.slice((currentPage - 1) * TESTS_PER_PAGE, currentPage * TESTS_PER_PAGE);
  const resetPage = () => { setPage(1); setSelected(null); };
  const historyFor = (item: GeneratedTestCase) => [...changelog].reverse().filter((entry) =>
    entry.testCaseId === item.id
    || (entry.kind === "Generierung" && entry.requirementId === item.requirementId && entry.after?.includes(item.id)),
  );

  return <>
    <Header
      title="Testfälle"
      subtitle="Testfälle filtern, aufklappen und gemeinsam mit ihrer Änderungshistorie prüfen. Maximal zehn Fälle werden je Seite angezeigt."
      action={<button className="primary" disabled={filtered.length === 0} onClick={() => printTestCasesAsPdf(filtered, requirements, sourceFilter)}><Download size={15} /> Gefilterte Testfälle als PDF</button>}
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
          <label className="field inline">Quelle
            <select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); resetPage(); }}>
              <option>Alle</option>
              {sources.map((source) => <option key={source}>{source}</option>)}
            </select>
          </label>
          <span className="muted small">{filtered.length} von {cases.length} Testfall/Testfällen</span>
          {(query || priorityFilter !== "Alle" || reviewFilter !== "Alle" || sourceFilter !== "Alle") && <button onClick={() => { setQuery(""); setPriorityFilter("Alle"); setReviewFilter("Alle"); setSourceFilter("Alle"); resetPage(); }}>Filter zurücksetzen</button>}
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
