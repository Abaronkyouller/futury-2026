import { useState } from "react";
import { Upload } from "lucide-react";
import { Header } from "../components/Header";
import { Panel } from "../components/Panel";
import { Status } from "../components/Status";

/**
 * Validation & report (H5/H6). Illustrative only: no payroll data set is
 * parsed or compared yet (data format and comparison rules are open, D4).
 */
export function Validation() {
  const [file, setFile] = useState("");
  return (
    <>
      <Header
        title="Validierung & Prüfbericht"
        subtitle="Aus der Entgeltabrechnungssoftware exportierte Datensätze werden mit den erwarteten Ergebnissen verglichen. Über bestanden/nicht bestanden entscheidet die Regel-Engine; die KI formuliert nur die Erläuterung."
      />
      <div className="chips">
        <span className="warm">Beispieldaten – Datenformat und Vergleichsregeln sind noch offen</span>
      </div>
      <div className="validationtop">
        <label className="upload">
          <Upload size={24} />
          <b>Datensätze aus der Entgeltabrechnung hochladen</b>
          <span>{file ? `${file} – Auswertung noch nicht angebunden` : "Dateien hierher ziehen oder auswählen · wird lokal verarbeitet"}</span>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0]?.name || "")} />
        </label>
        {[
          ["Eingegangen", "61"],
          ["Bestanden", "55"],
          ["Fehlgeschlagen", "6"],
          ["Noch ausstehend", "153"],
        ].map(([a, b]) => (
          <Panel key={a}>
            <small>{a}</small>
            <div className={"metric " + (a === "Fehlgeschlagen" ? "red" : a === "Bestanden" ? "green" : "")}>{b}</div>
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="paneltop">
          <div>
            <code>TC-028-04 · Datensatz #0412</code>
            <h3>Letzter Monat bei Beginn der AU noch nicht abgerechnet</h3>
          </div>
          <Status value="Fehlgeschlagen" />
        </div>
        <table>
          <thead>
            <tr>
              {["Feld", "Erwartet", "Tatsächlich", "Ergebnis"].map((x) => (
                <th key={x}>{x}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Beginn Arbeitsunfähigkeit", "02.10.2026", "02.10.2026", "✓ Übereinstimmung"],
              ["Bemessungszeitraum von", "01.08.2026", "01.09.2026", "✕ Abweichung"],
              ["Bemessungszeitraum bis", "31.08.2026", "30.09.2026", "✕ Abweichung"],
              ["Arbeitsentgelt im Zeitraum", "3.200,00 €", "3.200,00 €", "✓ Übereinstimmung"],
            ].map((r) => (
              <tr className={r[3].includes("Abweichung") ? "mismatch" : ""} key={r[0]}>
                {r.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="two inset">
          <div className="subpanel">
            <h5>ERLÄUTERUNG · KI-FORMULIERT, REGELGEPRÜFT</h5>
            Die Software hat September 2026 als Bemessungszeitraum gemeldet. Dieser Monat war bei Beginn der Arbeitsunfähigkeit am
            02.10.2026 noch nicht abgerechnet; daher hätte der letzte abgerechnete Zeitraum, August 2026, verwendet werden müssen.
          </div>
          <div className="subpanel">
            <h5>NACHVERFOLGUNG</h5>
            <div className="tags">
              <span>§ 47 SGB V</span>→<span>REQ-EEL-028</span>→<span>R-028</span>→<span>TC-028-04</span>→<span>#0412 fehlgeschlagen</span>
            </div>
            <p>Anforderung vom Systemprüfer am 21.10.2026 genehmigt (Beispieldaten)</p>
          </div>
        </div>
      </Panel>
      <Panel>
        <div className="two">
          <div>
            <h3>Prüfbericht für die ITSG-Systemprüfung</h3>
            <p>Der Entwurf wird mit jedem validierten Datensatz aktualisiert. Jeder Befund verweist auf seinen Quellabsatz.</p>
            <div className="actions">
              <button onClick={() => window.print()}>Als PDF drucken</button>
              <button className="primary" onClick={() => alert("Demo: Die Einreichung erfordert eine Backend-Anbindung.")}>
                Zur Systemprüfung einreichen
              </button>
            </div>
          </div>
          <table className="detail">
            <tbody>
              {[
                ["1 · Umfang, Produktversion und Spezifikationsstand", "Vollständig"],
                ["2 · Abdeckungsmatrix der Anforderungen", "61 / 214 Fälle"],
                ["3 · Befunde mit Nachverfolgung", "6 Befunde"],
                ["4 · Offene Punkte und nicht abgedeckte Anforderungen", "In Bearbeitung"],
                ["5 · Freigabe durch den Prüfer", "Nicht unterschrieben"],
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
