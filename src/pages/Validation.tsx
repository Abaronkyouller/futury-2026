import { useState } from "react";
import { Upload } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";

export function Validation() {
  const [file, setFile] = useState("");
  return (
    <>
      <Header
        title="Validation & test report"
        subtitle="Data sets exported from the payroll software are checked against the expected results. Pass or fail is decided by the rule engine; the AI only writes the explanation."
      />
      <div className="validationtop">
        <label className="upload">
          <Upload size={24} />
          <b>Upload data sets from the payroll software</b>
          <span>
            {file ||
              "Drop files here or browse · processed locally at the vendor"}
          </span>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0]?.name || "")}
          />
        </label>
        {[
          ["Received", "61"],
          ["Passed", "55"],
          ["Failed", "6"],
          ["Still missing", "153"],
        ].map(([a, b]) => (
          <Panel key={a}>
            <small>{a}</small>
            <div
              className={
                "metric " +
                (a === "Failed" ? "red" : a === "Passed" ? "green" : "")
              }
            >
              {b}
            </div>
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="paneltop">
          <div>
            <code>TC-028-04 · data set #0412</code>
            <h3>Last month not yet settled when incapacity begins</h3>
          </div>
          <Status value="Failed" />
        </div>
        <table>
          <thead>
            <tr>
              {["Field", "Expected", "Actual", "Verdict"].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              [
                "Beginn Arbeitsunfähigkeit",
                "02.10.2026",
                "02.10.2026",
                "✓ Match",
              ],
              [
                "Bemessungszeitraum von",
                "01.08.2026",
                "01.09.2026",
                "✕ Mismatch",
              ],
              [
                "Bemessungszeitraum bis",
                "31.08.2026",
                "30.09.2026",
                "✕ Mismatch",
              ],
              [
                "Arbeitsentgelt im Zeitraum",
                "3.200,00 €",
                "3.200,00 €",
                "✓ Match",
              ],
            ].map((r) => (
              <tr
                className={r[3].includes("Mismatch") ? "mismatch" : ""}
                key={r[0]}
              >
                {r.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="two inset">
          <div className="subpanel">
            <h5>EXPLANATION · AI-WRITTEN, RULE-CHECKED</h5>The software reported
            September 2026 as the assessment period. That month had not been
            settled when incapacity began on 02.10.2026, so the last settled
            period, August 2026, should have been used.
          </div>
          <div className="subpanel">
            <h5>TRACEABILITY</h5>
            <div className="tags">
              <span>§ 47 SGB V</span>→<span>REQ-EEL-028</span>→
              <span>R-028</span>→<span>TC-028-04</span>→
              <span>#0412 failed</span>
            </div>
            <p>Requirement approved by system examiner on 21.10.2026</p>
          </div>
        </div>
      </Panel>
      <Panel>
        <div className="two">
          <div>
            <h3>Test report for the ITSG system review</h3>
            <p>
              Draft is updated with each validated data set. Every finding links
              back to its source paragraph.
            </p>
            <div className="actions">
              <button onClick={() => window.print()}>Export PDF</button>
              <button
                className="primary"
                onClick={() =>
                  alert("Demo: submission requires backend integration.")
                }
              >
                Submit to system review
              </button>
            </div>
          </div>
          <table className="detail">
            <tbody>
              {[
                ["1 · Scope, product version and spec baseline", "Complete"],
                ["2 · Requirement coverage matrix", "61 / 214 cases"],
                ["3 · Findings with traceability", "6 findings"],
                ["4 · Open items and uncovered requirements", "In progress"],
                ["5 · Examiner sign-off", "Not signed"],
              ].map(([a, b]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
