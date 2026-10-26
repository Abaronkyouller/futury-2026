import type { Req } from "../types/requirement";
import { formatDateTime } from "../utils/format";

/** Bullet list, or a muted dash when empty. */
function Items({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="muted">–</span>;
  return (
    <ul className="plain">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

/** Highlights the quote inside the section text, if it occurs there literally. */
function SectionText({ text, quote }: { text: string; quote: string }) {
  const at = text.indexOf(quote.replace(/\s*\[…\]$/, "").slice(0, 80));
  if (at === -1) return <div className="sourcetext">{text}</div>;
  const end = at + Math.min(quote.length, text.length - at);
  return (
    <div className="sourcetext">
      {text.slice(0, at)}
      <mark>{text.slice(at, end)}</mark>
      {text.slice(end)}
    </div>
  );
}

/**
 * Source evidence of a requirement (AGENTS.md instructions 1 and 2): file,
 * version, section and the verbatim quote next to its interpretation.
 * Sample requirements have no source text; that is shown explicitly.
 */
export function SourceEvidence({ req, compact = false }: { req: Req; compact?: boolean }) {
  const o = req.origin;
  if (!o) {
    return (
      <div className="notice">
        <b>Beispieldaten</b>
        <p>Quelle „{req.source}“ – der Originaltext liegt im Prototyp nicht vor. Laden Sie ein Dokument hoch, um Anforderungen mit Quellennachweis zu erhalten.</p>
      </div>
    );
  }
  return (
    <div className="evidence">
      <div className="tags">
        <span title="Dokument">{o.documentName}</span>
        <span title="Version/Stand wie im Dokument abgedruckt">{o.documentVersion ?? "Version/Stand nicht angegeben"}</span>
        <span title="Dokumentart">{o.documentKind}</span>
        <span title="Abschnitt">{o.sectionLabel}</span>
        {o.criterionId && <span title="Kriterium-ID aus der Quelle">Kriterium {o.criterionId}</span>}
      </div>
      <blockquote className={"quote " + (o.quoteVerified ? "verified" : "unverified")}>
        <small>
          {o.quoteVerified ? "✓ Wörtliches Zitat – im Abschnitt gefunden" : "⚠ Zitat nicht wörtlich gefunden – am Original prüfen"}
        </small>
        „{o.quote}“
      </blockquote>
      {o.quoteNote && <p className="muted small">{o.quoteNote}</p>}
      {!compact && (
        <>
          <table className="detail">
            <tbody>
              <tr>
                <th>Interpretation</th>
                <td>{o.statement || <span className="muted">keine – regelbasiert übernommen, nicht umformuliert</span>}</td>
              </tr>
              <tr><th>Bedingungen</th><td><Items items={o.conditions} /></td></tr>
              <tr><th>Datenfelder</th><td><Items items={o.dataFields} /></td></tr>
              <tr><th>Unklarheiten</th><td><Items items={o.ambiguities} /></td></tr>
              <tr>
                <th>Extraktion</th>
                <td>
                  {o.extractedBy === "model" ? `KI (${o.model})` : "Regelbasiert (ohne KI)"} · Lauf {o.runId} · {formatDateTime(o.extractedAt)}
                </td>
              </tr>
            </tbody>
          </table>
          {o.sectionText && (
            <details className="checks">
              <summary>Abschnittstext anzeigen (Kontext für die Generierung)</summary>
              <SectionText text={o.sectionText} quote={o.quote} />
            </details>
          )}
        </>
      )}
    </div>
  );
}
