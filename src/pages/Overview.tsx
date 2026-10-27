import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Pager } from "../components/Pager";
import { useDocuments } from "../state/documentContext";
import { useReviewStore } from "../state/reviewContext";

/** Entries per page in "Abdeckung nach Leistung". */
const COVERAGE_PER_PAGE = 5;
/**
 * Metrics for "Abdeckung nach Leistung" (share of requirements per benefit):
 * - "Testfall vorhanden": at least one test case that was not rejected
 * - "Testfall akzeptiert": at least one test case accepted by the examiner
 */
const COVERAGE_METRICS = ["Testfall vorhanden", "Testfall akzeptiert"] as const;
type CoverageMetric = (typeof COVERAGE_METRICS)[number];
const METRIC_HINT: Record<CoverageMetric, string> = {
  "Testfall vorhanden": "Anteil der Anforderungen mit mindestens einem Testfall (ohne abgelehnte)",
  "Testfall akzeptiert": "Anteil der Anforderungen mit mindestens einem vom Prüfer akzeptierten Testfall",
};

type Step = { name: string; status: string; path: string; warn?: boolean };
type Attention = { title: string; desc: string; action: string; path: string; danger?: boolean };

/**
 * Start page. All numbers are computed from this browser's state (uploaded
 * documents, extracted requirements, generated cases); execution and
 * validation are not connected yet and say so.
 */
export function Overview() {
  const [coveragePage, setCoveragePage] = useState(1);
  const [metric, setMetric] = useState<CoverageMetric>("Testfall vorhanden");
  const [onlyDocs, setOnlyDocs] = useState(true);
  const nav = useNavigate();
  const { documents } = useDocuments();
  const { requirements, cases } = useReviewStore();

  const docReqs = requirements.filter((r) => r.origin);
  const unverified = docReqs.filter((r) => !r.origin!.quoteVerified);
  const accepted = cases.filter((c) => c.review.decision === "Akzeptiert");
  const openCases = cases.filter((c) => c.review.decision === "Offen");
  const failedChecks = cases.filter((c) => c.review.decision !== "Abgelehnt" && c.checks.some((k) => !k.passed));
  const questions = openCases.filter((c) => c.openQuestions.length > 0);

  const steps: Step[] = [
    {
      name: "Spezifikationen einlesen",
      status: documents.length ? "Erledigt" : "Offen",
      path: "/documents",
    },
    {
      name: "Testfälle erzeugen",
      status: openCases.length ? "Prüfung nötig" : cases.length ? "Erledigt" : "Offen",
      path: "/documents",
      warn: openCases.length > 0,
    },
    {
      name: "In der Entgeltabrechnung ausführen",
      status: "Offen",
      path: "/tests",
    },
    {
      name: "Validieren & berichten",
      status: "Beispieldaten",
      path: "/validation",
    },
  ];

  const attention: Attention[] = [
    ...(documents.length === 0
      ? [{ title: "Noch keine Spezifikation hochgeladen", desc: "Laden Sie z. B. die Verfahrensbeschreibung DTA EEL hoch, um Anforderungen mit Quellennachweis zu extrahieren.", action: "Hochladen", path: "/documents" }]
      : []),
    ...(unverified.length
      ? [{ title: `${unverified.length} Zitat(e) nicht wörtlich gefunden`, desc: "Die KI hat Text zitiert, der im Abschnitt so nicht vorkommt. Am Original prüfen.", action: "Ansehen", path: "/documents", danger: true }]
      : []),
    ...(failedChecks.length
      ? [{ title: `${failedChecks.length} Testfall/Testfälle mit Auffälligkeiten`, desc: "Die regelbasierte Strukturprüfung hat z. B. unbelegte Abgabegründe oder ungültige Daten gefunden.", action: "Ansehen", path: "/tests", danger: true }]
      : []),
    ...(questions.length
      ? [{ title: `${questions.length} offene Testfall/Testfälle mit fachlichen Fragen`, desc: "Erwartete Werte, die nicht eindeutig aus der Quelle folgen, sind als offen markiert.", action: "Klären", path: "/tests" }]
      : []),
  ];

  // Sample requirements (no uploaded source) are left out when documents exist and the switch is on.
  const scoped = onlyDocs && docReqs.length > 0 ? docReqs : requirements;
  const counting = metric === "Testfall akzeptiert" ? accepted : cases.filter((c) => c.review.decision !== "Abgelehnt");
  const benefits = [...new Set(scoped.map((r) => r.benefit))];
  const coverage = benefits.map((b) => {
    const reqs = scoped.filter((r) => r.benefit === b);
    const covered = reqs.filter((r) => counting.some((c) => c.requirementId === r.id)).length;
    return { benefit: b, covered, total: reqs.length, pct: Math.round((covered / reqs.length) * 100) };
  });

  // "Abdeckung nach Leistung" is paginated: at most COVERAGE_PER_PAGE entries per page.
  const coveragePages = Math.max(1, Math.ceil(coverage.length / COVERAGE_PER_PAGE));
  const coveragePageNow = Math.min(coveragePage, coveragePages);

  return (
    <>
      <Header
        title="Übersicht Prüflauf"
        subtitle="KI schlägt vor · Prüfer/in entscheidet · Regel-Engine bewertet (noch nicht angebunden)."
        action={
          <div className="actions">
            <button onClick={() => nav("/documents")}>Dokument hochladen</button>
            <button className="primary" onClick={() => nav("/tests")}>Testplan ansehen</button>
          </div>
        }
      />
      {/* <div className="chips">
        <span>Gespeichert nur in diesem Browser</span>
        <span>Modell über hessian.ai-Gateway</span>
        <span className="warm">Prototyp – keine Ausführung in echter Entgeltabrechnung</span>
      </div> */}
      <Panel>
        <div className="paneltop">
          <h3>Prüfablauf</h3>
          {/* <small>Schritte anklicken, um fortzufahren</small> */}
        </div>
        <div className="pipeline">
          {steps.map((s, i) => (
            <button className={"step " + (s.warn ? "stepwarn" : "")} key={s.name} onClick={() => nav(s.path)}>
              <small>
                {i + 1} · {s.status}
              </small>
              <b>{s.name}</b>
              <ChevronRight size={18} className="steparrow" />
            </button>
          ))}
        </div>
      </Panel>
      <div className="metrics">
        {[
          ["Dokumente", documents.length],
          ["Quellenzitate", docReqs.length],
          ["Testfälle erzeugt", cases.length],
          ["Prüfung offen", openCases.length, `${accepted.length} akzeptiert`],
        ].map(([label, n, desc]) => (
          <Panel key={label as string}>
            <small>{label}</small>
            <div className="metric">{n}</div>
            <small>{desc}</small>
          </Panel>
        ))}
      </div>
      <div className="two">
        <Panel>
          <h3>Ihre Aufmerksamkeit</h3>
          {attention.length === 0 && <p className="muted">Nichts offen.</p>}
          {attention.map((a) => (
            <div className="attention" key={a.title}>
              <span className={"attentionicon " + (a.danger ? "danger" : "")}>{a.danger ? "!" : "◷"}</span>
              <div>
                <b>{a.title}</b>
                <p>{a.desc}</p>
              </div>
              <button className="link" onClick={() => nav(a.path)}>{a.action}</button>
            </div>
          ))}
        </Panel>
        <Panel>
          <h3>Abdeckung nach Leistung</h3>
          <div className="filters metricswitch">
            {COVERAGE_METRICS.map((m) => (
              <button key={m} className={metric === m ? "selected" : ""} onClick={() => { setMetric(m); setCoveragePage(1); }}>{m}</button>
            ))}
            {docReqs.length > 0 && (
              <label className="checkrow">
                <input type="checkbox" checked={onlyDocs} onChange={(e) => { setOnlyDocs(e.target.checked); setCoveragePage(1); }} />
                Nur hochgeladene Dokumente
              </label>
            )}
          </div>
          <p className="muted">{METRIC_HINT[metric]}{onlyDocs && docReqs.length > 0 ? " · ohne Beispieldaten" : ""}</p>
          {coverage.slice((coveragePageNow - 1) * COVERAGE_PER_PAGE, coveragePageNow * COVERAGE_PER_PAGE).map((c) => (
            <div className="coverage" key={c.benefit}>
              <span>{c.benefit}</span>
              <div className="track">
                <div style={{ width: c.pct + "%" }} />
              </div>
              <b title={`${c.covered} von ${c.total}`}>{c.pct}%</b>
            </div>
          ))}
          {coveragePages > 1 && <Pager page={coveragePageNow} pageCount={coveragePages} total={coverage.length} unit="Leistung(en)" onPage={setCoveragePage} />}
          <p className="muted foot">„Testfall vorhanden“ heißt erzeugt und nicht abgelehnt, „Testfall akzeptiert“ heißt vom Prüfer bestätigt – beides heißt nicht ausgeführt. Nicht abgedeckte Anforderungen bleiben offene Punkte im Prüfbericht.</p>
        </Panel>
      </div>
    </>
  );
}
