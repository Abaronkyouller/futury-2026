import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Link } from "react-router-dom";
import { FileText, ListChecks, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";
import { SourceEvidence } from "../components/SourceEvidence";
import { AI_MODELS, EXTRACTION_TEMPERATURE } from "../config/ai";
import {
  ACCEPTED_FILE_TYPES,
  EXTRACTION_CHAR_BUDGET,
  FOCUS_SUGGESTIONS,
  NORMATIVE_CAP,
  NORMATIVE_WEIGHT,
  RANKED_SECTIONS_SHOWN,
} from "../config/documents";
import { extractRequirements, sectionsWithinBudget } from "../ai/extract";
import { sectionLabel, versionLabel } from "../documents/ingest";
import type { IngestProgress } from "../documents/ingest";
import { rankSections } from "../documents/rank";
import { countNormative } from "../documents/ruleExtract";
import { useDocuments } from "../state/documentContext";
import { useReviewStore } from "../state/reviewContext";
import { useGeneration } from "../state/useGeneration";
import { DOC_KINDS, DOC_ROLES } from "../types/document";
import type { DocKind, DocRole, SourceDocument } from "../types/document";
import type { ExtractionMethod } from "../types/requirement";
import type { OriginKind } from "../types/review";

/** Short explanation per document kind (brainstorm bonus idea: government vs. technical document). */
const KIND_HINT: Record<DocKind, string> = {
  Fachlich: "Rechtliche/fachliche Vorgaben (Gesetz, Rundschreiben, Grundsätze)",
  Technisch: "Verfahrens- oder Datensatzbeschreibung (Datenbausteine, Felder, Abgabegründe)",
  Testkonstellation: "Beispielszenario oder Testkonstellation",
};

const ROLE_HINT: Record<DocRole, string> = {
  Spezifikation: "Anforderungen werden daraus extrahiert",
  Formatbeispiel: "Wird dem Modell nur als Strukturbeispiel für Testfälle gezeigt – Werte gelten nicht als Fakten",
};

/** Number formatting for character counts. */
const fmt = (n: number) => n.toLocaleString("de-DE");

/** Upload area with drag & drop; reads files locally in the browser. */
function UploadArea() {
  const { addFiles } = useDocuments();
  const [progress, setProgress] = useState<{ name: string; p: IngestProgress } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [hover, setHover] = useState(false);

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErrors([]);
    const result = await addFiles([...files], (name, p) => setProgress({ name, p }));
    setProgress(null);
    setErrors(result.errors);
  }

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setHover(false);
    void handle(e.dataTransfer.files);
  };

  return (
    <>
      <label
        className={"upload dropzone " + (hover ? "hover" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
      >
        <Upload size={26} />
        <b>Spezifikationen hochladen</b>
        <span>
          {progress
            ? `${progress.name}: ${progress.p.stage}${progress.p.total ? ` (${progress.p.done}/${progress.p.total})` : ""} …`
            : "PDF, DOCX, TXT oder MD hierher ziehen oder auswählen · Verarbeitung lokal im Browser"}
        </span>
        <input
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          disabled={progress !== null}
          onChange={(e) => {
            void handle(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {errors.length > 0 && (
        <div className="notice errorbox">
          <b>Nicht verarbeitet</b>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** One uploaded document with classification, role and actions. */
function DocumentCard({
  doc,
  active,
  reqCount,
  onSelect,
}: {
  doc: SourceDocument;
  active: boolean;
  reqCount: number;
  onSelect: () => void;
}) {
  const { setKind, setRole, removeDocument } = useDocuments();
  const c = doc.classification;
  return (
    <div className={"doccard " + (active ? "chosen" : "")}>
      <div className="paneltop">
        <button className="docname" onClick={onSelect} title="Dokument bearbeiten">
          <FileText size={18} />
          <span>
            <b>{doc.name}</b>
            <small>
              {doc.format.toUpperCase()}
              {doc.pageCount ? ` · ${doc.pageCount} Seiten` : ""} · {doc.sections.length} Abschnitte · {fmt(doc.charCount)} Zeichen ·{" "}
              {versionLabel(doc)}
            </small>
          </span>
        </button>
        <div className="badges">
          <span className={"kindtag kind-" + c.kind}>{c.kind}</span>
          {reqCount > 0 && <span className="status good">{reqCount} Anforderung(en)</span>}
        </div>
      </div>
      <div className="docmeta">
        <label className="field inline">
          Dokumentart
          <select value={c.kind} onChange={(e) => setKind(doc.id, e.target.value as DocKind)} title={KIND_HINT[c.kind]}>
            {DOC_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="field inline">
          Rolle
          <select value={doc.role} onChange={(e) => setRole(doc.id, e.target.value as DocRole)} title={ROLE_HINT[doc.role]}>
            {DOC_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button className={active ? "primary" : ""} onClick={onSelect}>
            <ListChecks size={15} /> {active ? "Ausgewählt" : "Bearbeiten"}
          </button>
          <button
            onClick={() => {
              if (window.confirm(`„${doc.name}“ entfernen? Bereits extrahierte Anforderungen bleiben mit Zitat erhalten.`)) removeDocument(doc.id);
            }}
            title="Dokument entfernen"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <p className="muted small">
        {c.overridden ? "Dokumentart manuell gesetzt. " : `Automatisch erkannt (${KIND_HINT[c.kind]}). Merkmale: ${c.evidence.join(", ") || "–"}. `}
        {ROLE_HINT[doc.role]}.
      </p>
      {doc.warnings.length > 0 && (
        <ul className="warnings">
          {doc.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

type BatchState = { id: string; status: "wartet" | "läuft" | "fertig" | "Fehler"; message?: string };

/** Section search, requirement extraction and test generation for one document. */
function Workspace({ doc }: { doc: SourceDocument }) {
  const store = useReviewStore();
  const runGeneration = useGeneration();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);
  const [method, setMethod] = useState<ExtractionMethod>("model");
  const [model, setModel] = useState(store.settings.model);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rawReply, setRawReply] = useState("");
  const [genSelection, setGenSelection] = useState<Set<string>>(new Set());
  const [genKind, setGenKind] = useState<OriginKind>("model");
  const [batch, setBatch] = useState<BatchState[]>([]);

  const ranked = useMemo(() => rankSections(doc.sections, query), [doc.sections, query]);
  /** Normative sentences per section ("muss", "darf … nur", …), computed once per document. */
  const normative = useMemo(() => new Map(doc.sections.map((s) => [s.id, countNormative(s)])), [doc.sections]);
  const visible = showAll ? ranked : ranked.slice(0, RANKED_SECTIONS_SHOWN);
  const chosen = doc.sections.filter((s) => selected.has(s.id));
  const chosenChars = chosen.reduce((n, s) => n + s.text.length, 0);
  const sentToModel = sectionsWithinBudget(chosen);
  const docReqs = store.requirements.filter((r) => r.origin?.documentId === doc.id);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  /**
   * Selects the best sections that fit into the model budget: search relevance
   * weighted by the number of normative sentences, so rule-bearing parts win ties.
   */
  function selectTop() {
    const weight = (id: string) => 1 + NORMATIVE_WEIGHT * Math.min(normative.get(id) ?? 0, NORMATIVE_CAP);
    const hits = ranked
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score * weight(b.section.id) - a.score * weight(a.section.id))
      .map((r) => r.section);
    setSelected(new Set(sectionsWithinBudget(hits).map((s) => s.id)));
  }

  async function extract() {
    setBusy(true);
    setError("");
    try {
      const run = await extractRequirements({
        doc,
        sections: chosen,
        focus: query,
        method,
        model,
        temperature: EXTRACTION_TEMPERATURE,
        existing: docReqs,
      });
      setRawReply(run.rawReply);
      store.addRequirements(doc.name, run.runId, method, run.requirements);
      setGenSelection(new Set(run.requirements.map((r) => r.id)));
      if (run.dropped.length) setError(`Verworfen: ${run.dropped.join("; ")}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const targets = docReqs.filter((r) => genSelection.has(r.id));
    setBatch(targets.map((r) => ({ id: r.id, status: "wartet" })));
    setBusy(true);
    for (const req of targets) {
      setBatch((b) => b.map((x) => (x.id === req.id ? { ...x, status: "läuft" } : x)));
      try {
        const run = await runGeneration(req, { ...store.settings, model }, genKind);
        setBatch((b) => b.map((x) => (x.id === req.id ? { ...x, status: "fertig", message: `${run.cases.length} Testfall/Testfälle` } : x)));
      } catch (e) {
        setBatch((b) => b.map((x) => (x.id === req.id ? { ...x, status: "Fehler", message: (e as Error).message } : x)));
      }
    }
    setBusy(false);
  }

  return (
    <div className="docwork">
      <Panel>
        <div className="paneltop">
          <h3>
            <span className="stepno">2</span> Relevante Abschnitte finden
          </h3>
          <small>{doc.sections.length} Abschnitte</small>
        </div>
        <div className="search wide">
          <input
            placeholder="Suchbegriffe, z. B. Vorerkrankung DBVO Abgabegrund 41"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="chips tight">
          {FOCUS_SUGGESTIONS.map((s) => (
            <button key={s} className="chipbtn" onClick={() => setQuery(s)}>{s}</button>
          ))}
        </div>
        <div className="actions">
          <button onClick={selectTop} disabled={!query.trim()} title="Relevanz × Anzahl normativer Sätze, bis das Zeichenbudget erreicht ist">
            Top-Treffer auswählen
          </button>
          <button onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Auswahl leeren</button>
          <small className={chosenChars > EXTRACTION_CHAR_BUDGET ? "errortext" : "muted"}>
            {selected.size} ausgewählt · {fmt(chosenChars)} / {fmt(EXTRACTION_CHAR_BUDGET)} Zeichen
            {chosenChars > EXTRACTION_CHAR_BUDGET && method === "model" ? ` – an die KI gehen nur die ersten ${sentToModel.length}` : ""}
          </small>
        </div>
        <ul className="sectionlist">
          {visible.map(({ section: s, score, matched }) => (
            <li key={s.id} className={selected.has(s.id) ? "picked" : ""}>
              <label>
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => setSelected((x) => toggle(x, s.id))} />
                <span>
                  <b>{sectionLabel(s)}</b>
                  <small className="muted">
                    {s.id} · {fmt(s.text.length)} Zeichen · {normative.get(s.id) ?? 0} normative Sätze
                    {query.trim() && ` · Relevanz ${score}`}
                    {matched.length > 0 && ` · ${matched.map((m) => `${m.term} ×${m.count}`).join(", ")}`}
                  </small>
                </span>
              </label>
              <button className="link" onClick={() => setPreview(preview === s.id ? null : s.id)}>
                {preview === s.id ? "Text ausblenden" : "Text"}
              </button>
              {preview === s.id && <div className="sourcetext">{s.text}</div>}
            </li>
          ))}
        </ul>
        {ranked.length > RANKED_SECTIONS_SHOWN && (
          <button className="link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Weniger anzeigen" : `Alle ${ranked.length} Abschnitte anzeigen`}
          </button>
        )}
      </Panel>

      <Panel>
        <h3>
          <span className="stepno">3</span> Anforderungen extrahieren
        </h3>
        <div className="tabs">
          <button className={method === "model" ? "selected" : ""} onClick={() => setMethod("model")}>
            <Sparkles size={14} /> Mit KI
          </button>
          <button className={method === "regelbasiert" ? "selected" : ""} onClick={() => setMethod("regelbasiert")}>
            <Wand2 size={14} /> Regelbasiert (ohne KI)
          </button>
        </div>
        <p className="muted small">
          {method === "model"
            ? "Das Modell liest die ausgewählten Abschnitte und liefert Anforderungen mit wörtlichem Zitat. Jedes Zitat wird anschließend deterministisch im Abschnitt gesucht."
            : "Normative Sätze („muss“, „darf … nur“, „ist … zu übermitteln“ …) werden wörtlich übernommen. Keine Umformulierung, kein Modellaufruf."}
        </p>
        {method === "model" && (
          <label className="field">
            Modell
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
        )}
        <div className="actions">
          <button className="primary" disabled={busy || selected.size === 0} onClick={extract}>
            <ListChecks size={15} /> {busy ? "Läuft …" : `Aus ${selected.size} Abschnitt(en) extrahieren`}
          </button>
        </div>
        {selected.size === 0 && <p className="muted small">Wählen Sie links mindestens einen Abschnitt aus.</p>}
        {error && (
          <div className="notice errorbox">
            <b>Hinweis</b>
            <p>{error}</p>
          </div>
        )}
        {rawReply && (
          <details className="checks">
            <summary>Rohantwort der letzten Extraktion</summary>
            <pre className="wrap">{rawReply}</pre>
          </details>
        )}

        <h3 className="spaced">
          <span className="stepno">4</span> Testfälle erzeugen
        </h3>
        {docReqs.length === 0 ? (
          <p className="muted">Noch keine Anforderungen aus diesem Dokument.</p>
        ) : (
          <>
            <div className="actions">
              <button onClick={() => setGenSelection(new Set(docReqs.filter((r) => r.status !== "Abgelehnt").map((r) => r.id)))}>
                Alle nicht abgelehnten
              </button>
              <button onClick={() => setGenSelection(new Set())}>Keine</button>
            </div>
            <ul className="reqpicklist">
              {[...docReqs].reverse().map((r) => (
                <li key={r.id}>
                  <label>
                    <input type="checkbox" checked={genSelection.has(r.id)} onChange={() => setGenSelection((x) => toggle(x, r.id))} />
                    <span>
                      <span className="reqhead">
                        <code>{r.id}</code> <Status value={r.status} /> <b>{r.title}</b>
                      </span>
                      <SourceEvidence req={r} compact />
                    </span>
                  </label>
                  <Link className="link small" to={`/requirements?req=${r.id}`}>Prüfen</Link>
                </li>
              ))}
            </ul>
            <div className="tabs">
              <button className={genKind === "model" ? "selected" : ""} onClick={() => setGenKind("model")}>
                <Sparkles size={14} /> Mit KI
              </button>
              <button className={genKind === "regelbasiert" ? "selected" : ""} onClick={() => setGenKind("regelbasiert")}>
                <Wand2 size={14} /> Regelbasiert (ohne KI)
              </button>
            </div>
            <p className="muted small">
              Einstellungen aus dem <Link to="/generate">Generator</Link>: max. {store.settings.maxCases} Testfälle je Anforderung, Techniken{" "}
              {store.settings.techniques.join(", ")}.{" "}
              {genKind === "regelbasiert"
                ? "Regelbasiert: aus „darf nur …, wenn …“ werden Regelfall, Negativtests je Bedingung und Grenzwerte abgeleitet."
                : "Formatbeispiele (Rolle „Formatbeispiel“) werden als Strukturvorlage mitgegeben."}
            </p>
            <div className="actions">
              <button className="primary" disabled={busy || genSelection.size === 0} onClick={generate}>
                <Sparkles size={15} /> {busy ? "Läuft …" : `Testfälle für ${genSelection.size} Anforderung(en) erzeugen`}
              </button>
            </div>
            {batch.length > 0 && (
              <ul className="batch">
                {batch.map((b) => (
                  <li key={b.id} className={"batch-" + b.status}>
                    <code>{b.id}</code> {b.status}
                    {b.message && ` – ${b.message}`}
                    {b.status === "fertig" && (
                      <Link className="link" to={`/generate?req=${b.id}`}>ansehen & prüfen</Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

/**
 * H1–H3 from an uploaded document: upload -> classify -> find relevant
 * sections -> extract requirements with verified quotes -> generate test cases.
 */
export function DocumentsPage() {
  const { documents, ready, storageWarning } = useDocuments();
  const { requirements } = useReviewStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = documents.find((d) => d.id === activeId) ?? documents[documents.length - 1];

  return (
    <>
      <Header
        title="Dokumente & Extraktion"
        subtitle="Spezifikationen hochladen, relevante Abschnitte finden, Anforderungen mit Quellennachweis extrahieren und daraus Testfälle erzeugen. Die Texterkennung läuft lokal im Browser; an das Modell gehen nur die ausgewählten Abschnitte."
      />
      <div className="chips">
        <span>1 Hochladen</span>
        <span>2 Abschnitte finden</span>
        <span>3 Anforderungen extrahieren</span>
        <span>4 Testfälle erzeugen</span>
        <span className="warm">Ergebnisse sind Vorschläge – Prüfer/in entscheidet</span>
      </div>
      {storageWarning && <div className="notice">{storageWarning}</div>}
      <Panel>
        <h3>
          <span className="stepno">1</span> Dokumente
        </h3>
        <UploadArea />
        {!ready && <p className="muted">Gespeicherte Dokumente werden geladen …</p>}
        {ready && documents.length === 0 && (
          <p className="muted">
            Noch keine Dokumente. Beispiele: Verfahrensbeschreibung DTA EEL (technisch), Gemeinsames Rundschreiben (fachlich),
            DBVO-Beispiel oder Hinweise zur Testkonstellation (Formatbeispiel).
          </p>
        )}
        {documents.map((d) => (
          <DocumentCard
            key={d.id}
            doc={d}
            active={active?.id === d.id}
            reqCount={requirements.filter((r) => r.origin?.documentId === d.id).length}
            onSelect={() => setActiveId(d.id)}
          />
        ))}
      </Panel>
      {active && <Workspace key={active.id} doc={active} />}
    </>
  );
}
