import { Fragment, useState } from "react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { initial as requirements } from "../data/requirements";
import { useReviewStore } from "../state/reviewContext";
import { buildTraceGraph, EVIDENCE_LABEL } from "../utils/traceGraph";
import type { Evidence, TraceNode } from "../utils/traceGraph";

const EVIDENCES: Evidence[] = ["sample", "ai", "demo", "missing"];

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
 * test case -> expected -> observed -> finding. Rejected AI proposals are hidden.
 */
export function GraphPage() {
  const { cases } = useReviewStore();
  const [reqId, setReqId] = useState("REQ-EEL-028");
  const req = requirements.find((r) => r.id === reqId) ?? requirements[0];
  const graph = buildTraceGraph(req, cases);
  const [selected, setSelected] = useState<TraceNode | null>(null);
  const active = selected ?? graph.spine[1];

  return (
    <>
      <Header
        title="Traceability graph"
        subtitle="Follow each test case back to its requirement and source. Border styles separate sample data, AI proposals and missing evidence. Links do not prove that a payroll result is correct."
      />
      <div className="rulebar">
        Requirement{" "}
        <select value={reqId} onChange={(e) => { setReqId(e.target.value); setSelected(null); }}>
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>{r.id} · {r.title}</option>
          ))}
        </select>
      </div>
      <div className="legend">
        {EVIDENCES.map((e) => (
          <span key={e} className="legenditem"><i className={`swatch ev-${e}`} /> {EVIDENCE_LABEL[e]}</span>
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
            <p className="muted">
              No test cases linked yet. Generate proposals in the AI generator.
            </p>
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
                <tr key={i}><th>{k}</th><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
