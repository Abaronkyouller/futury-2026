import { AlertTriangle } from "lucide-react";
import { useReviewStore } from "../state/reviewContext";

/**
 * Warning shown on every page when the browser refused to save (storage full
 * or blocked). Changes then live only in this tab and are lost on reload.
 */
export function PersistBanner() {
  const { persistFailed } = useReviewStore();
  if (!persistFailed) return null;
  return (
    <div className="persistwarn" role="alert">
      <AlertTriangle size={18} />
      <span>
        <b>Speichern im Browser fehlgeschlagen.</b> Der Browserspeicher ist voll oder gesperrt – Änderungen bleiben nur bis zum Neuladen erhalten.
        Testberichte und die Software-Liste werden getrennt gesichert, solange dafür noch Platz ist. Entfernen Sie nicht mehr benötigte Testfälle (Änderungsprotokoll → „Testfälle zurücksetzen“) oder exportieren Sie wichtige Ergebnisse.
      </span>
    </div>
  );
}
