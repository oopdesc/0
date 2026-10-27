import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Minus, Plus, Move } from 'lucide-react';
import type { ModelState } from '../domain/types';
import { drawOrbit, type ViewState } from '../simulation/draw';
import { fallbackStars, loadStarfield, STAR_COUNT, STAR_SEED, type StarEngine } from '../simulation/stars';

import type { Quality } from '../domain/settings';
export type { Quality } from '../domain/settings';
interface Props {
  model: ModelState;
  playing: boolean;
  onToggle: () => void;
  speed: number;
  quality: Quality;
  compact?: boolean;
}
export function OrbitScene({ model, playing, onToggle, speed, quality, compact = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ViewState>({ rotation: 0, zoom: 1, selected: null, time: 0 });
  const drawRef = useRef<() => void>(() => {});
  const pointerRef = useRef<{ id: number; x: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [engine, setEngine] = useState<StarEngine>('typescript');

  useEffect(() => { viewRef.current.selected = null; setSelected(null); }, [model]);

  useEffect(() => {
    const canvas = canvasRef.current; const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    let disposed = false; let visible = true; let raf = 0; let last = 0; let lastPaint = 0;
    let stars = fallbackStars(STAR_SEED, STAR_COUNT);
    const dprCap = quality === 'high' ? 2 : quality === 'battery' ? 1 : 1.5;
    const paint = () => {
      if (disposed) return;
      const { width, height } = wrapper.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const w = Math.max(1, Math.round(width * dpr)); const h = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      drawOrbit(ctx, width, height, dpr, stars, model, viewRef.current, quality);
    };
    drawRef.current = paint;
    const tick = (t: number) => {
      if (disposed || !visible || document.hidden || !playing) { raf = 0; last = 0; return; }
      if (!last) last = t;
      if (t - lastPaint >= (quality === 'battery' ? 1000 / 15 : 1000 / 30)) {
        viewRef.current.time += Math.min((t - last) / 1000, 0.1) * speed;
        paint(); lastPaint = t; last = t;
      }
      raf = window.requestAnimationFrame(tick);
    };
    const update = () => {
      if (playing && visible && !document.hidden && !raf) raf = window.requestAnimationFrame(tick);
      else if ((!playing || !visible || document.hidden) && raf) { window.cancelAnimationFrame(raf); raf = 0; last = 0; }
      if (visible && !document.hidden) paint();
    };
    const resize = new ResizeObserver(paint); resize.observe(wrapper);
    const observer = new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting ?? true; update(); }, { threshold: 0.01 });
    observer.observe(wrapper);
    document.addEventListener('visibilitychange', update);
    loadStarfield().then((field) => { if (!disposed) { stars = field.points; setEngine(field.engine); paint(); } });
    update();
    return () => {
      disposed = true; if (raf) window.cancelAnimationFrame(raf); resize.disconnect(); observer.disconnect();
      document.removeEventListener('visibilitychange', update); drawRef.current = () => {};
    };
  }, [model, playing, speed, quality]);

  const changeZoom = useCallback((next: number) => {
    const v = Math.max(0.65, Math.min(1.6, next)); viewRef.current.zoom = v; setZoom(v); drawRef.current();
  }, []);
  const reset = () => { viewRef.current = { rotation: 0, zoom: 1, selected: null, time: 0 }; setZoom(1); setSelected(null); drawRef.current(); };
  const select = (index: number) => { const next = selected === index ? null : index; setSelected(next); viewRef.current.selected = next; drawRef.current(); };
  return (
    <div className={`orbit-scene ${compact ? 'orbit-scene--compact' : ''}`} ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        className="orbit-canvas"
        aria-label={`軌道モデル。現在の軌道値は${model.radii.length ? model.radii.join('、') : 'なし'}。左右矢印で回転、プラスとマイナスで拡大縮小。`}
        role="img" tabIndex={0}
        onPointerDown={(e) => { pointerRef.current = { id: e.pointerId, x: e.clientX }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (pointerRef.current?.id === e.pointerId) { viewRef.current.rotation += (e.clientX - pointerRef.current.x) * 0.009; pointerRef.current.x = e.clientX; drawRef.current(); } }}
        onPointerUp={() => { pointerRef.current = null; }}
        onPointerCancel={() => { pointerRef.current = null; }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); viewRef.current.rotation += e.key === 'ArrowLeft' ? -0.15 : 0.15; drawRef.current(); }
          if (e.key === '+' || e.key === '=') { e.preventDefault(); changeZoom(viewRef.current.zoom + 0.1); }
          if (e.key === '-') { e.preventDefault(); changeZoom(viewRef.current.zoom - 0.1); }
        }}
      />
      <div className="scene-vignette" aria-hidden="true" />
      <div className="scene-top"><span><span className="status-dot" /> {compact ? 'LIVE MODEL' : 'INTERACTIVE MODEL'} <i>/</i> 01</span><span>{playing ? 'LIVE' : 'PAUSED'}</span></div>
      {!compact && <div className="scene-coordinates" aria-hidden="true"><span>+ 35° 41′ 00″</span><span>FIELD / 001</span></div>}
      <div className="scene-bottom">
        <div className="scene-caption"><span className="eyebrow">ORBITAL FIELD <span className="scene-caption-slash">/</span> {String(model.radii.length).padStart(2, '0')} BODIES</span><strong>コードが描く、小さな宇宙。</strong><span>教育用の円軌道モデル・縮尺は任意</span></div>
        <div className="scene-controls" aria-label="シミュレーション操作">
          <button type="button" aria-label={playing ? 'シミュレーションを一時停止' : 'シミュレーションを再開'} title={playing ? '一時停止' : '再開'} onClick={onToggle}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
          <button type="button" aria-label="縮小" title="縮小" onClick={() => changeZoom(zoom - 0.15)} disabled={zoom <= 0.65}><Minus size={15} /></button>
          <button type="button" aria-label="拡大" title="拡大" onClick={() => changeZoom(zoom + 0.15)} disabled={zoom >= 1.6}><Plus size={15} /></button>
          <button type="button" aria-label="表示をリセット" title="表示をリセット" onClick={reset}><RotateCcw size={14} /></button>
        </div>
      </div>
      <div className="scene-helper"><Move size={12} aria-hidden="true" /> ドラッグで回転 <span>·</span> {engine === 'wasm' ? 'Rust / WASM' : 'TypeScript fallback'}</div>
      <div className="scene-selection" aria-label="軌道を選択">
        {model.radii.map((radius, index) => <button type="button" key={`${index}-${radius}`} aria-label={`軌道 ${index + 1}、値 ${radius}${selected === index ? '、選択中' : ''}`} aria-pressed={selected === index} onClick={() => select(index)}>{String(index + 1).padStart(2, '0')}</button>)}
      </div>
    </div>
  );
}
