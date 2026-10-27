import { useState } from 'react';
import { ArrowUpRight, GitBranch } from 'lucide-react';
import { LESSONS, getLesson } from '../domain/lessons';
import type { LessonId } from '../domain/types';
interface Props { onOpenMission: (id: LessonId) => void }
export function Atlas({ onOpenMission }: Props) {
  const [selected, setSelected] = useState<LessonId>('java-array');
  const lesson = getLesson(selected);
  return <section className="atlas-section shell section-space" id="atlas" aria-labelledby="atlas-title">
    <div className="section-heading"><div><p className="eyebrow"><span className="accent">03</span> / CONCEPT ATLAS</p><h2 id="atlas-title">知識を、点で終わらせない。</h2></div><p className="section-description">似ているところと、違うところ。<br />概念のつながりをたどる。</p></div>
    <div className="atlas-layout"><div className="atlas-map"><div className="atlas-map-top"><span><GitBranch size={14} /> CONCEPT MAP</span><span>JAVA ↔ RUST</span></div><div className="atlas-grid"><svg className="atlas-lines" viewBox="0 0 600 360" preserveAspectRatio="none" aria-hidden="true"><path d="M150 60 L450 60 M150 60 L150 180 L150 300 M450 60 L450 180 L450 300" /></svg>{[LESSONS[0], LESSONS[4], LESSONS[1], LESSONS[3], LESSONS[2], LESSONS[5]].map((l) => <button key={l.id} className={`atlas-node ${selected === l.id ? 'active' : ''}`} type="button" aria-pressed={selected === l.id} onClick={() => setSelected(l.id)}><span className="node-dot" /><span><small>{l.language.toUpperCase()} / {l.number}</small><strong>{l.id === 'java-array' ? '配列と境界' : l.id === 'java-stream' ? 'Streamと条件' : l.id === 'rust-ownership' ? '所有権と借用' : l.id === 'rust-option' ? 'Optionと境界' : l.id === 'java-polymorphism' ? '多態性と実体' : 'Resultと検証'}</strong></span><ArrowUpRight size={14} /></button>)}</div><p className="atlas-note">線は関連を示します。同じ仕組みであることを意味しません。</p></div>
      <div className="atlas-detail"><span className="eyebrow">SELECTED CONCEPT / {lesson.number}</span><h3>{lesson.title}</h3><p>{lesson.explanation}</p><div><small>LANGUAGE COMPARISON</small><p>{lesson.comparison}</p></div><button type="button" onClick={() => onOpenMission(lesson.id)}>この実験をひらく <ArrowUpRight size={15} /></button></div></div>
  </section>;
}
