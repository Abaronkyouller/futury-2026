import { useState } from "react";
import { Sparkles, FlaskConical } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { GeneratedCaseCard } from "../components/GeneratedCaseCard";
import { initial as requirements } from "../data/requirements";
import { AI_MODELS, FEEDBACK_EXAMPLES_MAX, MAX_CASES_LIMIT } from "../config/ai";
import { PRIORITIES, PRIORITY_FOCUSES, TECHNIQUES } from "../types/review";
import type { GenerationSettings, OriginKind, Technique } from "../types/review";
import { buildMessages } from "../ai/prompt";
import { generateTestCases } from "../ai/generate";
import { useReviewStore } from "../state/reviewContext";

/**
 * AI test-case generator (H2/H3). The examiner picks a requirement, adjusts
 * how the model reasons, generates proposals, then accepts or rejects each
 * one with a comment. Reviewed cases are fed back into later prompts.
 */
export function Generator() {
  const store = useReviewStore();
  const [reqId, setReqId] = useState(requirements[0].id);
  // Draft settings are local; they are committed (and logged) only when a run starts.
  const [draft, setDraft] = useState<GenerationSettings>(store.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rawReply, setRawReply] = useState("");
  const [showReasoning, setShowReasoning] = useState(true);

  const req = requirements.find((r) => r.id === reqId)!;
  const reviewed = store.cases.filter((c) => c.review.decision !== "Offen");
  // Exact prompt preview; cheap to rebuild on every render.
  const messages = buildMessages(req, draft, reviewed);

  const reqCases = store.cases
    .filter((c) => c.requirementId === reqId)
    .sort(
      (a, b) =>
        PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
        b.origin.generatedAt.localeCompare(a.origin.generatedAt),
    );

  const set = <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleTechnique = (t: Technique) =>
    set(
      "techniques",
      draft.techniques.includes(t) ? draft.techniques.filter((x) => x !== t) : [...draft.techniques, t],
    );

  async function run(kind: OriginKind) {
    setBusy(true);
    setError("");
    try {
      store.updateSettings(draft);
      const result = await generateTestCases(req, draft, reviewed, kind);
      setRawReply(result.rawReply);
      store.addRun(req.id, result.runId, result.cases);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header
        title="AI test-case generator"
        subtitle="The model proposes test cases with expected results for a requirement. Proposals are not an oracle: an examiner reviews each one, and expected values still need confirmation by approved rules."
      />
      <div className="chips">
        <span className="warm">Requirements are sample data</span>
        <span>Model via hessian.ai gateway (Vite proxy)</span>
        <span>Feedback stored in this browser only</span>
      </div>
      <div className="gengrid">
        <Panel>
          <h3>Requirement</h3>
          <select className="full" value={reqId} onChange={(e) => setReqId(e.target.value)}>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} · {r.title}
              </option>
            ))}
          </select>
          <table className="detail">
            <tbody>
              <tr><th>Benefit</th><td>{req.benefit}</td></tr>
              <tr><th>Source</th><td>{req.source}</td></tr>
              <tr><th>Status</th><td>{req.status}{req.rule ? ` · rule ${req.rule}` : " · no approved rule"}</td></tr>
              <tr><th>Original text</th><td className="muted">Not available (sample data)</td></tr>
            </tbody>
          </table>

          <h3 className="spaced">Adjust reasoning</h3>
          <label className="field">
            Model
            <select value={draft.model} onChange={(e) => set("model", e.target.value)}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
          <div className="field">
            Test techniques
            <div className="checkrow">
              {TECHNIQUES.map((t) => (
                <label key={t}>
                  <input type="checkbox" checked={draft.techniques.includes(t)} onChange={() => toggleTechnique(t)} /> {t}
                </label>
              ))}
            </div>
          </div>
          <label className="field">
            Max. cases: {draft.maxCases}
            <input type="range" min={1} max={MAX_CASES_LIMIT} value={draft.maxCases}
              onChange={(e) => set("maxCases", Number(e.target.value))} />
          </label>
          <label className="field">
            Creativity (temperature): {draft.temperature.toFixed(1)}
            <input type="range" min={0} max={1} step={0.1} value={draft.temperature}
              onChange={(e) => set("temperature", Number(e.target.value))} />
          </label>
          <div className="field">
            Reasoning depth
            <div className="tabs">
              {(["kurz", "ausführlich"] as const).map((d) => (
                <button key={d} className={draft.reasoningDetail === d ? "selected" : ""}
                  onClick={() => set("reasoningDetail", d)}>
                  {d === "kurz" ? "Short (1–3 steps)" : "Detailed (3–6 steps)"}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            Priority focus
            <select value={draft.priorityFocus}
              onChange={(e) => set("priorityFocus", e.target.value as GenerationSettings["priorityFocus"])}>
              {PRIORITY_FOCUSES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="checkrow">
            <input type="checkbox" checked={draft.useFeedback} onChange={(e) => set("useFeedback", e.target.checked)} />
            Learn from my feedback ({Math.min(reviewed.length, FEEDBACK_EXAMPLES_MAX)} of {reviewed.length} reviewed cases go into the prompt)
          </label>

          <div className="actions spaced">
            <button className="primary" disabled={busy || draft.techniques.length === 0} onClick={() => run("model")}>
              <Sparkles size={15} /> {busy ? "Generating…" : "Generate with AI"}
            </button>
            <button disabled={busy} onClick={() => run("offline-demo")}
              title="Loads a canned reply to demonstrate the UI without a model call">
              <FlaskConical size={15} /> Offline demo
            </button>
          </div>
          {draft.techniques.length === 0 && <p className="errortext">Select at least one technique.</p>}
          {error && <div className="notice errorbox"><b>Generation failed</b><p>{error}</p></div>}

          <details className="checks">
            <summary>Show exact prompt sent to the model</summary>
            {messages.map((m, i) => (
              <div key={i}>
                <h5 className="minihead">{m.role.toUpperCase()}</h5>
                <pre className="wrap">{m.content}</pre>
              </div>
            ))}
          </details>
          {rawReply && (
            <details className="checks">
              <summary>Show raw reply of the last run</summary>
              <pre className="wrap">{rawReply}</pre>
            </details>
          )}
        </Panel>

        <Panel>
          <div className="paneltop">
            <h3>Proposals for {req.id} · {reqCases.length}</h3>
            <label className="checkrow">
              <input type="checkbox" checked={showReasoning} onChange={(e) => setShowReasoning(e.target.checked)} />
              Show reasoning
            </label>
          </div>
          <div className="legend">
            <span className="basis basis-source">Quelle</span> from the given source
            <span className="basis basis-assumption">Annahme</span> assumption to confirm
            <span className="basis basis-generated">Generiert</span> derived test idea
          </div>
          {reqCases.length === 0 && (
            <p className="muted">No proposals yet. Adjust the settings and generate.</p>
          )}
          {reqCases.map((c) => (
            <GeneratedCaseCard key={c.id} item={c} showReasoning={showReasoning} />
          ))}
        </Panel>
      </div>
    </>
  );
}
