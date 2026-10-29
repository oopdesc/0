import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OrbitScene } from "../orbit/components/OrbitScene";
import { useDisplay } from "../DisplayPreferences";
import raw from "../orbit/styles.css?inline";
import theme from "../orbit/theme.css?inline";
const css =
  raw.replaceAll(":root", ":host").replace(/\bbody\s*\{/g, ":host {") +
  theme +
  ".orbit-scene{min-height:600px;height:65vh;max-height:780px}.shell{padding:0}:host{display:block}.scene-top,.scene-bottom,.scene-helper,.scene-selection{color:#eeeae0}";
export default function OrbitShowcase({ paused, background = false, immersive = false }: { paused: boolean; background?: boolean; immersive?:boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null),
    [stopped, setStopped] = useState(false),
    [count, setCount] = useState(5);
  const { theme: appearance } = useDisplay();
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    setRoot(
      host.current!.shadowRoot ?? host.current!.attachShadow({ mode: "open" }),
    );
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(m.matches);
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, []);
  return (
    <section className="guest-art">
      <div ref={host} data-theme={appearance}>
        {root &&
          createPortal(
            <>
              <style>{css+((background||immersive)?".orbit-scene{height:100vh;min-height:0;max-height:none}.scene-top,.scene-bottom,.scene-helper,.scene-selection{display:none}":"")}</style>
              <OrbitScene
                model={{
                  radii: [1, 2, 3, 4, 6, 8].slice(0, count),
                  highlightedIndex: null,
                }}
                playing={!paused && !stopped && !reduced}
                onToggle={() => setStopped((x) => !x)}
                speed={0.5}
                quality={background?"battery":"balanced"}
                pixelBudget={background?500000:immersive?850000:undefined}
              />
            </>,
            root,
          )}
      </div>
      <div className="guest-controls">
        <label>
          軌道の数{" "}
          <input
            aria-label="軌道の数"
            type="range"
            min="1"
            max="6"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
          <output>{count}</output>
        </label>
        <a href="/learn?section=orbit">この模型をコードで変える・6つの実験 →</a>
      </div>
      <p className="model-disclosure">
        光と円軌道を組み合わせた模型です。実際の太陽系の縮尺や、重力による運動を計算したものではありません。
      </p>
    </section>
  );
}
