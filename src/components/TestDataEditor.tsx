import { useState } from "react";
import { Download, Plus, Trash2, X } from "lucide-react";
import type { ExpectedField, GeneratedTestCase, Privacy, TestDatasets } from "../types/review";
import { PRIVACY_LEVELS } from "../types/review";
import { PRIVACY_EXPORT_NOTE, rowPrivacy } from "../utils/privacy";
import { OPEN_VALUE_MARKER } from "../config/ai";
import { useReviewStore } from "../state/reviewContext";
import { useConfirm } from "../state/confirmContext";
import { download } from "../utils/download";
import { toCsv } from "../utils/format";
import { randomRows } from "../utils/randomTestData";

/** Upper limit for one "+" action, so a typo like 1000 doesn't flood the table. */
const MAX_NEW_ROWS = 100;
/** Columns used when the case has no proposed test data to take field names from. */
const DEFAULT_COLUMNS = ["Bezeichnung", "Wert"];

/** Column names from the proposal, without duplicates. */
function columnsFrom(template: ExpectedField[]): string[] {
  const names = [...new Set(template.map((f) => f.field.trim()).filter(Boolean))];
  return names.length ? names : DEFAULT_COLUMNS;
}

/**
 * Test datasets of one case, maintained by the examiner.
 * - Starts with no datasets; "+" asks how many to create, either with random
 *   values derived from the proposal (src/utils/randomTestData.ts) or empty.
 * - Every cell is editable; rows and columns can be added and deleted.
 * - Every dataset is "Öffentlich" or "Privat"; private datasets are left out of the CSV.
 * - Export as CSV (UTF-8 with BOM so Excel shows umlauts correctly).
 * Adding/deleting is logged in the change log; cell edits are saved silently.
 */
export function TestDataEditor({ item, template, canRandomize = true }: {
  item: GeneratedTestCase;
  template: ExpectedField[];
  /** False for cases without concrete test data (see testDataAvailability): no new datasets can be created. */
  canRandomize?: boolean;
}) {
  const { setTestDatasets } = useReviewStore();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [count, setCount] = useState("1");
  const [prefillChoice, setPrefill] = useState(true);
  const prefill = canRandomize && prefillChoice;
  const [newColumn, setNewColumn] = useState("");
  const [newPrivacy, setNewPrivacy] = useState<Privacy>("Öffentlich");

  const data: TestDatasets = item.datasets ?? { columns: columnsFrom(template), rows: [], updatedAt: "" };
  const { columns, rows } = data;
  // Visibility per row, aligned with `rows`.
  const privacies = rows.map((_, i) => rowPrivacy(data, i));
  const privateCount = privacies.filter((p) => p === "Privat").length;
  const save = (next: Omit<TestDatasets, "updatedAt">, change?: string) =>
    setTestDatasets(item.id, { ...next, updatedAt: "" }, change); // timestamp is set by the store

  const n = Math.min(MAX_NEW_ROWS, Math.max(1, Math.floor(Number(count) || 0)));
  const createRows = () => {
    const proposed = (col: string) => {
      const value = template.find((f) => f.field.trim() === col)?.value ?? "";
      return value.includes(OPEN_VALUE_MARKER) ? "" : value;
    };
    const fresh = prefill ? randomRows(columns, proposed, n, rows) : Array.from({ length: n }, () => columns.map(() => ""));
    save({ columns, rows: [...rows, ...fresh], rowPrivacy: [...privacies, ...fresh.map(() => newPrivacy)] }, `${n} Datensatz/Datensätze angelegt${prefill ? " (zufällige Werte)" : " (leer)"}, ${newPrivacy.toLowerCase()}`);
    setAdding(false);
    setCount("1");
  };
  const editCell = (r: number, c: number, value: string) =>
    save({ columns, rows: rows.map((row, i) => (i === r ? row.map((v, j) => (j === c ? value : v)) : row)), rowPrivacy: privacies });
  const deleteRow = (r: number) => save({ columns, rows: rows.filter((_, i) => i !== r), rowPrivacy: privacies.filter((_, i) => i !== r) }, `Datensatz ${r + 1} gelöscht`);
  const setRowPrivacy = (r: number, privacy: Privacy) =>
    save({ columns, rows, rowPrivacy: privacies.map((p, i) => (i === r ? privacy : p)) }, `Datensatz ${r + 1}: ${privacy}`);
  const deleteAll = async () => {
    if (await confirm({ title: "Alle Testdaten löschen?", message: `Alle ${rows.length} Datensätze dieses Testfalls werden gelöscht. Der Vorschlag bleibt erhalten.`, confirmLabel: "Alle löschen" })) {
      save({ columns, rows: [], rowPrivacy: [] }, `Alle ${rows.length} Datensätze gelöscht`);
    }
  };
  const addColumn = () => {
    const name = newColumn.trim();
    if (!name || columns.includes(name)) return;
    save({ columns: [...columns, name], rows: rows.map((row) => [...row, ""]), rowPrivacy: privacies }, `Spalte „${name}“ hinzugefügt`);
    setNewColumn("");
  };
  const deleteColumn = async (c: number) => {
    const filled = rows.some((row) => row[c]?.trim());
    if (filled && !(await confirm({ title: `Spalte „${columns[c]}“ löschen?`, message: "Die Werte dieser Spalte gehen in allen Datensätzen verloren.", confirmLabel: "Spalte löschen" }))) return;
    save({ columns: columns.filter((_, i) => i !== c), rows: rows.map((row) => row.filter((_, i) => i !== c)), rowPrivacy: privacies }, `Spalte „${columns[c]}“ gelöscht`);
  };
  // Only public datasets are exported; the numbering keeps the row numbers shown in the app.
  const publicIdx = rows.map((_, i) => i).filter((i) => privacies[i] === "Öffentlich");
  const exportCsv = () =>
    download(`testdaten-${item.id}.csv`, "\uFEFF" + toCsv([["Nr.", ...columns], ...publicIdx.map((i) => [String(i + 1), ...rows[i]])]));

  return (
    <div className="testdata">
      <div className="testdatahead">
        <span className="muted small">
          {rows.length === 0 ? "Noch keine Test Datensätze." : `${rows.length} Datensatz/Datensätze${privateCount ? ` · ${privateCount} privat (nicht im Export)` : ""}`}
        </span>
        <div className="testdataactions">
          {canRandomize && (
            <button className="primary iconbtn" title="Datensätze anlegen" aria-label="Datensätze anlegen" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
              <Plus size={16} />
            </button>
          )}
          <button onClick={exportCsv} disabled={publicIdx.length === 0} title={`Öffentliche Testdaten als CSV herunterladen. ${PRIVACY_EXPORT_NOTE}`}><Download size={15} /> CSV</button>
          {rows.length > 0 && <button onClick={deleteAll} title="Alle Datensätze löschen"><Trash2 size={15} /> Alle löschen</button>}
        </div>
      </div>

      {adding && canRandomize && (
        <div className="testdataadd">
          <label className="field inline">Wie viele Datensätze?
            <input
              type="number" min={1} max={MAX_NEW_ROWS} value={count} autoFocus
              onChange={(e) => setCount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createRows(); if (e.key === "Escape") setAdding(false); }}
            />
          </label>
          <label className="checkrow">
            <input type="checkbox" checked={prefill} disabled={!canRandomize} onChange={(e) => setPrefill(e.target.checked)} />
            {canRandomize
              ? "Zufällige Werte erzeugen (angelehnt an den Vorschlag, fiktiv) – sonst leer zum selbst Ausfüllen"
              : "Keine Zufallswerte möglich – Datensätze werden leer angelegt und von Ihnen ausgefüllt"}
          </label>
          <label className="field inline">Sichtbarkeit
            <select value={newPrivacy} onChange={(e) => setNewPrivacy(e.target.value as Privacy)}>
              {PRIVACY_LEVELS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <button className="primary" onClick={createRows}>{n} anlegen</button>
          <button onClick={() => setAdding(false)}>Abbrechen</button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="testdatatable">
          <div className="testdatascroll">
          <table>
            <thead>
              <tr>
                <th className="nr">Nr.</th>
                {columns.map((col, c) => (
                  <th key={col} title={col}>
                    <span className="colname">{col}</span>
                    {columns.length > 1 && (
                      <button className="cellbtn" title={`Spalte „${col}“ löschen`} aria-label={`Spalte ${col} löschen`} onClick={() => deleteColumn(c)}><X size={13} /></button>
                    )}
                  </th>
                ))}
                <th className="privcol" title="Private Datensätze werden nicht exportiert">Sichtbarkeit</th>
                <th className="nr" aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className={privacies[r] === "Privat" ? "privaterow" : ""}>
                  <td className="nr">{r + 1}</td>
                  {columns.map((col, c) => (
                    <td key={col}>
                      <input value={row[c] ?? ""} aria-label={`${col}, Datensatz ${r + 1}`} onChange={(e) => editCell(r, c, e.target.value)} />
                    </td>
                  ))}
                  <td className="privcol">
                    <select className="miniselect" value={privacies[r]} aria-label={`Sichtbarkeit Datensatz ${r + 1}`} onChange={(e) => setRowPrivacy(r, e.target.value as Privacy)}>
                      {PRIVACY_LEVELS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="nr">
                    <button className="cellbtn" title={`Datensatz ${r + 1} löschen`} aria-label={`Datensatz ${r + 1} löschen`} onClick={() => deleteRow(r)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="testdatacol">
            <input placeholder="Neue Spalte, z. B. Arbeitsentgelt" value={newColumn} onChange={(e) => setNewColumn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addColumn(); }} />
            <button onClick={addColumn} disabled={!newColumn.trim() || columns.includes(newColumn.trim())}><Plus size={14} /> Spalte</button>
          </div>
        </div>
      )}
    </div>
  );
}
