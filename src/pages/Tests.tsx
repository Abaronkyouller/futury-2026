import { useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";
import { GeneratedCaseCard, PriorityBadge } from "../components/GeneratedCaseCard";
import { cases as sampleCases } from "../data/testCases";
import { useReviewStore } from "../state/reviewContext";
import { ORIGIN_LABEL, PRIORITIES } from "../types/review";
import type { GeneratedTestCase, ReviewDecision } from "../types/review";
import { download } from "../utils/download";
import { toCsv } from "../utils/format";

const FILTERS = ["Alle", "Offen", "Akzeptiert", "Abgelehnt"] as const;
type Filter = (typeof FILTERS)[number];

/** One CSV row per case; steps and fields are flattened so the vendor can follow them. */
function exportPlan(cases: GeneratedTestCase[], sourceOf: (id: string) => string) {
  const rows = cases.map((c) => [
    c.id,
    c.requirementId,
    sourceOf(c.requirementId),
    c.title,
    c.technique,
    c.priority,
    ORIGIN_LABEL[c.origin.kind],
    c.review.decision,
    c.given,
    c.when,
    c.then,
    c.testData.map((f) => `${f.field}: ${f.value}`).join(" | "),
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

/**
 * Test plan (H3/H4): all generated cases with their review state, plus the
 * illustrative sample cases. Nothing here has been executed in a payroll system.
 */
export function Tests() {
  const { cases, requirements } = useReviewStore();
  const [filter, setFilter] = useState<Filter>("Alle");
  const [selected, setSelected] = useState<string | null>(null);
  const [sampleSelected, setSampleSelected] = useState("TC-028-04");

  const visible = cases
    .filter((c) => filter === "Alle" || c.review.decision === (filter as ReviewDecision))
    .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.id.localeCompare(b.id));
  const active = cases.find((c) => c.id === selected) ?? visible[0];
  const sourceOf = (id: string) => requirements.find((r) => r.id === id)?.source ?? "";
  const exportable = cases.filter((c) => c.review.decision !== "Abgelehnt");
  const sample = sampleCases.find((c) => c[0] === sampleSelected)!;

  return (
    <>
      <Header
        title="Testfälle"
        subtitle="Alle erzeugten Testfälle mit Prüfstatus und Herkunft. Abgelehnte Fälle werden nicht exportiert. Keiner der Fälle wurde in einer Entgeltabrechnungssoftware ausgeführt."
        action={
          <button className="primary" disabled={exportable.length === 0} onClick={() => exportPlan(exportable, sourceOf)}>
            <Download size={15} /> Testplan für Hersteller exportieren (CSV)
          </button>
        }
      />
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>
            {f} · {f === "Alle" ? cases.length : cases.filter((c) => c.review.decision === f).length}
          </button>
        ))}
      </div>

      {cases.length === 0 ? (
        <Panel>
          <p className="muted">
            Noch keine erzeugten Testfälle. Laden Sie unter <Link to="/documents">Dokumente & Extraktion</Link> eine Spezifikation hoch
            oder nutzen Sie den <Link to="/generate">Testfall-Generator</Link>.
          </p>
        </Panel>
      ) : (
        <div className="reqgrid">
          <Panel className="tablepanel">
            <table>
              <thead>
                <tr>
                  {["ID", "Titel", "Technik", "Priorität", "Herkunft", "Prüfung"].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} onClick={() => setSelected(c.id)} className={active?.id === c.id ? "highlight" : ""}>
                    <td><code>{c.id}</code><br /><small className="muted">{c.requirementId}</small></td>
                    <td>{c.title}</td>
                    <td>{c.technique}</td>
                    <td><PriorityBadge value={c.priority} /></td>
                    <td>{ORIGIN_LABEL[c.origin.kind]}</td>
                    <td><Status value={c.review.decision} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <div>{active && <GeneratedCaseCard key={active.id} item={active} showReasoning />}</div>
        </div>
      )}

      <h3 className="spaced">Beispieldaten (illustrativ)</h3>
      <div className="rulebar">
        Regel R-028 · Bemessungszeitraum ist der letzte abgerechnete Entgeltabrechnungszeitraum
        <span>Quelle: § 47 SGB V · REQ-EEL-028 · Beispieldaten, nicht aus einem Dokument extrahiert</span>
      </div>
      <Panel className="tablepanel">
        <table>
          <thead>
            <tr>
              {["ID", "Szenario", "Technik", "Erwarteter Bemessungszeitraum", "Status"].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleCases.map((c) => (
              <tr key={c[0]} onClick={() => setSampleSelected(c[0])} className={sampleSelected === c[0] ? "highlight" : ""}>
                {c.slice(0, 4).map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
                <td><Status value={c[4]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <div className="two">
        <Panel>
          <code>{sample[0]}</code>
          <h3>{sample[1]}</h3>
          <div className="given">
            <b>GEGEBEN</b>
            <p>Beschäftigte Person mit festem Monatsentgelt, beschäftigt seit 01.03.2026. Abgerechnet bis August 2026; September ist noch nicht abgerechnet.</p>
            <b>WENN</b>
            <p>Die Arbeitsunfähigkeit beginnt am 02.10.2026 und die Krankenkasse fordert die Entgeltbescheinigung an.</p>
            <b>DANN</b>
            <p>Die Bescheinigung meldet August 2026 als Bemessungszeitraum.</p>
          </div>
          <h4>Schritte für den Hersteller</h4>
          <ol>
            <li>Beschäftigte Person mit den obigen Stammdaten anlegen.</li>
            <li>Entgeltabrechnung nur für März bis August 2026 durchführen.</li>
            <li>Arbeitsunfähigkeit ab 02.10.2026 erfassen.</li>
            <li>Entgeltbescheinigung erzeugen und den Datensatz exportieren.</li>
          </ol>
        </Panel>
        <Panel>
          <h3>Erwarteter Datensatz</h3>
          <table className="detail">
            <tbody>
              {[
                ["Beginn Arbeitsunfähigkeit", "02.10.2026"],
                ["Bemessungszeitraum von", "01.08.2026"],
                ["Bemessungszeitraum bis", "31.08.2026"],
                ["Arbeitsentgelt im Zeitraum", "3.200,00 €"],
              ].map(([a, b]) => (
                <tr key={a}>
                  <th>{a}</th>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>Nachverfolgung</h4>
          <div className="tags">
            <span>§ 47 SGB V</span>→<span>REQ-EEL-028</span>→<span>R-028</span>→<span>{sampleSelected}</span>
          </div>
          <Link className="link" to="/validation">Validierungsergebnis ansehen</Link>
        </Panel>
      </div>
    </>
  );
}
