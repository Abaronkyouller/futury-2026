import { FileText } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";

export function LibraryPage() {
  return (
    <>
      <Header
        title="Specification library"
        subtitle="Reference specifications and supporting documents supplied with the ITSG package."
      />
      <Panel>
        <h3>Specification documents</h3>
        {[
          "DTA EEL · Verfahrensbeschreibung Version 13.4 · 01.01.2027",
          "DTA EEL · Beispielpapier Version 13.3 · 01.01.2027",
          "GG EEL Version 13.1 · 06.05.2025",
          "Grundsätze zu Entgeltersatzleistungen · 2024 / 2025",
          "DTA-EEL · Vorerkrankung example and test constellation",
        ].map((x, i) => (
          <div className="libraryitem" key={x}>
            <FileText size={18} />
            <div>
              <b>{x}</b>
              <p>
                {i === 0
                  ? "Specification baseline"
                  : "Supporting source document"}
              </p>
            </div>
            <Status value={i === 0 ? "Needs review" : "Done"} />
          </div>
        ))}
        <p className="muted">
          Document list is a UI demonstration. File ingestion and source linking
          require backend integration.
        </p>
      </Panel>
    </>
  );
}
