import { useState } from "react";
import { Check, X } from "lucide-react";
import type { Basis, GeneratedTestCase, Priority } from "../types/review";
import { OPEN_VALUE_MARKER } from "../config/ai";
import { useReviewStore } from "../state/reviewContext";
import { Status } from "./Status";
import { formatDateTime } from "../utils/format";

/** CSS modifier per priority flag. */
const PRIORITY_CLASS: Record<Priority, string> = { Hoch: "bad", Mittel: "warn", Niedrig: "neutral" };

/** CSS modifier and explanation per reasoning basis. */
const BASIS_INFO: Record<Basis, { cls: string; hint: string }> = {
  Quelle: { cls: "basis-source", hint: "Restates the given requirement/source" },
  Annahme: { cls: "basis-assumption", hint: "Model assumption – examiner must confirm" },
  Generiert: { cls: "basis-generated", hint: "Derived test idea" },
};

export function PriorityBadge({ value }: { value: Priority }) {
  return <span className={"status " + PRIORITY_CLASS[value]}>Priorität {value}</span>;
}

/**
 * One AI-proposed test case: origin, priority, GIVEN/WHEN/THEN, expected values,
 * adjustable reasoning view, rule-based checks and examiner feedback controls.
 */
export function GeneratedCaseCard({
  item,
  showReasoning,
}: {
  item: GeneratedTestCase;
  showReasoning: boolean;
}) {
  const { reviewCase } = useReviewStore();
  const [comment, setComment] = useState(item.review.comment);
  const failed = item.checks.filter((c) => !c.passed);
  const isDemo = item.origin.kind === "offline-demo";

  return (
    <div className={"gencase " + (item.review.decision === "Abgelehnt" ? "rejected" : "")}>
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
        <span className={isDemo ? "origin-demo" : "origin-ai"}>
          {isDemo ? "Offline demo · simulated, no model call" : `KI-Vorschlag · ${item.origin.model}`}
        </span>
        <span>{item.technique || "technique missing"}</span>
        <span>{item.execution}</span>
        <span>{formatDateTime(item.origin.generatedAt)}</span>
      </div>
      {item.priorityReason && <p className="muted small">Priority reason: {item.priorityReason}</p>}

      <div className="given">
        <b>GIVEN</b>
        <p>{item.given || "—"}</p>
        <b>WHEN</b>
        <p>{item.when || "—"}</p>
        <b>THEN</b>
        <p>{item.then || "—"}</p>
      </div>

      <h5 className="minihead">EXPECTED RESULT · PROPOSAL, NOT VERIFIED BY A RULE ENGINE</h5>
      <table className="detail">
        <tbody>
          {item.expectedFields.map((f, i) => (
            <tr key={i} className={f.value.includes(OPEN_VALUE_MARKER) ? "openvalue" : ""}>
              <th>{f.field}</th>
              <td>{f.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showReasoning && (
        <>
          <h5 className="minihead">REASONING</h5>
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
          <b>Open questions for the examiner</b>
          <ul>
            {item.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="checks">
        <summary>
          Rule-based structure checks: {item.checks.length - failed.length}/{item.checks.length} passed
          {failed.length > 0 && <span className="checkfail"> · {failed.length} issue(s)</span>}
        </summary>
        <ul>
          {item.checks.map((c) => (
            <li key={c.id} className={c.passed ? "ok" : "fail"}>
              {c.passed ? "✓" : "✕"} {c.label}
              {c.detail && <small className="muted"> — {c.detail}</small>}
            </li>
          ))}
        </ul>
        <p className="muted small">
          These checks verify structure and traceability only, not payroll correctness.
        </p>
      </details>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Feedback for the AI: what is wrong, missing or good? (used in later runs)"
      />
      <div className="actions">
        <button className="primary" onClick={() => reviewCase(item.id, "Akzeptiert", comment.trim())}>
          <Check size={15} /> Accept
        </button>
        <button onClick={() => reviewCase(item.id, "Abgelehnt", comment.trim())}>
          <X size={15} /> Reject
        </button>
        {item.review.reviewedAt && (
          <small className="muted">Reviewed {formatDateTime(item.review.reviewedAt)}</small>
        )}
      </div>
    </div>
  );
}
