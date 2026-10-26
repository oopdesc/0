import { useEffect, useRef, useState } from "react";
import bodies from "./bodies.json";
import Sphere from "./Sphere";
import "./models.css";
const durations = [9, 14, 19, 26, 36, 48, 62, 78];
const sizes = [7, 11, 12, 9, 26, 22, 16, 15];
const planets = bodies
  .filter((b) => b.kind === "planet")
  .sort((a, b) => a.orderIndex - b.orderIndex);
const sun = bodies.find((b) => b.kind === "star")!;
export default function AstraModels({ paused }: { paused: boolean }) {
  const [selected, setSelected] = useState("earth"),
    [stopped, setStopped] = useState(false),
    [speed, setSpeed] = useState(1),
    [labels, setLabels] = useState(true),
    [visible, setVisible] = useState(true);
  const region = useRef<HTMLElement>(null);
  const body = bodies.find((b) => b.slug === selected) || sun;
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    update();
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const moving = !(paused || stopped || !visible);
  return (
    <section
      ref={region}
      className={`astra-models ${moving ? "" : "astra-paused"} ${labels ? "" : "astra-no-labels"}`}
      aria-label="太陽系と惑星の模型"
    >
      <header className="astra-title">
        <div>
          <span className="eyebrow">太陽系と惑星</span>
          <h2>惑星を選び、太陽系を眺める。</h2>
          <p>
            土星の環、木星の縞、地球の色。気になる天体を選んでみてください。
          </p>
        </div>
        <div className="astra-actions">
          <button aria-pressed={stopped} onClick={() => setStopped(!stopped)}>
            {stopped ? "公転を再開" : "公転を一時停止"}
          </button>
          <button aria-pressed={labels} onClick={() => setLabels(!labels)}>
            名前：{labels ? "表示" : "非表示"}
          </button>
          <label>
            動きの速さ
            <select
              aria-label="動きの速さ"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.5}>ゆっくり</option>
              <option value={1}>標準</option>
              <option value={2}>速く</option>
            </select>
          </label>
        </div>
      </header>
      <div className="astra-layout">
        <div className="astra-space">
          <div className="astra-system" aria-label="太陽と8惑星の公転模型">
            <div className="astra-solar-glow" />
            <button
              className="astra-sun"
              aria-label="太陽を選ぶ"
              aria-pressed={selected === sun.slug}
              onClick={() => setSelected(sun.slug)}
            >
              <Sphere
                gradient={sun.gradient}
                color={sun.color}
                size={52}
                glow
              />
              <span className="astra-body-label">{sun.name}</span>
            </button>
            {planets.map((p, i) => {
              const radius = 9.5 + i * 5.55,
                duration = durations[i] / speed,
                delay = -((i * 11.7) % durations[i]) / speed;
              return (
                <div
                  key={p.slug}
                  className="astra-orbit"
                  style={{
                    inset: `${50 - radius}%`,
                    animationDuration: `${duration}s`,
                    animationDelay: `${delay}s`,
                  }}
                >
                  <button
                    className="astra-planet"
                    aria-label={`${p.name}を選ぶ`}
                    aria-pressed={selected === p.slug}
                    onClick={() => setSelected(p.slug)}
                    style={{
                      animationDuration: `${duration}s`,
                      animationDelay: `${delay}s`,
                    }}
                  >
                    <Sphere
                      gradient={p.gradient}
                      color={p.color}
                      size={sizes[i]}
                      ringed={p.ringed}
                    />
                    <span className="astra-body-label">{p.name}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="astra-scale-note">
            距離・大きさ・公転速度は、見やすいように調整しています。実際の日時の配置ではありません。
          </p>
        </div>
        <aside className="astra-detail" aria-live="polite">
          <div className="astra-detail-sphere">
            <Sphere
              gradient={body.gradient}
              color={body.color}
              size={130}
              ringed={body.ringed}
              glow={body.kind === "star"}
            />
          </div>
          <span className="eyebrow">
            {body.kind === "star"
              ? "恒星"
              : body.kind === "moon"
                ? "衛星"
                : "惑星"}
          </span>
          <h3>{body.name}</h3>
          <p>{body.summary}</p>
          <dl>
            <div>
              <dt>半径</dt>
              <dd>{body.radiusKm.toLocaleString("ja-JP")} km</dd>
            </div>
            {body.orbitDays && (
              <div>
                <dt>公転周期</dt>
                <dd>{body.orbitDays.toLocaleString("ja-JP")} 日</dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
      <div className="astra-body-list" aria-label="天体を選ぶ">
        {bodies.map((b) => (
          <button
            key={b.slug}
            aria-pressed={selected === b.slug}
            onClick={() => setSelected(b.slug)}
          >
            <span className="astra-list-sphere">
              <Sphere
                gradient={b.gradient}
                color={b.color}
                size={32}
                ringed={b.ringed}
              />
            </span>
            <span>{b.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
