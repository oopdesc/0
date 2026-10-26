import { useMemo, useRef, useState } from 'react';
import { UniverseCanvas, type UniverseHandle } from './components/UniverseCanvas';
import type { SceneKind, SimulationParams } from './core/types';
import './art.css';
export default function ParallaxArt({paused}:{paused:boolean}) {
 const handle=useRef<UniverseHandle>(null);
 const [scene,setScene]=useState<SceneKind>('galaxy');
 const [stopped,setStopped]=useState(false);
 const [quality,setQuality]=useState<'balanced'|'high'>('balanced');
 const [density,setDensity]=useState(15000);
 const [eccentricity,setEccentricity]=useState(0.22);
 const lesson=useMemo(()=>({id:'art-gallery',title:'星と軌道',scene}),[scene]);
 const params=useMemo<SimulationParams>(()=>({stabilityLimit:0.12,radiusFloor:3000,eccentricity,particleCount:density,brightnessFloor:0.58,selectedBody:'planet',handoff:true,orbitRadius:4}),[density,eccentricity]);
 return <section className="parallax-art" aria-label="星と軌道の3Dスタジオ">
  <header><div><span className="eyebrow">星と軌道の3Dスタジオ</span><h2>銀河の中から、惑星の軌道へ。</h2><p>ドラッグで回転、スクロールで拡大。星の数や軌道の形も変えられます。</p></div>
  <div className="parallax-scenes">{([['galaxy','渦巻銀河'],['orbit','惑星の軌道'],['trajectory','軌道の比較']] as const).map(([id,label])=><button key={id} aria-pressed={scene===id} onClick={()=>setScene(id)}>{label}</button>)}</div></header>
  <div className="parallax-stage"><UniverseCanvas ref={handle} lesson={lesson} params={params} report={null} paused={paused||stopped} timeScale={1} quality={quality} reduceMotion={window.matchMedia('(prefers-reduced-motion: reduce)').matches}/></div>
  <div className="parallax-controls"><button onClick={()=>setStopped(!stopped)} aria-pressed={stopped}>{stopped?'再生':'一時停止'}</button><button onClick={()=>handle.current?.zoomIn()}>拡大</button><button onClick={()=>handle.current?.zoomOut()}>縮小</button><button onClick={()=>handle.current?.rotateLeft()}>左へ回転</button><button onClick={()=>handle.current?.rotateRight()}>右へ回転</button><button onClick={()=>handle.current?.resetView()}>視点を戻す</button>
  <label>星の数<input aria-label="星の数" type="range" min={2000} max={quality==='high'?28000:16000} step={1000} value={density} onChange={e=>setDensity(Number(e.target.value))}/>{density.toLocaleString('ja-JP')}</label>
  <label>軌道の離心率<input aria-label="軌道の離心率" type="range" min={0.01} max={0.7} step={0.01} value={eccentricity} onChange={e=>setEccentricity(Number(e.target.value))}/>{eccentricity.toFixed(2)}</label>
  <label>描画品質<select value={quality} onChange={e=>{const q=e.target.value as 'balanced'|'high';setQuality(q);if(q==='balanced')setDensity(n=>Math.min(n,16000));}}><option value="balanced">標準</option><option value="high">高画質</option></select></label></div>
  <p className="parallax-note">星や軌道は手続き生成した観察用モデルです。実際の観測位置や、一般相対論による光の軌道を再現したものではありません。</p>
 </section>;
}
