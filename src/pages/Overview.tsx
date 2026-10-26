import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { steps } from "../data/pipeline";

export function Overview() {
  const nav = useNavigate();
  return (
    <>
      <Header
        title="Review run · Entgeltersatzleistungen"
        action={
          <div className="actions">
            <button
              onClick={() =>
                alert("Demo: vendor invitation requires a backend.")
              }
            >
              Invite vendor
            </button>
            <button className="primary" onClick={() => nav("/validation")}>
              Generate test report
            </button>
          </div>
        }
      />
      <div className="chips">
        <span>Spec baseline valid from 01.01.2027</span>
        <span>Started 19.10.2026</span>
        <span>Runs locally at vendor</span>
        <span className="warm">Sample data</span>
      </div>
      <Panel>
        <div className="paneltop">
          <h3>Review pipeline</h3>
          <small>AI proposes · examiner approves · rule engine decides</small>
        </div>
        <div className="pipeline">
          {steps.map(([name, desc, status], i) => (
            <div
              className={
                "step " + (status === "Needs review" ? "stepwarn" : "")
              }
              key={name}
              onClick={() =>
                nav(
                  [
                    "/library",
                    "/requirements",
                    "/requirements",
                    "/tests",
                    "/validation",
                    "/validation",
                  ][i],
                )
              }
            >
              <small>
                {i + 1} · {status}
              </small>
              <b>{name}</b>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </Panel>
      <div className="metrics">
        {[
          [
            "Requirements approved",
            "118",
            "/ 142",
            "Each with source paragraph",
          ],
          [
            "Test cases generated",
            "214",
            "",
            "Boundary, equivalence, combination",
          ],
          ["Data sets validated", "61", "", "29% of planned cases"],
          ["Failed test cases", "6", "", "Linked to 4 requirements"],
        ].map(([label, n, after, desc]) => (
          <Panel key={label}>
            <small>{label}</small>
            <div className={"metric " + (n === "6" ? "red" : "")}>
              {n} <span>{after}</span>
            </div>
            <small>{desc}</small>
          </Panel>
        ))}
      </div>
      <div className="two">
        <Panel>
          <h3>Needs your attention</h3>
          {[
            [
              "24 requirements awaiting examiner review",
              "Mostly low-confidence extractions where two documents describe the same rule differently.",
              "Review",
              "/requirements",
            ],
            [
              "6 test cases failed",
              "TC-028-04: reported assessment period was not yet settled when incapacity began.",
              "Inspect",
              "/validation",
            ],
            [
              "Specification update detected",
              "A new document version affects 7 approved requirements. Linked test cases are flagged for re-check.",
              "Compare",
              "/library",
            ],
          ].map(([t, d, a, path], i) => (
            <div className="attention" key={t}>
              <span className={"attentionicon " + (i === 1 ? "danger" : "")}>
                {i === 0 ? "◷" : i === 1 ? "×" : "↻"}
              </span>
              <div>
                <b>{t}</b>
                <p>{d}</p>
              </div>
              <button className="link" onClick={() => nav(path)}>
                {a}
              </button>
            </div>
          ))}
        </Panel>
        <Panel>
          <h3>Coverage by benefit</h3>
          <p className="muted">
            Share of requirements with at least one passing test case
          </p>
          {[
            ["Krankengeld", 72],
            ["Kinderkrankengeld", 48],
            ["Mutterschaftsgeld", 31],
            ["Verletztengeld", 12],
            ["Übergangsgeld", 0],
          ].map(([n, v]) => (
            <div className="coverage" key={n}>
              <span>{n}</span>
              <div className="track">
                <div style={{ width: v + "%" }} />
              </div>
              <b>{v}%</b>
            </div>
          ))}
          <p className="muted foot">
            Not yet covered requirements are listed in the test report as open
            items.
          </p>
        </Panel>
      </div>
    </>
  );
}
