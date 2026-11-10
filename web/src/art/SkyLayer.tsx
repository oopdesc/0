import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSky } from "./SkyContext";
import { SKY_IDS, SKY_NAMES, type SkyId } from "./sky-state";
import UniverseCanvas from "../UniverseCanvas";
import type { UniverseHandle } from "./universe3d";
const Nebula = lazy(() => import("./NebulaExperience"));
const Orbit = lazy(() => import("./OrbitShowcase"));
const Solar = lazy(() =>
  import("../arena/astra/SolarDiagram").then((m) => ({
    default: m.SolarDiagram,
  })),
);
function Scene({
  id,
  paused,
  background,
}: {
  id: SkyId;
  paused: boolean;
  background: boolean;
}) {
  const handle = useRef<UniverseHandle | null>(null),
    [selected, setSelected] = useState("earth");
  const options = useMemo(
    () => ({
      mode: 0,
      seed: 42,
      brightness: 1.2,
      paused,
      autoCamera: true,
      quality: "standard" as const,
      speed: 0.7,
    }),
    [paused],
  );
  return (
    <div
      className={"sky-scene sky-scene-" + id + (paused ? " astra-paused" : "")}
      data-paused={paused}
    >
      <Suspense
        fallback={<div className="sky-preparing">宇宙を描いています…</div>}
      >
        {id === "nebula" || id === "milkyway" ? (
          <Nebula
            panorama={id === "milkyway"}
            paused={paused}
            background={background}
            immersive
          />
        ) : id === "orbit" ? (
          <Orbit paused={paused} background={background} immersive />
        ) : id === "solar" ? (
          <Solar selected={selected} onSelect={setSelected} speed={0.5} />
        ) : (
          <UniverseCanvas
            options={options}
            handle={handle}
            interactive={!background}
          />
        )}
      </Suspense>
    </div>
  );
}
export default function SkyLayer({ globalPaused }: { globalPaused: boolean }) {
  const sky = useSky(),
    dialog = useRef<HTMLDialogElement>(null),
    [screen, setScreen] = useState(!!document.fullscreenElement),
    [screenNotice, setScreenNotice] = useState(""),
    [hidden, setHidden] = useState(document.hidden),
    [reduced, setReduced] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)"),
      sync = () => {
        setHidden(document.hidden);
        setReduced(m.matches);
        setScreen(!!document.fullscreenElement);
      };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("visibilitychange", sync);
    m.addEventListener("change", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("visibilitychange", sync);
      m.removeEventListener("change", sync);
    };
  }, []);
  useEffect(() => {
    if (!sky.full) return;
    const previous = document.body.style.overflow,
      focus = document.activeElement;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
      dialog.current?.close();
      if (focus instanceof HTMLElement && focus.isConnected) focus.focus();
    };
  }, [sky.full]);
  async function close() {
    if (document.fullscreenElement)
      try {
        await document.exitFullscreen();
      } catch {
        /* the viewport view can still close */
      }
    sky.close();
  }
  async function fullScreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setScreenNotice("");
    } catch {
      setScreenNotice(
        "端末の全画面は利用できません。この画面いっぱいの表示で鑑賞できます。",
      );
    }
  }
  const paused = globalPaused || sky.state.paused || hidden || reduced;
  if (sky.full)
    return (
      <dialog
        ref={dialog}
        className="sky-cinema"
        onCancel={() => void close()}
        aria-labelledby="sky-cinema-title"
      >
        <Scene
          key={sky.full}
          id={sky.full}
          paused={paused}
          background={false}
        />
        <div className="sky-cinema-top">
          <h2 id="sky-cinema-title">{SKY_NAMES[sky.full]}</h2>
          <div>
            {document.fullscreenEnabled && (
              <button onClick={() => void fullScreen()}>
                {screen ? "全画面を解除" : "端末の全画面"}
              </button>
            )}
            <button onClick={() => void close()}>閉じる ×</button>
          </div>
        </div>
        {screenNotice && (
          <p className="sky-screen-notice" role="status">
            {screenNotice}
          </p>
        )}
        <div className="sky-cinema-bottom">
          <button
            aria-label="前の宇宙作品"
            onClick={() =>
              sky.show(
                SKY_IDS[
                  (SKY_IDS.indexOf(sky.full!) + SKY_IDS.length - 1) %
                    SKY_IDS.length
                ],
              )
            }
          >
            ←
          </button>
          <button disabled={reduced} onClick={sky.toggleMotion}>
            {paused ? "動きを再開" : "一時停止"}
          </button>
          <button
            onClick={() => {
              sky.choose(sky.full!, "all");
              sky.close();
            }}
          >
            全ページの背景にする
          </button>
          <button
            aria-label="次の宇宙作品"
            onClick={() =>
              sky.show(
                SKY_IDS[(SKY_IDS.indexOf(sky.full!) + 1) % SKY_IDS.length],
              )
            }
          >
            →
          </button>
        </div>
      </dialog>
    );
  if (!sky.active) return null;
  return (
    <div className="sky-backdrop" aria-hidden="true" inert>
      <Scene
        key={sky.active}
        id={sky.active}
        paused={paused || sky.foregroundActive}
        background
      />
      <div
        className="sky-veil"
        style={{ opacity: 1 - sky.state.strength / 100 }}
      />
    </div>
  );
}
