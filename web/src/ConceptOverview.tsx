import {lazy,Suspense,useState} from 'react';
import {useDisplay} from './DisplayPreferences';
import {ConceptGraph} from './arena/orrery/ui/components/ConceptGraph';
import {ConceptPanel} from './arena/orrery/ui/components/ConceptPanel';
import {CONCEPTS} from './arena/orrery/core/concepts/graph';
import {store} from './arena/orrery/core/appStore';
import {findChallenge} from './arena/orrery/core/lessons';
import './arena/orrery/styles/scoped.css';
const Lab=lazy(()=>import('./arena/orrery/App').then(m=>({default:m.App})));
export default function ConceptOverview(){
 const {theme}=useDisplay();const [selected,setSelected]=useState(CONCEPTS[0].id),[exercise,setExercise]=useState(false);
 return <main className="hub-content"><p><a href="/learn?section=overview">学習の入口へ戻る →</a></p><div className="arena-orrery" data-theme={theme}>
 {exercise?<><button type="button" onClick={()=>setExercise(false)}>← 概念図に戻る</button><Suspense fallback={<p>演習を読み込んでいます…</p>}><Lab/></Suspense></>:<div className="galaxy-view"><header className="view-head"><p className="view-head__kicker">学ぶ前にも、復習にも</p><h2>JavaとRustの概念図</h2><p className="view-head__lead">点を選ぶと、その役割・前提・境界と関連する演習が開きます。JavaとRustの似た言葉も、違いを確かめながらつなげてください。</p></header><div className="galaxy-view__grid"><ConceptGraph selectedId={selected} onSelect={setSelected}/><aside className="galaxy-view__detail" aria-label="概念の詳細"><ConceptPanel conceptId={selected} onSelectConcept={setSelected} onOpenChallenge={id=>{const found=findChallenge(id);if(found){store.gotoLesson(found.lesson.id,found.index);setExercise(true);}}}/></aside></div></div>}
 </div></main>;
}
