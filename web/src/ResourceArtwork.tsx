const labels: Record<string, string> = {
  "code-lab": "{ }",
  art: "01",
  java: "Java",
  rust: "Rust",
  typescript: "< / >",
  github: "git",
  chat: "会話",
  youtube: "API",
  huggingface: "本",
};
export default function ResourceArtwork({ id }: { id: string }) {
  const kind =
    id === "github"
      ? "branch"
      : id === "art"
        ? "orbit"
        : id === "chat"
          ? "chat"
          : id === "youtube" || id === "huggingface"
            ? "book"
            : "code";
  return (
    <div
      className={`resource-artwork resource-artwork-${kind}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 400 180" fill="none">
        <path
          d="M0 36H400M0 72H400M0 108H400M0 144H400M40 0V180M80 0V180M120 0V180M160 0V180M200 0V180M240 0V180M280 0V180M320 0V180M360 0V180"
          className="art-grid"
        />
        {kind === "orbit" ? (
          <g className="art-ink">
            <ellipse cx="200" cy="94" rx="116" ry="44" />
            <ellipse cx="200" cy="94" rx="82" ry="31" />
            <ellipse cx="200" cy="94" rx="46" ry="18" />
            <circle cx="200" cy="94" r="12" fill="currentColor" stroke="none" />
            <circle cx="310" cy="108" r="8" fill="currentColor" stroke="none" />
            <circle cx="124" cy="82" r="5" fill="currentColor" stroke="none" />
          </g>
        ) : kind === "branch" ? (
          <g className="art-ink" strokeWidth="2">
            <path d="M158 44V134M158 111C158 75 244 114 244 62" />
            <circle cx="158" cy="42" r="9" />
            <circle cx="158" cy="137" r="9" />
            <circle cx="244" cy="55" r="9" />
          </g>
        ) : kind === "chat" ? (
          <g className="art-ink">
            <path d="M109 49H242V106H150L124 125V106H109Z" />
            <path d="M255 73H292V132H267L249 148V132H186V120" />
            <path d="M130 68H216M130 85H192" />
          </g>
        ) : kind === "book" ? (
          <g className="art-ink">
            <path d="M200 57C172 43 142 42 116 48V133C146 127 173 133 200 144C226 132 253 128 284 133V48C257 42 227 43 200 57ZM200 57V144" />
            <path d="M134 71C152 69 169 72 184 78M134 91C152 89 169 92 184 98M218 78C233 72 251 69 266 71M218 98C233 92 251 89 266 91" />
          </g>
        ) : (
          <g className="art-ink">
            <rect x="91" y="39" width="218" height="112" rx="9" />
            <path d="M91 61H309" />
            <circle cx="106" cy="51" r="2" fill="currentColor" />
            <circle cx="116" cy="51" r="2" fill="currentColor" />
            <circle cx="126" cy="51" r="2" fill="currentColor" />
            <text
              x="200"
              y="118"
              textAnchor="middle"
              fill="currentColor"
              stroke="none"
            >
              {labels[id] || "code"}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
