import { Suspense, lazy, useEffect, useRef } from 'react';
import { RouterProvider, useRouter, match, Link } from './lib/router';
import { useStore, setTheme } from './state/useStore';
import { Home } from './pages/Home';
import { TrackPage } from './pages/Track';
import { ProblemPage } from './pages/Problem';
import { SessionPage } from './pages/Session';
import { BrowsePage } from './pages/Browse';
import { ErrorLabPage } from './pages/ErrorLab';
import { ProgressPage } from './pages/Progress';
import { HowPage } from './pages/How';
import { AboutPage } from './pages/About';
import { LicensesPage } from './pages/Licenses';
import { ComparePage } from './pages/Compare';
import { MapPage } from './pages/Map';
import { RulesPage } from './pages/Rules';
import { CommandPalette } from './components/CommandPalette';
import { KeyboardHelp } from './components/KeyboardHelp';

// 宇宙ページはルート単位で遅延読み込みする。
// 学習ページを開いただけでは Three も WebGPU も読み込まれない。
const SpacePage = lazy(() => import('./pages/Space'));

function NotFound() {
  return (
    <section className="page">
      <h1>ページが見つかりません</h1>
      <p className="lead">URL が変わったか、まだ作られていないページです。</p>
      <Link to="/" className="btn btn--primary">
        はじめに戻る
      </Link>
    </section>
  );
}

/** ルートごとのページ名（タブ・読み上げ・履歴の手がかり） */
function titleFor(path: string): string {
  if (path === '/') return '0 — 問題から始める Java・Rust';
  if (path.startsWith('/p/')) return '問題 — 0';
  if (path === '/today') return '今日の5問 — 0';
  if (path === '/review') return '復習 — 0';
  if (path === '/learn') return '学ぶ — 0';
  if (path.startsWith('/learn/')) return '学ぶ — 0';
  if (path === '/browse') return '問題一覧 — 0';
  if (path === '/errors') return 'ERROR LAB — 0';
  if (path === '/progress') return '進捗 — 0';
  if (path === '/how') return 'このサイトの仕組み — 0';
  if (path === '/about') return '作品と本 — 0';
  if (path === '/licenses') return 'ライセンス — 0';
  if (path === '/compare') return 'Java と Rust の対応表 — 0';
  if (path === '/map') return '概念マップ — 0';
  if (path === '/rules') return 'My Rules — 0';
  if (path === '/space') return '宇宙 — 0';
  return 'ページが見つかりません — 0';
}

function Routes() {
  const { path } = useRouter();
  const state = useStore();
  const firstRender = useRef(true);

  // 画面遷移のたびに、見出しへフォーカスを移して読み上げの起点を作る。
  // 初回表示では奪わない（そのまま読み始められるようにする）。
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
    } else {
      const h1 = document.getElementById('academy-host')?.shadowRoot?.querySelector<HTMLElement>('#main h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
      }
    }
    document.title = titleFor(path);
  }, [path]);

  const p = match(path, '/p/:id');
  if (p) return <ProblemPage id={p.id} />;
  if (match(path, '/learn')) return <TrackPage lang={null} concept={null} />;
  const l = match(path, '/learn/:lang');
  if (l) return <TrackPage lang={l.lang as 'java' | 'rust'} concept={null} />;
  const lc = match(path, '/learn/:lang/:concept');
  if (lc) return <TrackPage lang={lc.lang as 'java' | 'rust'} concept={lc.concept} />;
  if (match(path, '/today')) return <SessionPage mode="today" />;
  if (match(path, '/review')) return <SessionPage mode="review" />;
  if (match(path, '/browse')) return <BrowsePage />;
  if (match(path, '/errors')) return <ErrorLabPage />;
  if (match(path, '/progress')) return <ProgressPage state={state} />;
  if (match(path, '/how')) return <HowPage />;
  if (match(path, '/about')) return <AboutPage />;
  if (match(path, '/licenses')) return <LicensesPage />;
  if (match(path, '/compare')) return <ComparePage />;
  if (match(path, '/map')) return <MapPage />;
  if (match(path, '/rules')) return <RulesPage />;
  if (match(path, '/space'))
    return (
      <Suspense fallback={<div className="space-fallback">宇宙を読み込んでいます…</div>}>
        <SpacePage />
      </Suspense>
    );
  if (path === '/') return <Home state={state} />;
  return <NotFound />;
}

function Header() {
  const state = useStore();
  const { path } = useRouter();
  const isSpace = path === '/space';



  const nav = [
    { to: '/today', label: '今日の5問' },
    { to: '/learn', label: '学ぶ' },
    { to: '/review', label: '復習' },
    { to: '/errors', label: '間違いを振り返る' },
    { to: '/progress', label: '進捗' },
    { to: '/browse', label: '問題一覧' },
    { to: '/map', label: '概念マップ' },
    { to: '/rules', label: '自分のルール' },
  ];

  return (
    <header className={`sitehead ${isSpace ? 'sitehead--over' : ''}`}>
      <div className="sitehead__inner">
        <Link to="/" className="brand" aria-label="0 ホーム">
          <span className="brand__mark" aria-hidden="true">
            0
          </span>
          <span className="brand__text">
            <strong>問題から始める Java・Rust</strong>
            <small>予測 → 実行 → 差分 → 1 行 → 想起</small>
          </span>
        </Link>
        <nav className="nav" aria-label="主要">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={`nav__link ${path === n.to ? 'is-active' : ''}`}>
              {n.label}
            </Link>
          ))}
          <Link to="/space" className={`nav__link nav__link--space ${isSpace ? 'is-active' : ''}`}>
            宇宙
          </Link>
        </nav>
        <div className="sitehead__tools">
          <button
            type="button"
            className="iconbtn"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('0:academy-search'));
            }}
            aria-label="検索（⌘K）"
            title="検索 ⌘K"
          >
            ⌕
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setTheme(state.theme === 'dark' ? 'light' : 'dark')}
            aria-label={state.theme === 'dark' ? '明るいテーマにする' : '暗いテーマにする'}
            title="テーマ"
          >
            {state.theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
        <CommandPalette />
        <KeyboardHelp />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="sitefoot">
      <div className="sitefoot__inner">
        <p>
          登録不要・無料。学習記録はこのブラウザにだけ保存されます。
          <Link to="/progress" className="link">
            書き出し / 読み込み
          </Link>
        </p>
        <nav className="sitefoot__nav" aria-label="サイト情報">
          <Link to="/compare">Java と Rust</Link>
          <Link to="/how">このサイトの仕組み</Link>
          <Link to="/about">作品と本</Link>
          <Link to="/licenses">ライセンス</Link>
        </nav>
      </div>
    </footer>
  );
}

export function App() {
  const { path } = useRouter();
  const isSpace = path === '/space';
  return (
    <div className={`app ${isSpace ? 'app--space' : ''}`}>
      <a className="skip" href="#main" onClick={e=>{e.preventDefault();const root=e.currentTarget.getRootNode() as Document|ShadowRoot;const main=root.querySelector<HTMLElement>("#main");main?.focus();main?.scrollIntoView();}}>
        本文へ
      </a>
      <Header />
      <main id="main" tabIndex={-1} className={isSpace ? 'main main--space' : 'main'}>
        <Routes />
      </main>
      {!isSpace && <Footer />}
    </div>
  );
}

export default function Root() {
  return (
    <RouterProvider>
      <App />
    </RouterProvider>
  );
}
