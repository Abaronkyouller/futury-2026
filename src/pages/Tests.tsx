import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";
import { cases } from "../data/testCases";
import { download } from "../utils/download";

export function Tests() {
  const [selected, setSelected] = useState("TC-028-04");
  const nav = useNavigate();
  const active = cases.find((c) => c[0] === selected)!;
  return (
    <>
      <Header
        title="Generated test cases"
        subtitle="Derived from approved rules by boundary-value, equivalence-class and combination analysis. Expected results are computed by the rule engine, not by the language model."
        action={
          <button
            className="primary"
            onClick={() =>
              download(
                "test-plan.csv",
                cases.map((r) => r.join(",")).join("\n"),
              )
            }
          >
            <Download size={15} /> Export test plan for vendor
          </button>
        }
      />
      <div className="rulebar">
        Rule{" "}
        <select>
          <option>
            R-028 · Assessment period is the last settled pay period
          </option>
        </select>
        <span>Source: § 47 SGB V · REQ-EEL-028 · approved 21.10.2026</span>
      </div>
      <Panel className="tablepanel">
        <table>
          <thead>
            <tr>
              {[
                "ID",
                "Scenario",
                "Technique",
                "Expected assessment period",
                "Status",
              ].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr
                key={c[0]}
                onClick={() => setSelected(c[0])}
                className={selected === c[0] ? "highlight" : ""}
              >
                {c.slice(0, 4).map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
                <td>
                  <Status value={c[4]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <div className="two">
        <Panel>
          <code>{active[0]}</code>
          <h3>{active[1]}</h3>
          <div className="given">
            <b>GIVEN</b>
            <p>
              Employee with fixed monthly pay, employed since 01.03.2026.
              Payroll is settled up to August 2026; September is not yet
              settled.
            </p>
            <b>WHEN</b>
            <p>
              Incapacity for work begins on 02.10.2026 and the insurer requests
              the certificate.
            </p>
            <b>THEN</b>
            <p>The certificate reports August 2026 as the assessment period.</p>
          </div>
          <h4>Steps for the vendor</h4>
          <ol>
            <li>Create the employee with the master data above.</li>
            <li>Run payroll for March to August 2026 only.</li>
            <li>Record incapacity from 02.10.2026.</li>
            <li>Generate the Entgeltbescheinigung and export the data set.</li>
          </ol>
        </Panel>
        <Panel>
          <h3>Expected data set</h3>
          <table className="detail">
            <tbody>
              {[
                ["Beginn Arbeitsunfähigkeit", "02.10.2026"],
                ["Bemessungszeitraum von", "01.08.2026"],
                ["Bemessungszeitraum bis", "31.08.2026"],
                ["Arbeitsentgelt im Zeitraum", "3.200,00 €"],
              ].map(([a, b]) => (
                <tr key={a}>
                  <th>{a}</th>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>Trace</h4>
          <div className="tags">
            <span>§ 47 SGB V</span>→<span>REQ-EEL-028</span>→<span>R-028</span>→
            <span>{selected}</span>
          </div>
          <button className="link" onClick={() => nav("/validation")}>
            See validation result
          </button>
        </Panel>
      </div>
    </>
  );
}
