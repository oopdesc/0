import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { loadJavaArt, type JavaArt } from "./java-model";
import "./art-gallery.css";
import { ART_EXHIBITS, readExhibit, type ExhibitId } from "./art/exhibits";
import UniverseCanvas, { type CameraPosition } from "./UniverseCanvas";
import type { UniverseHandle, UniverseOptions } from "./art/universe3d";
const OrbitShowcase = lazy(() => import("./art/OrbitShowcase"));
const NebulaExperience = lazy(() => import("./art/NebulaExperience"));
const ParticleExperience = lazy(() => import("./art/ParticleExperience"));
const AstraModels = lazy(() => import("./arena/astra/Models"));
const scenes = [
  {
    id: "m51",
    name: "渦巻銀河",
    caption: "青い腕、星を生む雲、中心の淡い光。",
    description:
      "星の密度や色、塵の筋を参考に、渦巻く円盤を立体で描いています。正面と側面で、同じ星の配置がどう見えるか比べてください。",
    image: "/cosmos/m51-hubble.webp",
    reference: "M51（子持ち銀河）",
    source: "https://svs.gsfc.nasa.gov/30852/",
    credit:
      "NASA, ESA, S. Beckwith (STScI), and The Hubble Heritage Team (STScI/AURA)",
    elevation: 35,
  },
  {
    id: "black-hole",
    name: "ブラックホール",
    caption: "暗い中心を囲む、熱いガスの円盤。",
    description:
      "中心に星を置かず、その周囲に降着円盤を描くモデルです。回転と視点の変化を観察できます。相対論的な光の軌道や重力レンズを計算するシミュレーションではありません。",
    image: "/cosmos/black-hole-nasa.jpg",
    reference: "NASAの降着円盤の科学可視化",
    source: "https://svs.gsfc.nasa.gov/13326/",
    credit: "NASA’s Goddard Space Flight Center / Jeremy Schnittman",
    elevation: 12,
  },
  {
    id: "m104",
    name: "円盤銀河",
    caption: "横から眺める、薄い星の円盤。",
    description:
      "同じ渦巻銀河を低い視点から見ると、円盤の薄さと中心のふくらみが見えます。横からの姿を、ソンブレロ銀河の観測画像と比較してください。",
    image: "/cosmos/m104-hubble.webp",
    reference: "M104（ソンブレロ銀河）",
    source: "https://svs.gsfc.nasa.gov/30855/",
    credit: "NASA and The Hubble Heritage Team (STScI/AURA)",
    elevation: 7,
  },
];
export function HomeUniverse({ paused }: { paused: boolean }) {
  const handle = useRef<UniverseHandle | null>(null);
  const options = useMemo<UniverseOptions>(
    () => ({
      mode: 0,
      seed: 42,
      brightness: 1.2,
      paused,
      autoCamera: true,
      quality: "standard",
      speed: 1,
    }),
    [paused],
  );
  return (
    <div className="home-cosmos">
      <UniverseCanvas options={options} handle={handle} interactive={false} />
    </div>
  );
}
export default function ArtStudio({
  paused,
  onPause,
  search,
}: {
  paused: boolean;
  onPause: () => void;
  search: string;
}) {
  const [currentExhibit, setExhibit] = useState<ExhibitId>(() =>
    readExhibit(search),
  );
  const astra = currentExhibit === "solar";
  const observation = currentExhibit === "observation";
  const guest =
    currentExhibit === "orbit" ||
    currentExhibit === "nebula" ||
    currentExhibit === "particles"
      ? currentExhibit
      : null;
  useEffect(() => setExhibit(readExhibit(search)), [search]);
  function selectExhibit(id: ExhibitId) {
    setExhibit(id);
    const query = new URLSearchParams({ exhibit: id });
    if (id === "observation" || id === "galaxy")
      query.set("scene", scenes[mode].id);
    history.replaceState(null, "", "/art?" + query);
    dispatchEvent(new PopStateEvent("popstate"));
  }
  const [java, setJava] = useState<JavaArt | null>(null),
    [mode, setMode] = useState(0),
    [seed, setSeed] = useState(42),
    [brightness, setBrightness] = useState(1.15),
    [distance, setDistance] = useState(3.8),
    [speed, setSpeed] = useState(1),
    [autoCamera, setAutoCamera] = useState(false),
    [quality, setQuality] = useState<"standard" | "high">("standard"),
    [focus, setFocus] = useState(false),
    [notice, setNotice] = useState(""),
    [sharedURL, setSharedURL] = useState(""),
    [savedImage, setSavedImage] = useState(""),
    [ready, setReady] = useState(false),
    [view, setView] = useState<CameraPosition | undefined>();
  const handle = useRef<UniverseHandle | null>(null),
    stage = useRef<HTMLDivElement>(null),
    video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (guest || astra) return;
    let live = true;
    loadJavaArt()
      .then((m) => {
        if (live) setJava(m);
      })
      .catch(() =>
        setNotice(
          "Javaの設定を読み込めませんでした。ページを再読み込みしてください。",
        ),
      );
    return () => {
      live = false;
    };
  }, [guest, astra]);
  useEffect(() => {
    if (!java) return;
    const q = new URLSearchParams(search),
      m = java.indexForId(q.get("scene") || "m51");
    const read = (key: string, fallback: number) =>
      q.has(key) ? Number(q.get(key)) : fallback;
    const camera = JSON.parse(
      java.orbit(
        read("az", -70),
        read("el", scenes[m].elevation),
        read("distance", 3.8),
        read("light", 1.15),
      ),
    );
    const safe = JSON.parse(
      java.settings(m, read("seed", 42), 0.5, camera.brightness),
    );
    setMode(m);
    setSeed(safe.seed);
    setBrightness(camera.brightness);
    setDistance(camera.distance);
    setView(camera);
    setNotice("");
  }, [java, search]);
  const options = useMemo<UniverseOptions>(
    () => ({ mode, seed, brightness, paused, autoCamera, quality, speed }),
    [mode, seed, brightness, paused, autoCamera, quality, speed],
  );
  const scene = scenes[mode];
  const gallery = ART_EXHIBITS;
  function camera(az: number, el: number, d = distance) {
    if (!java) return;
    const v = JSON.parse(java.orbit(az, el, d, brightness));
    setView(v);
    setDistance(v.distance);
  }
  function choose(m: number) {
    setMode(m);
    setNotice("");
    if (m !== mode) setReady(false);
    camera(-70, scenes[m].elevation, 3.8);
  }
  function zoom(d: number) {
    const v = handle.current?.readView();
    camera(v?.azimuth ?? -70, v?.elevation ?? scene.elevation, d);
  }
  function rotate(az: number, el: number) {
    const v = handle.current?.readView();
    camera(
      (v?.azimuth ?? -70) + az,
      (v?.elevation ?? scene.elevation) + el,
      v?.distance ?? distance,
    );
  }
  async function share() {
    const v = handle.current?.readView();
    const q = new URLSearchParams({
      scene: scene.id,
      seed: String(seed),
      light: String(brightness),
    });
    if (observation) q.set("view", "observation");
    else if (v) {
      q.set("az", v.azimuth.toFixed(3));
      q.set("el", v.elevation.toFixed(3));
      q.set("distance", v.distance.toFixed(4));
    }
    const url = location.origin + "/art?" + q;
    setSharedURL(url);
    try {
      await navigator.clipboard.writeText(url);
      setNotice("この視点を開けるURLをコピーしました。");
    } catch {
      setNotice("共有URL：" + url);
    }
  }
  function image() {
    try {
      const href = observation
        ? scene.image
        : ready
          ? handle.current?.image()
          : undefined;
      if (!href) {
        setNotice("描画が完了してから保存してください。");
        return;
      }
      setSavedImage(href);
      const a = document.createElement("a");
      a.href = href;
      a.download = `0-${scene.id}.${observation ? (scene.image.endsWith(".webp") ? "webp" : "jpg") : "png"}`;
      a.click();
      setNotice(
        observation
          ? "観測資料には出典ページの利用条件が適用されます。"
          : "今の視点の画像保存を開始しました。",
      );
    } catch {
      setNotice(
        "画像を保存できませんでした。ページを再読み込みして試してください。",
      );
    }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch {
      setNotice("このブラウザでは全画面表示を開始できません。");
    }
  }
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    let visible = true;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (paused || document.hidden || !visible || reduced.matches)
        node.pause();
      // Media starts only from the video's own play control; opening this
      // reference page must not automatically transfer the whole video.
    };
    const observer = new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      sync();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    sync();
    return () => {
      node.pause();
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, [observation, mode, paused]);
  return (
    <main className={`observatory ${focus ? "observatory-focus" : ""}`}>
      <div className="observatory-heading">
        <div>
          <span className="eyebrow">0 / 宇宙を観察する</span>
          <h1>
            {guest
              ? gallery.find((x) => x[0] === guest)![1]
              : astra
                ? "動かして眺める、太陽系。"
                : "動かして眺める、銀河。"}
          </h1>
        </div>
        <p>
          {guest
            ? "視点を変え、手を動かして、光と奥行きを楽しむ。"
            : astra
              ? "太陽と惑星の動きや、それぞれの姿を観察する。"
              : "星の円盤を回し、視点を変え、仕組みを読む。"}
        </p>
      </div>
      <div className="art-collection" aria-label="宇宙の作品を選ぶ">
        {gallery.map(([id, title, description, n]) => (
          <button
            key={id}
            className={"art-choice art-choice-" + id}
            aria-pressed={currentExhibit === id}
            onClick={() => selectExhibit(id)}
          >
            <span className="art-choice-preview" aria-hidden="true">
              <i />
              <i />
              <b />
            </span>
            <span className="art-choice-number">{n}</span>
            <strong>{title}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>
      <div className="art-collection-note">
        <span>眺めたい宇宙を選び、視点を変えてみてください。</span>
        <button
          aria-pressed={currentExhibit === "observation"}
          onClick={() => selectExhibit("observation")}
        >
          観測資料と比べる ↗
        </button>
      </div>
      {guest ? (
        <Suspense
          fallback={
            <p className="guest-loading">宇宙を描く準備をしています…</p>
          }
        >
          {guest === "orbit" ? (
            <OrbitShowcase paused={paused} />
          ) : guest === "nebula" ? (
            <NebulaExperience paused={paused} />
          ) : (
            <ParticleExperience paused={paused} />
          )}
        </Suspense>
      ) : astra ? (
        <Suspense fallback={<p>太陽系の模型を読み込んでいます…</p>}>
          <AstraModels paused={paused} />
        </Suspense>
      ) : (
        <>
          <div
            className={`observatory-frame universe-stage ${observation ? "observation-frame" : ""}`}
            ref={stage}
          >
            {!observation ? (
              <UniverseCanvas
                options={options}
                handle={handle}
                view={view}
                onReady={() => setReady(true)}
                onViewChange={(v) => setDistance(v.distance)}
                onError={setNotice}
              />
            ) : mode === 1 ? (
              <video
                className="observed-media"
                ref={video}
                poster={scene.image}
                muted
                loop
                playsInline
                controls
                preload="none"
                aria-label="NASAのブラックホール降着円盤の科学可視化"
              >
                <source src="/cosmos/black-hole-nasa.webm" type="video/webm" />
                <source src="/cosmos/black-hole-nasa.mp4" type="video/mp4" />
              </video>
            ) : (
              <img
                className="observed-media"
                src={scene.image}
                alt={scene.reference + "の観測画像"}
                decoding="async"
              />
            )}
            <div className="stage-top">
              <span>
                0{mode + 1} / 03 ·{" "}
                {observation ? "観測資料" : "三次元の学習モデル"}
              </span>
              <button onClick={fullscreen} aria-label="宇宙を全画面表示">
                ⛶
              </button>
            </div>
            <div className="stage-title">
              <span>
                {observation
                  ? scene.reference
                  : "Javaで設定 · Rustで星の配置 · GPUで描画"}
              </span>
              <h2>{scene.name}</h2>
              <p>{scene.caption}</p>
            </div>
            <div className="stage-bottom">
              <span>
                {observation
                  ? "提供資料とモデルは別のものです"
                  : "ドラッグで回転 · スクロール／ピンチで拡大"}
              </span>
              {!observation && (
                <button onClick={onPause}>
                  {paused ? "▷ 動きを再開" : "Ⅱ 動きを止める"}
                </button>
              )}
              <button onClick={() => setFocus((x) => !x)}>
                {focus ? "操作を表示" : "宇宙に集中"}
              </button>
            </div>
          </div>
          {observation ? (
            <div className="media-credit">
              <span>{scene.credit}</span>
              <a href={scene.source} target="_blank" rel="noreferrer">
                出典・元データ ↗
              </a>
            </div>
          ) : (
            <p className="model-disclosure">
              観測画像を参考にした、コードで描く三次元モデルです。実際の観測データの三次元復元や、天体物理の厳密な計算ではありません。
            </p>
          )}
          <div className="scene-rail" aria-label="宇宙を選ぶ">
            {scenes.map((s, m) => (
              <button
                key={s.id}
                className={`scene-card ${mode === m ? "selected" : ""}`}
                aria-pressed={mode === m}
                onClick={() => choose(m)}
              >
                <img
                  className="scene-swatch"
                  src={s.image}
                  alt=""
                  loading="lazy"
                />
                <span>
                  <small>
                    0{m + 1} / {observation ? "観測資料" : "三次元モデル"}
                  </small>
                  <strong>{s.name}</strong>
                  <span>{s.caption}</span>
                </span>
                <b>↗</b>
              </button>
            ))}
          </div>
          <section className="studio-tools" aria-label="宇宙の操作">
            <div>
              <span className="eyebrow">視点と光の調整</span>
              <h2>正面から。横から。裏側から。</h2>
              <p>{scene.description}</p>
              <p>
                マウスや指で回せます。ドラッグが難しい場合は、下の視点ボタンを使ってください。
              </p>
              <div className="view-presets">
                <button
                  disabled={observation || !java}
                  onClick={() => camera(-70, 85)}
                >
                  正面から
                </button>
                <button
                  disabled={observation || !java}
                  onClick={() => camera(-70, 7)}
                >
                  横から
                </button>
                <button
                  disabled={observation || !java}
                  onClick={() => camera(-70, scene.elevation, 3.8)}
                >
                  視点を戻す
                </button>
              </div>
              <div className="view-arrows" aria-label="ボタンで回転">
                <button
                  disabled={observation || !java}
                  onClick={() => rotate(-15, 0)}
                  aria-label="左へ回転"
                >
                  ←
                </button>
                <button
                  disabled={observation || !java}
                  onClick={() => rotate(0, 15)}
                  aria-label="上から見る"
                >
                  ↑
                </button>
                <button
                  disabled={observation || !java}
                  onClick={() => rotate(0, -15)}
                  aria-label="下から見る"
                >
                  ↓
                </button>
                <button
                  disabled={observation || !java}
                  onClick={() => rotate(15, 0)}
                  aria-label="右へ回転"
                >
                  →
                </button>
              </div>
            </div>
            <div className="studio-settings">
              {!observation && (
                <>
                  <label>
                    視点までの距離<output>{distance.toFixed(1)}</output>
                    <input
                      aria-label="視点までの距離"
                      type="range"
                      min="1.6"
                      max="8"
                      step=".1"
                      value={distance}
                      onChange={(e) => zoom(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    星の配置（乱数の種）
                    <input
                      aria-label="星の配置の種"
                      type="number"
                      min="1"
                      max="999999"
                      value={seed}
                      onChange={(e) =>
                        setSeed(
                          Math.max(
                            1,
                            Math.min(
                              999999,
                              Math.trunc(Number(e.target.value)) || 1,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    動きの速さ<output>{speed.toFixed(1)}倍</output>
                    <input
                      aria-label="動きの速さ"
                      type="range"
                      min=".1"
                      max="2"
                      step=".1"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    描画の細かさ
                    <select
                      aria-label="描画の細かさ"
                      value={quality}
                      onChange={(e) =>
                        setQuality(e.target.value as "standard" | "high")
                      }
                    >
                      <option value="standard">標準（22,000個の星）</option>
                      <option value="high">詳細（32,000個の星）</option>
                    </select>
                  </label>
                  <button
                    aria-pressed={autoCamera}
                    onClick={() => setAutoCamera((x) => !x)}
                  >
                    {autoCamera
                      ? "自動で視点を回す：入"
                      : "自動で視点を回す：切"}
                  </button>
                </>
              )}
              {!observation && (
                <label>
                  明るさ<output>{brightness.toFixed(2)}</output>
                  <input
                    aria-label="宇宙の明るさ"
                    type="range"
                    min=".6"
                    max="1.8"
                    step=".05"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                  />
                </label>
              )}
              <div className="studio-actions">
                <button onClick={image} disabled={!observation && !ready}>
                  画像を保存 ↓
                </button>
                <button
                  onClick={share}
                  disabled={!java || (!observation && !ready)}
                >
                  この視点のURLをコピー ↗
                </button>
              </div>
            </div>
          </section>
          {savedImage && (
            <figure className="saved-image">
              <img src={savedImage} alt="保存する宇宙の画像" />
              <figcaption>
                保存が始まらない場合は、画像を右クリックまたは長押しして保存できます。
              </figcaption>
            </figure>
          )}
          {sharedURL && (
            <label className="share-url">
              共有する表示のURL
              <input
                aria-label="共有する表示のURL"
                readOnly
                value={sharedURL}
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
          {notice && (
            <p className="studio-notice" role="status">
              {notice}
            </p>
          )}
          <section className="art-colophon">
            <div>
              <span className="eyebrow">ソースを読む</span>
              <h2>この星空を、自分でつくる。</h2>
              <p>
                Javaで入力の範囲とカメラの位置を決め、Rustで星を配置します。描画はThree.jsとシェーダー。処理を分けているので、ひとつずつ変えて試せます。
              </p>
              <a className="text-link" href="/learn?track=Java">
                Javaから読み始める →
              </a>
            </div>
            <dl>
              <div>
                <dt>設定とカメラ</dt>
                <dd>Java / TeaVM</dd>
              </div>
              <div>
                <dt>星の配置</dt>
                <dd>Rust / WebAssembly</dd>
              </div>
              <div>
                <dt>三次元の描画と操作</dt>
                <dd>Three.js / WebGL 2</dd>
              </div>
              <div>
                <dt>動きと負荷</dt>
                <dd>上限24コマ/秒・画面外では停止</dd>
              </div>
            </dl>
          </section>
          <p className="caption">
            三次元モデルとNASA等の提供資料は区別して掲載しています。このサイトはNASAの公式サイトではありません。
          </p>
        </>
      )}
    </main>
  );
}
