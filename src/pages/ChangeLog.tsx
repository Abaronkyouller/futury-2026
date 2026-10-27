import { Fragment, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileDiff, FlaskConical, Search, Trash2 } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Pager } from "../components/Pager";
import { useReviewStore } from "../state/reviewContext";
import { buildCaseHistory, CASE_CHANGE_KINDS } from "../changes/caseHistory";
import type { CaseChangeKind } from "../changes/caseHistory";
import { wordDiff } from "../changes/ruleDiff";
import { RULE_CHANGE_KINDS } from "../types/ruleChange";
import { SAMPLE_RULE_CHANGES, SAMPLE_RULE_RUNS } from "../data/ruleChanges";
import type { RuleChange, RuleChangeKind } from "../types/ruleChange";
import { download } from "../utils/download";
import { formatDateTime, toCsv } from "../utils/format";
import { useConfirm } from "../state/confirmContext";

/** Rows per page in both tables. */
const ROWS_PER_PAGE = 15;

type View = "regeln" | "testfaelle";

/** CSS modifier per rule change kind. */
const RULE_CLASS: Record<RuleChangeKind, string> = { Neu: "good", Geändert: "warn", Entfallen: "bad" };

/** CSS modifier per test-case change kind (reuses the change-log tag colours). */
const CASE_CLASS: Record<CaseChangeKind, string> = {
  Erzeugt: "kind-gen",
  "Neu erzeugt aus Feedback": "kind-gen",
  Bewertet: "kind-review",
  "Feedback eingereicht": "kind-feedback",
  "Feedback geschaltet": "kind-feedback",
  Abgeglichen: "kind-validation",
  "Regel geändert – prüfen": "kind-rulechange",
  Zurückgesetzt: "kind-reset",
};

/** Word-level before/after view of a changed rule. */
function QuoteDiff({ change }: { change: RuleChange }) {
  if (change.before && change.after) {
    return (
      <div className="quotediff">
        {wordDiff(change.before.quote, change.after.quote).map((p, i) =>
          p.op === "same" ? <span key={i}>{p.text}</span> : p.op === "del" ? <del key={i}>{p.text}</del> : <ins key={i}>{p.text}</ins>,
        )}
      </div>
    );
  }
  const only = change.after ?? change.before;
  return <div className={"quotediff " + (change.after ? "allnew" : "allgone")}>{only?.quote}</div>;
}

/** Option 1: how rules/specifications changed between document versions. */
function RuleView() {
  const store = useReviewStore();
  // Illustrative history (fictional demo specs) shown next to real detections; switchable.
  const [showSamples, setShowSamples] = useState(true);
  const ruleChanges = showSamples ? [...SAMPLE_RULE_CHANGES, ...store.ruleChanges] : store.ruleChanges;
  const ruleChangeRuns = (showSamples ? [...SAMPLE_RULE_RUNS, ...store.ruleChangeRuns] : store.ruleChangeRuns)
    .slice()
    .sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));
  const [kind, setKind] = useState<RuleChangeKind | "Alle">("Alle");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLocaleLowerCase("de-DE");
  const rows = [...ruleChanges]
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
    .filter((c) => kind === "Alle" || c.kind === kind)
    .filter((c) => !q || [c.rule, c.before?.quote, c.after?.quote, c.before?.documentName, c.after?.documentName, ...c.differences].some((v) => v?.toLocaleLowerCase("de-DE").includes(q)));
  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const current = Math.min(page, pageCount);
  const shown = rows.slice((current - 1) * ROWS_PER_PAGE, current * ROWS_PER_PAGE);

  const exportCsv = () =>
    download(
      "regelaenderungen.csv",
      toCsv([
        ["Zeitpunkt", "Art", "Regel", "Kriterium", "Unterschiede", "Vorher Dokument", "Vorher Version", "Vorher Abschnitt", "Vorher Text", "Nachher Dokument", "Nachher Version", "Nachher Abschnitt", "Nachher Text", "Zuordnung", "Ähnlichkeit", "Betroffene Testfälle"],
        ...rows.map((c) => [
          c.detectedAt, c.kind, c.rule, c.criterionId, c.differences.join("; "),
          c.before?.documentName, c.before?.documentVersion, c.before?.sectionLabel, c.before?.quote,
          c.after?.documentName, c.after?.documentVersion, c.after?.sectionLabel, c.after?.quote,
          c.matchedBy, c.similarity === undefined ? "" : String(c.similarity), c.affectedCaseIds.join(", "),
        ]),
      ]),
    );

  return (
    <>
      <Panel>
        <div className="paneltop">
          <h3>Versionsvergleiche</h3>
          <label className="checkrow" title="Fiktive Demo-Spezifikationen zur Veranschaulichung – keine echten Änderungen der DTA EEL">
            <input type="checkbox" checked={showSamples} onChange={(e) => { setShowSamples(e.target.checked); setPage(1); }} />
            Beispieldaten anzeigen ({SAMPLE_RULE_RUNS.length} Vergleiche, {SAMPLE_RULE_CHANGES.length} Änderungen)
          </label>
        </div>
        <p className="muted small">
          Wird automatisch ausgeführt, wenn ein Dokument mit Vorgängerversion analysiert wird.
        </p>
        {ruleChangeRuns.length === 0 ? (
          <p className="muted">
            Noch kein Vergleich. Laden Sie unter „Dokumente & Testfälle“ zuerst die ältere Version einer Spezifikation hoch und analysieren Sie sie, danach die
            neuere Version (z. B. DEMO_Spezifikation_DBVO_Version_1.0.pdf und _1.1.pdf aus dem Ordner demo-spezifikationen/).
          </p>
        ) : (
          <ol className="timeline">
            {[...ruleChangeRuns].reverse().map((r) => (
              <li key={r.id}>
                <time>{formatDateTime(r.detectedAt)}</time>
                <div>
                  <b>{r.documentName}</b> <span className="muted small">({r.documentVersion})</span>
                  {r.predecessorName ? (
                    <>
                      <span className="muted small"> gegenüber </span><b>{r.predecessorName}</b> <span className="muted small">({r.predecessorVersion})</span>
                      {!r.note && (
                        <div className="tags">
                          <span className="status warn">{r.counts.geaendert} geändert</span>
                          <span className="status good">{r.counts.neu} neu</span>
                          <span className="status bad">{r.counts.entfallen} entfallen</span>
                          <span className="status neutral">{r.counts.unveraendert} unverändert</span>
                        </div>
                      )}
                    </>
                  ) : null}
                  {r.note && <p className="muted small">{r.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel>
        <div className="paneltop">
          <h3>Geänderte Regeln · {ruleChanges.length}</h3>
          <button onClick={exportCsv} disabled={!rows.length}><Download size={15} /> CSV</button>
        </div>
        <div className="search wide">
          <Search size={15} />
          <input placeholder="Suche in Regel, Text, Dokument oder Unterschied" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        </div>
        <div className="filters">
          {(["Alle", ...RULE_CHANGE_KINDS] as const).map((k) => (
            <button key={k} className={kind === k ? "selected" : ""} onClick={() => { setKind(k); setPage(1); }}>
              {k} · {k === "Alle" ? ruleChanges.length : ruleChanges.filter((c) => c.kind === k).length}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="muted">{ruleChanges.length ? "Keine Änderungen für diese Filter." : "Noch keine Regeländerungen erkannt."}</p>
        ) : (
          <>
            <div className="tablepanel">
              <table className="changetable">
                <thead>
                  <tr>{["Zeitpunkt", "Regel", "Art", "Änderung", "Version", "Betroffene Testfälle"].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <Fragment key={c.id}>
                      <tr className={open === c.id ? "highlight" : ""} onClick={() => setOpen(open === c.id ? null : c.id)}>
                        <td className="nowrap">{formatDateTime(c.detectedAt)}</td>
                        <td>
                          <b>{c.rule}</b>
                          <small className="muted block">{(c.after ?? c.before)?.sectionLabel}{c.matchedBy ? ` · zugeordnet über ${c.matchedBy}` : ""}</small>
                        </td>
                        <td><span className={"status " + RULE_CLASS[c.kind]}>{c.kind}</span></td>
                        <td>
                          <ul className="plain">{c.differences.map((d) => <li key={d}>{d}</li>)}</ul>
                          <small className="link">{open === c.id ? "Text ausblenden" : "Vorher/Nachher anzeigen"}</small>
                        </td>
                        <td className="small">
                          {c.before ? `${c.before.documentVersion ?? "–"}` : "–"} → {c.after ? `${c.after.documentVersion ?? "–"}` : "entfallen"}
                        </td>
                        <td>
                          {c.affectedCaseIds.length ? (
                            <><b>{c.affectedCaseIds.length}</b><small className="muted block">{c.affectedCaseIds.slice(0, 3).join(", ")}{c.affectedCaseIds.length > 3 ? " …" : ""}</small></>
                          ) : <span className="muted">–</span>}
                        </td>
                      </tr>
                      {open === c.id && (
                        <tr className="detailrow">
                          <td colSpan={6}>
                            <div className="beforeafter">
                              <div>
                                <h5 className="minihead">VORHER · {c.before ? `${c.before.documentName} · ${c.before.sectionLabel}` : "nicht vorhanden"}</h5>
                                <h5 className="minihead">NACHHER · {c.after ? `${c.after.documentName} · ${c.after.sectionLabel}` : "entfallen"}</h5>
                              </div>
                              <QuoteDiff change={c} />
                              <p className="muted small">
                                <del>Durchgestrichen</del> = entfernt, <ins>unterstrichen</ins> = neu. {c.similarity !== undefined && `Textähnlichkeit ${Math.round(c.similarity * 100)} %.`}
                                {c.affectedCaseIds.length > 0 && ` Betroffene Testfälle: ${c.affectedCaseIds.join(", ")} – bitte gegen die neue Fassung prüfen oder neu erzeugen.`}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={current} pageCount={pageCount} total={rows.length} onPage={setPage} unit="Änderungen" />
          </>
        )}
      </Panel>
    </>
  );
}

/** Option 2: how test cases changed over time. */
function CaseView() {
  const { changelog, ruleChanges, cases, resetCases } = useReviewStore();
  const [kind, setKind] = useState<CaseChangeKind | "Alle">("Alle");
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const history = useMemo(() => buildCaseHistory(changelog, ruleChanges), [changelog, ruleChanges]);

  const q = query.trim().toLocaleLowerCase("de-DE");
  const rows = history
    .filter((r) => kind === "Alle" || r.kind === kind)
    .filter((r) => !q || [r.caseId, r.requirementId, r.summary, r.before, r.after].some((v) => v?.toLocaleLowerCase("de-DE").includes(q)));
  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const current = Math.min(page, pageCount);
  const shown = rows.slice((current - 1) * ROWS_PER_PAGE, current * ROWS_PER_PAGE);
  const usedKinds = CASE_CHANGE_KINDS.filter((k) => history.some((r) => r.kind === k));

  const exportCsv = () =>
    download(
      "testfall-aenderungen.csv",
      toCsv([["Zeitpunkt", "Testfall", "Anforderung", "Änderung", "Beschreibung", "Vorher", "Nachher"], ...rows.map((r) => [r.timestamp, r.caseId, r.requirementId, r.kind, r.summary, r.before, r.after])]),
    );

  return (
    <Panel>
      <div className="paneltop">
        <h3>Änderungen an Testfällen · {history.length}</h3>
        <div className="actions">
          <button onClick={exportCsv} disabled={!rows.length}><Download size={15} /> CSV</button>
          <button
            disabled={cases.length === 0}
            onClick={async () => { if (await confirm({ title: "Alle Testfälle entfernen?", message: `Alle ${cases.length} erzeugten Testfälle samt Rückmeldungen werden entfernt. Das Protokoll behält einen Eintrag.`, confirmLabel: "Alle entfernen" })) resetCases(); }}
          >
            <Trash2 size={15} /> Testfälle zurücksetzen
          </button>
        </div>
      </div>
      <div className="search wide">
        <Search size={15} />
        <input placeholder="Suche nach Testfall, Anforderung oder Inhalt" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
      </div>
      <div className="filters">
        {(["Alle", ...usedKinds] as const).map((k) => (
          <button key={k} className={kind === k ? "selected" : ""} onClick={() => { setKind(k); setPage(1); }}>
            {k} · {k === "Alle" ? history.length : history.filter((r) => r.kind === k).length}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="muted">{history.length ? "Keine Einträge für diese Filter." : "Noch keine Änderungen an Testfällen."}</p>
      ) : (
        <>
          <div className="tablepanel">
            <table className="changetable">
              <thead>
                <tr>{["Zeitpunkt", "Testfall", "Änderung", "Beschreibung", "Vorher", "Nachher"].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap">{formatDateTime(r.timestamp)}</td>
                    <td><code>{r.caseId}</code>{r.requirementId && <small className="muted block">{r.requirementId}</small>}</td>
                    <td><span className={"kind " + CASE_CLASS[r.kind]}>{r.kind}</span></td>
                    <td>{r.summary}</td>
                    <td className="prewrap small">{r.before || <span className="muted">–</span>}</td>
                    <td className="prewrap small">{r.after || <span className="muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={current} pageCount={pageCount} total={rows.length} onPage={setPage} unit="Einträge" />
        </>
      )}
    </Panel>
  );
}

/**
 * Änderungsprotokoll with two views:
 * - Regeln & Spezifikationen: rule changes detected between document versions
 * - Testfälle: creation, regeneration, reviews, comparisons and rule-change impact per test case
 * The complete raw log (all kinds) stays exportable.
 */
export function ChangeLog() {
  const { changelog, ruleChanges } = useReviewStore();
  const [params, setParams] = useSearchParams();
  const view: View = params.get("ansicht") === "testfaelle" ? "testfaelle" : "regeln";

  const exportAll = () =>
    download(
      "aenderungsprotokoll-gesamt.csv",
      toCsv([
        ["Zeitpunkt", "Art", "Anforderung", "Testfall", "Zusammenfassung", "Vorher", "Nachher"],
        ...changelog.map((e) => [e.timestamp, e.kind, e.requirementId, e.testCaseId, e.summary, e.before, e.after]),
      ]),
    );

  return (
    <>
      <Header
        title="Änderungsprotokoll"
        subtitle="Wie sich Regeln und Spezifikationen über die Zeit verändert haben – und wie sich die Testfälle verändert haben. Alle Einträge mit Zeitstempel; nichts wird stillschweigend überschrieben."
        action={<button onClick={exportAll} disabled={!changelog.length}><Download size={15} /> Gesamtprotokoll (CSV)</button>}
      />
      <div className="viewswitch" role="tablist">
        <button role="tab" aria-selected={view === "regeln"} className={view === "regeln" ? "selected" : ""} onClick={() => setParams({ ansicht: "regeln" })}>
          <FileDiff size={18} />
          <span><b>Regeln & Spezifikationen</b><small>{ruleChanges.length} erkannte Änderung(en) zwischen Dokumentversionen</small></span>
        </button>
        <button role="tab" aria-selected={view === "testfaelle"} className={view === "testfaelle" ? "selected" : ""} onClick={() => setParams({ ansicht: "testfaelle" })}>
          <FlaskConical size={18} />
          <span><b>Testfälle</b><small>Erzeugung, Bewertung, Abgleich und Auswirkungen von Regeländerungen</small></span>
        </button>
      </div>
      {view === "regeln" ? <RuleView /> : <CaseView />}
    </>
  );
}
