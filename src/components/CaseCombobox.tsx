import { useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { GeneratedTestCase } from "../types/review";
import { visibleFields } from "../utils/caseText";

/** Entries shown at most in the open list; typing narrows the list further. */
const MAX_OPTIONS = 50;

export type CaseOption = { testCase: GeneratedTestCase; score: number; suggested: boolean };

/** Display label of a case, e.g. "RB-001-… · Alle Bedingungen erfüllt". */
function caseLabel(c: GeneratedTestCase): string {
  return `${c.id} · ${c.title || c.technique || "ohne Titel"}`;
}

/** Text searched when typing: id, title, technique, requirement, GEGEBEN and expected values. */
function haystack(c: GeneratedTestCase): string {
  return [
    c.id,
    c.requirementId,
    c.title,
    c.technique,
    c.given,
    c.then,
    ...visibleFields(c.testData).map((f) => `${f.field} ${f.value}`),
    ...c.expectedFields.map((f) => `${f.field} ${f.value}`),
  ]
    .join(" ")
    .toLocaleLowerCase("de-DE");
}

/**
 * Searchable test-case picker: the examiner types any part of the ID, title,
 * scenario or an expected value and picks from the matching cases. Suggested
 * cases (best scenario fit) are listed first and marked as "Vorschlag".
 */
export function CaseCombobox({
  options,
  value,
  onChange,
}: {
  /** All selectable cases, best fit first. */
  options: CaseOption[];
  value: GeneratedTestCase | undefined;
  onChange: (id: string) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const indexed = useMemo(() => options.map((o) => ({ ...o, text: haystack(o.testCase) })), [options]);
  const terms = query.trim().toLocaleLowerCase("de-DE").split(/\s+/).filter(Boolean);
  const matches = indexed.filter((o) => terms.every((t) => o.text.includes(t))).slice(0, MAX_OPTIONS);

  const choose = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      choose(matches[active].testCase.id);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div className="combobox">
      <div className="comboinput">
        <Search size={15} />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={open ? query : value ? caseLabel(value) : ""}
          placeholder="Testfall suchen: ID, Titel, Szenario oder erwarteter Wert"
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          // Delay so a click on an option is handled before the list closes.
          onBlur={() => window.setTimeout(() => { setOpen(false); setQuery(""); }, 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <ChevronDown size={15} className="muted" />
      </div>
      {open && (
        <ul className="combolist" id={listId} role="listbox">
          {matches.length === 0 && <li className="comboempty">Kein Testfall passt zu „{query}“.</li>}
          {matches.map((o, i) => (
            <li
              key={o.testCase.id}
              role="option"
              aria-selected={o.testCase.id === value?.id}
              className={(i === active ? "active " : "") + (o.testCase.id === value?.id ? "selected" : "")}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o.testCase.id);
              }}
            >
              <span className="combomain">
                {caseLabel(o.testCase)}
                {o.suggested && <span className="combotag">Vorschlag · Passung {o.score}</span>}
              </span>
              {o.testCase.given && <small className="muted">{o.testCase.given}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
