import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import { ORIGIN_LABEL } from "../types/review";
import type { CheckStatus, GraphNode, ReasoningGraph } from "../reasoning/reasoningGraph";
import { GRAPH_EVIDENCE_LABEL } from "../reasoning/reasoningGraph";
import { sanitizeCaseTitle, visibleFields } from "../utils/caseText";

const CHECK_ICON: Record<CheckStatus, typeof Info> = { ok: CheckCircle2, warn: AlertTriangle, info: Info };
const BASIS_CLASS: Record<string, string> = { Quelle: "basis-source", Annahme: "basis-assumption", Generiert: "basis-generated" };

/** One numbered, collapsible step of the trace. */
function Step({ no, title, hint, open = false, warn = 0, children }: { no: number; title: string; hint?: string; open?: boolean; warn?: number; children: ReactNode }) {
  return (
    <details className="tracestep" open={open}>
      <summary>
        <ChevronRight size={18} className="chev" />
        <span className="stepno">{no}</span>
        <span className="steptitle">{title}{hint && <small>{hint}</small>}</span>
        {warn > 0 && <span className="status warn"><AlertTriangle size={13} /> {warn} Hinweis(e)</span>}
      </summary>
      <div className="stepbody">{children}</div>
    </details>
  );
}

/** Warning lines below a bullet. */
function Warnings({ node }: { node?: GraphNode }) {
  if (!node?.warnings.length) return null;
  return <>{node.warnings.map((w, i) => <p key={i} className="tracewarn"><AlertTriangle size={14} /> {w}</p>)}</>;
}

/**
 * Traceback of one test case as plain numbered sections with bullet points:
 * where the rule comes from, what it demands, how the model reasoned, what is
 * tested, what is expected and what came out. Warnings from the local grounding
 * checks are shown right next to the statement they concern.
 */
export function CaseTraceSection({ req, testCase, sampleId, graph, open, onToggle }: {
  req: Req;
  /** Undefined for illustrative sample cases. */
  testCase?: GeneratedTestCase;
  sampleId?: string;
  graph: ReasoningGraph;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const id = testCase?.id ?? sampleId ?? "";
  const o = req.origin;
  const of = (layer: number) => graph.nodes.filter((n) => n.layer === layer && (layer < 3 || n.caseId === id));
  const concepts = of(2);
  const steps = of(3);
  const caseNode = graph.nodes.find((n) => n.id === id);
  const expected = of(5).filter((n) => n.kind === "Erwartet");
  const questions = of(5).filter((n) => n.kind === "Offene Frage");
  const result = of(6);
  const summary = graph.cases.find((c) => c.id === id);
  const warnCount = summary?.warnings ?? 0;
  const warnIn = (nodes: GraphNode[]) => nodes.reduce((n, x) => n + x.warnings.length, 0);
  const source = graph.nodes.find((n) => n.id === "src");
  const failed = testCase?.checks.filter((c) => !c.passed) ?? [];

  return (
    <details className="tracecase" open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <ChevronRight size={20} className="chev" />
        <span className="tracecasehead">
          <b>{id}</b>
          <span>{testCase ? sanitizeCaseTitle(testCase.title) || testCase.technique : caseNode?.label.split(" · ").slice(1).join(" · ")}</span>
        </span>
        <span className="tracebadges">
          <span className={`evtag ${testCase ? "" : "ev-sample"}`}>{testCase ? ORIGIN_LABEL[testCase.origin.kind] : "Beispieldaten"}</span>
          {warnCount > 0
            ? <span className="status warn"><AlertTriangle size={13} /> {warnCount} Hinweis(e) prüfen</span>
            : testCase && <span className="status good"><CheckCircle2 size={13} /> Keine Belegwarnung</span>}
          {testCase && <span className="status neutral">{testCase.review.decision}</span>}
        </span>
      </summary>

      {open && (
        <div className="tracebody">
          <p className="tracelead">
            {testCase
              ? <>Dieser Testfall wurde {testCase.origin.kind === "model" ? `von der KI (${testCase.origin.model})` : testCase.origin.kind === "regelbasiert" ? "regelbasiert ohne KI" : testCase.origin.kind === "manuell" ? "manuell vom Prüfer" : "als Offline-Demo"} aus {o ? <b>{o.documentName}, {o.sectionLabel}</b> : "Beispieldaten"} erzeugt.{" "}
                  {graph.focusId === id && graph.claims.total > 0 && <>{graph.claims.backed} von {graph.claims.total} Aussagen finden sich in der Quelle oder in den Testdaten wieder.</>}</>
              : "Illustratives Beispiel ohne Originaltext und ohne Begründung eines Modells."}
          </p>

          <Step no={1} title="Woher stammt die Regel?" hint="Quelle und Originaltext" warn={warnIn(source ? [source] : [])}>
            <ul className="tracelist">
              {source?.details.map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}
            </ul>
            {o?.quote && <div className={`quote ${o.quoteVerified ? "" : "unverified"}`}><small>Wörtlich aus der Quelle</small>{o.quote}</div>}
            <Warnings node={source} />
          </Step>

          <Step no={2} title="Was verlangt die Regel?" hint="Auslegung und Bedingungen" warn={warnIn(concepts)}>
            <ul className="tracelist">
              {o?.statement && <li><b>Auslegung:</b> {o.statement} <span className="muted">({o.extractedBy === "model" ? "von der KI formuliert – mit dem Zitat vergleichen" : "regelbasiert aus dem Zitat"})</span></li>}
              {concepts.map((k) => (
                <li key={k.id}>
                  <b>{k.kind}:</b> {k.label} <span className="muted">– {k.evidence === "source" ? "steht so in der Quelle" : GRAPH_EVIDENCE_LABEL[k.evidence]}</span>
                  <Warnings node={k} />
                </li>
              ))}
              {!o?.statement && !concepts.length && <li className="muted">Keine Bedingungen erkannt.</li>}
            </ul>
          </Step>

          <Step no={3} title="Wie hat das Modell begründet?" hint="Gedankengang Schritt für Schritt" open warn={warnIn(steps)}>
            {testCase?.reasoning.length ? (
              <ol className="tracelist numbered">
                {testCase.reasoning.map((r, i) => (
                  <li key={i}>
                    <span className={`basis ${BASIS_CLASS[r.basis] ?? ""}`}>{r.basis === "Generiert" ? "Abgeleitet" : r.basis}</span>
                    {r.text}
                    {r.sourceRef && <span className="muted"> – zitiert: {r.sourceRef}</span>}
                    {r.basis === "Annahme" && <p className="traceinfo"><Info size={14} /> Annahme – bitte fachlich bestätigen.</p>}
                    <Warnings node={steps[i]} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">{testCase ? "Das Modell hat keine Begründung geliefert – die Herleitung ist nicht nachvollziehbar." : "Keine Modellbegründung (Beispieldaten)."}</p>
            )}
          </Step>

          <Step no={4} title="Was wird getestet?" hint="Ausgangslage, Testdaten und Ablauf" warn={failed.length}>
            {testCase ? (
              <ul className="tracelist">
                <li><b>Gegeben:</b> {testCase.given || "–"}</li>
                <li><b>Wenn:</b> {testCase.when || "–"}</li>
                <li><b>Dann:</b> {testCase.then || "–"}</li>
                {visibleFields(testCase.testData).length > 0 && (
                  <li><b>Testdaten:</b>
                    <ul>{visibleFields(testCase.testData).map((f, i) => <li key={i}>{f.field}: {f.value}</li>)}</ul>
                  </li>
                )}
                {testCase.steps.length > 0 && (
                  <li><b>Ablauf:</b>
                    <ol>{testCase.steps.map((s, i) => <li key={i}>{s.actor}: {s.action}{s.abgabegrund ? ` (Abgabegrund ${s.abgabegrund})` : ""}</li>)}</ol>
                  </li>
                )}
                <li><b>Technik / Priorität:</b> {testCase.technique} · {testCase.priority}{testCase.priorityReason ? ` – ${testCase.priorityReason}` : ""}</li>
                {failed.map((f) => <li key={f.id}><p className="tracewarn"><AlertTriangle size={14} /> {f.label}{f.detail ? `: ${f.detail}` : ""}</p></li>)}
              </ul>
            ) : (
              <ul className="tracelist">{caseNode?.details.map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}</ul>
            )}
          </Step>

          <Step no={5} title="Was wird erwartet?" hint="Erwartete Werte und offene Fragen" warn={warnIn(expected)}>
            <ul className="tracelist">
              {expected.map((n) => (
                <li key={n.id}>
                  <b>{n.label}</b>
                  <span className="muted"> – {n.details.find(([k]) => k === "Herkunft")?.[1] ?? GRAPH_EVIDENCE_LABEL[n.evidence]}</span>
                  <Warnings node={n} />
                </li>
              ))}
              {!expected.length && <li className="muted">Keine erwarteten Werte angegeben.</li>}
            </ul>
            {questions.length > 0 && (
              <>
                <h4>Offene Fragen</h4>
                <ul className="tracelist">{questions.map((q) => <li key={q.id}>{q.label}</li>)}</ul>
              </>
            )}
          </Step>

          <Step no={6} title="Was kam heraus?" hint="Ergebnis der Entgeltabrechnung und Befund" warn={warnIn(result)}>
            <ul className="tracelist">
              {result.map((n) => (
                <li key={n.id}>
                  <b>{n.kind}:</b> {n.label}
                  {n.details.length > 0 && <ul>{n.details.map(([k, v], i) => <li key={i}>{k}: {v}</li>)}</ul>}
                  <Warnings node={n} />
                </li>
              ))}
            </ul>
          </Step>

          <Step no={7} title="Zusammenfassung der Belegprüfung" hint="Woran die Begründung hängt" open={warnCount > 0}>
            <ul className="tracechecks">
              {graph.checks.map((c) => {
                const Icon = CHECK_ICON[c.status];
                return <li key={c.id} className={`chk-${c.status}`}><Icon size={16} /> <span><b>{c.label}:</b> {c.detail}</span></li>;
              })}
            </ul>
            <p className="muted small">Die Prüfung vergleicht nur Text und Zahlen mit dem zitierten Abschnitt und den Testdaten. Ein Hinweis bedeutet „nicht in der Quelle gefunden“ – nicht automatisch „falsch“. Sie ersetzt nicht die fachliche Prüfung.</p>
          </Step>
        </div>
      )}
    </details>
  );
}
