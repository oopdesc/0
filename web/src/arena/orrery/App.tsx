import { useDisplay } from '../../DisplayPreferences';
import './styles/scoped.css';
import { useEffect, useSyncExternalStore } from 'react';
import { store, type Route } from './core/appStore';
import { universe } from './core/simulation/controller';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { HomeView } from './ui/views/HomeView';
import { LabView } from './ui/views/LabView';
import { LearnView } from './ui/views/LearnView';
import { ErrorLabView } from './ui/views/ErrorLabView';
import { GalaxyView } from './ui/views/GalaxyView';
import { ReviewView } from './ui/views/ReviewView';
import { SettingsView } from './ui/views/SettingsView';

const NAV: Array<{ id: Route; label: string }> = [
  { id: 'home', label: 'ホーム' },
  { id: 'learn', label: '学習' },
  { id: 'lab', label: 'コード実験' },
  { id: 'errors', label: '誤りの記録' },
  { id: 'galaxy', label: '概念地図' },
  { id: 'review', label: '復習' },
  { id: 'settings', label: '設定' },
];

export function App() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const prefs = state.progress.preferences;
  const { theme } = useDisplay();
  const reduced = prefs.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  useEffect(() => {
    universe.setQuality(prefs.quality);
    universe.setGrid(prefs.showGrid);
    universe.setTimeScale(prefs.timeScale);
    if (prefs.reducedMotion) universe.setReducedMotion(true);
    // Only apply persisted preferences once on mount; later changes go through
    // store.setPreference so the simulation stays in sync without loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  let view: React.ReactNode;
  switch (state.route) {
    case 'lab': view = <LabView />; break;
    case 'learn': view = <LearnView />; break;
    case 'errors': view = <ErrorLabView />; break;
    case 'galaxy': view = <GalaxyView />; break;
    case 'review': view = <ReviewView />; break;
    case 'settings': view = <SettingsView />; break;
    default: view = <HomeView />;
  }

  return (
    <ErrorBoundary>
      <div className="arena-orrery" data-theme={theme} data-motion={reduced ? "reduced" : "full"}><div className="app">
        <header className="site-header">
          <div className="site-header__inner">
            <button type="button" className="brand" onClick={() => store.navigate('home')} aria-label="コード実験室 ホーム">
              <span className="brand__mark" aria-hidden="true"><i /><i /><i /></span>
              <span className="brand__name">0 · コード実験室</span>
              <span className="brand__sub">予測・実行・復習</span>
            </button>
            <nav className="site-nav" aria-label="メインナビゲーション">
              {NAV.map((n) => (
                <button key={n.id} type="button" className={state.route === n.id ? 'is-active' : ''}
                  aria-current={state.route === n.id ? 'page' : undefined}
                  onClick={() => store.navigate(n.id)}>{n.label}</button>
              ))}
            </nav>
            <span className="site-header__meta" aria-hidden="true">Java / Rust</span>
          </div>
        </header>

        <main id="main" className="site-main" key={state.route}>{view}</main>

        <footer className="site-footer">
          <div>
            <strong>0 · コード実験室</strong> — Java / Rust を、宇宙を組み替えながら学ぶ。
          </div>
          <div>
            教育用簡略モデル · API key 不要 · アカウント不要 · <button type="button" onClick={() => store.navigate('settings')}>データと制限</button>
          </div>
        </footer>

        {state.toast && <div className="toast" role="status" aria-live="polite">{state.toast}</div>}
      </div>
    </div></ErrorBoundary>
  );
}
