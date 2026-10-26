import { useEffect, useRef, useSyncExternalStore } from 'react';
import type * as React from 'react';
import { universe } from '../../core/simulation/controller';
import type { PresetId } from '../../core/world';

interface Props {
  compact?: boolean;
  showControls?: boolean;
  className?: string;
}

const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: 'solar', label: '太陽系' },
  { id: 'spiral', label: '渦巻銀河' },
  { id: 'accretion', label: '降着円盤' },
  { id: 'asteroid', label: '小惑星帯' },
];

export function UniverseCanvas({ compact = false, showControls = true, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; rotate: boolean; moved: number } | null>(null);
  const pinchDistance = useRef<number | null>(null);
  useSyncExternalStore(universe.subscribe, universe.getSnapshot);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    universe.attach(canvas);
    return () => universe.detach(canvas);
  }, []);

  const stats = universe.getStats();
  const selected = universe.selectedBody;
  const reduced = universe.options.reducedMotion;

  function localPoint(e: React.PointerEvent | React.WheelEvent | React.MouseEvent): [number, number] {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const [x, y] = localPoint(e);
    pointers.current.set(e.pointerId, { x, y });
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x, y, rotate: e.shiftKey || e.button === 2, moved: 0 };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const [x, y] = localPoint(e);
    const prev = pointers.current.get(e.pointerId);
    if (prev) pointers.current.set(e.pointerId, { x, y });
    if (pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const d = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      if (pinchDistance.current !== null && d > 0) {
        universe.zoomBy(d / pinchDistance.current);
      }
      pinchDistance.current = d;
      return;
    }
    if (!prev) {
      const body = universe.hitTest(x, y);
      universe.hoveredId = body?.id ?? null;
      return;
    }
    const dx = x - prev.x;
    const dy = y - prev.y;
    if (drag.current) drag.current.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.current?.rotate) universe.rotateBy(dx * 0.005);
    else universe.panBy(dx, dy);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const [x, y] = localPoint(e);
    pointers.current.delete(e.pointerId);
    pinchDistance.current = null;
    if (drag.current && drag.current.moved < 6) universe.selectAt(x, y);
    drag.current = null;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 40 : 14;
    switch (e.key) {
      case 'ArrowLeft': universe.panBy(step, 0); break;
      case 'ArrowRight': universe.panBy(-step, 0); break;
      case 'ArrowUp': universe.panBy(0, step); break;
      case 'ArrowDown': universe.panBy(0, -step); break;
      case '+': case '=': universe.zoomBy(1.18); break;
      case '-': case '_': universe.zoomBy(1 / 1.18); break;
      case '[': universe.rotateBy(-0.12); break;
      case ']': universe.rotateBy(0.12); break;
      case ' ': universe.togglePaused(); break;
      case 'f': case 'F': universe.focusSelected(); break;
      case 'r': case 'R': universe.resetView(); break;
      case 'c': case 'C': universe.options.compare ? universe.clearSnapshot() : universe.snapshot(); break;
      case '1': universe.setPreset('solar'); break;
      case '2': universe.setPreset('spiral'); break;
      case '3': universe.setPreset('accretion'); break;
      case '4': universe.setPreset('asteroid'); break;
      default: return;
    }
    e.preventDefault();
  }

  return (
    <section className={`universe ${compact ? 'universe--compact' : ''} ${className}`} aria-label="宇宙シミュレーション">
      <div
        className="universe__stage"
        tabIndex={0}
        role="application"
        aria-label="宇宙ビュー。矢印キーで移動、+/-で拡大縮小、[ ]で回転、Spaceで一時停止、fで選択天体に注目、1〜4でプリセット切替。"
        onKeyDown={onKeyDown}
      >
        <canvas
          ref={canvasRef}
          className="universe__canvas"
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => { e.preventDefault(); universe.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }}
          onDoubleClick={(e) => { const [x, y] = localPoint(e); const b = universe.selectAt(x, y); if (b) universe.focusSelected(); }}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="universe__corner" aria-hidden="true">
          <span>ORRERY / SIM</span>
          <span>{stats.bodies} BODIES</span>
        </div>
        {selected && (
          <div className="universe__selected">
            <span className="universe__selected-label">{selected.label || `#${selected.id}`}</span>
            <span>{selected.kind} · x {selected.x.toFixed(1)} · y {selected.y.toFixed(1)}</span>
          </div>
        )}
        {reduced && <p className="universe__reduced">reduced motion: 静止表示中</p>}
      </div>

      <p className="sr-only" aria-live="polite">
        現在 {stats.bodies} 個の天体。{universe.options.paused ? '一時停止中' : '稼働中'}。
        計算カーネルは {stats.kernelName === 'wasm' ? 'WebAssembly' : 'TypeScript'}。
      </p>

      {showControls && (
        <div className="universe__controls">
          <div className="universe__toolbar" role="group" aria-label="シミュレーション操作">
            <button type="button" onClick={() => universe.togglePaused()} aria-pressed={universe.options.paused}>
              {universe.options.paused ? '▶ 再生' : '❚❚ 停止'}
            </button>
            <button type="button" onClick={() => universe.zoomBy(1.2)} aria-label="拡大">＋</button>
            <button type="button" onClick={() => universe.zoomBy(1 / 1.2)} aria-label="縮小">−</button>
            <button type="button" onClick={() => universe.rotateBy(-0.18)} aria-label="左に回転">↺</button>
            <button type="button" onClick={() => universe.rotateBy(0.18)} aria-label="右に回転">↻</button>
            <button type="button" onClick={() => universe.focusSelected()} disabled={!selected}>注目</button>
            <button type="button" onClick={() => universe.resetView()}>視点リセット</button>
            <button type="button" onClick={() => universe.options.compare ? universe.clearSnapshot() : universe.snapshot()} aria-pressed={universe.options.compare}>
              比較
            </button>
          </div>

          <div className="universe__sliders">
            <label>
              <span>時間倍率 {universe.options.timeScale.toFixed(1)}×</span>
              <input type="range" min="0.1" max="4" step="0.1" value={universe.options.timeScale}
                onChange={(e) => universe.setTimeScale(Number(e.target.value))} />
            </label>
            <label>
              <span>重力 {universe.world.gravity.toFixed(1)}</span>
              <input type="range" min="0" max="6" step="0.1" value={universe.world.gravity}
                onChange={(e) => universe.setGravity(Number(e.target.value))} />
            </label>
            <label>
              <span>描画品質</span>
              <select value={universe.options.quality}
                onChange={(e) => universe.setQuality(e.target.value as 'auto' | 'high' | 'balanced' | 'battery')}>
                <option value="auto">自動</option>
                <option value="high">高画質</option>
                <option value="balanced">標準</option>
                <option value="battery">省電力</option>
              </select>
            </label>
          </div>

          <div className="universe__presets" role="group" aria-label="宇宙モデル">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={stats.preset === p.id ? 'is-active' : ''}
                onClick={() => universe.setPreset(p.id)} aria-pressed={stats.preset === p.id}>
                {p.label}
              </button>
            ))}
            <button type="button" onClick={() => universe.resetWorld()}>リセット</button>
          </div>

          <div className="universe__toggles">
            <label><input type="checkbox" checked={universe.options.trails} onChange={(e) => universe.setTrails(e.target.checked)} /> 軌跡</label>
            <label><input type="checkbox" checked={universe.options.showGrid} onChange={(e) => universe.setGrid(e.target.checked)} /> グリッド</label>
            <span className="universe__meta">{stats.fps} fps · {stats.kernelName.toUpperCase()} · {stats.visible ? '表示中' : '非表示'}</span>
          </div>
        </div>
      )}

      <p className="universe__disclaimer">
        教育用の簡略重力モデル（ソフトニング付き中心引力）です。実観測データでも一般相対論シミュレーションでもありません。
      </p>
    </section>
  );
}
