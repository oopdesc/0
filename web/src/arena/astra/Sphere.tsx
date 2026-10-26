export default function Sphere({
  gradient,
  color,
  size,
  ringed = false,
  glow = false,
  className = "",
}: {
  gradient: string;
  color: string;
  size: number;
  ringed?: boolean;
  glow?: boolean;
  className?: string;
}) {
  const ringW = size * 2.3;
  const ringH = size * 0.78;
  const ringBorder = Math.max(2, size * 0.085);
  const ringStyle = {
    width: ringW,
    height: ringH,
    borderWidth: ringBorder,
    borderColor: `${color}80`,
    boxShadow: `0 0 ${size * 0.15}px ${color}33, inset 0 0 ${size * 0.1}px ${color}22`,
  };

  return (
    <div
      className={`astra-sphere ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {ringed && (
        <div
          className="astra-ring"
          style={{
            ...ringStyle,
            transform: "translate(-50%, -50%) rotate(-18deg)",
            clipPath: "inset(0 0 50% 0)",
          }}
        />
      )}
      <div
        className="astra-globe"
        style={{
          background: gradient,
          boxShadow: `inset ${-size * 0.2}px ${-size * 0.16}px ${size * 0.4}px rgba(0,0,0,0.7), inset ${size * 0.06}px ${size * 0.06}px ${size * 0.18}px rgba(255,255,255,0.18)${
            glow
              ? `, 0 0 ${size * 0.7}px ${color}66, 0 0 ${size * 1.6}px ${color}22`
              : ""
          }`,
        }}
      />
      {ringed && (
        <div
          className="astra-ring"
          style={{
            ...ringStyle,
            transform: "translate(-50%, -50%) rotate(-18deg)",
            clipPath: "inset(50% 0 0 0)",
          }}
        />
      )}
    </div>
  );
}
