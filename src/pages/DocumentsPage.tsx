import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { FileText, Sparkles, Trash2, Upload } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { GeneratedCaseCard } from "../components/GeneratedCaseCard";
import { AI_MODEL, EXTRACTION_TEMPERATURE } from "../config/ai";
import { ACCEPTED_FILE_TYPES } from "../config/documents";
import { extractRequirements, sectionBatches } from "../ai/extract";
import { versionLabel } from "../documents/ingest";
import type { IngestProgress } from "../documents/ingest";
import { useDocuments } from "../state/documentContext";
import { useReviewStore } from "../state/reviewContext";
import { useGeneration } from "../state/useGeneration";
import { DOC_ROLES } from "../types/document";
import type { DocKind, DocRole, SourceDocument } from "../types/document";
import type { Req } from "../types/requirement";
import { PRIORITIES } from "../types/review";

const KIND_HINT: Record<DocKind, string> = {
  Fachlich: "Rechtliche/fachliche Vorgaben",
  Technisch: "Verfahrens- oder Datensatzbeschreibung",
  Testkonstellation: "Beispielszenario oder Testkonstellation",
};
const ROLE_HINT: Record<DocRole, string> = {
  Spezifikation: "Fachliche Vorgaben – daraus werden Testfälle mit Quellennachweis erzeugt",
  "Technische Informationen": "Technische Beschreibung – daraus werden ebenfalls Testfälle erzeugt",
};
const fmt = (n: number) => n.toLocaleString("de-DE");

function UploadArea() {
  const { addFiles } = useDocuments();
  const [progress, setProgress] = useState<{ name: string; p: IngestProgress } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [hover, setHover] = useState(false);
  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setErrors([]);
    const result = await addFiles([...files], (name, p) => setProgress({ name, p }));
    setProgress(null);
    setErrors(result.errors);
  }
  const onDrop = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); setHover(false); void handle(e.dataTransfer.files); };
  return <>
    <label className={`upload dropzone ${hover ? "hover" : ""}`} onDragOver={(e) => { e.preventDefault(); setHover(true); }} onDragLeave={() => setHover(false)} onDrop={onDrop}>
      <Upload size={26} /><b>Spezifikation hochladen</b>
      <span>{progress ? `${progress.name}: ${progress.p.stage}${progress.p.total ? ` (${progress.p.done}/${progress.p.total})` : ""} …` : "PDF, DOCX, TXT oder MD hierher ziehen oder auswählen · Verarbeitung lokal im Browser"}</span>
      <input type="file" multiple accept={ACCEPTED_FILE_TYPES} disabled={progress !== null} onChange={(e) => { void handle(e.target.files); e.target.value = ""; }} />
    </label>
    {errors.length > 0 && <div className="notice errorbox"><b>Nicht verarbeitet</b><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
  </>;
}

function DocumentCard({ doc, active, caseCount, onSelect }: { doc: SourceDocument; active: boolean; caseCount: number; onSelect: () => void }) {
  const { setRole, removeDocument } = useDocuments();
  return <div className={`doccard ${active ? "chosen" : ""}`}>
    <div className="paneltop">
      <button className="docname" onClick={onSelect}><FileText size={18} /><span><b>{doc.name}</b><small>{doc.format.toUpperCase()}{doc.pageCount ? ` · ${doc.pageCount} Seiten` : ""} · {doc.sections.length} Abschnitte · {fmt(doc.charCount)} Zeichen · {versionLabel(doc)}</small></span></button>
      <div className="badges"><span className={`kindtag kind-${doc.classification.kind}`}>{doc.classification.kind}</span>{caseCount > 0 && <span className="status good">{caseCount} Testfall/Testfälle</span>}</div>
    </div>
    <div className="docmeta">
      <label className="field inline">Rolle<select value={doc.role} onChange={(e) => setRole(doc.id, e.target.value as DocRole)}>{DOC_ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
      <div className="actions"><button className={active ? "primary" : ""} onClick={onSelect}>{active ? "Ausgewählt" : "Bearbeiten"}</button><button title="Dokument entfernen" onClick={() => { if (window.confirm(`„${doc.name}“ entfernen? Bereits erzeugte Testfälle bleiben erhalten.`)) removeDocument(doc.id); }}><Trash2 size={15} /></button></div>
    </div>
    <p className="muted small">Dokumentart automatisch erkannt ({KIND_HINT[doc.classification.kind]}). {ROLE_HINT[doc.role]}.</p>
    {/* Technical running-header notices are intentionally not displayed. */}
    {doc.warnings.length > 0 && <ul className="warnings">{doc.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
  </div>;
}

function Workspace({ doc }: { doc: SourceDocument }) {
  const store = useReviewStore();
  const runGeneration = useGeneration();
  const docReqs = useMemo(() => store.requirements.filter((r) => r.origin?.documentId === doc.id), [store.requirements, doc.id]);
  const ids = useMemo(() => new Set(docReqs.map((r) => r.id)), [docReqs]);
  const docCases = useMemo(() => store.cases.filter((c) => ids.has(c.requirementId)).sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || b.origin.generatedAt.localeCompare(a.origin.generatedAt)), [store.cases, ids]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showReasoning, setShowReasoning] = useState(true);

  async function extractAll(): Promise<Req[]> {
    const extracted: Req[] = [];
    const batches = sectionBatches(doc.sections);
    for (const [index, sections] of batches.entries()) {
      setPhase(`Alle Abschnitte analysieren: Paket ${index + 1}/${batches.length} …`);
      try {
        const run = await extractRequirements({ doc, sections, focus: "", method: "model", model: AI_MODEL, temperature: EXTRACTION_TEMPERATURE, existing: [...docReqs, ...extracted] });
        extracted.push(...run.requirements);
        store.addRequirements(doc.name, run.runId, "model", run.requirements);
      } catch (modelError) {
        setWarnings((x) => [...x, `KI-Extraktion in Paket ${index + 1} fehlgeschlagen: ${(modelError as Error).message}`]);
        try {
          const run = await extractRequirements({ doc, sections, focus: "", method: "regelbasiert", model: AI_MODEL, temperature: EXTRACTION_TEMPERATURE, existing: [...docReqs, ...extracted] });
          extracted.push(...run.requirements);
          store.addRequirements(doc.name, run.runId, "regelbasiert", run.requirements);
        } catch {
          // A batch without a normative requirement is valid; continue with all remaining sections.
        }
      }
    }
    return extracted;
  }

  async function runAnalysis() {
    setBusy(true); setError(""); setWarnings([]);
    try {
      const targets = docReqs.length ? docReqs.filter((r) => r.status !== "Abgelehnt") : await extractAll();
      if (!targets.length) throw new Error("Aus diesem Dokument konnten keine prüfbaren Anforderungen ermittelt werden.");
      for (const [index, req] of targets.entries()) {
        setPhase(`Testfälle erzeugen (${index + 1}/${targets.length}) …`);
        try {
          await runGeneration(req, { ...store.settings, model: AI_MODEL, reasoningDetail: "ausführlich" }, "model");
        } catch (modelError) {
          setWarnings((x) => [...x, `KI-Generierung für ${req.id} fehlgeschlagen: ${(modelError as Error).message}`]);
          await runGeneration(req, { ...store.settings, model: AI_MODEL, reasoningDetail: "ausführlich" }, "regelbasiert");
        }
      }
      setPhase("Fertig.");
    } catch (e) { setError((e as Error).message); setPhase(""); } finally { setBusy(false); }
  }

  return <div className="docworkspace">
    <Panel>
      <div className="paneltop"><h3><span className="stepno">2</span> Testfälle aus der Spezifikation erzeugen</h3><small>Alle {doc.sections.length} Abschnitte</small></div>
      <p className="muted">Die App analysiert automatisch das gesamte Dokument. Anforderungen bleiben ein interner Verarbeitungsschritt; angezeigt werden die daraus erzeugten Testfälle.</p>
      <div className="chips"><span>Alle Abschnitte</span><span>Quelle: {doc.name}</span>{doc.version && <span>{doc.version}</span>}{doc.stand && <span>Stand {doc.stand}</span>}</div>
      <div className="actions"><button className="primary" disabled={busy || !doc.sections.length} onClick={runAnalysis}><Sparkles size={15} /> {busy ? "Analyse läuft …" : docCases.length ? "Weitere Testfälle erzeugen" : "Testfälle erzeugen"}</button></div>
      {phase && <p className="muted small">{phase}</p>}
      {error && <div className="notice errorbox"><b>Analyse fehlgeschlagen</b><p>{error}</p></div>}
      {warnings.length > 0 && <details className="checks"><summary>{warnings.length} Hinweis(e) zur Analyse</summary><ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
    </Panel>
    <Panel>
      <div className="paneltop"><h3>Generierte Testfälle · {docCases.length}</h3><label className="checkrow"><input type="checkbox" checked={showReasoning} onChange={(e) => setShowReasoning(e.target.checked)} /> Begründung anzeigen</label></div>
      <p className="muted small">Jeder Fall enthält Modellbegründung und aufklappbare Backend-Details mit Quellenzitat, Ontologie, Wissensgraph und Regelmodell.</p>
      {!docCases.length ? <p className="muted">Noch keine Testfälle. Starten Sie oben die Analyse.</p> : docCases.map((c) => <GeneratedCaseCard key={c.id} item={c} showReasoning={showReasoning} />)}
    </Panel>
  </div>;
}

export function DocumentsPage() {
  const { documents, ready, storageWarning } = useDocuments();
  const { requirements, cases } = useReviewStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = documents.find((d) => d.id === activeId) ?? documents[documents.length - 1];
  const caseCount = (doc: SourceDocument) => { const ids = new Set(requirements.filter((r) => r.origin?.documentId === doc.id).map((r) => r.id)); return cases.filter((c) => ids.has(c.requirementId)).length; };
  return <>
    <Header title="Dokumente & Testfälle" subtitle="Spezifikation hochladen, alle Abschnitte automatisch analysieren und Testfälle mit Modellbegründung und Quellennachweis erhalten." />
    <div className="chips"><span>1 Hochladen</span><span>2 Testfälle erzeugen</span><span>3 Testfälle prüfen</span><span className="warm">Ergebnisse sind Vorschläge – Prüfer/in entscheidet</span></div>
    {storageWarning && <div className="notice">{storageWarning}</div>}
    <Panel><h3><span className="stepno">1</span> Dokumente</h3><UploadArea />
      {!ready && <p className="muted">Gespeicherte Dokumente werden geladen …</p>}
      {ready && !documents.length && <p className="muted">Noch keine Dokumente.</p>}
      {documents.map((doc) => <DocumentCard key={doc.id} doc={doc} active={active?.id === doc.id} caseCount={caseCount(doc)} onSelect={() => setActiveId(doc.id)} />)}
    </Panel>
    {active && <Workspace key={active.id} doc={active} />}
  </>;
}
