import { Header } from "../components/Header";
import { Panel } from "../components/Panel";

export function GraphPage() {
  return (
    <>
      <Header
        title="Ontology & knowledge graph"
        subtitle="Explore relationships between legal sources, requirements, rules and generated test cases."
      />
      <Panel>
        <div className="graph">
          <div className="node">§ 47 SGB V</div>
          <div className="arrow">→</div>
          <div className="node">REQ-EEL-028</div>
          <div className="arrow">→</div>
          <div className="node">R-028</div>
          <div className="arrow">→</div>
          <div className="node">TC-028-04</div>
        </div>
        <h3>Linked concepts</h3>
        <div className="tags">
          {[
            "Arbeitsunfähigkeit",
            "Bemessungszeitraum",
            "Entgeltbescheinigung",
            "Krankengeld",
          ].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <p className="muted">
          Concept relationships are illustrative, based on the PDF. No live
          graph database is connected.
        </p>
      </Panel>
    </>
  );
}
