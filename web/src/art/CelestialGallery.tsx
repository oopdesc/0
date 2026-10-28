import {useEffect,useRef,useState} from 'react';
import {createUniverse,type UniverseHandle} from './arenaUniverse3d';
import './celestial.css';
const works=[{mode:1,title:'渦巻き銀河',note:'四本の腕と、中心を囲む星の円盤。正面と側面を見比べてください。'},{mode:3,title:'星雲の層',note:'淡い雲の奥に星を重ねた立体表現です。視点で重なりが変わります。'},{mode:2,title:'軌道の構造',note:'同じ中心を囲む線と星団を、異なる角度から観察します。'}];
export default function CelestialGallery({paused}:{paused:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),handle=useRef<UniverseHandle|null>(null),area=useRef<HTMLElement>(null);
 const [mode,setMode]=useState(1),[seed,setSeed]=useState(42),[stopped,setStopped]=useState(false),[visible,setVisible]=useState(true),[reduced,setReduced]=useState(false),[error,setError]=useState('');
 const work=works.find(w=>w.mode===mode)!;
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>setReduced(mq.matches);sync();mq.addEventListener('change',sync);return()=>mq.removeEventListener('change',sync);},[]);
 useEffect(()=>{let inside=true;const sync=()=>setVisible(inside&&!document.hidden);const observer=new IntersectionObserver(([entry])=>{inside=entry.isIntersecting;sync();});if(area.current)observer.observe(area.current);document.addEventListener('visibilitychange',sync);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);};},[]);
 useEffect(()=>{if(!canvas.current)return;handle.current=createUniverse(canvas.current,{mode:1,seed:42,brightness:1,paused:true,autoCamera:false,quality:'standard',speed:.6},()=>{},setError);return()=>{handle.current?.dispose();handle.current=null;};},[]);
 useEffect(()=>handle.current?.update({mode,seed,brightness:1,paused:paused||stopped||reduced||!visible,autoCamera:false,quality:'standard',speed:.6}),[mode,seed,paused,stopped,reduced,visible]);
 function save(){const image=handle.current?.image();if(!image)return;const a=document.createElement('a');a.href=image;a.download=`0-celestial-${mode}-${seed}.png`;a.click();}
 return <section className="celestial-gallery" ref={area} aria-labelledby="celestial-title">
  <div className="celestial-intro"><span>新しい宇宙の作品</span><h2 id="celestial-title">星のアトリエ</h2><p>星の点、雲の層、円盤の角度。手で動かして、立体のつくりを見てみよう。</p></div>
  <nav className="celestial-works" aria-label="アトリエの作品">{works.map(w=><button key={w.mode} aria-pressed={mode===w.mode} onClick={()=>setMode(w.mode)}>{w.title}</button>)}</nav>
  <div className="celestial-stage"><canvas ref={canvas} aria-label={`${work.title}の三次元模型。ドラッグで回転、スクロールで拡大。下の視点ボタンでも操作できます。`}/>{error&&<p role="alert">{error}</p>}<span>{work.title} / 種 {seed}</span></div>
  <div className="celestial-controls"><button aria-pressed={stopped} onClick={()=>setStopped(!stopped)}>{stopped?'回転を再開':'回転を止める'}</button><button onClick={()=>handle.current?.view({x:0,y:95,z:1})}>正面から</button><button onClick={()=>handle.current?.view({x:0,y:6,z:100})}>側面から</button><button onClick={()=>handle.current?.view({x:0,y:48,z:85})}>斜めから</button><button onClick={()=>setSeed(s=>(s+7919)%1000000)}>星の配置を変える</button><button onClick={save}>画像を保存 ↓</button></div>
  <p>{work.note}</p>{reduced&&<p role="status">「動きを減らす」に合わせ、自動回転を止めています。視点は手動で変えられます。</p>}
  <details><summary>この模型で学べること</summary><p>同じ種なら同じ配置になります。球座標、回転、透明な点の重ね方をコードで確かめられます。観測データを三次元に復元したものや、重力を解く科学シミュレーションではありません。</p><a href="https://github.com/oopdesc/0/blob/main/web/src/art/arenaUniverse3d.ts" target="_blank" rel="noreferrer">描画のソースを読む ↗</a></details>
 </section>;
}
