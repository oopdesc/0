import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import App from "./orbit/App";
import raw from "./orbit/styles.css?inline";
const css=raw.replaceAll(":root",":host").replace(/\bbody\s*\{/g,":host {");
export default function OrbitLab(){const ref=useRef<HTMLDivElement>(null);const [root,setRoot]=useState<ShadowRoot|null>(null);
useEffect(()=>{const host=ref.current!;setRoot(host.shadowRoot??host.attachShadow({mode:"open"}));},[]);
return <div id="orbit-host" ref={ref} style={{display:"block"}} onClick={e=>{const a=(e.nativeEvent.composedPath().find(x=>x instanceof HTMLAnchorElement) as HTMLAnchorElement|undefined);if(a?.getAttribute("href")?.startsWith("#")){e.preventDefault();root?.getElementById(a.getAttribute("href")!.slice(1))?.scrollIntoView({behavior:"smooth"});}}}>{root&&createPortal(<><style>{css+"\n:host{display:block}.site-header{position:relative}.hero{padding-top:28px}"}</style><App/></>,root)}</div>}
