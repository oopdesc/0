import { useEffect, useRef, useState } from 'react';
import { Link } from '../lib/router';
import { useStore, setPref } from '../state/useStore';
import { autoTier, preset, type Tier } from '../space/quality';
import { createEngine, type EngineHandle, type EngineStats } from '../space/engine';

/**
 * 宇宙ページ。
 * 学習ページとは別チャンク（React.lazy）なので、ここを開くまでエンジンは評価されない。
 */
export default function SpacePage() {
  const state = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const engineRef = useRef<EngineHandle | null>(null);

  const reduced =
    state.reduceMotion === 'on' ||
    (state.reduceMotion === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    const startTier: Tier = state.spaceQuality === 'auto' ? autoTier() : (state.spaceQuality as Tier);
    setTier(startTier);
    setStats(null);
    setFailed(null);

    async function boot(t: Tier) {
      const engine = await createEngine(canvas!, {
        tier: t,
        reducedMotion: reduced,
        onStats: (s) => setStats(s),
        onDowngrade: (next) => {
          // 実測が重かったので 1 段下げて作り直す（自動モードのときだけ）
          if (state.spaceQuality !== 'auto' || disposed) return;
          engineRef.current?.dispose();
          engineRef.current = null;
          setTier(next.tier);
          void boot(next.tier);
        },
      });
      if (disposed) {
        engine.dispose();
        return;
      }
      engineRef.current = engine;
      engine.start();
    }

    void boot(startTier).catch((e: unknown) => setFailed(e instanceof Error ? e.message : '起動できませんでした'));

    return () => {
      disposed = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // reduced / quality が変わったら作り直す
  }, [state.spaceQuality, reduced]);

  const q = preset(tier ?? 'balanced');

  return (
    <div className="space">
      <canvas ref={canvasRef} className="space__canvas" aria-label="インタラクティブな星空。カーソルで星が生まれ、近い星が線で結ばれます。" role="img" />

      <div className="space__overlay">
        <header className="space__head">
          <p className="space__kicker">experiment 001</p>
          <h1 className="space__title">深い宇宙、静かに、正確に</h1>
          <p className="space__lead">
            カーソルを動かすと星が生まれ、近い星どうしが細い線で結ばれる。押したままにすると重力が強くなる。
          </p>
        </header>

        <div className="space__panel">
          <dl className="space__stats">
            <div>
              <dt>描画</dt>
              <dd>{stats ? label(stats.backend) : failed ? '静止画' : '準備中'}</dd>
            </div>
            <div>
              <dt>星</dt>
              <dd>{reduced ? '—' : stats ? stats.particles.toLocaleString() : q.count.toLocaleString()}</dd>
            </div>
            <div>
              <dt>線</dt>
              <dd>{reduced ? '—' : stats ? stats.links.toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt>fps</dt>
              <dd>{reduced ? '停止中' : stats ? stats.fps : '—'}</dd>
            </div>
            <div>
              <dt>Rust</dt>
              <dd>{stats ? (stats.wasm ? 'wasm32' : '未使用') : '—'}</dd>
            </div>
          </dl>

          <div className="space__controls">
            <label className="space__select">
              品質
              <select value={state.spaceQuality} onChange={(e) => setPref('spaceQuality', e.target.value as typeof state.spaceQuality)}>
                <option value="auto">自動（実測）</option>
                <option value="ultra">Ultra</option>
                <option value="high">High</option>
                <option value="balanced">Balanced</option>
                <option value="battery">Battery</option>
              </select>
            </label>
            <label className="space__select">
              動き
              <select value={state.reduceMotion} onChange={(e) => setPref('reduceMotion', e.target.value as typeof state.reduceMotion)}>
                <option value="auto">OS に従う</option>
                <option value="on">減らす</option>
                <option value="off">動かす</option>
              </select>
            </label>
            <Link to="/learn" className="btn btn--ghost btn--tiny">
              学習に戻る
            </Link>
          </div>

          <p className="space__note">
            {failed
              ? `この環境ではエンジンを起動できなかったため、静止した星空を表示しています（${failed}）。`
              : reduced
                ? '「動きを減らす」が有効なため、静止した 1 枚を表示しています。'
                : stats?.backend === 'webgl2'
                  ? 'WebGPU が使えないため WebGL2 で描画しています。見た目と操作は同じです。'
                  : 'WebGPU の計算シェーダで塵を、Rust/wasm で星座の粒子とリンクを計算しています。'}
          </p>
        </div>
      </div>
    </div>
  );
}

function label(b: EngineStats['backend']): string {
  if (b === 'webgpu') return 'WebGPU';
  if (b === 'webgl2') return 'WebGL2';
  return '静止画';
}
