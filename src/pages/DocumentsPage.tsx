import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { FileText, Layers, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { GeneratedCaseCard } from "../components/GeneratedCaseCard";
import { Pager } from "../components/Pager";
import { AI_MODEL, EXTRACTION_TEMPERATURE } from "../config/ai";
import { ACCEPTED_FILE_TYPES, CASES_PER_PAGE } from "../config/documents";
import { extractRequirements, sectionBatches } from "../ai/extract";
import { versionLabel } from "../documents/ingest";
import type { IngestProgress } from "../documents/ingest";
import { useDocuments } from "../state/documentContext";
import { useReviewStore } from "../state/reviewContext";
import { useGeneration } from "../state/useGeneration";
import { DOC_ROLES } from "../types/document";
import type { DocKind, DocRole, SourceDocument } from "../types/document";
import type { Req } from "../types/requirement";
import type { GeneratedTestCase, Priority } from "../types/review";
import { PRIORITIES } from "../types/review";
import { detectRuleChanges } from "../changes/ruleDiff";

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
const REVIEW_FILTERS = ["Alle", "Offen", "Akzeptiert", "Abgelehnt"] as const;
type ReviewFilter = (typeof REVIEW_FILTERS)[number];
type PriorityFilter = "Alle" | Priority;
type CaseSort = "Priorität" | "Offene zuerst";

/**
 * Category for a case whose requirement names no source section. Cases are
 * grouped by their source section (the "Quelle" of the requirement).
 */
const NO_SECTION = "Ohne Abschnittsangabe";

/**
 * One source section with the test cases derived from it. Each section is
 * paginated on its own (at most CASES_PER_PAGE cases per page) and its cases
 * start collapsed.
 */
function SectionGroup({ label, cases, showReasoning }: { label: string; cases: GeneratedTestCase[]; showReasoning: boolean }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(cases.length / CASES_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageCases = cases.slice((currentPage - 1) * CASES_PER_PAGE, currentPage * CASES_PER_PAGE);
  return <section className="casegroup">
    <div className="grouphead">
      <Layers size={16} />
      <h4>{label}</h4>
      <span className="groupcount">{cases.length} Testfall/Testfälle</span>
    </div>
    {pageCases.map((c) => <GeneratedCaseCard key={c.id} item={c} showReasoning={showReasoning} collapsible showStatuses={false} showTitle={false} />)}
    <Pager page={currentPage} pageCount={pageCount} total={cases.length} onPage={setPage} />
  </section>;
}

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

/**
 * Compares the rules of a document with its predecessor version and stores
 * the result (Änderungsprotokoll → Regeln & Spezifikationen).
 */
function useRuleComparison() {
  const store = useReviewStore();
  const { documents } = useDocuments();
  return (doc: SourceDocument, newReqs: Req[]) => {
    const predecessor = documents.find((d) => d.id === doc.predecessorId);
    const oldReqs = predecessor ? store.requirements.filter((r) => r.origin?.documentId === predecessor.id) : [];
    const { run, changes } = detectRuleChanges({ doc, predecessor, newReqs, oldReqs, cases: store.cases });
    store.recordRuleChanges(run, changes);
    return run;
  };
}

function DocumentCard({ doc, active, caseCount, onSelect }: { doc: SourceDocument; active: boolean; caseCount: number; onSelect: () => void }) {
  const { setRole, removeDocument, documents, setPredecessor } = useDocuments();
  const { requirements } = useReviewStore();
  const compare = useRuleComparison();
  const [compareNote, setCompareNote] = useState("");
  const candidates = documents.filter((d) => d.id !== doc.id);
  const ownReqs = requirements.filter((r) => r.origin?.documentId === doc.id);
  const predecessorAnalysed = requirements.some((r) => r.origin?.documentId === doc.predecessorId);
  return <div className={`doccard ${active ? "chosen" : ""}`}>
    <div className="paneltop">
      <button className="docname" onClick={onSelect}><FileText size={18} /><span><b>{doc.name}</b><small>{doc.format.toUpperCase()}{doc.pageCount ? ` · ${doc.pageCount} Seiten` : ""} · {doc.sections.length} Abschnitte · {fmt(doc.charCount)} Zeichen · {versionLabel(doc)}</small></span></button>
      <div className="badges"><span className={`kindtag kind-${doc.classification.kind}`}>{doc.classification.kind}</span>{caseCount > 0 && <span className="status good">{caseCount} Testfall/Testfälle</span>}</div>
    </div>
    <div className="docmeta">
      <label className="field inline">Rolle<select value={doc.role} onChange={(e) => setRole(doc.id, e.target.value as DocRole)}>{DOC_ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="field inline" title="Frühere Version dieser Spezifikation – Grundlage für das Änderungsprotokoll">Vorgängerversion
        <select value={doc.predecessorId ?? ""} onChange={(e) => setPredecessor(doc.id, e.target.value || undefined)}>
          <option value="">keine (Erstfassung)</option>
          {candidates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      {doc.predecessorId && ownReqs.length > 0 && predecessorAnalysed && (
        <button title="Regeln mit der Vorgängerversion vergleichen" onClick={() => {
          const run = compare(doc, ownReqs);
          setCompareNote(`${run.counts.geaendert} geändert · ${run.counts.neu} neu · ${run.counts.entfallen} entfallen – siehe Änderungsprotokoll`);
        }}>Mit Vorgänger vergleichen</button>
      )}
      <div className="actions"><button className={active ? "primary" : ""} onClick={onSelect}>{active ? "Ausgewählt" : "Bearbeiten"}</button><button title="Dokument entfernen" onClick={() => { if (window.confirm(`„${doc.name}“ entfernen? Bereits erzeugte Testfälle bleiben erhalten.`)) removeDocument(doc.id); }}><Trash2 size={15} /></button></div>
    </div>
    <p className="muted small">Dokumentart automatisch erkannt ({KIND_HINT[doc.classification.kind]}). {ROLE_HINT[doc.role]}.</p>
    {compareNote && <p className="status good">{compareNote}</p>}
    {/* Technical running-header notices are intentionally not displayed. */}
    {doc.warnings.length > 0 && <ul className="warnings">{doc.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>}
  </div>;
}

function Workspace({ doc }: { doc: SourceDocument }) {
  const store = useReviewStore();
  const runGeneration = useGeneration();
  const compareRules = useRuleComparison();
  const docReqs = useMemo(() => store.requirements.filter((r) => r.origin?.documentId === doc.id), [store.requirements, doc.id]);
  const ids = useMemo(() => new Set(docReqs.map((r) => r.id)), [docReqs]);
  const docCases = useMemo(
    () => store.cases
      .filter((c) => ids.has(c.requirementId))
      .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || b.origin.generatedAt.localeCompare(a.origin.generatedAt)),
    [store.cases, ids],
  );
  // Source section of every requirement of this document; the cases are grouped and filtered by it.
  const sectionByReq = useMemo(() => new Map(docReqs.map((r) => [r.id, r.origin?.sectionLabel ?? NO_SECTION])), [docReqs]);
  /** One entry per source section, in document order, with the number of cases it produced. */
  const sourceSections = useMemo(() => {
    const orderByReq = new Map(docReqs.map((r, i) => [r.id, i]));
    const byLabel = new Map<string, { label: string; count: number; order: number }>();
    for (const c of docCases) {
      const label = sectionByReq.get(c.requirementId) ?? NO_SECTION;
      const order = orderByReq.get(c.requirementId) ?? Number.MAX_SAFE_INTEGER;
      const entry = byLabel.get(label);
      if (entry) { entry.count += 1; entry.order = Math.min(entry.order, order); }
      else byLabel.set(label, { label, count: 1, order });
    }
    return [...byLabel.values()].sort((a, b) => a.order - b.order);
  }, [docCases, docReqs, sectionByReq]);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showReasoning, setShowReasoning] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("Alle");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("Alle");
  const [caseSort, setCaseSort] = useState<CaseSort>("Priorität");
  /** Writable filter; only the first matching source section is visible. */
  const [sectionQuery, setSectionQuery] = useState("");
  const normalizedQuery = sectionQuery.trim().toLocaleLowerCase("de-DE");
  const activeSection = normalizedQuery
    ? sourceSections.find((s) => s.label.toLocaleLowerCase("de-DE").includes(normalizedQuery))?.label ?? ""
    : sourceSections[0]?.label ?? "";
  const filteredCases = docCases
    .filter((c) => priorityFilter === "Alle" || c.priority === priorityFilter)
    .filter((c) => reviewFilter === "Alle" || c.review.decision === reviewFilter)
    .sort((a, b) => {
      const priorityOrder = PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
      if (caseSort === "Priorität") return priorityOrder || b.origin.generatedAt.localeCompare(a.origin.generatedAt);
      const openOrder = Number(b.review.decision === "Offen") - Number(a.review.decision === "Offen");
      return openOrder || priorityOrder || b.origin.generatedAt.localeCompare(a.origin.generatedAt);
    });
  const activeCases = filteredCases.filter((c) => (sectionByReq.get(c.requirementId) ?? NO_SECTION) === activeSection);
  const hasFilters = Boolean(sectionQuery) || priorityFilter !== "Alle" || reviewFilter !== "Alle" || caseSort !== "Priorität";

  async function extractAll(): Promise<Req[]> {
    const extracted: Req[] = [];
    const batches = sectionBatches(doc.sections);
    for (const [index, sections] of batches.entries()) {
      setPhase(`Alle Abschnitte analysieren: Paket ${index + 1}/${batches.length} …`);
      try {
        const run = await extractRequirements({ doc, sections, focus: "", method: "model", model: AI_MODEL, temperature: EXTRACTION_TEMPERATURE, existing: [...docReqs, ...extracted], feedbackExcluded: store.feedbackExcluded });
        extracted.push(...run.requirements);
        store.addRequirements(doc.name, run.runId, "model", run.requirements);
      } catch (modelError) {
        setWarnings((x) => [...x, `KI-Extraktion in Paket ${index + 1} fehlgeschlagen: ${(modelError as Error).message}`]);
        try {
          const run = await extractRequirements({ doc, sections, focus: "", method: "regelbasiert", model: AI_MODEL, temperature: EXTRACTION_TEMPERATURE, existing: [...docReqs, ...extracted], feedbackExcluded: store.feedbackExcluded });
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
      const fresh = docReqs.length === 0;
      const targets = fresh ? await extractAll() : docReqs.filter((r) => r.status !== "Abgelehnt");
      if (!targets.length) throw new Error("Aus diesem Dokument konnten keine prüfbaren Anforderungen ermittelt werden.");
      // New rules extracted: compare them with the predecessor version (Änderungsprotokoll).
      if (fresh) {
        const run = compareRules(doc, targets);
        if (run.predecessorName) setWarnings((x) => [...x, `Änderungen gegenüber „${run.predecessorName}“: ${run.counts.geaendert} geändert, ${run.counts.neu} neu, ${run.counts.entfallen} entfallen.`]);
      }
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
      <div className="chips"><span>Quelle: {doc.name}</span>{doc.version && <span>{doc.version}</span>}{doc.stand && <span>Stand {doc.stand}</span>}</div>
      <div className="actions"><button className="primary" disabled={busy || !doc.sections.length} onClick={runAnalysis}><Sparkles size={15} /> {busy ? "Analyse läuft …" : docCases.length ? "Weitere Testfälle erzeugen" : "Testfälle erzeugen"}</button></div>
      {phase && <p className="muted small">{phase}</p>}
      {error && <div className="notice errorbox"><b>Analyse fehlgeschlagen</b><p>{error}</p></div>}
      {warnings.length > 0 && <details className="checks"><summary>{warnings.length} Hinweis(e) zur Analyse</summary><ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
    </Panel>
    <Panel>
      <div className="paneltop"><h3>Generierte Testfälle · {docCases.length}</h3><label className="checkrow"><input type="checkbox" checked={showReasoning} onChange={(e) => setShowReasoning(e.target.checked)} /> Begründung anzeigen</label></div>
      <p className="muted small">Es wird jeweils ein Abschnitt der Quelle angezeigt. Ein Klick auf den Kopf klappt einen Testfall auf. Pro Seite erscheinen maximal {CASES_PER_PAGE} Testfälle. Jeder Fall enthält Modellbegründung sowie Quellenzitat, Ontologie, Wissensgraph und Regelmodell.</p>
      {!docCases.length ? <p className="muted">Noch keine Testfälle. Starten Sie oben die Analyse.</p> : <>
        <div className="search wide">
          <Search size={15} />
          <input list="source-sections" placeholder="Abschnitt der Quelle eingeben, z. B. „Inhalt der Leistung“" value={sectionQuery} onChange={(e) => setSectionQuery(e.target.value)} />
          <datalist id="source-sections">{sourceSections.map((s) => <option key={s.label} value={s.label}>{s.count} Testfall/Testfälle</option>)}</datalist>
        </div>
        <div className="filters">
          <label className="field inline">Priorität
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}>
              <option>Alle</option>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label className="field inline">Prüfstatus
            <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value as ReviewFilter)}>
              {REVIEW_FILTERS.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="field inline">Sortierung
            <select value={caseSort} onChange={(e) => setCaseSort(e.target.value as CaseSort)}>
              <option>Priorität</option>
              <option>Offene zuerst</option>
            </select>
          </label>
        </div>
        <div className="docmeta">
          <span className="muted small">{sourceSections.length} Abschnitt(e) der Quelle · {filteredCases.length} von {docCases.length} Testfall/Testfällen</span>
          {hasFilters && <button onClick={() => { setSectionQuery(""); setPriorityFilter("Alle"); setReviewFilter("Alle"); setCaseSort("Priorität"); }}>Filter zurücksetzen</button>}
        </div>
        {activeSection && activeCases.length > 0
          ? <div className="casegroups"><SectionGroup key={activeSection} label={activeSection} cases={activeCases} showReasoning={showReasoning} /></div>
          : <p className="muted">Keine Testfälle entsprechen den gewählten Filtern{sectionQuery ? ` im Abschnitt „${sectionQuery}“` : ""}.</p>}
      </>}
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
