import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ConfirmContext } from "../state/confirmContext";
import type { ConfirmOptions } from "../state/confirmContext";

/**
 * In-app confirmation dialog in the page style (replaces window.confirm).
 * Usage via useConfirm() from src/state/confirmContext.ts.
 * Built on the native <dialog> element, so focus stays inside the dialog and
 * Esc cancels.
 */

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), []);

  useEffect(() => {
    const d = ref.current;
    if (pending && d && !d.open) d.showModal();
  }, [pending]);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
    ref.current?.close();
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <dialog
          ref={ref}
          className="confirmdialog"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          onCancel={(e) => { e.preventDefault(); close(false); }}
          // A click on the backdrop (outside the box) cancels.
          onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
        >
          <div className="confirmbox">
            <div className="confirmicon"><AlertTriangle size={22} /></div>
            <div>
              <h3 id="confirm-title">{pending.title}</h3>
              <p id="confirm-message">{pending.message}</p>
            </div>
            <div className="confirmactions">
              <button autoFocus onClick={() => close(false)}>{pending.cancelLabel ?? "Abbrechen"}</button>
              <button className="primary" onClick={() => close(true)}>{pending.confirmLabel ?? "Bestätigen"}</button>
            </div>
          </div>
        </dialog>
      )}
    </ConfirmContext.Provider>
  );
}
