import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Root from "./academy/App";
import tokens from "./academy/styles/tokens.css?inline";
import base from "./academy/styles/base.css?inline";
import app from "./academy/styles/app.css?inline";
import { setTheme } from "./academy/state/useStore";
const css = [tokens, base, app].join("\n").replaceAll(":root", ":host").replace(/\bhtml\s*\{/g, ":host {").replace(/\bbody\s*\{/g, ":host {");
export default function Academy() {
 const ref = useRef<HTMLDivElement>(null);
 const [root, setRoot] = useState<ShadowRoot | null>(null);
 useEffect(() => {
  const host = ref.current!;
  setRoot(host.shadowRoot ?? host.attachShadow({mode:"open"}));
  const sync = () => { const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light"; host.dataset.theme = theme; setTheme(theme); };
  sync(); const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});
  return () => observer.disconnect();
 }, []);
 return <div id="academy-host" ref={ref} style={{display:"block", minHeight:700}}>{root && createPortal(<><style>{css + "\n:host{display:block} .sitehead{position:relative}.sitehead__tools .iconbtn[title=テーマ]{display:none}.brand__text small{display:none}"}</style><Root /></>, root)}</div>;
}
