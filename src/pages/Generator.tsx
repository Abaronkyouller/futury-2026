import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FlaskConical, Sparkles, Wand2 } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { GeneratedCaseCard } from "../components/GeneratedCaseCard";
import { SourceEvidence } from "../components/SourceEvidence";
import { Status } from "../components/Status";
import { FEEDBACK_EXAMPLES_MAX, MAX_CASES_LIMIT } from "../config/ai";
import { PRIORITIES, PRIORITY_FOCUSES, TECHNIQUES } from "../types/review";
import type { GenerationSettings, OriginKind, Technique } from "../types/review";
import { buildMessages } from "../ai/prompt";
import { activeNotes, selectGenerationFeedback } from "../feedback/collect";
import { useReviewStore } from "../state/reviewContext";
import { useGeneration } from "../state/useGeneration";

/**
 * Test-case generator (H2/H3). The examiner picks a requirement, adjusts how
 * the model reasons, generates proposals (AI, rule-based or offline demo),
 * then accepts or rejects each one with a comment. Reviewed cases are fed
 * back into later prompts.
 */
export function Generator() {
  const store = useReviewStore();
  const runGeneration = useGeneration();
  const [params, setParams] = useSearchParams();
  const requirements = store.requirements;
  const fromDocs = requirements.filter((r) => r.origin);
  const samples = requirements.filter((r) => !r.origin);
  const reqId = params.get("req") ?? (fromDocs[fromDocs.length - 1] ?? requirements[0])?.id;
  const req = requirements.find((r) => r.id === reqId) ?? requirements[0];

  // Draft settings are local; they are committed (and logged) only when a run starts.
  const [draft, setDraft] = useState<GenerationSettings>(store.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rawReply, setRawReply] = useState("");
  const [showReasoning, setShowReasoning] = useState(true);

  const allReviewed = store.cases.filter((c) => c.review.decision !== "Offen");
  // Same selection as a real run (useGeneration): relevant active feedback plus maintainer notes.
  const reviewed = selectGenerationFeedback(store.cases, req, store.requirements, store.feedbackExcluded);
  const notes = activeNotes(store.feedbackNotes, store.feedbackExcluded, "Generierung");
  // Exact prompt preview; cheap to rebuild on every render.
  const messages = buildMessages(req, draft, reviewed, notes);

  const reqCases = store.cases
    .filter((c) => c.requirementId === req.id)
    .sort(
      (a, b) =>
        PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
        b.origin.generatedAt.localeCompare(a.origin.generatedAt),
    );

  const set = <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleTechnique = (t: Technique) =>
    set("techniques", draft.techniques.includes(t) ? draft.techniques.filter((x) => x !== t) : [...draft.techniques, t]);

  async function run(kind: OriginKind) {
    setBusy(true);
    setError("");
    try {
      const result = await runGeneration(req, draft, kind);
      setRawReply(result.rawReply);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header
        title="Testfall-Generator"
        subtitle="Erzeugt zu einer Anforderung Testfälle mit Testdaten, Nachrichtenfolge und erwarteten Ergebnissen. Vorschläge sind kein Orakel: Der Prüfer bewertet jeden Fall, erwartete Werte brauchen eine Bestätigung durch genehmigte Regeln."
      />
      <div className="chips">
        <span>Modell über hessian.ai-Gateway (Vite-Proxy)</span>
        <span>Rückmeldungen nur in diesem Browser gespeichert</span>
      </div>
      <div className="gengrid">
        <Panel>
          <h3>Anforderung</h3>
          <select className="full" value={req.id} onChange={(e) => setParams({ req: e.target.value })}>
            {fromDocs.length > 0 && (
              <optgroup label="Aus hochgeladenen Dokumenten">
                {fromDocs.map((r) => (
                  <option key={r.id} value={r.id}>{r.id} · {r.title}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Beispieldaten (ohne Originaltext)">
              {samples.map((r) => (
                <option key={r.id} value={r.id}>{r.id} · {r.title}</option>
              ))}
            </optgroup>
          </select>
          <div className="tags">
            <Status value={req.status} />
            <span>Leistung: {req.benefit}</span>
            <Link className="link small" to={`/requirements?req=${req.id}`}>Anforderung prüfen</Link>
          </div>
          <SourceEvidence req={req} compact />
          {fromDocs.length === 0 && (
            <p className="muted small">
              Tipp: Unter <Link to="/documents">Dokumente & Extraktion</Link> eine Spezifikation hochladen – dann entstehen Testfälle mit Quellennachweis.
            </p>
          )}

          <h3 className="spaced">Begründung & Generierung einstellen</h3>
          <div className="field">
            Testtechniken
            <div className="checkrow">
              {TECHNIQUES.map((t) => (
                <label key={t}>
                  <input type="checkbox" checked={draft.techniques.includes(t)} onChange={() => toggleTechnique(t)} /> {t}
                </label>
              ))}
            </div>
          </div>
          <label className="field">
            Max. Testfälle: {draft.maxCases}
            <input type="range" min={1} max={MAX_CASES_LIMIT} value={draft.maxCases} onChange={(e) => set("maxCases", Number(e.target.value))} />
          </label>
          <label className="field">
            Kreativität (Temperatur): {draft.temperature.toFixed(1)}
            <input type="range" min={0} max={1} step={0.1} value={draft.temperature} onChange={(e) => set("temperature", Number(e.target.value))} />
          </label>
          <div className="field">
            Begründungstiefe
            <div className="tabs">
              {(["kurz", "ausführlich"] as const).map((d) => (
                <button key={d} className={draft.reasoningDetail === d ? "selected" : ""} onClick={() => set("reasoningDetail", d)}>
                  {d === "kurz" ? "Kurz (1–3 Schritte)" : "Ausführlich (3–6 Schritte)"}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            Prioritätsfokus
            <select value={draft.priorityFocus} onChange={(e) => set("priorityFocus", e.target.value as GenerationSettings["priorityFocus"])}>
              {PRIORITY_FOCUSES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="checkrow">
            <input type="checkbox" checked={draft.useFeedback} onChange={(e) => set("useFeedback", e.target.checked)} />
            Aus der <Link to="/feedback">Feedback-Datenbank</Link> lernen ({reviewed.length} von {allReviewed.length} bewerteten Fällen, max. {FEEDBACK_EXAMPLES_MAX}, ähnlichste zuerst, plus {notes.length} Hinweis(e))
          </label>

          <div className="actions spaced">
            <button className="primary" disabled={busy || draft.techniques.length === 0} onClick={() => run("model")}>
              <Sparkles size={15} /> {busy ? "Läuft …" : "Mit KI generieren"}
            </button>
            {req.origin ? (
              <button disabled={busy || draft.techniques.length === 0} onClick={() => run("regelbasiert")}
                title="Leitet Testfälle deterministisch aus dem Quellzitat ab – ohne Modellaufruf">
                <Wand2 size={15} /> Regelbasiert ableiten
              </button>
            ) : (
              <button disabled={busy} onClick={() => run("offline-demo")} title="Lädt eine vorbereitete Antwort, um die Oberfläche ohne Modellaufruf zu zeigen">
                <FlaskConical size={15} /> Offline-Demo
              </button>
            )}
          </div>
          {draft.techniques.length === 0 && <p className="errortext">Mindestens eine Technik auswählen.</p>}
          {error && (
            <div className="notice errorbox">
              <b>Generierung fehlgeschlagen</b>
              <p>{error}</p>
            </div>
          )}

          <details className="checks">
            <summary>Exakten Prompt an das Modell anzeigen</summary>
            {messages.map((m, i) => (
              <div key={i}>
                <h5 className="minihead">{m.role.toUpperCase()}</h5>
                <pre className="wrap">{m.content}</pre>
              </div>
            ))}
          </details>
          {rawReply && (
            <details className="checks">
              <summary>Rohantwort des letzten Laufs anzeigen</summary>
              <pre className="wrap">{rawReply}</pre>
            </details>
          )}
        </Panel>

        <Panel>
          <div className="paneltop">
            <h3>Vorschläge für {req.id} · {reqCases.length}</h3>
            <label className="checkrow">
              <input type="checkbox" checked={showReasoning} onChange={(e) => setShowReasoning(e.target.checked)} />
              Begründung anzeigen
            </label>
          </div>
          <div className="legend">
            <span className="basis basis-source">Quelle</span> aus dem Quelltext
            <span className="basis basis-assumption">Annahme</span> vom Prüfer zu bestätigen
            <span className="basis basis-generated">Generiert</span> abgeleitete Testidee
          </div>
          {reqCases.length === 0 && <p className="muted">Noch keine Vorschläge. Einstellungen anpassen und generieren.</p>}
          {reqCases.map((c) => (
            <GeneratedCaseCard key={c.id} item={c} showReasoning={showReasoning} />
          ))}
        </Panel>
      </div>
    </>
  );
}
