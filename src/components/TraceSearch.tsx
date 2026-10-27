import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { Search } from "lucide-react";
import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import { ORIGIN_LABEL } from "../types/review";
import { requirementHaystack } from "../reasoning/reasoningGraph";
import { truncate } from "../documents/text";
import { sanitizeCaseTitle, visibleFields } from "../utils/caseText";

/** Suggestions shown per group (requirements, test cases). */
const MAX_PER_GROUP = 8;

type Suggestion =
  | { type: "req"; key: string; req: Req; label: string; hint: string }
  | { type: "case"; key: string; testCase: GeneratedTestCase; label: string; hint: string };

const lower = (s: string) => s.toLocaleLowerCase("de-DE");

/** Text searched for a test case: id, title, technique, scenario and expected values. */
function caseHaystack(c: GeneratedTestCase): string {
  return lower([c.id, c.requirementId, c.title, c.technique, c.given, ...visibleFields(c.testData).map((f) => `${f.field} ${f.value}`), ...c.expectedFields.map((f) => `${f.field} ${f.value}`)].join(" "));
}

/**
 * Search field of the Nachverfolgbarkeit page. Clicking or typing opens a
 * list of suggestions (requirements and test cases) like the test-case picker
 * on "Validierung & Bericht"; picking one jumps to its traceback.
 */
export function TraceSearch({ requirements, cases, ordered, query, onQuery, onPickRequirement, onPickCase }: {
  requirements: Req[];
  cases: GeneratedTestCase[];
  /** Requirements in display order; used for the suggestions of an empty query. */
  ordered: Req[];
  query: string;
  onQuery: (q: string) => void;
  onPickRequirement: (r: Req) => void;
  onPickCase: (c: GeneratedTestCase) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const terms = lower(query.trim()).split(/\s+/).filter(Boolean);
  const visibleCases = cases.filter((c) => c.review.decision !== "Abgelehnt");
  const countOf = (r: Req) => visibleCases.filter((c) => c.requirementId === r.id).length;

  const reqHits = (terms.length ? requirements.filter((r) => { const h = requirementHaystack(r, cases); return terms.every((t) => h.includes(t)); }) : ordered)
    .slice(0, MAX_PER_GROUP);
  const caseHits = terms.length ? visibleCases.filter((c) => { const h = caseHaystack(c); return terms.every((t) => h.includes(t)); }).slice(0, MAX_PER_GROUP) : [];
  const suggestions: Suggestion[] = [
    ...reqHits.map((r): Suggestion => ({
      type: "req", key: `r-${r.id}`, req: r, label: `${r.id} · ${truncate(r.title, 110)}`,
      hint: `${r.origin ? `${r.origin.documentName} · ${r.origin.sectionLabel}` : `${r.source} · Beispieldaten`} · ${countOf(r)} Testfall/Testfälle`,
    })),
    ...caseHits.map((c): Suggestion => ({
      type: "case", key: `c-${c.id}`, testCase: c, label: `${c.id} · ${sanitizeCaseTitle(c.title) || c.technique}`,
      hint: `${c.requirementId} · ${ORIGIN_LABEL[c.origin.kind]} · ${c.review.decision}`,
    })),
  ];

  const pick = (s: Suggestion) => {
    if (s.type === "req") onPickRequirement(s.req);
    else onPickCase(s.testCase);
    setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && open && suggestions[active]) { e.preventDefault(); pick(suggestions[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="combobox tracesearch">
      <div className="search wide">
        <Search size={15} />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Anforderung, Testfall, Dokument oder Begriff aus dem Zitat suchen"
          value={query}
          onFocus={() => { setOpen(true); setActive(0); }}
          // Delay so a click on a suggestion is handled before the list closes.
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { onQuery(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && (
        <ul className="combolist" id={listId} role="listbox">
          {suggestions.length === 0 && <li className="comboempty">Nichts passt zu „{query}“.</li>}
          {suggestions.map((s, i) => (
            <li
              key={s.key}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
            >
              <span className="combomain">
                <span className={`combotag ${s.type === "case" ? "combotag-case" : ""}`}>{s.type === "req" ? "Anforderung" : "Testfall"}</span>
                {s.label}
              </span>
              <small className="muted">{s.hint}</small>
            </li>
          ))}
          {!terms.length && suggestions.length > 0 && <li className="comboempty">Tippen Sie, um auch nach Testfällen, Dokumenten oder Begriffen zu suchen.</li>}
        </ul>
      )}
    </div>
  );
}
