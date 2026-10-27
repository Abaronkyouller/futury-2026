import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { useReviewStore } from "../state/reviewContext";
import { buildTraceGraph, EVIDENCE_LABEL } from "../utils/traceGraph";
import type { Evidence, TraceNode } from "../utils/traceGraph";

const EVIDENCES: Evidence[] = ["source", "sample", "ai", "rule", "demo", "missing"];

/** One clickable node; border style encodes the evidence type. */
function NodeBox({ node, active, onSelect }: { node: TraceNode; active: boolean; onSelect: (n: TraceNode) => void }) {
  return (
    <button className={`tnode ev-${node.evidence} ${active ? "tactive" : ""}`} onClick={() => onSelect(node)}>
      <small>{node.kind}</small>
      <span>{node.label}</span>
    </button>
  );
}

/**
 * Interactive traceability graph (H4): source -> requirement -> rule ->
 * test case -> expected -> observed -> finding. Rejected proposals are hidden.
 */
export function GraphPage() {
  const { cases, requirements, comparisons } = useReviewStore();
  const [params, setParams] = useSearchParams();
  const withCases = requirements.filter((r) => cases.some((c) => c.requirementId === r.id));
  const reqId = params.get("req") ?? withCases[withCases.length - 1]?.id ?? "REQ-EEL-028";
  const req = requirements.find((r) => r.id === reqId) ?? requirements[0];
  const graph = buildTraceGraph(req, cases, comparisons);
  const [selected, setSelected] = useState<TraceNode | null>(null);
  const active = (selected && [...graph.spine, ...graph.lanes.flat()].find((n) => n.id === selected.id)) ?? graph.spine[0];

  return (
    <>
      <Header
        title="Nachverfolgbarkeit"
        subtitle="Jeden Testfall bis zur Anforderung und zum Quelltext zurückverfolgen. Rahmenstile trennen Quelltext, Beispieldaten, KI-Vorschläge, regelbasierte Ableitungen und fehlende Nachweise. Verknüpfungen beweisen nicht, dass ein Abrechnungsergebnis korrekt ist."
      />
      <div className="rulebar">
        Anforderung{" "}
        <select
          value={req.id}
          onChange={(e) => {
            setParams({ req: e.target.value });
            setSelected(null);
          }}
        >
          {[...requirements].reverse().map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} · {r.title} ({cases.filter((c) => c.requirementId === r.id).length})
            </option>
          ))}
        </select>
      </div>
      <div className="legend">
        {EVIDENCES.map((e) => (
          <span key={e} className="legenditem">
            <i className={`swatch ev-${e}`} /> {EVIDENCE_LABEL[e]}
          </span>
        ))}
      </div>
      <div className="graphgrid">
        <Panel className="graphpanel">
          <div className="spine">
            {graph.spine.map((n, i) => (
              <Fragment key={n.id}>
                {i > 0 && <span className="tarrow">→</span>}
                <NodeBox node={n} active={active.id === n.id} onSelect={setSelected} />
              </Fragment>
            ))}
          </div>
          {graph.lanes.length === 0 ? (
            <p className="muted">Noch keine Testfälle verknüpft. Erzeugen Sie Vorschläge im Testfall-Generator.</p>
          ) : (
            <div className="lanes">
              <div className="lanehead">
                {["Testfall", "Erwartet", "Beobachtet", "Befund"].map((h, i) => (
                  <Fragment key={h}>
                    {i > 0 && <span />}
                    <small>{h}</small>
                  </Fragment>
                ))}
              </div>
              {graph.lanes.map((lane) => (
                <div className="lane" key={lane[0].id}>
                  {lane.map((n, i) => (
                    <Fragment key={n.id}>
                      {i > 0 && <span className="tarrow">→</span>}
                      <NodeBox node={n} active={active.id === n.id} onSelect={setSelected} />
                    </Fragment>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel>
          <small>{active.kind}</small>
          <h3>{active.label}</h3>
          <span className={`evtag ev-${active.evidence}`}>{EVIDENCE_LABEL[active.evidence]}</span>
          <table className="detail">
            <tbody>
              {active.details.map(([k, v], i) => (
                <tr key={i}>
                  <th>{k}</th>
                  <td className="prewrap">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
