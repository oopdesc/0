import { DesignButtons, useSky } from "./SkyContext";
import { useEffect, useRef, useState } from "react";
import type { SpaceHandle } from "./nebula/scene";

export default function HomeNebula({ paused, onStartMotion, suspended = false, focusArtwork }: { paused: boolean; onStartMotion: () => void; suspended?: boolean; focusArtwork: boolean }) {
  const sky = useSky();
  const canvas = useRef<HTMLCanvasElement>(null),
    handle = useRef<SpaceHandle | null>(null),
    stage = useRef<HTMLElement>(null);
  const [stopped, setStopped] = useState(false),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState(""),
    [image, setImage] = useState("");
  const [stats, setStats] = useState({ drawnFrames: 0, pixels: 0, particles: 0 }),
    [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
    pause = useRef(paused || stopped);
  pause.current = paused || stopped;

  useEffect(() => {
    if (focusArtwork) stage.current?.scrollIntoView({ block: "start" });
  }, [focusArtwork]);

  useEffect(() => {
    let alive = true;
    setReady(false);
    setFailed(false);
    if (suspended || !canvas.current) return;
    const surface = canvas.current;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      setReduced(media.matches);
      handle.current?.setReducedMotion(pause.current || media.matches);
    };
    media.addEventListener("change", syncMotion);
    void import("./nebula/scene")
      .then(({ createSpaceScene }) => {
        if (!alive) return;
        return createSpaceScene(surface, {
          quality: "balanced",
          maxFps: 30,
          reducedMotion: pause.current || media.matches,
          onActivity: sky.setForegroundActive,
          onStats: ({ engine, particles }) => {
            if (!alive) return;
            if (engine === "minimal") {
              setFailed(true);
              setReady(false);
            } else if (particles > 0) {
              setStats({
                drawnFrames: Number(surface.dataset.drawnFrames || 0),
                pixels: surface.width * surface.height,
                particles,
              });
              setReady(true);
            }
          },
        });
      })
      .then(next => {
        if (!next) return;
        if (!alive) next.dispose();
        else {
          handle.current = next;
          syncMotion();
        }
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => {
      alive = false;
      media.removeEventListener("change", syncMotion);
      handle.current?.dispose();
      handle.current = null;
    };
  }, [version, suspended, sky.setForegroundActive]);
  useEffect(() => handle.current?.setReducedMotion(paused || stopped || reduced), [paused, stopped, reduced]);
  function save() {
    try {
      const url = handle.current?.image?.();
      if (!url) return;
      setImage(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = "0-nebula.png";
      a.click();
      setNotice(
        "今の視点の画像を用意しました。保存されない場合は、下の画像を開いて保存できます。",
      );
    } catch {
      setNotice("画像を保存できませんでした。");
    }
  }
  const view = (action: Parameters<NonNullable<SpaceHandle["view"]>>[0]) =>
    handle.current?.view?.(action);
  return (
    <figure
      className={"home-nebula" + (ready && !failed ? " is-ready" : "")}
      ref={stage}
      id="nebula"
      data-drawn-frames={ready ? stats.drawnFrames : 0}
      data-drawing-pixels={ready ? stats.pixels : 0}
      data-fps-cap={30}
    >
      <div className="home-nebula-frame">
        <img
          className="home-nebula-poster"
          src="/cosmos/nebula-poster.webp"
          alt={ready ? "" : "青い星雲と、遠い星、かすかな光の線。"}
          aria-hidden={ready}
          width="900"
          height="699"
          fetchPriority="high"
        />
        <canvas
          ref={canvas}
          tabIndex={ready && !failed ? 0 : -1}
          aria-hidden={!ready || failed}
          role="img"
          aria-label="星雲の立体作品。ドラッグで360度回転し、光を描けます。矢印キー、拡大縮小ボタンも使えます。"
          onKeyDown={(e) => {
            const keys: Record<string, Parameters<NonNullable<SpaceHandle["view"]>>[0]> = {
              ArrowLeft: "left",
              ArrowRight: "right",
              ArrowUp: "up",
              ArrowDown: "down",
              "+": "in",
              "=": "in",
              "-": "out",
              Home: "reset",
            };
            if (keys[e.key]) {
              e.preventDefault();
              view(keys[e.key]);
            }
          }}
        />
        <div className="home-nebula-caption">
          <span>0 / 光と塵のあいだ</span>
          <strong>星雲の奥へ</strong>
          <p>ゆっくり回る宇宙を、好きな方向へ。</p>
        </div>
        <div className="home-nebula-status">
          <span>
            <i />
            {suspended ? "背景・全画面に表示中" : failed
              ? "静止画"
              : !ready
                ? "星雲を描いています"
                : reduced
                  ? "動きを減らして表示"
                  : paused
                    ? "表示設定で停止中"
                    : stopped
                      ? "停止中"
                      : "ゆっくり自動回転"}
          </span>
          <span>{ready ? `${stats.particles.toLocaleString()}粒子 · 360°回転` : "360°回転・光の線を描く"}</span>
        </div>
      </div>
      <figcaption className="home-nebula-controls">
        <DesignButtons id="nebula"/>
        <div className="home-nebula-controls-main">
          <span>雲の奥を、のぞいてみる。</span>
          {paused ? (
            <button onClick={() => {setStopped(false); onStartMotion();}} disabled={reduced}>自動回転を開始</button>
          ) : (
            <button
              disabled={
                !ready || failed || reduced
              }
              onClick={() => setStopped((s) => !s)}
              aria-pressed={stopped}
            >
              {reduced ? "静止表示中" : stopped ? "▷ 再開" : "Ⅱ 停止"}
            </button>
          )}
        </div>
        <div className="home-nebula-views" aria-label="星雲の視点">
          <button
            disabled={!ready || failed}
            onClick={() => view("left")}
            aria-label="星雲を左へ回す"
          >
            ←
          </button>
          <button
            disabled={!ready || failed}
            onClick={() => view("right")}
            aria-label="星雲を右へ回す"
          >
            →
          </button>
          <button disabled={!ready || failed} onClick={() => view("up")} aria-label="星雲の視点を上へ">↑</button>
          <button disabled={!ready || failed} onClick={() => view("down")} aria-label="星雲の視点を下へ">↓</button>
          <button
            disabled={!ready || failed}
            onClick={() => view("in")}
            aria-label="星雲を拡大"
          >
            ＋
          </button>
          <button
            disabled={!ready || failed}
            onClick={() => view("out")}
            aria-label="星雲を縮小"
          >
            −
          </button>
          <button disabled={!ready || failed} onClick={() => view("reset")}>
            視点を戻す
          </button>
          <button disabled={!ready || failed} onClick={save}>
            画像を保存 ↓
          </button>
        </div>
        {failed && (
          <p className="home-nebula-fallback">
            この環境では静止画で表示しています。
            <button onClick={() => setVersion((v) => v + 1)}>
              描画を再試行
            </button>
          </p>
        )}
        <p className="home-nebula-note">
          雲と星の奥行きを描く作品です。天体観測の再現ではありません。
          <a href="/art">宇宙の作品をもっと見る ↗</a>
        </p>
        <details className="home-nebula-making">
          <summary>この星雲は、どう描く？</summary>
          <ol>
            <li>視線の向きを、周囲の球面の座標に置き換えます。</li>
            <li>大きさの違うノイズを重ね、雲の濃い場所と薄い場所を描きます。</li>
            <li>星を立体空間に置き、近い点どうしを細い線で結びます。</li>
            <li>カーソルから生まれた点を、流れに沿って散らします。</li>
          </ol>
          <p>
            数値から描くので、画像のダウンロードを繰り返さずに視点を変えられます。
          </p>
          <a
            href="https://github.com/oopdesc/0/blob/main/docs/NEBULA_RENDERER.md"
            target="_blank"
            rel="noreferrer"
          >
            コードと小さな実験を読む ↗
          </a>
        </details>
        {notice && <p role="status">{notice}</p>}
        {image && (
          <details className="home-nebula-saved">
            <summary>保存する画像を見る</summary>
            <img src={image} alt="保存する星雲の画像" />
          </details>
        )}
      </figcaption>
    </figure>
  );
}
