import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import App from "./orbit/App";
import { useDisplay } from "./DisplayPreferences";
import raw from "./orbit/styles.css?inline";
import themeCSS from "./orbit/theme.css?inline";
const css =
  raw.replaceAll(":root", ":host").replace(/\bbody\s*\{/g, ":host {") +
  themeCSS;
export default function OrbitLab() {
  const ref = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const { theme } = useDisplay();
  useEffect(() => {
    const host = ref.current!;
    setRoot(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
  }, []);
  return (
    <div
      id="orbit-host"
      data-theme={theme}
      ref={ref}
      style={{ display: "block" }}
      onClick={(e) => {
        const a = e.nativeEvent
          .composedPath()
          .find((x) => x instanceof HTMLAnchorElement) as
          HTMLAnchorElement | undefined;
        if (a?.getAttribute("href")?.startsWith("#")) {
          e.preventDefault();
          root
            ?.getElementById(a.getAttribute("href")!.slice(1))
            ?.scrollIntoView({
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            });
        }
      }}
    >
      {root &&
        createPortal(
          <>
            <style>{css}</style>
            <App />
          </>,
          root,
        )}
    </div>
  );
}
