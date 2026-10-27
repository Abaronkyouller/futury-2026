import { useState } from "react";
import { AlertTriangle, Check, RefreshCw, X } from "lucide-react";
import type { Basis, GeneratedTestCase, OriginKind, Priority } from "../types/review";
import { ORIGIN_LABEL } from "../types/review";
import { OPEN_VALUE_MARKER } from "../config/ai";
import { useReviewStore } from "../state/reviewContext";
import { useGeneration } from "../state/useGeneration";
import { buildCaseTrace } from "../reasoning/trace";
import { expectedStatus } from "../reasoning/expectedStatus";
import { CaseBackendDetails } from "./CaseBackendDetails";
import { TestDataEditor } from "./TestDataEditor";
import { Status } from "./Status";
import { formatDateTime } from "../utils/format";
import { sanitizeCaseTitle, testDataAvailability, visibleFields } from "../utils/caseText";

/** CSS modifier per priority flag. */
const PRIORITY_CLASS: Record<Priority, string> = { Hoch: "bad", Mittel: "warn", Niedrig: "info" };

/** CSS modifier and explanation per reasoning basis. */
const BASIS_INFO: Record<Basis, { cls: string; hint: string }> = {
  Quelle: { cls: "basis-source", hint: "Steht so in der Quelle bzw. Anforderung" },
  Annahme: { cls: "basis-assumption", hint: "Annahme – muss vom Prüfer bestätigt werden" },
  Generiert: { cls: "basis-generated", hint: "Abgeleitete Testidee" },
};

/** CSS modifier per origin (border colour of the card and origin tag). */
const ORIGIN_CLASS: Record<OriginKind, string> = {
  model: "origin-ai",
  regelbasiert: "origin-rule",
  "offline-demo": "origin-demo",
  manuell: "origin-manual",
};

export function PriorityBadge({ value }: { value: Priority }) {
  return <span className={"status " + PRIORITY_CLASS[value]}>Priorität {value}</span>;
}

/** Key/value table; rows whose value is the open marker are highlighted. */
function FieldTable({ rows }: { rows: { field: string; value: string }[] }) {
  return (
    <table className="detail">
      <tbody>
        {rows.map((f, i) => (
          <tr key={i} className={f.value.includes(OPEN_VALUE_MARKER) ? "openvalue" : ""}>
            <th>{f.field}</th>
            <td>{f.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One proposed test case: origin, priority, GEGEBEN/WENN/DANN, test data,
 * message flow, expected values, adjustable reasoning view, rule-based checks
 * and examiner feedback controls.
 */
export function GeneratedCaseCard({
  item,
  showReasoning,
  collapsible = false,
  showStatuses = true,
  showTitle = true,
  expanded,
  onExpandedChange,
}: {
  item: GeneratedTestCase;
  showReasoning: boolean;
  /** Start collapsed and expand on click (used by the workspace list on the documents page). */
  collapsible?: boolean;
  /**
   * Hide the detailed statuses (origin, execution, expected-result status) in the
   * document workspace body. Priority and review status stay in the header so a
   * collapsed case still shows them.
   */
  showStatuses?: boolean;
  /** Hide the generated scenario title beneath the test-case ID. */
  showTitle?: boolean;
  /** Optional controlled expansion state, used when only one list item may be open. */
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}) {
  const { reviewCase, submitCaseFeedback, requirements, settings } = useReviewStore();
  const runGeneration = useGeneration();
  const [comment, setComment] = useState(item.review.comment);
  const [regenerating, setRegenerating] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [internalOpen, setInternalOpen] = useState(!collapsible);
  const open = expanded ?? internalOpen;
  const toggleOpen = () => {
    const next = !open;
    setInternalOpen(next);
    onExpandedChange?.(next);
  };
  const failed = item.checks.filter((c) => !c.passed);
  const kind = item.origin.kind;
  const req = requirements.find((r) => r.id === item.requirementId);
  const trace = item.trace ?? (req ? buildCaseTrace(req, item, item.origin, item.id) : undefined);
  // Computed from the case origin and the requirement's source, not a fixed label.
  const expected = expectedStatus(item, req);
  const displayTitle = sanitizeCaseTitle(item.title);
  // Condition bookkeeping rows are not test data (see utils/caseText.ts).
  const testData = visibleFields(item.testData);
  const dataInfo = testDataAvailability(item);

  const submitFeedback = async () => {
    const feedback = comment.trim();
    if (!feedback || !req) return;
    setRegenerating(true);
    setFeedbackResult("");
    setFeedbackError("");
    submitCaseFeedback(item.id, feedback);
    const feedbackCase: GeneratedTestCase = {
      ...item,
      review: { ...item.review, decision: "Abgelehnt", comment: feedback, reviewedAt: new Date().toISOString() },
    };
    try {
      const result = await runGeneration(req, { ...settings, maxCases: 1, useFeedback: true }, "model", feedbackCase);
      setFeedbackResult(`Ersatztestfall ${result.cases[0]?.id ?? ""} wurde erzeugt.`);
    } catch (error) {
      setFeedbackError(`Feedback wurde gespeichert, die Neuerzeugung ist jedoch fehlgeschlagen: ${(error as Error).message}`);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className={`gencase ${ORIGIN_CLASS[kind]} ${showStatuses && item.review.decision === "Abgelehnt" ? "rejected" : ""} ${collapsible && !open ? "collapsed" : ""}`}>
      <div
        className={"paneltop" + (collapsible ? " clickable" : "")}
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
        onClick={collapsible ? toggleOpen : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleOpen();
                }
              }
            : undefined
        }
      >
        <div>
          <code>{item.id}</code>
          {showTitle && displayTitle && <h4 className="gentitle">{displayTitle}</h4>}
        </div>
        {/* Priority and review status stay visible while the case is collapsed. */}
        <div className="badges">
          {collapsible && <span className="casemark">{open ? "▲" : "▼"}</span>}
          <PriorityBadge value={item.priority} />
          <Status value={item.review.decision} />
        </div>
      </div>
      {open && <>
      <div className="tags">
        {showStatuses && <span className={ORIGIN_CLASS[kind]}>{ORIGIN_LABEL[kind]}</span>}
        <span>{item.technique || "Technik fehlt"}</span>
        {showStatuses && <span>{item.execution}</span>}
        <span>{formatDateTime(item.origin.generatedAt)}</span>
        {item.criteriaIds.map((id) => (
          <span key={id} title="Abgedeckte Kriterium-ID">Kriterium {id}</span>
        ))}
      </div>
      {req && <div className="case-source"><span><b>Anforderung:</b> {req.id} · {req.title}</span>{trace && <><span><b>Quelle:</b> {trace.source.documentName} · {trace.source.sectionLabel}</span>{showStatuses && <span className={trace.source.quoteVerified ? "status good" : "status warn"}>{trace.source.quoteVerified ? "Zitat geprüft" : "Zitat ungeprüft"}</span>}</>}</div>}
      {showStatuses && item.priorityReason && <p className="muted small">Begründung der Priorität: {item.priorityReason}</p>}

      <div className="given">
        <b>GEGEBEN</b>
        <p>{item.given || "—"}</p>
        <b>WENN</b>
        <p>{item.when || "—"}</p>
        <b>DANN</b>
        <p>{item.then || "—"}</p>
      </div>

      <h5 className="minihead">TESTDATEN</h5>
      {!dataInfo.available && (
        <div className="nodata" role="note">
          <AlertTriangle size={18} />
          <div><b>Dieser Testfall hat keine Testdaten.</b> {dataInfo.reason}</div>
        </div>
      )}
      {testData.length > 0 && dataInfo.available && (
        <>
          <p className="muted small">Vorschlag ({ORIGIN_LABEL[kind]}):</p>
          <FieldTable rows={testData} />
        </>
      )}
      <TestDataEditor item={item} template={dataInfo.available ? testData : []} canRandomize={dataInfo.available} />

      {item.steps.length > 0 && (
        <>
          <h5 className="minihead">ABLAUF / NACHRICHTENFOLGE</h5>
          <ol className="flow">
            {item.steps.map((s, i) => (
              <li key={i}>
                <span className={"actor " + (s.actor === "Krankenkasse" ? "actor-kk" : "actor-ag")}>{s.actor || "?"}</span>
                {s.action}
                {s.abgabegrund && <span className="code">Abgabegrund {s.abgabegrund}</span>}
              </li>
            ))}
          </ol>
        </>
      )}

      <h5 className="minihead">ERWARTETES ERGEBNIS{showStatuses ? ` · ${expected.label}` : ""}</h5>
      {showStatuses && <p className="muted small">{expected.detail}</p>}
      {expected.present ? <FieldTable rows={item.expectedFields} /> : <p className="muted small">kein erwartetes Ergebnis</p>}

      {showReasoning && (
        <>
          <h5 className="minihead">BEGRÜNDUNG</h5>
          <ol className="reasoning">
            {item.reasoning.map((s, i) => (
              <li key={i}>
                <span className={"basis " + BASIS_INFO[s.basis].cls} title={BASIS_INFO[s.basis].hint}>
                  {s.basis}
                </span>
                {s.text}
                {s.sourceRef && <small className="muted"> · {s.sourceRef}</small>}
              </li>
            ))}
          </ol>
        </>
      )}

      {item.openQuestions.length > 0 && (
        <div className="notice">
          <b>Offene Fragen an den Prüfer</b>
          <ul>
            {item.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {trace ? <CaseBackendDetails trace={trace} checks={item.checks} /> : <details className="checks"><summary>Regelbasierte Strukturprüfung: {item.checks.length - failed.length}/{item.checks.length} bestanden</summary></details>}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Rückmeldung an die KI: Was ist falsch, fehlt oder ist gut? (fließt in spätere Läufe ein)"
      />
      <div className="actions">
        <button className="primary" disabled={regenerating || !comment.trim() || !req} onClick={() => void submitFeedback()}>
          <RefreshCw size={15} /> {regenerating ? "Wird neu erzeugt …" : "Feedback absenden & neu erzeugen"}
        </button>
      </div>
      {feedbackResult && <p className="status good">{feedbackResult}</p>}
      {feedbackError && <div className="notice errorbox">{feedbackError}</div>}
      <div className="actions">
        <button className="primary" onClick={() => reviewCase(item.id, "Akzeptiert", comment.trim())}>
          <Check size={15} /> Akzeptieren
        </button>
        <button onClick={() => reviewCase(item.id, "Abgelehnt", comment.trim())}>
          <X size={15} /> Ablehnen
        </button>
        {showStatuses && item.review.reviewedAt && <small className="muted">Geprüft am {formatDateTime(item.review.reviewedAt)}</small>}
      </div>
      </>}
    </div>
  );
}
