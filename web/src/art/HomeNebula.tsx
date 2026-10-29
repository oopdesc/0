import { DesignButtons, useSky } from "./SkyContext";
import { useEffect, useRef, useState } from "react";
import type { NurseryHandle, NurseryStats } from "./nursery/renderer";

export default function HomeNebula({ paused, onStartMotion, suspended = false }: { paused: boolean; onStartMotion: () => void; suspended?: boolean }) {
  const sky = useSky();
  const canvas = useRef<HTMLCanvasElement>(null),
    handle = useRef<NurseryHandle | null>(null),
    stage = useRef<HTMLElement>(null);
  const [stopped, setStopped] = useState(false),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState(""),
    [image, setImage] = useState("");
  const [stats, setStats] = useState<NurseryStats | null>(null),
    pause = useRef(paused || stopped);
  pause.current = paused || stopped;
  useEffect(() => {
    let alive = true;
    setReady(false);
    setFailed(false);
    if(suspended) return;
    import("./nursery/renderer")
      .then(({ createNursery }) => {
        if (!alive) return;
        handle.current = createNursery(canvas.current!, {
          paused: pause.current,
          onVisibility: sky.setForegroundActive,
          onFailure: () => {
            if (alive) {
              setFailed(true);
              setReady(false);
            }
          },
          onStats: (s) => {
            if (alive) {
              setStats(s);
              if (s.drawnFrames > 0) setReady(true);
            }
          },
        });
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      handle.current?.dispose();
      handle.current = null;
    };
  }, [version,suspended]);
  useEffect(() => handle.current?.pause(paused || stopped), [paused, stopped]);
  function save() {
    try {
      const url = handle.current?.image();
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
  const view = (action: Parameters<NurseryHandle["view"]>[0]) =>
    handle.current?.view(action);
  return (
    <figure
      className={"home-nebula" + (ready && !failed ? " is-ready" : "")}
      ref={stage}
      data-drawn-frames={stats?.drawnFrames ?? 0}
      data-gpu-ms={stats?.gpuMs ?? "unavailable"}
      data-volume-pixels={stats?.volumePixels ?? 0}
      data-drawing-pixels={stats?.drawingPixels ?? 0}
      data-fps-cap={stats?.fpsCap ?? 0}
    >
      <div className="home-nebula-frame">
        <img
          className="home-nebula-poster"
          src="/cosmos/nursery-poster.webp"
          alt={ready ? "" : "青い星雲と、遠い星、かすかな光の線。"}
          aria-hidden={ready}
          width="739"
          height="696"
          fetchPriority="high"
        />
        <canvas
          ref={canvas}
          tabIndex={ready && !failed ? 0 : -1}
          aria-hidden={!ready || failed}
          role="img"
          aria-label="星雲の立体作品。ドラッグで360度回転し、光を描けます。矢印キー、拡大縮小ボタンも使えます。"
          onKeyDown={(e) => {
            const keys: Record<string, Parameters<NurseryHandle["view"]>[0]> = {
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
          <strong>星雲の中へ。</strong>
          <p>ゆっくり回る宇宙を、好きな方向へ。</p>
        </div>
        <div className="home-nebula-status">
          <span>
            <i />
            {suspended ? "背景・全画面に表示中" : failed || stats?.lowPower
              ? "静止画"
              : !ready
                ? "星雲を描いています"
                : stats?.reduced
                  ? "動きを減らして表示"
                  : paused
                    ? "表示設定で停止中"
                    : stopped
                      ? "停止中"
                      : "ゆっくり自動回転"}
          </span>
          <span>360°回転・光の線を描く</span>
        </div>
      </div>
      <figcaption className="home-nebula-controls">
        <DesignButtons id="nursery"/>
        <div className="home-nebula-controls-main">
          <span>雲の奥を、のぞいてみる。</span>
          {paused ? (
            <button onClick={() => {setStopped(false); onStartMotion();}} disabled={stats?.reduced || stats?.lowPower}>自動回転を開始</button>
          ) : (
            <button
              disabled={
                !ready || failed || paused || stats?.reduced || stats?.lowPower
              }
              onClick={() => setStopped((s) => !s)}
              aria-pressed={stopped}
            >
              {paused
                ? "設定で停止中"
                : stats?.reduced || stats?.lowPower
                  ? "静止表示中"
                  : stopped
                    ? "▷ 再開"
                    : "Ⅱ 停止"}
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
          <a href="/art?exhibit=nebula">宇宙の作品をもっと見る ↗</a>
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
