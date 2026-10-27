import { createContext, useContext } from "react";

/** Options of the in-app confirmation dialog (src/components/ConfirmDialog.tsx). */
export type ConfirmOptions = {
  title: string;
  message: string;
  /** Label of the confirming button, e.g. "Entfernen". */
  confirmLabel?: string;
  cancelLabel?: string;
};

export const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

/** `const confirm = useConfirm(); if (await confirm({ ... })) doIt();` – replaces window.confirm. */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}
