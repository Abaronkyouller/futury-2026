import type { Privacy, TestDatasets } from "../types/review";

/**
 * Privacy of examiner test datasets ("Öffentlich" / "Privat").
 * Private datasets are shown in the app but left out of every PDF and CSV export.
 */

/** Visibility of dataset row `i`. */
export const rowPrivacy = (d: TestDatasets, i: number): Privacy => d.rowPrivacy?.[i] ?? "Öffentlich";

/** Only the public rows of a case's datasets. */
export function publicRows(d: TestDatasets | undefined): string[][] {
  return d ? d.rows.filter((_, i) => rowPrivacy(d, i) === "Öffentlich") : [];
}

/** Note printed in exports so readers know datasets may have been left out. */
export const PRIVACY_EXPORT_NOTE = "Als „Privat“ markierte Testdatensätze sind in diesem Export nicht enthalten.";
