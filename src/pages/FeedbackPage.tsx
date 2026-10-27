import { useMemo, useState } from "react";
import { Database, Download, Plus, Search, Trash2 } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Pager } from "../components/Pager";
import { Status } from "../components/Status";
import { COMPARE_FEEDBACK_MAX } from "../config/validation";
import { FEEDBACK_EXAMPLES_MAX } from "../config/ai";
import { collectFeedback } from "../feedback/collect";
import { useReviewStore } from "../state/reviewContext";
import { FEEDBACK_AREAS, FEEDBACK_SCOPES, NOTE_SCOPES } from "../types/feedback";
import type { FeedbackArea, FeedbackEntry, FeedbackScope, NoteScope } from "../types/feedback";
import { download } from "../utils/download";
import { formatDateTime, toCsv } from "../utils/format";
import { useConfirm } from "../state/confirmContext";

/** Rows per page of the feedback table. */
const ROWS_PER_PAGE = 20;

const ACTIVE_FILTERS = ["Alle", "Aktiv", "Inaktiv"] as const;
type ActiveFilter = (typeof ACTIVE_FILTERS)[number];

/** CSS modifier per area tag. */
const AREA_CLASS: Record<FeedbackArea, string> = {
  Testfall: "kind-gen",
  Abgleich: "kind-validation",
  Anforderung: "kind-req",
  Hinweis: "kind-feedback",
};

/** What the scope of an entry means for the prompts, shown as tooltip. */
const SCOPE_HINT: Record<FeedbackScope, string> = {
  Generierung: `Fließt in die Testfall-Generierung ein (bis zu ${FEEDBACK_EXAMPLES_MAX} Fälle, ähnlichste zuerst)`,
  Abgleich: `Fließt in den Abgleich von Ergebnissen ein (bis zu ${COMPARE_FEEDBACK_MAX} Entscheidungen)`,
  Extraktion: "Fließt in die Extraktion von Anforderungen aus demselben Dokument ein",
  Alle: "Fließt in Generierung und Abgleich ein",
};

function exportCsv(rows: FeedbackEntry[]) {
  download(
    "feedback-datenbank.csv",
    toCsv([
      ["ID", "Zeitpunkt", "Bereich", "Bezug", "Anforderung", "Dokument", "Entscheidung", "Kommentar", "Details", "Wirkt auf", "Aktiv"],
      ...rows.map((r) => [r.id, r.timestamp, r.area, r.subjectId, r.requirementId, r.documentName, r.decision, r.comment, r.detail, r.scope, r.active ? "ja" : "nein"]),
    ]),
  );
}

function exportJson(rows: FeedbackEntry[]) {
  download("feedback-datenbank.json", JSON.stringify({ exportedAt: new Date().toISOString(), entries: rows }, null, 2));
}

/** Form for a free maintainer note that is added to every matching prompt. */
function NoteForm() {
  const { addFeedbackNote } = useReviewStore();
  const [scope, setScope] = useState<NoteScope>("Generierung");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  return (
    <div className="noteform">
      <h4>Hinweis hinzufügen</h4>
      <p className="muted small">
        Allgemeine Regel für die Modelle, z. B. „Datumsangaben immer im Format TT.MM.JJJJ“ oder „Kurz-AU ohne Bescheinigung nie als Vorerkrankung werten“.
      </p>
      <div className="filters">
        <label className="field inline">
          Wirkt auf
          <select value={scope} onChange={(e) => setScope(e.target.value as NoteScope)}>
            {NOTE_SCOPES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field inline">
          Erfasst von
          <input className="textinput" value={author} placeholder="Prüfer/in" onChange={(e) => setAuthor(e.target.value)} />
        </label>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Hinweis an die Modelle" />
      <div className="actions">
        <button
          className="primary"
          disabled={!text.trim()}
          onClick={() => {
            addFeedbackNote(scope, text, author);
            setText("");
          }}
        >
          <Plus size={15} /> Hinweis speichern
        </button>
      </div>
    </div>
  );
}

/**
 * Nachweis → Feedback: one table with all feedback of examiners and
 * maintainers (test-case reviews, comparison decisions, requirement comments,
 * free notes). Active entries are fed into later prompts – this is how the
 * models improve (in-context, no training). Entries can be switched off.
 */
export function FeedbackPage() {
  const store = useReviewStore();
  const { setFeedbackActive, removeFeedbackNote } = store;
  const [area, setArea] = useState<FeedbackArea | "Alle">("Alle");
  const [scope, setScope] = useState<FeedbackScope | "Alle Bereiche">("Alle Bereiche");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("Alle");
  const [decision, setDecision] = useState("Alle");
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const entries = useMemo(
    () =>
      collectFeedback({
        cases: store.cases,
        comparisons: store.comparisons,
        requirements: store.requirements,
        notes: store.feedbackNotes,
        excluded: store.feedbackExcluded,
      }),
    [store.cases, store.comparisons, store.requirements, store.feedbackNotes, store.feedbackExcluded],
  );
  const decisions = ["Alle", ...new Set(entries.map((e) => e.decision))];
  const q = query.trim().toLocaleLowerCase("de-DE");
  const filtered = entries
    .filter((e) => area === "Alle" || e.area === area)
    .filter((e) => scope === "Alle Bereiche" || e.scope === scope)
    .filter((e) => activeFilter === "Alle" || e.active === (activeFilter === "Aktiv"))
    .filter((e) => decision === "Alle" || e.decision === decision)
    .filter((e) => !q || [e.id, e.subjectId, e.requirementId, e.documentName, e.comment, e.detail].some((v) => v?.toLocaleLowerCase("de-DE").includes(q)));
  const pageCount = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * ROWS_PER_PAGE, current * ROWS_PER_PAGE);
  const reset = () => setPage(1);

  const count = (a: FeedbackArea) => entries.filter((e) => e.area === a).length;
  const active = entries.filter((e) => e.active).length;
  const accepted = entries.filter((e) => e.area === "Testfall" && e.decision === "Akzeptiert").length;
  const rejected = entries.filter((e) => e.area === "Testfall" && e.decision === "Abgelehnt").length;
  const withComment = entries.filter((e) => e.comment).length;

  return (
    <>
      <Header
        title="Feedback-Datenbank"
        subtitle="Alle Rückmeldungen von Prüfern und Maintainern an einer Stelle: Testfall-Bewertungen, Entscheidungen zu Abgleichen, Kommentare zu Anforderungen und freie Hinweise. Aktive Einträge werden späteren Prompts als Beispiele mitgegeben – so verbessern sich die Modelle, ohne neu trainiert zu werden."
        action={
          <div className="actions">
            <button onClick={() => exportJson(filtered)} disabled={!filtered.length}><Database size={15} /> JSON</button>
            <button className="primary" onClick={() => exportCsv(filtered)} disabled={!filtered.length}><Download size={15} /> CSV exportieren</button>
          </div>
        }
      />
      <div className="metrics">
        {[
          ["Einträge", entries.length, `${active} aktiv · ${withComment} mit Kommentar`],
          ["Testfall-Bewertungen", count("Testfall"), `${accepted} akzeptiert · ${rejected} abgelehnt`],
          ["Abgleich-Entscheidungen", count("Abgleich"), `${count("Anforderung")} Anforderungs-Kommentar(e)`],
          ["Hinweise", count("Hinweis"), "freie Regeln für die Modelle"],
        ].map(([label, n, desc]) => (
          <Panel key={label as string}>
            <small>{label}</small>
            <div className="metric">{n}</div>
            <small>{desc}</small>
          </Panel>
        ))}
      </div>

      <Panel>
        <div className="paneltop">
          <h3>So wirkt das Feedback</h3>
        </div>
        <ul className="plain small">
          <li><b>Generierung:</b> pro Lauf bis zu {FEEDBACK_EXAMPLES_MAX} aktive Testfall-Bewertungen – zuerst zur selben Anforderung, dann zum selben Dokument, dann die neuesten – plus alle aktiven Hinweise für „Generierung“/„Alle“.</li>
          <li><b>Abgleich:</b> die letzten {COMPARE_FEEDBACK_MAX} aktiven Prüferentscheidungen samt Feldkorrekturen plus Hinweise für „Abgleich“/„Alle“.</li>
          <li><b>Extraktion:</b> aktive Kommentare zu Anforderungen desselben Dokuments.</li>
          <li>Ein deaktivierter Eintrag bleibt in der Datenbank, erreicht aber keinen Prompt mehr. Jede Änderung steht im Änderungsprotokoll.</li>
        </ul>
        <NoteForm />
      </Panel>

      <Panel>
        <div className="search wide">
          <Search size={15} />
          <input placeholder="Suche in ID, Bezug, Dokument, Kommentar" value={query} onChange={(e) => { setQuery(e.target.value); reset(); }} />
        </div>
        <div className="filters">
          {(["Alle", ...FEEDBACK_AREAS] as const).map((a) => (
            <button key={a} className={area === a ? "selected" : ""} onClick={() => { setArea(a); reset(); }}>
              {a} · {a === "Alle" ? entries.length : count(a)}
            </button>
          ))}
        </div>
        <div className="filters">
          <label className="field inline">Wirkt auf
            <select value={scope} onChange={(e) => { setScope(e.target.value as FeedbackScope | "Alle Bereiche"); reset(); }}>
              <option>Alle Bereiche</option>
              {FEEDBACK_SCOPES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field inline">Entscheidung
            <select value={decision} onChange={(e) => { setDecision(e.target.value); reset(); }}>
              {decisions.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="field inline">Status
            <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value as ActiveFilter); reset(); }}>
              {ACTIVE_FILTERS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <span className="muted small">{filtered.length} von {entries.length} Einträgen</span>
        </div>

        {filtered.length === 0 ? (
          <p className="muted">
            {entries.length ? "Keine Einträge für diese Filter." : "Noch kein Feedback. Bewerten Sie Testfälle, entscheiden Sie Abgleiche oder fügen Sie oben einen Hinweis hinzu."}
          </p>
        ) : (
          <>
            <div className="tablepanel">
              <table className="feedbacktable">
                <thead>
                  <tr>
                    {["ID", "Zeitpunkt", "Bereich", "Bezug", "Entscheidung", "Kommentar", "Wirkt auf", "Aktiv", ""].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className={e.active ? "" : "inactive"}>
                      <td><code>{e.id}</code></td>
                      <td className="nowrap">{e.timestamp ? formatDateTime(e.timestamp) : "–"}</td>
                      <td><span className={"kind " + AREA_CLASS[e.area]}>{e.area}</span></td>
                      <td>
                        <b>{e.subjectId}</b>
                        <small className="muted block">{e.detail}</small>
                        {(e.requirementId || e.documentName) && (
                          <small className="muted block">{[e.requirementId, e.documentName].filter(Boolean).join(" · ")}</small>
                        )}
                      </td>
                      <td>{e.decision === "Hinweis" || e.decision === "Kommentar" ? <span className="status neutral">{e.decision}</span> : <Status value={e.decision} />}</td>
                      <td className="prewrap">{e.comment || <span className="muted">–</span>}</td>
                      <td title={SCOPE_HINT[e.scope]}>{e.scope}</td>
                      <td>
                        <label className="toggle" title={e.active ? "Fließt in Prompts ein" : "Erreicht keinen Prompt"}>
                          <input type="checkbox" checked={e.active} onChange={(ev) => setFeedbackActive(e.id, ev.target.checked, `${e.area} ${e.subjectId}`)} />
                          {e.active ? "aktiv" : "inaktiv"}
                        </label>
                      </td>
                      <td>
                        {e.area === "Hinweis" && (
                          <button title="Hinweis löschen" onClick={async () => { if (await confirm({ title: "Hinweis löschen?", message: "Der Hinweis wird den Modellen nicht mehr mitgegeben. Der Eintrag im Änderungsprotokoll bleibt.", confirmLabel: "Löschen" })) removeFeedbackNote(e.id); }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={current} pageCount={pageCount} total={filtered.length} onPage={setPage} unit="Einträge" />
          </>
        )}
      </Panel>
    </>
  );
}
