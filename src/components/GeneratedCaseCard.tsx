import { useState } from "react";
import { Check, X } from "lucide-react";
import type { Basis, GeneratedTestCase, OriginKind, Priority } from "../types/review";
import { ORIGIN_LABEL } from "../types/review";
import { OPEN_VALUE_MARKER } from "../config/ai";
import { useReviewStore } from "../state/reviewContext";
import { buildCaseTrace } from "../reasoning/trace";
import { CaseBackendDetails } from "./CaseBackendDetails";
import { Status } from "./Status";
import { formatDateTime } from "../utils/format";

/** CSS modifier per priority flag. */
const PRIORITY_CLASS: Record<Priority, string> = { Hoch: "bad", Mittel: "warn", Niedrig: "neutral" };

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
export function GeneratedCaseCard({ item, showReasoning }: { item: GeneratedTestCase; showReasoning: boolean }) {
  const { reviewCase, requirements } = useReviewStore();
  const [comment, setComment] = useState(item.review.comment);
  const failed = item.checks.filter((c) => !c.passed);
  const kind = item.origin.kind;
  const req = requirements.find((r) => r.id === item.requirementId);
  const trace = item.trace ?? (req ? buildCaseTrace(req, item, item.origin, item.id) : undefined);

  return (
    <div className={`gencase ${ORIGIN_CLASS[kind]} ${item.review.decision === "Abgelehnt" ? "rejected" : ""}`}>
      <div className="paneltop">
        <div>
          <code>{item.id}</code>
          <h4 className="gentitle">{item.title}</h4>
        </div>
        <div className="badges">
          <PriorityBadge value={item.priority} />
          <Status value={item.review.decision} />
        </div>
      </div>
      <div className="tags">
        <span className={ORIGIN_CLASS[kind]}>
          {ORIGIN_LABEL[kind]}
        </span>
        <span>{item.technique || "Technik fehlt"}</span>
        <span>{item.execution}</span>
        <span>{formatDateTime(item.origin.generatedAt)}</span>
        {item.criteriaIds.map((id) => (
          <span key={id} title="Abgedeckte Kriterium-ID">Kriterium {id}</span>
        ))}
      </div>
      {req && <div className="case-source"><span><b>Anforderung:</b> {req.id} · {req.title}</span>{trace && <><span><b>Quelle:</b> {trace.source.documentName} · {trace.source.sectionLabel}</span><span className={trace.source.quoteVerified ? "status good" : "status warn"}>{trace.source.quoteVerified ? "Zitat geprüft" : "Zitat ungeprüft"}</span></>}</div>}
      {item.priorityReason && <p className="muted small">Begründung der Priorität: {item.priorityReason}</p>}

      <div className="given">
        <b>GEGEBEN</b>
        <p>{item.given || "—"}</p>
        <b>WENN</b>
        <p>{item.when || "—"}</p>
        <b>DANN</b>
        <p>{item.then || "—"}</p>
      </div>

      {item.testData.length > 0 && (
        <>
          <h5 className="minihead">TESTDATEN</h5>
          <FieldTable rows={item.testData} />
        </>
      )}

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

      <h5 className="minihead">ERWARTETES ERGEBNIS · VORSCHLAG, NICHT DURCH EINE REGEL-ENGINE BESTÄTIGT</h5>
      {item.expectedFields.length === 0 ? (
        <p className="muted small">Für diesen Fall ist kein erwartetes Ergebnis angegeben – vor der Ausführung ergänzen.</p>
      ) : (
        <FieldTable rows={item.expectedFields} />
      )}

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
        <button className="primary" onClick={() => reviewCase(item.id, "Akzeptiert", comment.trim())}>
          <Check size={15} /> Akzeptieren
        </button>
        <button onClick={() => reviewCase(item.id, "Abgelehnt", comment.trim())}>
          <X size={15} /> Ablehnen
        </button>
        {item.review.reviewedAt && <small className="muted">Geprüft am {formatDateTime(item.review.reviewedAt)}</small>}
      </div>
    </div>
  );
}
