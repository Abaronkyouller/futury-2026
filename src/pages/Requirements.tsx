import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";
import { SourceEvidence } from "../components/SourceEvidence";
import { useReviewStore } from "../state/reviewContext";
import { REQUIREMENT_STATUSES } from "../types/requirement";
import type { Req, RequirementStatus } from "../types/requirement";

const FILTERS = ["Alle", ...REQUIREMENT_STATUSES, "Aus Dokumenten", "Beispieldaten"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(r: Req, f: Filter): boolean {
  if (f === "Alle") return true;
  if (f === "Aus Dokumenten") return Boolean(r.origin);
  if (f === "Beispieldaten") return !r.origin;
  return r.status === f;
}

/** Illustrative rule draft, shown only for the sample requirements. */
const SAMPLE_RULE = (id: string) => `# Illustrativ – keine Regel-Engine angebunden
# R-031 ← ${id}    gültig ab 2027-01-01
def pruefe_mindestdauer_bemessungszeitraum(bescheinigung):
    beginn, ende = bescheinigung.bemessung_von, bescheinigung.bemessung_bis
    tage = (ende - beginn).days + 1
    if tage < 28:
        return Fehler("R-031", f"Zeitraum umfasst {tage} Tage, erwartet ≥ 28")
    return Ok("R-031")`;

/** Detail panel with examiner decision; keyed by requirement so the comment draft resets. */
function RequirementDetail({ req }: { req: Req }) {
  const { reviewRequirement, cases } = useReviewStore();
  const [comment, setComment] = useState(req.comment ?? "");
  const linked = cases.filter((c) => c.requirementId === req.id);
  const decide = (status: RequirementStatus) => reviewRequirement(req.id, status, comment.trim());

  return (
    <Panel>
      <div className="paneltop">
        <div>
          <code>{req.id}</code>
          <h3>{req.title}</h3>
        </div>
        <div className="badges">
          <Status value={req.status} />
          {!req.origin && <span className="status warn">Beispieldaten</span>}
        </div>
      </div>
      <div className="tags">
        <span>Leistung: {req.benefit}</span>
        <span>{linked.length} verknüpfte(r) Testfall/Testfälle</span>
        {req.confidence !== undefined && <span>Extraktionskonfidenz {req.confidence} (Beispielwert)</span>}
      </div>

      <h4>Quelle und Originaltext</h4>
      <SourceEvidence req={req} />

      {!req.origin && (
        <>
          <h4>Regelentwurf</h4>
          <pre>{SAMPLE_RULE(req.id)}</pre>
        </>
      )}

      <h4>Kommentar des Prüfers</h4>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Auslegung, Begründung für Änderung oder Ablehnung (fließt in spätere Extraktionen und Generierungen ein)"
      />
      <div className="actions">
        <button className="primary" onClick={() => decide("Genehmigt")}>
          <Check size={15} /> Genehmigen
        </button>
        <button onClick={() => decide("Abgelehnt")}>
          <X size={15} /> Ablehnen
        </button>
        <button onClick={() => decide("Offen")} disabled={req.status === "Offen"}>
          <RotateCcw size={15} /> Wieder öffnen
        </button>
        <Link className="buttonlink" to={`/generate?req=${req.id}`}>
          <Sparkles size={15} /> Testfälle generieren
        </Link>
      </div>
      <p className="muted small">
        Genehmigen bestätigt die Auslegung durch den Prüfer. Es wird keine ausführbare Regel kompiliert – eine Regel-Engine ist nicht angebunden.
      </p>
    </Panel>
  );
}

/**
 * Requirement review (H1/H2): requirements extracted from uploaded documents
 * and the illustrative samples. The examiner approves or rejects each one;
 * every decision is logged with its previous value.
 */
export function Requirements() {
  const { requirements } = useReviewStore();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("Alle");
  const [search, setSearch] = useState("");
  const selectedId = params.get("req") ?? requirements[requirements.length - 1]?.id;
  const active = requirements.find((r) => r.id === selectedId) ?? requirements[0];

  const visible = [...requirements]
    .reverse()
    .filter(
      (r) =>
        matchesFilter(r, filter) &&
        `${r.id} ${r.title} ${r.benefit} ${r.source} ${r.origin?.quote ?? ""}`.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <>
      <Header
        title="Anforderungen prüfen"
        subtitle="Aus Dokumenten extrahierte Anforderungen mit wörtlichem Zitat und Abschnittsangabe. Der Prüfer genehmigt oder verwirft jede Anforderung, bevor daraus Testfälle verbindlich werden."
        action={
          <Link className="buttonlink primary" to="/documents">
            Dokument hochladen
          </Link>
        }
      />
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>
            {f} · {requirements.filter((r) => matchesFilter(r, f)).length}
          </button>
        ))}
        <div className="search">
          <Search size={15} />
          <input placeholder="ID, Begriff oder Zitat" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="reqgrid">
        <Panel className="reqitems">
          {visible.length === 0 && <p className="muted pad">Keine Anforderungen für diesen Filter.</p>}
          {visible.map((r) => (
            <div
              key={r.id}
              className={"reqitem " + (active?.id === r.id ? "chosen" : "")}
              onClick={() => setParams({ req: r.id })}
            >
              <div className="paneltop">
                <code>{r.id}</code>
                <Status value={r.status} />
              </div>
              <b>{r.title}</b>
              <p>
                {r.benefit} · {r.origin ? `${r.origin.documentName} · ${r.origin.sectionLabel}` : `${r.source} · Beispieldaten`}
                {r.origin && !r.origin.quoteVerified && " · ⚠ Zitat ungeprüft"}
              </p>
            </div>
          ))}
        </Panel>
        {active && <RequirementDetail key={active.id} req={active} />}
      </div>
    </>
  );
}
