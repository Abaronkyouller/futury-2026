import { useState } from "react";
import { Search } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";
import { initial } from "../data/requirements";

export function Requirements() {
  const [reqs, setReqs] = useState(initial),
    [selected, setSelected] = useState(initial[0].id),
    [filter, setFilter] = useState("Pending"),
    [search, setSearch] = useState(""),
    [comment, setComment] = useState(""),
    [tab, setTab] = useState("Python");
  const active = reqs.find((r) => r.id === selected)!;
  const update = (status: "Approved" | "Pending") => {
    setReqs((a) =>
      a.map((r) =>
        r.id === selected
          ? {
              ...r,
              status,
              rule:
                status === "Approved"
                  ? "R-" + r.id.split("-").pop()
                  : undefined,
            }
          : r,
      ),
    );
    alert(
      status === "Approved"
        ? "Demo requirement approved."
        : "Demo requirement marked pending.",
    );
  };
  return (
    <>
      <Header
        title="Requirements & rule review"
        subtitle="The AI extracts requirements from the specifications. An examiner approves each one before it is compiled into an executable rule. Every requirement keeps a link to its source paragraph."
      />
      <div className="filters">
        {[
          ["All", "142"],
          ["Pending", "24"],
          ["Approved", "118"],
          ["Changed", "7"],
        ].map(([n, c]) => (
          <button
            key={n}
            className={filter === n ? "selected" : ""}
            onClick={() => setFilter(n)}
          >
            {n === "Changed" ? "Changed by spec update" : n} · {c}
          </button>
        ))}
        <div className="search">
          <Search size={15} />
          <input
            placeholder="ID, field or paragraph"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="reqgrid">
        <Panel className="reqitems">
          {reqs
            .filter(
              (r) =>
                (filter === "All" ||
                  filter === "Changed" ||
                  r.status === filter) &&
                `${r.id} ${r.title} ${r.benefit}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((r) => (
              <div
                key={r.id}
                className={"reqitem " + (selected === r.id ? "chosen" : "")}
                onClick={() => setSelected(r.id)}
              >
                <div className="paneltop">
                  <code>{r.id}</code>
                  <Status value={r.status} />
                </div>
                <b>{r.title}</b>
                <p>
                  {r.benefit} · {r.source} ·{" "}
                  {r.rule ?? `confidence ${r.confidence}`}
                </p>
              </div>
            ))}
        </Panel>
        <Panel>
          <div className="paneltop">
            <div>
              <code>{active.id} · draft v1</code>
              <h3>{active.title}</h3>
            </div>
            <div>
              <Status value={active.status} />
              <p className="muted">Valid from 01.01.2027</p>
            </div>
          </div>
          <div className="notice">
            <b>⚠ Why confidence is {active.confidence}</b>
            <p>
              The source mentions both "four weeks" and "pay period". It is
              unclear which one governs for employees paid weekly. Please
              confirm the interpretation.
            </p>
          </div>
          <h4>Source</h4>
          <div className="tags">
            <span>{active.source}</span>
            <span>EEL specification, section x.y</span>
          </div>
          <div className="source">
            [Highlighted source paragraph as shown in the original document]
          </div>
          <h4>Extracted structure</h4>
          <table className="detail">
            <tbody>
              {[
                ["Applies to", active.benefit + " · Entgeltbescheinigung"],
                ["Trigger", "Start of incapacity for work"],
                ["Constraint", "Reported assessment period ≥ 4 weeks"],
                ["Data fields", "Bemessungszeitraum von · bis, Arbeitsentgelt"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="paneltop">
            <h4>Proposed executable rule</h4>
            <div className="tabs">
              {["Python", "SHACL", "Ontology"].map((t) => (
                <button
                  className={tab === t ? "selected" : ""}
                  onClick={() => setTab(t)}
                  key={t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <pre>
            {tab === "Python"
              ? `# R-031 ← ${active.id}    valid_from 2027-01-01\ndef check_min_assessment_period(cert):\n    start, end = cert.bemessung_von, cert.bemessung_bis\n    days = (end - start).days + 1\n    if days < 28:\n        return Fail("R-031", f"period is {days} days, expected ≥ 28")\n    return Pass("R-031")`
              : tab === "SHACL"
                ? "# SHACL representation is not provided in the source PDF."
                : "# Ontology representation is not provided in the source PDF."}
          </pre>
          <h4>Linked concepts in the knowledge graph</h4>
          <div className="tags">
            {[
              "Arbeitsunfähigkeit",
              "Bemessungszeitraum",
              "Entgeltbescheinigung",
              "Krankengeld",
              "related: REQ-EEL-028",
            ].map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          <h4>Examiner comment</h4>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Interpretation, reason for change or rejection"
          />
          <div className="actions">
            <button className="primary" onClick={() => update("Approved")}>
              Approve & compile rule
            </button>
            <button
              onClick={() =>
                alert("Edit the requirement in your connected backend.")
              }
            >
              Edit requirement
            </button>
            <button onClick={() => update("Pending")}>Reject</button>
          </div>
        </Panel>
      </div>
    </>
  );
}
