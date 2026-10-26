import { useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";
import { GeneratedCaseCard, PriorityBadge } from "../components/GeneratedCaseCard";
import { useReviewStore } from "../state/reviewContext";
import { ORIGIN_LABEL, PRIORITIES } from "../types/review";
import type { GeneratedTestCase, ReviewDecision } from "../types/review";
import { download } from "../utils/download";
import { toCsv } from "../utils/format";
import { sanitizeCaseTitle, visibleFields } from "../utils/caseText";

const FILTERS = ["Alle", "Offen", "Akzeptiert", "Abgelehnt"] as const;
type Filter = (typeof FILTERS)[number];

/** One CSV row per case; steps and fields are flattened so the vendor can follow them. */
function exportPlan(cases: GeneratedTestCase[], sourceOf: (id: string) => string) {
  const rows = cases.map((c) => [
    c.id,
    c.requirementId,
    sourceOf(c.requirementId),
    sanitizeCaseTitle(c.title),
    c.technique,
    c.priority,
    ORIGIN_LABEL[c.origin.kind],
    c.review.decision,
    c.given,
    c.when,
    c.then,
    visibleFields(c.testData).map((f) => `${f.field}: ${f.value}`).join(" | "),
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

  const shownCases = cases;
  const visible = shownCases
    .filter((c) => filter === "Alle" || c.review.decision === (filter as ReviewDecision))
    .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.id.localeCompare(b.id));
  const active = shownCases.find((c) => c.id === selected) ?? visible[0];
  const sourceOf = (id: string) => requirements.find((r) => r.id === id)?.source ?? "";
  const exportable = cases.filter((c) => c.review.decision !== "Abgelehnt");

  return (
    <>
      <Header
        title="Testfälle"
        subtitle="Alle erzeugten Testfälle mit erwartetem Ergebnis, Prüfstatus und Herkunft. Abgelehnte Fälle werden nicht exportiert. Keiner der Fälle wurde in einer Entgeltabrechnungssoftware ausgeführt."
        action={
          <button className="primary" disabled={exportable.length === 0} onClick={() => exportPlan(exportable, sourceOf)}>
            <Download size={15} /> Testplan für Hersteller exportieren (CSV)
          </button>
        }
      />
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>
            {f} · {f === "Alle" ? shownCases.length : shownCases.filter((c) => c.review.decision === f).length}
          </button>
        ))}
      </div>

      {shownCases.length === 0 ? (
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
                  {["ID", "Titel", "Technik", "Priorität", "Erwartet", "Herkunft", "Prüfung"].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} onClick={() => setSelected(c.id)} className={active?.id === c.id ? "highlight" : ""}>
                    <td><code>{c.id}</code><br /><small className="muted">{c.requirementId}</small></td>
                    <td>{sanitizeCaseTitle(c.title)}</td>
                    <td>{c.technique}</td>
                    <td><PriorityBadge value={c.priority} /></td>
                    <td>
                      {c.expectedFields.length === 0 ? (
                        <span className="muted">kein erwartetes Ergebnis</span>
                      ) : (
                        c.expectedFields.map((f, i) => (
                          <div key={i}>
                            <small className="muted">{f.field}:</small> {f.value}
                          </div>
                        ))
                      )}
                    </td>
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

    </>
  );
}
