import type { CheckResult } from "../types/review";
import type { CaseTrace, TraceEvidence } from "../types/reasoning";
import { TRACE_EVIDENCE_LABEL } from "../types/reasoning";

function EvidenceBadge({ value }: { value: TraceEvidence }) {
  return <span className={`evidence-badge evidence-${value}`}>{TRACE_EVIDENCE_LABEL[value]}</span>;
}

const RULE_CLASS: Record<string, string> = { belegt: "ok", abgeleitet: "derived", offen: "warn", widerspruch: "fail" };

/** Longest value/detail text shown per graph edge; longer text is cut and stays readable via title. */
const EDGE_TEXT_CHARS = 120;

/** Shortens long graph text so a line stays scannable (full text on hover). */
function shorten(text: string): string {
  return text.length > EDGE_TEXT_CHARS ? `${text.slice(0, EDGE_TEXT_CHARS - 1).trimEnd()}…` : text;
}

/** Expandable local reasoning details: source, ontology, graph and rule trace. */
export function CaseBackendDetails({ trace, checks }: { trace: CaseTrace; checks: CheckResult[] }) {
  const nodeById = new Map(trace.graph.nodes.map((n) => [n.id, n]));
  return (
    <details className="backend">
      <summary>Quelle · Ontologie · Wissensgraph · Regelmodell <small className="muted">— {trace.summary}</small></summary>
      <h5 className="minihead">1 QUELLE</h5>
      <div className="tags">
        <span>{trace.source.documentName}</span>
        <span>{trace.source.documentVersion ?? "Version/Stand nicht angegeben"}</span>
        <span>{trace.source.sectionLabel}</span>
        <span className={trace.source.quoteVerified ? "status good" : "status warn"}>{trace.source.quoteVerified ? "Zitat geprüft" : "Zitat ungeprüft"}</span>
      </div>
      {trace.source.quote && <blockquote className={"quote " + (trace.source.quoteVerified ? "verified" : "unverified")}><small>{trace.source.quoteVerified ? "Wörtlich im Abschnitt gefunden" : "Am Original prüfen"}</small>„{trace.source.quote}“</blockquote>}

      <h5 className="minihead">2 ONTOLOGIE</h5>
      <table className="detail compact"><thead><tr><th>Kategorie</th><th>Begriff</th><th>Wert</th><th>Beleg</th></tr></thead><tbody>
        {trace.ontology.map((concept) => <tr key={concept.id}><td>{concept.category}</td><td>{concept.label}</td><td className="prewrap">{concept.value}</td><td><EvidenceBadge value={concept.evidence} /></td></tr>)}
      </tbody></table>

      <h5 className="minihead">3 WISSENSGRAPH</h5>
      <p className="muted small">{trace.graph.nodes.length} Knoten · {trace.graph.edges.length} Kanten. Der Graph zeigt Herkunft und Ableitung; er beweist keine fachliche Korrektheit.</p>
      <ul className="kedges">{trace.graph.edges.map((edge) => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        return <li key={edge.id}>
          <span className={`knode evidence-${edge.evidence}`}>{from?.kind ?? edge.from}:</span>
          <span className="krelation">{edge.relation}</span>
          <span className={`knode evidence-${edge.evidence}`}>{to?.kind ?? edge.to}:</span>
          <span title={to?.label}>{shorten(to?.label ?? "")}</span>
          {to?.detail && <small className="muted" title={to.detail}>— {shorten(to.detail)}</small>}
        </li>;
      })}</ul>

      <h5 className="minihead">4 REGELMODELL</h5>
      <table className="detail compact"><thead><tr><th>Regel</th><th>Ausdruck</th><th>Status</th><th>Begründung</th></tr></thead><tbody>
        {trace.rules.map((rule) => <tr key={rule.id}><td><code>{rule.id}</code><br />{rule.label}</td><td>{rule.expression}</td><td><span className={`rulestatus ${RULE_CLASS[rule.status]}`}>{rule.status}</span></td><td>{rule.evidence}</td></tr>)}
      </tbody></table>

      <h5 className="minihead">5 STRUKTURPRÜFUNG</h5>
      <ul className="backendchecks">{checks.map((check) => <li key={check.id} className={check.passed ? "ok" : "fail"}>{check.passed ? "✓" : "✕"} {check.label}{check.detail && <small className="muted"> — {check.detail}</small>}</li>)}</ul>
      <p className="muted small">Diese Prüfungen bewerten Nachverfolgbarkeit und Form, nicht die fachliche Korrektheit der Entgeltabrechnung.</p>
    </details>
  );
}
