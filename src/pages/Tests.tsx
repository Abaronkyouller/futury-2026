import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Plus, Search } from "lucide-react";
import { ManualCaseDialog } from "../components/ManualCaseDialog";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { GeneratedCaseCard } from "../components/GeneratedCaseCard";
import { Pager } from "../components/Pager";
import { useReviewStore } from "../state/reviewContext";
import { PRIORITIES } from "../types/review";
import type { Priority } from "../types/review";
import { printTestCasesAsPdf } from "../utils/testCasePdf";
import { TEST_OUTCOMES } from "../types/testReport";
import type { TestOutcome } from "../types/testReport";
import { comparisonOutcome, latestComparisons } from "../utils/testOutcome";

const REVIEW_FILTERS = ["Alle", "Offen", "Akzeptiert", "Abgelehnt"] as const;
type ReviewFilter = (typeof REVIEW_FILTERS)[number];
type PriorityFilter = "Alle" | Priority;
const TESTS_PER_PAGE = 10;

/** Paginated test plan with collapsible details and filters. */
export function Tests() {
  const { cases, requirements, comparisons } = useReviewStore();
  const [outcomeFilter, setOutcomeFilter] = useState<"Alle" | TestOutcome>("Alle");
  const latest = latestComparisons(comparisons);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("Alle");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("Alle");
  const [sourceFilter, setSourceFilter] = useState("Alle");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdNotice, setCreatedNotice] = useState("");

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
    .filter((item) => outcomeFilter === "Alle" || comparisonOutcome(latest.get(item.id)) === outcomeFilter)
    .filter((item) => !normalizedQuery || [item.id, item.requirementId, item.title, item.technique, sourceOf(item.requirementId)]
      .some((value) => value.toLocaleLowerCase("de-DE").includes(normalizedQuery)))
    .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(filtered.length / TESTS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageCases = filtered.slice((currentPage - 1) * TESTS_PER_PAGE, currentPage * TESTS_PER_PAGE);
  const resetPage = () => { setPage(1); setSelected(null); };

  return <>
    <Header
      title="Testfälle"
      subtitle="Testfälle filtern, aufklappen und prüfen. Maximal zehn Fälle werden je Seite angezeigt. Änderungen je Testfall stehen im Änderungsprotokoll."
      action={
        <div className="actions">
          <button className="primary" disabled={requirements.length === 0} onClick={() => setCreating(true)}><Plus size={15} /> Testfall manuell anlegen</button>
          <button disabled={filtered.length === 0} onClick={() => printTestCasesAsPdf(filtered, requirements, sourceFilter)}><Download size={15} /> Gefilterte Testfälle als PDF</button>
        </div>
      }
    />
    {creating && (
      <ManualCaseDialog
        requirements={requirements}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          // Show the new case: search for its id and open it.
          setCreating(false);
          setQuery(id); setPriorityFilter("Alle"); setReviewFilter("Alle"); setSourceFilter("Alle"); setOutcomeFilter("Alle");
          setPage(1); setSelected(id);
          setCreatedNotice(`Testfall ${id} wurde angelegt.`);
        }}
      />
    )}
    {createdNotice && <p className="status good creatednotice">{createdNotice}</p>}

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
          <label className="field inline">Ergebnis
            <select value={outcomeFilter} onChange={(e) => { setOutcomeFilter(e.target.value as "Alle" | TestOutcome); resetPage(); }}>
              <option>Alle</option>
              {TEST_OUTCOMES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <span className="muted small">{filtered.length} von {cases.length} Testfall/Testfällen</span>
          {(query || priorityFilter !== "Alle" || reviewFilter !== "Alle" || sourceFilter !== "Alle" || outcomeFilter !== "Alle") && <button onClick={() => { setQuery(""); setPriorityFilter("Alle"); setReviewFilter("Alle"); setSourceFilter("Alle"); setOutcomeFilter("Alle"); resetPage(); }}>Filter zurücksetzen</button>}
        </div>

        {filtered.length === 0 ? <p className="muted">Keine Testfälle entsprechen den gewählten Filtern.</p> : <div className="casegroup">
          {pageCases.map((item) => (
            <GeneratedCaseCard
              key={item.id}
              item={item}
              showReasoning
              collapsible
              expanded={selected === item.id}
              onExpandedChange={(open) => setSelected(open ? item.id : null)}
            />
          ))}
          <Pager page={currentPage} pageCount={pageCount} total={filtered.length} onPage={(next) => { setPage(next); setSelected(null); }} />
        </div>}
      </Panel>
    </>}
  </>;
}
