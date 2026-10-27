import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Pager } from "../components/Pager";
import { CaseTraceSection } from "../components/CaseTraceSection";
import { TraceSearch } from "../components/TraceSearch";
import { useReviewStore } from "../state/reviewContext";
import { buildReasoningGraph, caseWarnings, requirementHaystack } from "../reasoning/reasoningGraph";
import { cases as sampleCases } from "../data/testCases";
import type { Req } from "../types/requirement";
import { truncate } from "../documents/text";

const REQS_PER_PAGE = 6;

/**
 * Nachverfolgbarkeit (H4): find a requirement or test case, then open a test
 * case to read its traceback as numbered, collapsible sections with bullet
 * points (source, rule, model reasoning, test, expectation, result). Local
 * grounding checks flag claims that cannot be found in the source.
 * (A knowledge-graph variant of this page lives on branch knowledge-graph-traceback.)
 */
export function GraphPage() {
  const { cases, requirements, comparisons } = useReviewStore();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const [page, setPage] = useState(1);

  const caseCount = (r: Req) => cases.filter((c) => c.requirementId === r.id && c.review.decision !== "Abgelehnt").length
    + (r.origin ? 0 : sampleCases.filter((c) => c[0].startsWith(`TC-${r.id.split("-").pop()}-`)).length);
  const warningsOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of requirements) {
      const own = cases.filter((c) => c.requirementId === r.id && c.review.decision !== "Abgelehnt");
      map.set(r.id, own.reduce((n, c) => n + caseWarnings(r, c), 0));
    }
    return map;
  }, [requirements, cases]);

  const q = query.trim().toLocaleLowerCase("de-DE");
  // Newest document requirements first, then those with test cases.
  const ordered = [...requirements].reverse().sort((a, b) => Number(caseCount(b) > 0) - Number(caseCount(a) > 0));
  const filtered = ordered
    .filter((r) => !onlyWarnings || (warningsOf.get(r.id) ?? 0) > 0)
    .filter((r) => { const h = requirementHaystack(r, cases); return q.split(/\s+/).filter(Boolean).every((t) => h.includes(t)); });
  const pageCount = Math.max(1, Math.ceil(filtered.length / REQS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage - 1) * REQS_PER_PAGE, currentPage * REQS_PER_PAGE);

  const reqId = params.get("req") ?? ordered[0]?.id;
  const req = requirements.find((r) => r.id === reqId) ?? ordered[0];
  const caseParam = params.get("case") ?? undefined;
  const baseGraph = req ? buildReasoningGraph(req, cases, comparisons) : undefined;
  const traceCases = (baseGraph?.cases ?? []).map((c) => ({ id: c.id, testCase: cases.find((x) => x.id === c.id) }));
  const hiddenRejected = baseGraph?.hiddenRejected ?? 0;
  // Cases opened by the examiner; the case named in the URL (or the first one) starts open.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const defaultOpen = caseParam ?? traceCases[0]?.id;
  const openCases = new Set(traceCases.map((c) => c.id).filter((id) => opened[id] ?? id === defaultOpen));
  const toggleCase = (id: string, isOpen: boolean) => setOpened((prev) => (prev[id] === isOpen || (prev[id] === undefined && isOpen === (id === defaultOpen)) ? prev : { ...prev, [id]: isOpen }));

  const choose = (r: Req) => {
    // A query that names one of the requirement's cases focuses that case.
    const hit = q ? cases.find((c) => c.requirementId === r.id && `${c.id} ${c.title}`.toLocaleLowerCase("de-DE").includes(q)) : undefined;
    setParams(hit ? { req: r.id, case: hit.id } : { req: r.id });
    setOpened({});
  };
  const resetFilters = () => { setQuery(""); setOnlyWarnings(false); setPage(1); };


  return (
    <>
      <Header
        title="Nachverfolgbarkeit"
        // subtitle="Nachvollziehen, wie ein Testfall entstanden ist: woher die Regel stammt, wie das Modell begründet hat und was erwartet wird. Hinweise markieren Aussagen, die sich nicht in der Quelle finden – ein Anlass zur Prüfung, kein Beweis für einen Fehler."
      />

      <Panel>
        <TraceSearch
          requirements={requirements}
          cases={cases}
          ordered={ordered}
          query={query}
          onQuery={(value) => { setQuery(value); setPage(1); }}
          onPickRequirement={(r) => { setQuery(r.id); setPage(1); setParams({ req: r.id }); setOpened({}); }}
          onPickCase={(c) => { setQuery(c.id); setPage(1); setParams({ req: c.requirementId, case: c.id }); setOpened({}); }}
        />
        <div className="filters">
          <label className="checkrow small">
            <input type="checkbox" checked={onlyWarnings} onChange={(e) => { setOnlyWarnings(e.target.checked); setPage(1); }} />
            Nur mit Belegwarnungen
          </label>
          <span className="muted small">{filtered.length} von {requirements.length} Anforderung(en)</span>
          {(query || onlyWarnings) && <button onClick={resetFilters}>Filter zurücksetzen</button>}
        </div>
        {filtered.length === 0 ? (
          <p className="muted">Keine Anforderung entspricht der Suche.</p>
        ) : (
          <>
            <div className="reqpick">
              {shown.map((r) => {
                const warn = warningsOf.get(r.id) ?? 0;
                return (
                  <button key={r.id} className={`reqpickitem ${req?.id === r.id ? "selected" : ""}`} onClick={() => choose(r)}>
                    <span className="reqpickhead">
                      <b>{r.id}</b>
                      <span className="muted small">{caseCount(r)} Testfall/Testfälle</span>
                      {warn > 0 && <span className="status warn"><AlertTriangle size={11} /> {warn}</span>}
                      {!r.origin && <span className="status neutral">Beispieldaten</span>}
                    </span>
                    <span>{truncate(r.title, 140)}</span>
                    <small className="muted">{r.origin ? `${r.origin.documentName} · ${r.origin.sectionLabel}` : r.source}</small>
                  </button>
                );
              })}
            </div>
            {pageCount > 1 && <Pager page={currentPage} pageCount={pageCount} total={filtered.length} unit="Anforderung(en)" onPage={setPage} />}
          </>
        )}
      </Panel>

      {req && (
        <Panel>
          <div className="paneltop">
            <div>
              <small className="muted">Rückverfolgung je Testfall</small>
              <h3>{req.id} · {truncate(req.title, 120)}</h3>
            </div>
          </div>
          {traceCases.length === 0 ? (
            <p className="muted">Noch keine Testfälle zu dieser Anforderung. Erzeugen Sie sie unter <Link to="/documents">Testfall-Generator</Link>.</p>
          ) : (
            <>
              <p className="muted">
                Klicken Sie auf einen Testfall, um zu sehen, wie er entstanden ist. Die Abschnitte 1 bis 6 lassen sich einzeln auf- und zuklappen.
                {hiddenRejected > 0 && ` ${hiddenRejected} abgelehnte(r) Testfall/Testfälle sind ausgeblendet.`}
              </p>
              <div className="tracecases">
                {traceCases.map(({ id, testCase }) => (
                  <CaseTraceSection
                    key={id}
                    req={req}
                    testCase={testCase}
                    sampleId={testCase ? undefined : id}
                    graph={buildReasoningGraph(req, cases, comparisons, id)}
                    open={openCases.has(id)}
                    onToggle={(isOpen) => toggleCase(id, isOpen)}
                  />
                ))}
              </div>
            </>
          )}
        </Panel>
      )}
    </>
  );
}
