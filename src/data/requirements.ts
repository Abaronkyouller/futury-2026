import type { Req } from "../types/requirement";

export const initial: Req[] = [
  {
    id: "REQ-EEL-031",
    title: "Assessment period covers at least four weeks",
    benefit: "Krankengeld",
    source: "§ 47 SGB V",
    confidence: 0.71,
    status: "Pending",
  },
  {
    id: "REQ-EEL-047",
    title: "Protection period dates must be reported for Mutterschaftsgeld",
    benefit: "Mutterschaftsgeld",
    source: "EEL specification",
    confidence: 0.63,
    status: "Pending",
  },
  {
    id: "REQ-EEL-052",
    title: "One-time payments reported separately from regular pay",
    benefit: "Krankengeld",
    source: "EEL specification",
    confidence: 0.68,
    status: "Pending",
  },
  {
    id: "REQ-EEL-028",
    title: "Assessment period is the last settled pay period before incapacity",
    benefit: "Krankengeld",
    source: "§ 47 SGB V",
    confidence: 0.99,
    status: "Approved",
    rule: "R-028",
  },
  {
    id: "REQ-EEL-012",
    title: "Certificate is sent electronically after the insurer's request",
    benefit: "All benefits",
    source: "EEL specification",
    confidence: 0.98,
    status: "Approved",
    rule: "R-012",
  },
];
