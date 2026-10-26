import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { useDocuments } from "../state/documentContext";
import { useReviewStore } from "../state/reviewContext";

type Step = { name: string; desc: string; status: string; path: string; warn?: boolean };
type Attention = { title: string; desc: string; action: string; path: string; danger?: boolean };

/**
 * Start page. All numbers are computed from this browser's state (uploaded
 * documents, extracted requirements, generated cases); execution and
 * validation are not connected yet and say so.
 */
export function Overview() {
  const nav = useNavigate();
  const { documents } = useDocuments();
  const { requirements, cases } = useReviewStore();

  const docReqs = requirements.filter((r) => r.origin);
  const unverified = docReqs.filter((r) => !r.origin!.quoteVerified);
  const accepted = cases.filter((c) => c.review.decision === "Akzeptiert");
  const openCases = cases.filter((c) => c.review.decision === "Offen");
  const failedChecks = cases.filter((c) => c.review.decision !== "Abgelehnt" && c.checks.some((k) => !k.passed));
  const questions = openCases.filter((c) => c.openQuestions.length > 0);
  const count = (kind: string) => documents.filter((d) => d.classification.kind === kind).length;

  const steps: Step[] = [
    {
      name: "Spezifikationen einlesen",
      desc: `${documents.length} Dokument(e): ${count("Fachlich")} fachlich, ${count("Technisch")} technisch, ${count("Testkonstellation")} Testkonstellation`,
      status: documents.length ? "Erledigt" : "Offen",
      path: "/documents",
    },
    {
      name: "Testfälle erzeugen",
      desc: `${cases.length} erzeugt, ${accepted.length} akzeptiert, ${openCases.length} offen`,
      status: openCases.length ? "Prüfung nötig" : cases.length ? "Erledigt" : "Offen",
      path: "/documents",
      warn: openCases.length > 0,
    },
    {
      name: "In der Entgeltabrechnung ausführen",
      desc: "Beim Hersteller, manuell – nicht angebunden",
      status: "Offen",
      path: "/tests",
    },
    {
      name: "Validieren & berichten",
      desc: "Datenformat und Vergleichsregeln noch offen; Seite zeigt Beispieldaten",
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

  const benefits = [...new Set(requirements.map((r) => r.benefit))];
  const coverage = benefits.map((b) => {
    const reqs = requirements.filter((r) => r.benefit === b);
    const covered = reqs.filter((r) => accepted.some((c) => c.requirementId === r.id)).length;
    return { benefit: b, covered, total: reqs.length, pct: Math.round((covered / reqs.length) * 100) };
  });

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
      <div className="chips">
        <span>Gespeichert nur in diesem Browser</span>
        <span>Modell über hessian.ai-Gateway</span>
        <span className="warm">Prototyp – keine Ausführung in echter Entgeltabrechnung</span>
      </div>
      <Panel>
        <div className="paneltop">
          <h3>Prüfablauf</h3>
          <small>Schritte anklicken, um fortzufahren</small>
        </div>
        <div className="pipeline">
          {steps.map((s, i) => (
            <div className={"step " + (s.warn ? "stepwarn" : "")} key={s.name} onClick={() => nav(s.path)}>
              <small>
                {i + 1} · {s.status}
              </small>
              <b>{s.name}</b>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </Panel>
      <div className="metrics">
        {[
          ["Dokumente", documents.length, `${documents.filter((d) => d.role === "Technische Informationen").length} mit technischen Informationen`],
          ["Quellenzitate", docReqs.length, `${unverified.length} nicht wörtlich geprüft`],
          ["Testfälle erzeugt", cases.length, `${cases.filter((c) => c.origin.kind === "model").length} KI · ${cases.filter((c) => c.origin.kind === "regelbasiert").length} regelbasiert`],
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
          <p className="muted">Anteil der Anforderungen mit mindestens einem akzeptierten Testfall</p>
          {coverage.map((c) => (
            <div className="coverage" key={c.benefit}>
              <span>{c.benefit}</span>
              <div className="track">
                <div style={{ width: c.pct + "%" }} />
              </div>
              <b title={`${c.covered} von ${c.total}`}>{c.pct}%</b>
            </div>
          ))}
          <p className="muted foot">Akzeptiert heißt vom Prüfer bestätigt, nicht ausgeführt. Nicht abgedeckte Anforderungen bleiben offene Punkte im Prüfbericht.</p>
        </Panel>
      </div>
    </>
  );
}
