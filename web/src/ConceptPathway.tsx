import {useEffect,useMemo,useState} from 'react';
import {FAMILY_NAMES,PATHWAY_CONCEPTS,layoutPathway,linkedPackQuestions,relatedPath} from './learning-v2/conceptPathway';
import {loadConcepts,loadManifest} from './learning-v2/loader';
import type {Concept,Lang,Manifest} from './learning-v2/types';
import './concept-pathway.css';
export default function ConceptPathway(){
 const initial=new URLSearchParams(location.search);
 const [lang,setLang]=useState<Lang>(initial.get('mapLang')==='rust'?'rust':'java');
 const [selected,setSelected]=useState(initial.get('concept')||(initial.get('mapLang')==='rust'?'r-let':'j-primitive'));
 const [search,setSearch]=useState(''),[family,setFamily]=useState('all'),[focus,setFocus]=useState(false),[zoom,setZoom]=useState(1);
 const [pack,setPack]=useState<{manifest:Manifest;concepts:Concept[]}|null>(null),[error,setError]=useState('');
 const nodes=PATHWAY_CONCEPTS.filter(n=>n.lang===lang);
 const current=nodes.find(n=>n.id===selected)||nodes.find(n=>n.id===(lang==='java'?'j-primitive':'r-let'))||nodes[0];
 const ancestors=relatedPath(current.id),children=nodes.filter(n=>n.prereqs.includes(current.id));
 const families=[...new Set(nodes.map(n=>n.family))];
 const visible=useMemo(()=>{
  const query=search.trim().toLocaleLowerCase();
  const matches=nodes.filter(n=>(family==='all'||n.family===family)&&(!query||(n.name+' '+n.rule+' '+n.summary).toLocaleLowerCase().includes(query)));
  let ids=new Set(matches.map(n=>n.id));
  if(focus)ids=new Set([...relatedPath(current.id),...children.map(n=>n.id)]);
  // Keep prerequisites alongside search results, so an arrow is not left dangling.
  for(const n of matches)if(!focus)for(const id of relatedPath(n.id))ids.add(id);
  return nodes.filter(n=>ids.has(n.id));
 },[lang,family,search,focus,current.id]);
 const layout=useMemo(()=>layoutPathway(visible,lang),[visible,lang]);
 const linked=pack?linkedPackQuestions(current,pack.concepts,pack.manifest):[];
 useEffect(()=>{
  const controller=new AbortController();setPack(null);setError('');
  loadManifest(lang,controller.signal).then(async manifest=>({manifest,concepts:await loadConcepts(manifest,controller.signal)})).then(setPack).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'問題の索引を読めません。');});
  return()=>controller.abort();
 },[lang]);
 function choose(id:string){setSelected(id);const p=new URLSearchParams(location.search);p.set('mapLang',lang);p.set('concept',id);history.replaceState(null,'','/learn?'+p.toString());}
 function changeLanguage(next:Lang){setLang(next);setSelected(next==='java'?'j-primitive':'r-let');setFamily('all');setSearch('');setFocus(false);const p=new URLSearchParams(location.search);p.set('mapLang',next);p.set('concept',next==='java'?'j-primitive':'r-let');history.replaceState(null,'','/learn?'+p.toString());}
 return <section className="concept-pathway" aria-labelledby="pathway-title">
  <header><span className="pathway-eyebrow">全体を見渡して、今いる場所を確かめる</span><h2 id="pathway-title">枝分かれでたどる、学びの地図</h2><p>JavaとRustの概念を、前提から次の一歩へたどれます。点を選ぶと「先に知ること」と「次につながること」がわかります。</p><p className="pathway-note">矢印はおすすめの学習順序です。クラスの継承や型の派生そのものを表す図ではありません。順番を飛ばしても学べます。</p></header>
  <div className="pathway-tools"><div role="group" aria-label="概念図の言語">{(['java','rust'] as Lang[]).map(l=><button type="button" key={l} aria-pressed={lang===l} onClick={()=>changeLanguage(l)}>{l==='java'?'Java':'Rust'} <small>{PATHWAY_CONCEPTS.filter(n=>n.lang===l).length}概念</small></button>)}</div><label>分野<select value={family} onChange={e=>{setFamily(e.target.value);setFocus(false);}}><option value="all">全体を見渡す</option>{families.map(f=><option value={f} key={f}>{FAMILY_NAMES[f]||f}</option>)}</select></label><label>概念を探す<input value={search} maxLength={100} onChange={e=>{setSearch(e.target.value);setFocus(false);}} placeholder="所有権、参照、型…" /></label></div>
  <div className="pathway-workspace"><div className="pathway-chart-area"><div className="pathway-chart-tools"><span>{visible.length}概念を表示 · 左から右へ</span><label><input type="checkbox" checked={focus} onChange={e=>setFocus(e.target.checked)}/>選んだ概念の道筋だけ</label><label>図の大きさ<select aria-label="概念図の表示倍率" value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={0.8}>80%</option><option value={1}>100%</option><option value={1.25}>125%</option></select></label></div>
   <div className="pathway-scroll" tabIndex={0} role="region" aria-label="横と縦にスクロールできる枝分かれ図"><svg role="group" aria-label={`${lang==='java'?'Java':'Rust'}の学習順序。下の概念一覧でも選べます。`} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width*zoom} height={layout.height*zoom}>
    <defs><marker id={`pathway-arrow-${lang}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
    {visible.flatMap(n=>n.prereqs.map(parent=>{const a=layout.positions.get(parent),b=layout.positions.get(n.id);if(!a||!b)return null;const active=ancestors.has(n.id)&&ancestors.has(parent)||parent===current.id;return <path key={parent+'-'+n.id} className={active?'pathway-edge is-active':'pathway-edge'} d={`M${a.x+158},${a.y} C${a.x+178},${a.y} ${b.x-20},${b.y} ${b.x},${b.y}`} markerEnd={`url(#pathway-arrow-${lang})`}/>;}))}
    {visible.map(n=>{const p=layout.positions.get(n.id)!;return <g key={n.id} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-label={`概念を選択：${n.name}`} aria-pressed={n.id===current.id} className={`pathway-node ${n.id===current.id?'is-selected':ancestors.has(n.id)?'is-prerequisite':''}`} onClick={()=>choose(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(n.id);}}}><rect x={0} y={-18} width={158} height={36} rx={9}/><text x={10} y={4}>{n.name.length>12?n.name.slice(0,12)+'…':n.name}</text><title>{n.name+'：'+n.rule}</title></g>;})}
   </svg>{visible.length===0&&<p>一致する概念がありません。検索語や分野を変えてください。</p>}</div><p className="pathway-note">枠の中で横・縦へスクロールできます。色の濃い点が選択中で、太い矢印がその前後のつながりです。</p>
   <details className="pathway-list"><summary>文字の一覧から選ぶ（{nodes.length}概念）</summary><div>{nodes.map(n=><button type="button" key={n.id} aria-pressed={n.id===current.id} onClick={()=>{setFamily('all');setSearch('');choose(n.id);}}>{n.name}</button>)}</div></details>
  </div>
  <aside className="pathway-detail" aria-label="選んだ概念の説明"><span>{lang==='java'?'Java':'Rust'} / {FAMILY_NAMES[current.family]||current.family}</span><h3>{current.name}</h3><strong>{current.rule}</strong><p>{current.summary}</p>
   <h4>先に知っておくと役立つこと</h4>{current.prereqs.length?<ul>{current.prereqs.map(id=>{const n=nodes.find(n=>n.id===id);return n?<li key={id}><button type="button" onClick={()=>choose(id)}>{n.name} ←</button></li>:null;})}</ul>:<p>この図では、ここを出発点にできます。</p>}
   <h4>次につながること</h4>{children.length?<ul>{children.map(n=><li key={n.id}><button type="button" onClick={()=>choose(n.id)}>{n.name} →</button></li>)}</ul>:<p>関連問題を解き、理解を自分の言葉で確かめましょう。</p>}
   {current.contrast&&<details><summary>もう一方の言語と比べる</summary><p>{current.contrast}</p></details>}
   <div className="pathway-practice"><h4>この概念を使って解く</h4>{linked.length>0?<><p>新しい教材に関連問題が{linked.length}問あります。</p><div>{linked.slice(0,4).map((id,i)=><a key={id} href={`/learn?section=drill&lang=${lang}&q=${encodeURIComponent(id)}`}>関連問題{i+1}を開く →</a>)}</div></>:<p>{error?'新しい教材の索引を読み込めませんでした。':pack?'新しい教材に対応する問題は未収録です。':'問題の索引を確認しています…'}</p>}<a href={`/learn?section=supplemental#/learn/${lang}/${current.id}`}>補充問題でこの概念を学ぶ →</a></div>
   <p className="pathway-note">仕様を調べる： <a target="_blank" rel="noreferrer" href={lang==='java'?'https://docs.oracle.com/javase/jp/21/docs/api/index.html':'https://doc.rust-jp.rs/book-ja/'}>{lang==='java'?'Java公式・日本語API':'Rust入門書・日本語訳'} ↗</a></p>
  </aside></div>
  <p className="pathway-note">別の見方： <a href="/learn?section=supplemental#/map">以前の全体マップを開く →</a></p>
 </section>;
}
