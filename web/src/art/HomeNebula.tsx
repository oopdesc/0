import { useEffect, useRef, useState } from "react";
import type { NurseryHandle, NurseryStats } from "./nursery/renderer";

export default function HomeNebula({ paused }: { paused: boolean }) {
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
    import("./nursery/renderer")
      .then(({ createNursery }) => {
        if (!alive) return;
        handle.current = createNursery(canvas.current!, {
          paused: pause.current,
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
  }, [version]);
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
          alt={ready ? "" : "青い星雲の層と、琥珀色に縁取られた暗い塵。"}
          aria-hidden={ready}
          width="814"
          height="708"
          fetchPriority="high"
        />
        <canvas
          ref={canvas}
          tabIndex={ready && !failed ? 0 : -1}
          aria-hidden={!ready || failed}
          role="img"
          aria-label="星雲の立体作品。左右にドラッグして視点を変えられます。矢印キー、拡大縮小ボタンも使えます。"
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
          <strong>星の生まれる場所。</strong>
          <p>視点を変えると、雲の向こうが見えてくる。</p>
        </div>
        <div className="home-nebula-status">
          <span>
            <i />
            {failed || stats?.lowPower
              ? "静止画"
              : !ready
                ? "星雲を描いています"
                : stats?.reduced
                  ? "動きを減らして表示"
                  : paused
                    ? "表示設定で停止中"
                    : stopped
                      ? "停止中"
                      : "動かせる星雲"}
          </span>
          <span>ドラッグで回転</span>
        </div>
      </div>
      <figcaption className="home-nebula-controls">
        <div className="home-nebula-controls-main">
          <span>雲の奥を、のぞいてみる。</span>
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
          光の吸収と雲の重なりを描く作品です。天体観測の再現ではありません。
          <a href="/art?exhibit=nebula">宇宙の作品をもっと見る ↗</a>
        </p>
        <details className="home-nebula-making">
          <summary>この星雲は、どう描く？</summary>
          <ol>
            <li>奥行きのある空間に、雲の濃い場所と薄い場所をつくります。</li>
            <li>
              画面から奥へ視線を伸ばし、途中にある雲の光を少しずつ重ねます。
            </li>
            <li>手前の塵で光を遮ると、暗い筋や光る縁が生まれます。</li>
            <li>星を別の層に描き、視点を変えるときも雲と一緒に動かします。</li>
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
