/**
 * 概念マップ。
 *
 * CONCEPTS の prereqs（先に知っておくと理解が早い関係）だけを描く。手で座標を置かず、
 * 「前提の深さ」で列を決めるので、概念を足しても崩れない。ノードは教材へリンクし、
 * 学習履歴がある概念は状態の色で塗る（苦手・期限・再現済みなど）。
 */
import { useMemo } from 'react';
import { CONCEPTS } from '../content/concepts';
import { Link } from '../lib/router';
import type { Concept } from '../content/types';
import { progressOf, PROGRESS_LABEL, type ProgressKey } from '../lib/learn';
import { useStore } from '../state/useStore';

const W = 920;
const COL_W = 150;
const ROW_H = 34;

function depthOf(c: Concept, byId: Map<string, Concept>, cache = new Map<string, number>(), seen = new Set<string>()): number {
  const hit = cache.get(c.id);
  if (hit !== undefined) return hit;
  if (seen.has(c.id)) return 0; // 循環はしない前提だが、壊れたデータでも止まるように
  seen.add(c.id);
  let d = 0;
  for (const p of c.prereqs) {
    const parent = byId.get(p);
    if (parent && parent.lang === c.lang) d = Math.max(d, depthOf(parent, byId, cache, seen) + 1);
  }
  seen.delete(c.id);
  cache.set(c.id, d);
  return d;
}

function layout(lang: 'java' | 'rust') {
  const list = CONCEPTS.filter((c) => c.lang === lang);
  const byId = new Map(CONCEPTS.map((c) => [c.id, c]));
  const cache = new Map<string, number>();
  const cols = new Map<number, Concept[]>();
  for (const c of list) {
    const d = depthOf(c, byId, cache);
    const arr = cols.get(d) ?? [];
    arr.push(c);
    cols.set(d, arr);
  }
  const pos = new Map<string, { x: number; y: number }>();
  let maxRows = 0;
  for (const [d, arr] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
    arr.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    maxRows = Math.max(maxRows, arr.length);
    arr.forEach((c, i) => pos.set(c.id, { x: 60 + d * COL_W, y: 50 + i * ROW_H }));
  }
  const height = 90 + maxRows * ROW_H;
  const width = Math.max(W, 60 + (cols.size - 1) * COL_W + COL_W);
  return { list, pos, width, height };
}

const STATE_CLASS: Record<ProgressKey, string> = {
  untouched: 'is-untouched',
  learning: 'is-learning',
  unstable: 'is-unstable',
  due: 'is-due',
  reproduced: 'is-reproduced',
  transfer: 'is-transfer',
  weak: 'is-weak',
  recent_error: 'is-error',
};

function MapFor({ lang }: { lang: 'java' | 'rust' }) {
  const state = useStore();
  const { list, pos, width, height } = useMemo(() => layout(lang), [lang]);

  const edges = useMemo(() => {
    const out: { from: string; to: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const c of list) {
      for (const p of c.prereqs) {
        const a = pos.get(p);
        const b = pos.get(c.id);
        if (!a || !b) continue;
        out.push({ from: p, to: c.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
    return out;
  }, [list, pos]);

  const weak = list.filter((c) => {
    const k = progressOf(c.id, state);
    return k === 'weak' || k === 'recent_error';
  });

  return (
    <section className="map" aria-labelledby={`map-${lang}`}>
      <div className="map__head">
        <h2 id={`map-${lang}`}>{lang === 'java' ? 'Java' : 'Rust'} の前提関係</h2>
        <p className="map__lead">
          {list.length} 概念。矢印は「先に知っておくと理解が早い」向き（前提 → 応用）。
          {weak.length > 0 ? ` いま苦手な概念が ${weak.length} 個あります。` : ' まだ苦手な概念はありません。'}
        </p>
      </div>
      <div className="map__scroll">
        <svg
          className="map__svg"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`${lang} の概念 ${list.length} 個の前提関係図`}
        >
          <defs>
            <marker id={`arrow-${lang}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="map__arrowhead" />
            </marker>
          </defs>
          {edges.map((e) => (
            <path
              key={`${e.from}->${e.to}`}
              d={`M ${e.x1 + 96} ${e.y1} C ${e.x1 + 120} ${e.y1}, ${e.x2 - 26} ${e.y2}, ${e.x2 - 4} ${e.y2}`}
              className="map__edge"
              markerEnd={`url(#arrow-${lang})`}
            />
          ))}
          {list.map((c) => {
            const p = pos.get(c.id);
            if (!p) return null;
            const k = progressOf(c.id, state);
            return (
              <Link key={c.id} to={`/learn/${c.lang}/${c.id}`} className="map__node-link">
                <g className={`map__node ${STATE_CLASS[k]}`} transform={`translate(${p.x}, ${p.y})`}>
                  <rect x="0" y="-12" rx="6" ry="6" width="96" height="24" />
                  <text x="8" y="4">
                    {c.name.length > 8 ? c.name.slice(0, 8) + '…' : c.name}
                  </text>
                  <title>{`${c.name} — ${PROGRESS_LABEL[k]}`}</title>
                </g>
              </Link>
            );
          })}
        </svg>
      </div>
      <ul className="map__legend">
        {(['untouched', 'learning', 'unstable', 'reproduced', 'transfer', 'weak', 'recent_error'] as ProgressKey[]).map((k) => (
          <li key={k}>
            <span className={`map__swatch ${STATE_CLASS[k]}`} aria-hidden="true" />
            {PROGRESS_LABEL[k]}
          </li>
        ))}
      </ul>
      <p className="map__note">
        ノードを選ぶと、その概念の問題へ移動します（図は前提関係だけで、点数や順位ではありません）。
      </p>
    </section>
  );
}

export function MapPage() {
  const state = useStore();
  const start = CONCEPTS.filter((c) => progressOf(c.id, state) === 'untouched').length;
  return (
    <div className="page page--read">
      <h1>概念マップ</h1>
      <p className="lead">
        概念どうしの前提関係を 1 枚にしました。登録した前提（prereqs）だけを線で引き、
        {start > 0 ? `まだ触れていない概念は ${start} 個です。` : 'すべての概念に触れています。'}
        線の根元から順に進むと、つまずきが連鎖しにくくなります。
      </p>
      <MapFor lang="java" />
      <MapFor lang="rust" />
      <p className="note">
        Java の 継承 → 上書き → ポリモーフィズム、Rust の 所有権 → 借用 → ライフタイム のように、
        前の概念が分かっていないと次の説明が「暗記」になる関係だけを描いています。
      </p>
    </div>
  );
}
