
export type Req = {
  id: string;
  title: string;
  benefit: string;
  source: string;
  confidence: number;
  status: "Pending" | "Approved";
  rule?: string;
};
