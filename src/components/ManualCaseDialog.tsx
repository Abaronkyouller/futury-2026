import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Req } from "../types/requirement";
import type { ExpectedField, GeneratedTestCase, Priority, TestStep } from "../types/review";
import { PRIORITIES, TECHNIQUES } from "../types/review";
import { useReviewStore } from "../state/reviewContext";
import { runChecks } from "../ai/validate";
import type { RawCase } from "../ai/parse";
import { buildCaseTrace } from "../reasoning/trace";
import { truncate } from "../documents/text";

const pad = (n: number) => String(n).padStart(2, "0");
/** Current time; only called from the save handler. */
const currentTime = () => new Date();
/** YYYYMMDDHHMMSS of the local time, used in the id of manual cases. */
function stamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

type Row = { field: string; value: string };
const emptyRow = (): Row => ({ field: "", value: "" });
const emptyStep = (): TestStep => ({ actor: "Arbeitgeber", action: "", abgabegrund: "" });
const filled = (rows: Row[]): ExpectedField[] => rows.map((r) => ({ field: r.field.trim(), value: r.value.trim() })).filter((r) => r.field || r.value);
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Editable list of field/value rows (test data, expected results). */
function RowsEditor({ rows, onChange, fieldLabel, valueLabel, addLabel }: { rows: Row[]; onChange: (rows: Row[]) => void; fieldLabel: string; valueLabel: string; addLabel: string }) {
  return (
    <div className="mcrows">
      {rows.map((r, i) => (
        <div className="mcrow" key={i}>
          <input placeholder={fieldLabel} aria-label={`${fieldLabel} ${i + 1}`} value={r.field} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} />
          <input placeholder={valueLabel} aria-label={`${valueLabel} ${i + 1}`} value={r.value} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <button type="button" className="cellbtn" aria-label={`Zeile ${i + 1} löschen`} onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" className="mcadd" onClick={() => onChange([...rows, emptyRow()])}><Plus size={14} /> {addLabel}</button>
    </div>
  );
}

/**
 * Dialog to create a test case by hand. The case is stored like a generated
 * one but with origin "manuell" (examiner input, not derived from the source),
 * so it stays distinguishable from model and rule-based proposals. The same
 * structural checks as for generated cases run on it.
 */
export function ManualCaseDialog({ requirements, onClose, onCreated }: {
  requirements: Req[];
  onClose: () => void;
  onCreated: (caseId: string) => void;
}) {
  const { addRun, settings } = useReviewStore();
  const ref = useRef<HTMLDialogElement>(null);
  const reqs = [...requirements].sort((a, b) => Number(Boolean(b.origin)) - Number(Boolean(a.origin)));
  const [reqId, setReqId] = useState(reqs[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [technique, setTechnique] = useState<string>(TECHNIQUES[0]);
  const [priority, setPriority] = useState<Priority>("Mittel");
  const [given, setGiven] = useState("");
  const [when, setWhen] = useState("");
  const [then, setThen] = useState("");
  const [testData, setTestData] = useState<Row[]>([emptyRow()]);
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [expected, setExpected] = useState<Row[]>([emptyRow()]);
  const [criteria, setCriteria] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [questions, setQuestions] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const req = reqs.find((r) => r.id === reqId);
  const save = () => {
    const problems = [
      !req && "Bitte eine Anforderung wählen.",
      !title.trim() && "Bitte einen Titel eingeben.",
      !then.trim() && filled(expected).length === 0 && "Bitte „Dann“ oder mindestens ein erwartetes Ergebnis angeben.",
    ].filter((p): p is string => Boolean(p));
    setErrors(problems);
    if (problems.length || !req) return;

    const now = currentTime();
    const ts = stamp(now);
    const reqNo = req.id.split("-").pop();
    const id = `MAN-${reqNo}-${ts}`;
    const ref0 = req.origin ? `${req.origin.documentName} · ${req.origin.sectionLabel}` : req.source;
    const raw: RawCase = {
      title: title.trim(),
      technique,
      given: given.trim(),
      when: when.trim(),
      then: then.trim(),
      testData: filled(testData),
      steps: steps.map((s) => ({ actor: s.actor.trim(), action: s.action.trim(), abgabegrund: s.abgabegrund?.trim() || undefined })).filter((s) => s.action),
      expectedFields: filled(expected),
      criteriaIds: criteria.split(/[,;\s]+/).map((c) => c.trim()).filter(Boolean),
      priority,
      priorityReason: "Vom Prüfer festgelegt",
      // The examiner's own justification; marked as derived, not as a source quote.
      reasoning: lines(reasoning).map((text) => ({ text, basis: "Generiert" as const, sourceRef: ref0 })),
      sourceRefs: [ref0],
      openQuestions: lines(questions),
    };
    const origin = { kind: "manuell" as const, model: "Prüfer/in", runId: `MAN-${ts}`, generatedAt: now.toISOString() };
    const testCase: GeneratedTestCase = {
      ...raw,
      priority,
      id,
      requirementId: req.id,
      checks: runChecks(raw, req, settings),
      trace: buildCaseTrace(req, raw, origin, id),
      origin,
      review: { decision: "Offen", comment: "" },
      execution: "Nicht ausgeführt",
    };
    addRun(req.id, origin.runId, [testCase]);
    onCreated(id);
  };

  return (
    <dialog
      ref={ref}
      className="confirmdialog casedialog"
      aria-labelledby="mc-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
      <div className="casebox">
        <div className="caseboxhead">
          <h3 id="mc-title">Testfall manuell anlegen</h3>
          <button type="button" className="cellbtn" aria-label="Schließen" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="muted small">Der Testfall wird als „Manuell erstellt (Prüfer)“ gekennzeichnet und durchläuft dieselben Strukturprüfungen wie erzeugte Testfälle. Pflichtfelder sind mit * markiert.</p>

        <div className="mcgrid">
          <label className="field mcwide">Anforderung *
            <select value={reqId} onChange={(e) => setReqId(e.target.value)}>
              {reqs.map((r) => <option key={r.id} value={r.id}>{r.id} · {truncate(r.title, 90)}{r.origin ? "" : " (Beispieldaten)"}</option>)}
            </select>
          </label>
          {req && <p className="muted small mcwide mcsource">Quelle: {req.origin ? `${req.origin.documentName} · ${req.origin.sectionLabel}` : req.source}</p>}
          <label className="field mcwide">Titel *
            <input value={title} placeholder="z. B. Grenzwert 42 Tage: genau 42 Tage" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">Technik
            <select value={technique} onChange={(e) => setTechnique(e.target.value)}>
              {TECHNIQUES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">Priorität
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="field mcwide">Gegeben
            <textarea value={given} placeholder="Ausgangslage, z. B. AU seit 01.09.2026, Vorerkrankungen 30 Tage" onChange={(e) => setGiven(e.target.value)} />
          </label>
          <label className="field mcwide">Wenn
            <textarea value={when} placeholder="Auslöser, z. B. Der Arbeitgeber erstellt die Meldung" onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="field mcwide">Dann
            <textarea value={then} placeholder="Erwartetes Verhalten, z. B. Die Meldung mit Abgabegrund 41 wird erzeugt" onChange={(e) => setThen(e.target.value)} />
          </label>
        </div>

        <h4>Testdaten</h4>
        <RowsEditor rows={testData} onChange={setTestData} fieldLabel="Feld" valueLabel="Wert" addLabel="Testdatum hinzufügen" />

        <h4>Ablauf / Nachrichtenfolge</h4>
        <div className="mcrows">
          {steps.map((s, i) => (
            <div className="mcrow mcstep" key={i}>
              <input placeholder="Akteur" aria-label={`Akteur Schritt ${i + 1}`} value={s.actor} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, actor: e.target.value } : x)))} />
              <input placeholder="Aktion" aria-label={`Aktion Schritt ${i + 1}`} value={s.action} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, action: e.target.value } : x)))} />
              <input placeholder="Abgabegrund" aria-label={`Abgabegrund Schritt ${i + 1}`} value={s.abgabegrund ?? ""} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, abgabegrund: e.target.value } : x)))} />
              <button type="button" className="cellbtn" aria-label={`Schritt ${i + 1} löschen`} onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="mcadd" onClick={() => setSteps([...steps, emptyStep()])}><Plus size={14} /> Schritt hinzufügen</button>
        </div>

        <h4>Erwartetes Ergebnis *</h4>
        <RowsEditor rows={expected} onChange={setExpected} fieldLabel="Feld, z. B. Meldung wird erzeugt" valueLabel="Erwarteter Wert, z. B. ja" addLabel="Erwartetes Ergebnis hinzufügen" />

        <div className="mcgrid">
          <label className="field mcwide">Kriterium-IDs (optional, mit Komma getrennt)
            <input value={criteria} placeholder="z. B. 9c8c9b58-4d0f-4066-98ac-973095418d63" onChange={(e) => setCriteria(e.target.value)} />
          </label>
          <label className="field mcwide">Begründung (optional, eine Zeile je Schritt)
            <textarea value={reasoning} placeholder="Warum dieser Testfall? z. B. Grenzwert aus Abschnitt 2.2" onChange={(e) => setReasoning(e.target.value)} />
          </label>
          <label className="field mcwide">Offene Fragen (optional, eine je Zeile)
            <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} />
          </label>
        </div>

        {errors.length > 0 && <ul className="warnlist">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="confirmactions">
          <button type="button" onClick={onClose}>Abbrechen</button>
          <button type="button" className="primary" onClick={save}><Plus size={15} /> Testfall anlegen</button>
        </div>
      </div>
    </dialog>
  );
}
