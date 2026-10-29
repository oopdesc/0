/** A single upright zero, shared by the masthead and the colophon. */
export default function ZeroMark() {
  return (
    <svg
      className="zero-mark"
      viewBox="0 0 48 58"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M24 3C11 3 5 13 5 29s6 26 19 26 19-10 19-26S37 3 24 3Zm0 5c6 0 9 8 9 21s-3 21-9 21-9-8-9-21S18 8 24 8Z"
      />
    </svg>
  );
}
