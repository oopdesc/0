import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { LESSONS } from '../domain/lessons';
import type { LessonId } from '../domain/types';
import type { ProgressState } from '../domain/progress';
interface Props { selected: LessonId; onSelect: (id: LessonId) => void; progress: ProgressState }
export function MissionSelector({ selected, onSelect, progress }: Props) {
  return <section className="missions-section shell section-space" id="missions" aria-labelledby="mission-title">
    <div className="section-heading"><div><p className="eyebrow"><span className="accent">01</span> / SELECT YOUR MISSION</p><h2 id="mission-title">ひとつの問いから、<br className="mobile-only" />宇宙がはじまる。</h2></div><p className="section-description">6つの小さな実験。<br />言語も、順番も、あなたの自由に。</p></div>
    <div className="mission-list">
      {LESSONS.map((lesson) => <button type="button" key={lesson.id} className={`mission-item ${selected === lesson.id ? 'is-selected' : ''}`} aria-pressed={selected === lesson.id} onClick={() => { onSelect(lesson.id); document.getElementById('orbit-host')?.shadowRoot?.getElementById('lab')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}>
        <span className="mission-number">{lesson.number} <span>/</span> {lesson.language.toUpperCase()}</span>
        <span className="mission-main"><strong>{lesson.title}</strong><small>{lesson.short}</small></span>
        <span className="mission-end"><span>{progress.lessons[lesson.id].completed ? '実験記録あり' : lesson.tag}</span>{selected === lesson.id ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}</span>
      </button>)}
    </div>
  </section>;
}
