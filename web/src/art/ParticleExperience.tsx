import { useEffect, useRef, useState } from "react";
import {
  createEngine,
  type EngineHandle,
  type EngineStats,
} from "../academy/space/engine";

export default function ParticleExperience({ paused }: { paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    handle = useRef<EngineHandle | null>(null);
  const [stats, setStats] = useState<EngineStats | null>(null),
    [failed, setFailed] = useState(false),
    [stopped, setStopped] = useState(false);
  const pause = useRef(paused || stopped);
  pause.current = paused || stopped;
  useEffect(() => {
    let live = true;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (pause.current || media.matches) handle.current?.stop();
      else handle.current?.start();
    };
    void Promise.resolve()
      .then(() => {
        if (!live) return null;
        return createEngine(canvas.current!, {
          tier: "balanced",
          reducedMotion: false,
          onStats: (s) => {
            if (live) setStats(s);
          },
        });
      })
      .then((e) => {
        if (!e) return;
        if (!live) e.dispose();
        else {
          handle.current = e;
          sync();
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    media.addEventListener("change", sync);
    return () => {
      live = false;
      media.removeEventListener("change", sync);
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);
  useEffect(() => {
    if (
      paused ||
      stopped ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      handle.current?.stop();
    else handle.current?.start();
  }, [paused, stopped]);
  return (
    <section className="guest-art">
      <div className="guest-stage particle-stage">
        <canvas
          ref={canvas}
          role="img"
          aria-label="流れる星塵。カーソルを動かすと粒子が生まれ、押すと引力が強まります。"
        />
        <div className="guest-stage-label">
          <span>流れる星塵</span>
          <small>カーソルで星を生む・押したままで引き寄せる</small>
        </div>
        {failed && (
          <p className="guest-error">
            描画を開始できませんでした。ほかの作品を選べます。
          </p>
        )}
      </div>
      <div className="guest-controls">
        <button onClick={() => setStopped((v) => !v)} aria-pressed={stopped}>
          {stopped ? "動きを再開" : "一時停止"}
        </button>
        <span>
          {stats?.particles ?? 0}粒子 · 上限30fps · {stats?.backend ?? "準備中"}
        </span>
      </div>
      <p className="model-disclosure">
        Rust/Wasmで粒子を更新し、対応環境ではWebGPUで描画します。星の密度や動きを楽しむための作品で、天文学的な観測モデルではありません。
      </p>
    </section>
  );
}
