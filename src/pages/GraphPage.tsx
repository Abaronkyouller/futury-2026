import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Info, Search } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Pager } from "../components/Pager";
import { ReasoningGraphView } from "../components/ReasoningGraphView";
import { useReviewStore } from "../state/reviewContext";
import { buildReasoningGraph, caseWarnings, GRAPH_EVIDENCE_LABEL, requirementHaystack } from "../reasoning/reasoningGraph";
import type { CheckStatus, GraphEvidence, GraphNode } from "../reasoning/reasoningGraph";
import { cases as sampleCases } from "../data/testCases";
import type { Req } from "../types/requirement";
import { truncate } from "../documents/text";

const ORIGIN_FILTERS = ["Alle", "Aus Dokumenten", "Beispieldaten"] as const;
type OriginFilter = (typeof ORIGIN_FILTERS)[number];
const REQS_PER_PAGE = 6;
const EVIDENCES: GraphEvidence[] = ["source", "derived", "model", "assumption", "demo", "sample", "open"];
const EVIDENCE_CLASS: Record<GraphEvidence, string> = {
  source: "ev-source", derived: "ev-rule", model: "ev-ai", assumption: "ev-assumption", demo: "ev-demo", sample: "ev-sample", open: "ev-missing",
};
const CHECK_ICON: Record<CheckStatus, typeof Info> = { ok: CheckCircle2, warn: AlertTriangle, info: Info };

/**
 * Nachverfolgbarkeit (H4): find a requirement or test case, then read its
 * reasoning graph top-down – from the source text through the model's
 * reasoning steps to the test case, its expected values and the result.
 * Local grounding checks flag claims that cannot be found in the source.
 */
export function GraphPage() {
  const { cases, requirements, comparisons } = useReviewStore();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<OriginFilter>("Alle");
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

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
    .filter((r) => origin === "Alle" || (origin === "Aus Dokumenten" ? Boolean(r.origin) : !r.origin))
    .filter((r) => !onlyWarnings || (warningsOf.get(r.id) ?? 0) > 0)
    .filter((r) => !q || requirementHaystack(r, cases).includes(q));
  const pageCount = Math.max(1, Math.ceil(filtered.length / REQS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage - 1) * REQS_PER_PAGE, currentPage * REQS_PER_PAGE);

  const reqId = params.get("req") ?? ordered[0]?.id;
  const req = requirements.find((r) => r.id === reqId) ?? ordered[0];
  const caseParam = params.get("case") ?? undefined;
  const graph = req ? buildReasoningGraph(req, cases, comparisons, caseParam) : undefined;

  const choose = (r: Req) => {
    // A query that names one of the requirement's cases focuses that case.
    const hit = q ? cases.find((c) => c.requirementId === r.id && `${c.id} ${c.title}`.toLocaleLowerCase("de-DE").includes(q)) : undefined;
    setParams(hit ? { req: r.id, case: hit.id } : { req: r.id });
    setSelectedNode(null);
  };
  const focusCase = (id: string) => { if (req) setParams({ req: req.id, case: id }); setSelectedNode(id); };
  const resetFilters = () => { setQuery(""); setOrigin("Alle"); setOnlyWarnings(false); setPage(1); };

  const active: GraphNode | undefined = graph && (graph.nodes.find((n) => n.id === selectedNode) ?? graph.nodes.find((n) => n.id === graph.focusId) ?? graph.nodes[1]);
  const onNode = (n: GraphNode) => {
    if (n.kind === "Testfall" && n.caseId && n.caseId !== graph?.focusId) focusCase(n.caseId);
    else setSelectedNode(n.id);
  };

  return (
    <>
      <Header
        title="Nachverfolgbarkeit"
        subtitle="Nachvollziehen, wie ein Testfall entstanden ist: von der Quelle über die Begründung des Modells bis zum erwarteten Ergebnis. Lokale Belegprüfungen markieren Aussagen, die sich nicht in der Quelle finden – ein Hinweis auf mögliche Halluzinationen, kein Beweis."
      />

      <Panel>
        <div className="search wide">
          <Search size={15} />
          <input
            placeholder="Anforderung, Testfall, Dokument oder Begriff aus dem Zitat suchen"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
        </div>
        <div className="filters">
          <label className="field inline">Herkunft
            <select value={origin} onChange={(e) => { setOrigin(e.target.value as OriginFilter); setPage(1); }}>
              {ORIGIN_FILTERS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="checkrow small">
            <input type="checkbox" checked={onlyWarnings} onChange={(e) => { setOnlyWarnings(e.target.checked); setPage(1); }} />
            Nur mit Belegwarnungen
          </label>
          <span className="muted small">{filtered.length} von {requirements.length} Anforderung(en)</span>
          {(query || origin !== "Alle" || onlyWarnings) && <button onClick={resetFilters}>Filter zurücksetzen</button>}
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

      {req && graph && active && (
        <>
          <Panel>
            <div className="paneltop">
              <div>
                <small className="muted">Begründungsgraph</small>
                <h3>{req.id} · {truncate(req.title, 120)}</h3>
              </div>
              {graph.claims.total > 0 && (
                <span className={`status ${graph.claims.backed === graph.claims.total ? "good" : "warn"}`} title="Begründungsschritte und erwartete Werte des Testfalls im Fokus, die sich in Quelle oder Testdaten wiederfinden (Annahmen und offene Werte zählen nicht).">
                  Belegt: {graph.claims.backed} von {graph.claims.total} Aussagen
                </span>
              )}
            </div>
            {graph.cases.length > 0 ? (
              <div className="casechips">
                <span className="muted small">Testfall im Fokus:</span>
                {graph.cases.map((c) => (
                  <button key={c.id} className={c.id === graph.focusId ? "selected" : ""} onClick={() => focusCase(c.id)} title={c.label}>
                    {c.id}{c.warnings > 0 && <> · <AlertTriangle size={11} /> {c.warnings}</>}
                  </button>
                ))}
                {graph.hiddenRejected > 0 && <span className="muted small">{graph.hiddenRejected} abgelehnte(r) ausgeblendet</span>}
              </div>
            ) : (
              <p className="muted small">Noch keine Testfälle. Erzeugen Sie sie unter <Link to="/documents">Testfall-Generator</Link>.</p>
            )}
            <div className="legend">
              {EVIDENCES.map((e) => (
                <span key={e} className="legenditem"><i className={`swatch ${EVIDENCE_CLASS[e]}`} /> {GRAPH_EVIDENCE_LABEL[e]}</span>
              ))}
              <span className="legenditem"><i className="swatch rnodewarn" /> <i className="rwarn static"><AlertTriangle size={11} /></i> Nicht in der Quelle gefunden</span>
            </div>
            <p className="muted small">
              Von oben nach unten lesen. Ein Klick auf einen Knoten hebt den Begründungspfad hervor – alles, worauf er beruht, und alles, was daraus folgt.
              Ein Klick auf einen anderen Testfall klappt dessen Begründung auf.
            </p>
            <div className="rgraphwrap">
              <ReasoningGraphView nodes={graph.nodes} edges={graph.edges} selectedId={active.id} onSelect={onNode} />
            </div>
          </Panel>

          <div className="graphdetail">
            <Panel>
              <small className="muted">{active.kind}</small>
              <h3 className="breakword">{active.label}</h3>
              <span className={`evtag ${EVIDENCE_CLASS[active.evidence]}`}>{GRAPH_EVIDENCE_LABEL[active.evidence]}</span>
              {active.warnings.length > 0 && (
                <ul className="warnlist">
                  {active.warnings.map((w, i) => <li key={i}><AlertTriangle size={13} /> {w}</li>)}
                </ul>
              )}
              {active.quote && <div className="quote"><small>Wörtlich aus der Quelle</small>{active.quote}</div>}
              <table className="detail">
                <tbody>
                  {active.details.map(([k, v], i) => (
                    <tr key={i}><th>{k}</th><td className="prewrap">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel>
              <small className="muted">Belegprüfung · {graph.focusId ?? "kein Testfall"}</small>
              <h3>Woran die Begründung hängt</h3>
              {graph.checks.length === 0 ? (
                <p className="muted">Kein Testfall im Fokus.</p>
              ) : (
                <ul className="checklist">
                  {graph.checks.map((c) => {
                    const Icon = CHECK_ICON[c.status];
                    return (
                      <li key={c.id} className={`chk-${c.status}`}>
                        <button onClick={() => c.nodeId && setSelectedNode(c.nodeId)} disabled={!c.nodeId}>
                          <Icon size={15} />
                          <span><b>{c.label}</b><span className="muted small">{c.detail}</span></span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="muted small">
                Die Prüfungen vergleichen nur Text und Zahlen mit dem zitierten Abschnitt und den Testdaten. Sie ersetzen nicht die fachliche Prüfung.
              </p>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
