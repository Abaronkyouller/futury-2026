import { useState } from "react";
import { Check, CheckCircle2, XCircle } from "lucide-react";
import { useReviewStore } from "../state/reviewContext";
import { FIELD_VERDICTS, MODEL_RATINGS, modelRatingLabel, OVERALL_VERDICTS } from "../types/validation";
import type { Assessment, FieldAssessment, FieldVerdict, ModelRating, OverallVerdict, ResultComparison } from "../types/validation";
import { formatDateTime } from "../utils/format";
import { Status } from "./Status";

/** Verdict and evidence of one assessor for one field. */
function Cell({ a }: { a: FieldAssessment | undefined }) {
  if (!a) return <td className="muted">–</td>;
  return (
    <td>
      <Status value={a.verdict} />
      <div className="observed">{a.observed || <span className="muted">kein Wert gelesen</span>}</div>
      {a.quote && (
        <small className={a.quoteFound ? "quotecheck ok" : "quotecheck fail"} title={a.quote}>
          {a.quoteFound ? "✓ Beleg im Dokument gefunden" : "⚠ Beleg nicht im Dokument"}
        </small>
      )}
    </td>
  );
}

/** Summary card of one assessor (model or rule-based reference). */
function AssessorCard({ a }: { a: Assessment }) {
  return (
    <div className={"assessor " + (a.kind === "model" ? "assessor-model" : "assessor-rule")}>
      <div className="paneltop">
        <div>
          <b>{a.label}</b>
          <small className="muted block">{a.model} · {(a.durationMs / 1000).toFixed(1)} s</small>
        </div>
        {a.ok ? <Status value={a.overall} /> : <span className="status bad">Fehler</span>}
      </div>
      {a.ok ? <p className="small">{a.summary || <span className="muted">Keine Zusammenfassung.</span>}</p> : <p className="errortext">{a.error}</p>}
      {a.notes.length > 0 && (
        <ul className="warnings">
          {a.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Default examiner verdict per field: the common verdict of KI and rule-based matcher, else open. */
function defaultFieldVerdicts(c: ResultComparison): Record<string, FieldVerdict> {
  const [ki, rule] = c.assessments;
  return Object.fromEntries(
    c.expected.map((e) => {
      const vk = ki.fields.find((f) => f.field === e.field)?.verdict;
      const vr = rule.fields.find((f) => f.field === e.field)?.verdict;
      return [e.field, vk && vk === vr ? vk : "Nicht feststellbar"];
    }),
  );
}

/** Examiner's binding decision; saved decisions are fed into later comparison prompts. */
function FeedbackForm({ c }: { c: ResultComparison }) {
  const { reviewComparison, comparisons } = useReviewStore();
  const [verdict, setVerdict] = useState<OverallVerdict>(c.feedback?.verdict ?? (c.consensus === "Uneinig" ? "Unklar" : c.consensus));
  const [fields, setFields] = useState<Record<string, FieldVerdict>>(c.feedback?.fieldVerdicts ?? defaultFieldVerdicts(c));
  const [rating, setRating] = useState<ModelRating>(c.feedback?.rating ?? (c.consensus === "Uneinig" ? "KI" : "Beide"));
  const [comment, setComment] = useState(c.feedback?.comment ?? "");
  const learned = comparisons.filter((x) => x.feedback).length;

  const save = () =>
    reviewComparison(c.id, { verdict, fieldVerdicts: fields, rating, comment: comment.trim(), reviewedAt: new Date().toISOString() });

  return (
    <div className="feedbackform">
      <h4>Entscheidung des Prüfers</h4>
      <p className="muted small">
        KI und Kontroll-KI schlagen nur vor. Ihre Entscheidung ist das verbindliche Ergebnis im Prüfbericht und wird künftigen Abgleichen als Beispiel
        mitgegeben ({learned} gespeicherte Entscheidung(en) bisher).
      </p>
      <div className="filters">
        <label className="field inline">
          Gesamturteil
          <select value={verdict} onChange={(e) => setVerdict(e.target.value as OverallVerdict)}>
            {OVERALL_VERDICTS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field inline">
          Welche Einschätzung trifft zu?
          <select value={rating} onChange={(e) => setRating(e.target.value as ModelRating)}>
            {MODEL_RATINGS.map((r) => (
              <option key={r} value={r}>{modelRatingLabel(r)}</option>
            ))}
          </select>
        </label>
      </div>
      <table className="detail compact">
        <tbody>
          {c.expected.map((e) => (
            <tr key={e.field}>
              <th>{e.field}</th>
              <td>
                <select
                  value={fields[e.field] ?? "Nicht feststellbar"}
                  onChange={(ev) => setFields((f) => ({ ...f, [e.field]: ev.target.value as FieldVerdict }))}
                >
                  {FIELD_VERDICTS.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Begründung oder Hinweis an die KI, z. B. „Anzahl Vorerkrankungen fehlt im Export – nicht als Abweichung werten“"
      />
      <div className="actions">
        <button className="primary" onClick={save}>
          <Check size={15} /> Entscheidung speichern
        </button>
        {c.feedback && <small className="muted">Gespeichert am {formatDateTime(c.feedback.reviewedAt)}</small>}
      </div>
    </div>
  );
}

/**
 * Side-by-side view of one comparison: the expected values of the test case,
 * what the KI and the rule-based matcher read from the result, whether the
 * evidence is really in the document, and where both agree.
 */
export function ComparisonView({ c }: { c: ResultComparison }) {
  const [ki, rule] = c.assessments;
  return (
    <div className="comparison">
      <div className="paneltop">
        <div>
          <code>{c.id}</code>
          <h3>
            „{c.resultName}“ ↔ {c.testCaseId}
          </h3>
          <small className="muted">
            {c.caseLabel} · Anforderung {c.requirementId} · {formatDateTime(c.createdAt)}
          </small>
        </div>
        <div className="badges">
          <span className="muted small">KI und Kontroll-KI</span>
          <Status value={c.consensus} />
          {c.feedback && (
            <>
              <span className="muted small">Prüfer</span>
              <Status value={c.feedback.verdict} />
            </>
          )}
        </div>
      </div>

      <div className="assessors">
        {c.assessments.map((x) => (
          <AssessorCard key={x.label} a={x} />
        ))}
      </div>

      <h5 className="minihead">FELDWEISER ABGLEICH · ERWARTET (TESTFALL) GEGEN GELESEN (ERGEBNIS)</h5>
      <div className="tablepanel">
        <table className="cmp">
          <thead>
            <tr>
              <th>Feld</th>
              <th>Erwartet</th>
              <th>{ki.label}</th>
              <th>{rule.label}</th>
              <th>Einig</th>
              {c.feedback && <th>Prüfer</th>}
            </tr>
          </thead>
          <tbody>
            {c.expected.map((e) => (
              <tr key={e.field} className={ki.ok && !c.fieldAgreement[e.field] ? "disagree" : ""}>
                <th>{e.field}</th>
                <td>{e.value}</td>
                <Cell a={ki.fields.find((f) => f.field === e.field)} />
                <Cell a={rule.fields.find((f) => f.field === e.field)} />
                <td>
                  {!ki.ok ? (
                    <span className="muted small">KI ohne Antwort</span>
                  ) : c.fieldAgreement[e.field] ? (
                    <span className="agree"><CheckCircle2 size={15} /> einig</span>
                  ) : (
                    <span className="disagreetag"><XCircle size={15} /> uneinig</span>
                  )}
                </td>
                {c.feedback && <td><Status value={c.feedback.fieldVerdicts[e.field] ?? "–"} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="checks">
        <summary>Begründung je Feld · KI und Kontroll-KI</summary>
        {c.assessments.filter((x) => x.ok).map((x) => (
          <div key={x.label}>
            <h5 className="minihead">
              {x.label.toUpperCase()} · {x.kind === "model" ? x.model : "Zeilenabgleich Feldname/Wert"}
            </h5>
            <ul className="plain reasons">
              {x.fields.map((f) => (
                <li key={f.field}>
                  <b>{f.field}:</b> <Status value={f.verdict} /> {f.explanation || "–"}
                  {f.quote && <small className="muted"> · Beleg: „{f.quote}“</small>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>

      <FeedbackForm key={c.id} c={c} />
    </div>
  );
}
