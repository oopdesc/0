import { useMemo, useState } from 'react';
import { CONCEPTS, EDGES } from '../../core/concepts/graph';

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

const W = 900;
const H = 520;

export function ConceptGraph({ selectedId, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const activeId = hovered ?? selectedId;
  const activeEdges = useMemo(
    () => EDGES.filter((e) => e.from === activeId || e.to === activeId),
    [activeId],
  );
  const neighbours = useMemo(() => {
    const s = new Set<string>([activeId]);
    for (const e of activeEdges) { s.add(e.from); s.add(e.to); }
    return s;
  }, [activeEdges, activeId]);

  return (
    <div className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} className="graph__svg" role="group"
        aria-label="Java と Rust の概念関係図。下の一覧から選択できます。">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {EDGES.map((e, i) => {
          const a = CONCEPTS.find((c) => c.id === e.from);
          const b = CONCEPTS.find((c) => c.id === e.to);
          if (!a || !b) return null;
          const active = e.from === activeId || e.to === activeId;
          return (
            <line key={i} x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H}
              className={`graph__edge ${active ? 'is-active' : ''} ${e.warning ? 'is-warning' : ''}`} />
          );
        })}
        {CONCEPTS.map((c) => {
          const isActive = c.id === activeId;
          const isNeighbour = neighbours.has(c.id);
          return (
            <g key={c.id} transform={`translate(${c.x * W},${c.y * H})`}
              className={`graph__node graph__node--${c.language} ${isActive ? 'is-active' : ''} ${!isNeighbour ? 'is-dim' : ''}`}
              role="button" tabIndex={0}
              aria-label={`${c.label}。${c.summary}`}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(c.id)}
              onBlur={() => setHovered(null)}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.id); } }}>
              <circle r={isActive ? 9 : 6} />
              <text x={12} y={4}>{c.label}</text>
            </g>
          );
        })}
      </svg>

      <div className="graph__legend" aria-hidden="true">
        <span><i className="dot dot--java" /> Java</span>
        <span><i className="dot dot--rust" /> Rust</span>
        <span><i className="dot dot--both" /> 比較・Simulation</span>
        <span><i className="dash dash--warning" /> 誤解しやすい対応</span>
      </div>

      <div className="graph__list">
        <label htmlFor="concept-select">概念を選択（キーボード・スクリーンリーダー用）</label>
        <select id="concept-select" value={selectedId} onChange={(e) => onSelect(e.target.value)}>
          {CONCEPTS.map((c) => <option key={c.id} value={c.id}>{c.label} — {c.group}</option>)}
        </select>
        <ul>
          {activeEdges.map((e, i) => {
            const other = CONCEPTS.find((c) => c.id === (e.from === activeId ? e.to : e.from));
            return (
              <li key={i} className={e.warning ? 'is-warning' : ''}>
                <button type="button" onClick={() => other && onSelect(other.id)}>{other?.label}</button>
                <strong>{e.relation}</strong>
                <span>{e.note}</span>
              </li>
            );
          })}
          {activeEdges.length === 0 && <li>この概念はまだ孤立しています。</li>}
        </ul>
      </div>
    </div>
  );
}
