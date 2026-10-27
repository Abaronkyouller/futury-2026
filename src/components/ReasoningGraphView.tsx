import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { GRAPH_LAYERS } from "../reasoning/reasoningGraph";
import type { GraphEdge, GraphNode } from "../reasoning/reasoningGraph";

/** Layout constants (px). Five nodes per row; longer layers wrap into further rows. */
const NODE_W = 168;
const NODE_H = 78;
const GAP_X = 16;
const GAP_Y = 54;
const SUBROW_GAP = 14;
const PER_ROW = 5;
const GUTTER = 128;
const PAD = 12;
const CONTENT_W = PER_ROW * (NODE_W + GAP_X) - GAP_X;

type Placed = GraphNode & { x: number; y: number };

/** Layered top-down layout: one band per layer, nodes centred, wrapped after PER_ROW. */
function layout(nodes: GraphNode[]) {
  const placed: Placed[] = [];
  const bands: { label: string; y: number; h: number }[] = [];
  let y = PAD;
  GRAPH_LAYERS.forEach((label, layer) => {
    const inLayer = nodes.filter((n) => n.layer === layer);
    if (!inLayer.length) return;
    const rows = Math.ceil(inLayer.length / PER_ROW);
    inLayer.forEach((n, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, inLayer.length - row * PER_ROW);
      const rowW = inRow * (NODE_W + GAP_X) - GAP_X;
      const col = i % PER_ROW;
      placed.push({ ...n, x: GUTTER + (CONTENT_W - rowW) / 2 + col * (NODE_W + GAP_X), y: y + row * (NODE_H + SUBROW_GAP) });
    });
    const h = rows * NODE_H + (rows - 1) * SUBROW_GAP;
    bands.push({ label, y, h });
    y += h + GAP_Y;
  });
  return { placed, bands, width: GUTTER + CONTENT_W + PAD, height: y - GAP_Y + PAD };
}

/** All nodes reachable upstream and downstream from `id` (the reasoning path through it). */
function pathThrough(id: string, edges: GraphEdge[]): Set<string> {
  const keep = new Set([id]);
  for (const dir of ["up", "down"] as const) {
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift() as string;
      for (const e of edges) {
        const next = dir === "up" ? (e.to === cur ? e.from : undefined) : (e.from === cur ? e.to : undefined);
        if (next && !keep.has(next)) { keep.add(next); queue.push(next); }
      }
    }
  }
  return keep;
}

/**
 * Knowledge graph of how a test case came about. Clicking a node highlights
 * the reasoning path through it (everything it is based on and everything
 * derived from it) and shows its details next to the graph.
 */
export function ReasoningGraphView({ nodes, edges, selectedId, onSelect }: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string;
  onSelect: (node: GraphNode) => void;
}) {
  const { placed, bands, width, height } = useMemo(() => layout(nodes), [nodes]);
  const byId = useMemo(() => new Map(placed.map((n) => [n.id, n])), [placed]);
  const path = useMemo(() => pathThrough(selectedId, edges), [selectedId, edges]);

  return (
    <div className="rgraph" style={{ width, height }}>
      {bands.map((b) => (
        <div key={b.label} className="rband" style={{ top: b.y - 6, height: b.h + 12, width: width - PAD }}>
          <small>{b.label}</small>
        </div>
      ))}
      <svg width={width} height={height} className="redges" aria-hidden="true">
        <defs>
          <marker id="rg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" className="rarrowhead" />
          </marker>
        </defs>
        {edges.map((e) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
          const bend = Math.max(28, (y2 - y1) / 2);
          const on = path.has(e.from) && path.has(e.to);
          return (
            <g key={e.id} className={`redge e-${e.evidence} ${on ? "on" : "off"}`}>
              <path d={`M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2 - 2}`} markerEnd="url(#rg-arrow)">
                <title>{e.relation}</title>
              </path>
              {on && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2} textAnchor="middle">{e.relation}</text>}
            </g>
          );
        })}
      </svg>
      {placed.map((n) => (
        <button
          key={n.id}
          className={`rnode ev-${n.evidence} ${n.warnings.length ? "haswarn" : ""} ${n.id === selectedId ? "tactive" : ""} ${path.has(n.id) ? "" : "dim"}`}
          style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
          onClick={() => onSelect(n)}
          title={n.label}
        >
          <small>{n.kind}</small>
          <span>{n.label}</span>
          {n.warnings.length > 0 && (
            <i className="rwarn" title={n.warnings.join("\n")}><AlertTriangle size={11} /> {n.warnings.length}</i>
          )}
        </button>
      ))}
    </div>
  );
}
