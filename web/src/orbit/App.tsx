import { useCallback, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { MissionSelector } from './components/MissionSelector';
import { Lab } from './components/Lab';
import { Atlas } from './components/Atlas';
import { Review } from './components/Review';
import { Footer } from './components/Footer';
import type { Quality } from './components/OrbitScene';
import { freshProgress, loadProgress, recordAttempt, saveProgress, scheduleReview } from './domain/progress';
import { loadSettings, saveSettings } from './domain/settings';
import { LESSON_IDS } from './domain/types';
import type { LessonId, ModelState, RunResult, Stage } from './domain/types';

function initialMotion(): boolean { return typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
export default function App() {
  const [loaded] = useState(loadProgress);
  const [progress, setProgress] = useState(loaded.data); const [storageAvailable, setStorageAvailable] = useState(loaded.available);
  const [selected, setSelected] = useState<LessonId>('java-array'); const [initialStage, setInitialStage] = useState<Stage>('example'); const [labKey, setLabKey] = useState(0);
  const [model, setModel] = useState<ModelState>({ radii: [1, 2, 3], highlightedIndex: null });
  const [modelOrigin, setModelOrigin] = useState('初期モデル');
  const [settings] = useState(loadSettings);
  const [playing, setPlaying] = useState(initialMotion); const [speed, setSpeed] = useState<number>(settings.speed); const [quality, setQuality] = useState<Quality>(settings.quality);
  useEffect(() => { if (!saveProgress(progress)) setStorageAvailable(false); }, [progress]);
  useEffect(() => { if (!saveSettings({ speed: speed === 0.5 || speed === 2 ? speed : 1, quality })) setStorageAvailable(false); }, [speed, quality]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => { if (media.matches) setPlaying(false); };
    media.addEventListener('change', onChange); return () => media.removeEventListener('change', onChange);
  }, []);
  const toggle = useCallback(() => setPlaying((v) => !v), []);
  const open = (id: LessonId, stage: Stage = 'example', scroll = false) => { setSelected(id); setInitialStage(stage); setLabKey((n) => n + 1); if (scroll) window.setTimeout(() => document.getElementById('orbit-host')?.shadowRoot?.getElementById('lab')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }), 0); };
  const onRun = (correct: boolean, result: RunResult, stage: Stage, satisfied: boolean) => {
    setProgress((state) => recordAttempt(state, selected, correct, result.status === 'success', stage, satisfied));
    if (result.model) { setModel(result.model); setModelOrigin('直近の成功結果'); }
  };
  const completed = Object.values(progress.lessons).filter((p) => p.completed).length;
  const due = Object.values(progress.lessons).filter((p) => p.dueAt !== null && p.dueAt <= Date.now()).length;
  const reset = () => { if (window.confirm('この端末のORBIT学習記録をすべて消去します。よろしいですか？')) setProgress(freshProgress()); };
  return <div id="top"><Header total={LESSON_IDS.length} completed={completed} due={due} storageAvailable={storageAvailable} /><main id="main"><Hero model={model} playing={playing} onToggle={toggle} speed={speed} quality={quality} /><MissionSelector selected={selected} onSelect={(id) => open(id)} progress={progress} /><Lab key={`${selected}-${labKey}`} lessonId={selected} initialStage={initialStage} progress={progress.lessons[selected]} model={model} playing={playing} onToggle={toggle} speed={speed} setSpeed={setSpeed} quality={quality} setQuality={setQuality} modelOrigin={modelOrigin} onRun={onRun} /><Atlas onOpenMission={(id) => open(id, 'example', true)} /><Review key={selected} selected={selected} progress={progress} onSchedule={(id, success) => setProgress((state) => scheduleReview(state, id, success))} onOpenMission={(id) => open(id, 'example', true)} /></main><Footer onReset={reset} storageAvailable={storageAvailable} /></div>;
}
