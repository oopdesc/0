import bodies from "./bodies.json";
import Sphere from "./Sphere";
import "./models.css";
const durations = [9, 14, 19, 26, 36, 48, 62, 78];
const sizes = [7, 11, 12, 9, 26, 22, 16, 15];
const planets = bodies
  .filter((b) => b.kind === "planet")
  .sort((a, b) => a.orderIndex - b.orderIndex);
const sun = bodies.find((b) => b.kind === "star")!;
export function SolarDiagram({
  selected,
  onSelect,
  speed = 1,
}: {
  selected: string;
  onSelect: (slug: string) => void;
  speed?: number;
}) {
  return (
    <div className="astra-system" aria-label="太陽と8惑星の公転模型">
      <div className="astra-solar-glow" />
      <button
        className="astra-sun"
        aria-label="太陽を選ぶ"
        aria-pressed={selected === sun.slug}
        onClick={() => onSelect(sun.slug)}
      >
        <Sphere gradient={sun.gradient} color={sun.color} size={52} glow />
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
              onClick={() => onSelect(p.slug)}
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
  );
}
