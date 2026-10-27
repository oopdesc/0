import { useEffect, useRef, useState } from "react";
import { createSpaceScene, type SpaceHandle } from "./nebula/scene";

const viewKeys: Record<string, "left" | "right" | "in" | "out"> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  "+": "in",
  "=": "in",
  "-": "out",
};

export default function NebulaExperience({ paused }: { paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<SpaceHandle | null>(null);
  const [stats, setStats] = useState({
    fps: 0,
    particles: 0,
    engine: "準備中",
  });
  const [failed, setFailed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reduced = useRef(false);
  const pause = useRef(paused || stopped);
  pause.current = paused || stopped;
  useEffect(() => {
    let alive = true;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduced.current = media.matches;
      engine.current?.setReducedMotion(pause.current || media.matches);
    };
    reduced.current = media.matches;
    void Promise.resolve()
      .then(() => {
        if (!alive) return null;
        return createSpaceScene(canvas.current!, {
          quality: "balanced",
          reducedMotion: pause.current || media.matches,
          onStats: (s) => {
            if (alive) setStats(s);
          },
        });
      })
      .then((h) => {
        if (!h) return;
        if (!alive) h.dispose();
        else {
          engine.current = h;
          sync();
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    media.addEventListener("change", sync);
    return () => {
      alive = false;
      media.removeEventListener("change", sync);
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(
    () =>
      engine.current?.setReducedMotion(paused || stopped || reduced.current),
    [paused, stopped],
  );
  return (
    <section className="guest-art">
      <div className="guest-stage">
        <canvas
          ref={canvas}
          tabIndex={0}
          onKeyDown={(event) => {
            const action = viewKeys[event.key];
            if (action) {
              event.preventDefault();
              engine.current?.view?.(action);
            }
          }}
          role="img"
          aria-label="青灰色の星雲と星空。ドラッグで視点を回せます。"
        />
        <div className="guest-stage-label">
          <span>星雲の奥へ</span>
          <small>ドラッグで回転・スクロールで拡大</small>
        </div>
        {failed && (
          <p className="guest-error">
            この環境では描画を開始できませんでした。ほかの作品を選べます。
          </p>
        )}
      </div>
      <div className="guest-controls">
        <button onClick={() => setStopped((x) => !x)} aria-pressed={stopped}>
          {stopped ? "動きを再開" : "一時停止"}
        </button>
        <div className="guest-view-buttons" aria-label="星雲の視点">
          <button
            aria-label="星雲を左へ回す"
            onClick={() => engine.current?.view?.("left")}
          >
            ←
          </button>
          <button
            aria-label="星雲を右へ回す"
            onClick={() => engine.current?.view?.("right")}
          >
            →
          </button>
          <button
            aria-label="星雲を拡大"
            onClick={() => engine.current?.view?.("in")}
          >
            ＋
          </button>
          <button
            aria-label="星雲を縮小"
            onClick={() => engine.current?.view?.("out")}
          >
            −
          </button>
          <button onClick={() => engine.current?.view?.("reset")}>
            視点を戻す
          </button>
        </div>
        <span>
          {stats.particles.toLocaleString()}粒子 · 上限30fps · {stats.fps}fps
        </span>
      </div>
      <p className="model-disclosure">
        雲と星の奥行きを、ノイズと粒子で描いた作品です。観測データや重力計算の再現ではありません。
      </p>
    </section>
  );
}
