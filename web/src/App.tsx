import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import ArtStudio, { HomeUniverse } from "./ArtStudio";
import { ThemeButton } from "./DisplayPreferences";
import { type Resource } from "./data";
import { filterResources, parseState, STORAGE_KEY } from "./state";

const CodeLab = lazy(() => import("./arena/orrery/App").then(m => ({default: m.App})));
const Learning = lazy(() => import("./Learning"));
const Secondary = lazy(() => import("./Secondary"));
const routes = new Set([
  "/",
  "/art",
  "/lab",
  "/learn",
  "/code",
  "/aichat",
  "/excelvba",
  "/contact",
  "/privacy",
  "/accessibility",
  "/settings",
  "/game",
  "/cosmicGameV3",
  "/free-book",
]);

export default function App() {
  const [url, setUrl] = useState(location.pathname + location.search);
  const [state, setState] = useState(() => {
    try {
      return parseState(localStorage.getItem(STORAGE_KEY));
    } catch {
      return parseState(null);
    }
  });
  const [storageOK, setStorageOK] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const [command, setCommand] = useState("");
  const path = url.split("?")[0];
  useEffect(() => {
    const pop = () => setUrl(location.pathname + location.search);
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageOK(true);
    } catch {
      setStorageOK(false);
    }
  }, [state]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (searchOpen) dialog.current?.showModal();
    else if (dialog.current?.open) {
      dialog.current.close();
      searchTrigger.current?.focus();
    }
  }, [searchOpen]);
  useEffect(() => {
    document.title =
      path === "/"
        ? "0 — Java・Rustを動かして学ぶ"
        : `${path === "/learn" ? "学ぶ" : path === "/art" ? "宇宙アート" : path === "/lab" ? "コード実験室" : path === "/code" ? "コードを読む" : "0"} — 0`;
  }, [path]);
  function navigate(href: string) {
    history.pushState({}, "", href);
    setUrl(location.pathname + location.search);
    setSearchOpen(false);
    scrollTo({ top: 0, behavior: "instant" });
  }
  function links(event: MouseEvent<HTMLElement>) {
    const target = (event.target as HTMLElement).closest("a");
    if (
      !target ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target.target === "_blank"
    )
      return;
    const href = target.getAttribute("href");
    if (href?.startsWith("/") && !href.startsWith("//")) {
      event.preventDefault();
      navigate(href);
    }
  }
  function favorite(id: string) {
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(id)
        ? s.favorites.filter((x) => x !== id)
        : [...s.favorites, id],
    }));
  }
  const results = filterResources(
    query,
    category,
    state.favorites,
    onlyFavorites,
  );
  const commandResults = filterResources(command, "すべて", [], false);
  const card = (item: Resource) => (
    <article key={item.id} className={`resource-card accent-${item.accent}`}>
      <a
        className="card-main"
        href={item.href}
        target={item.href.startsWith("https://") ? "_blank" : undefined}
        rel={item.href.startsWith("https://") ? "noreferrer" : undefined}
      >
        <div className="card-art">
          {item.image ? (
            <img
              src={item.image}
              width="640"
              height="360"
              loading="lazy"
              decoding="async"
              alt=""
            />
          ) : (
            <div className={`code-art art-${item.id}`}>
              <span>
                {item.id === "art"
                  ? "◌"
                  : item.id === "java"
                    ? "J"
                    : item.id === "rust"
                      ? "R"
                      : "TS"}
              </span>
              <div className="art-line" />
              <div className="art-line" />
            </div>
          )}
          <span className="card-kind">{item.category}</span>
          <span className="card-arrow">↗</span>
        </div>
        <div className="card-copy">
          <span className="card-tag">{item.tag}</span>
          <h3>{item.title}</h3>
          <p>{item.subtitle}</p>
        </div>
      </a>
      <button
        className="favorite"
        aria-label={`${item.title}をお気に入り${state.favorites.includes(item.id) ? "から削除" : "に追加"}`}
        aria-pressed={state.favorites.includes(item.id)}
        onClick={() => favorite(item.id)}
      >
        {state.favorites.includes(item.id) ? "★" : "☆"}
      </button>
    </article>
  );
  const known = routes.has(path);
  return (
    <div onClick={links}>
      <a className="skip-link" href="#main">
        本文へ
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="0 ホーム">
            <span className="brand-symbol">0</span>
            <span>
              0<small>みんなの学習</small>
            </span>
          </a>
          <nav aria-label="メイン">
            <a aria-current={path === "/" ? "page" : undefined} href="/">
              探索
            </a>
            <a aria-current={path === "/lab" ? "page" : undefined} href="/lab">実験室</a>
            <a aria-current={path === "/art" ? "page" : undefined} href="/art">
              宇宙
            </a>
            <a
              aria-current={path === "/learn" ? "page" : undefined}
              href="/learn"
            >
              学ぶ
            </a>
            <a
              aria-current={path === "/code" ? "page" : undefined}
              href="/code"
            >
              コード
            </a>
          </nav>
          <div className="header-actions">
            <ThemeButton />
            <button
              ref={searchTrigger}
              className="search-trigger"
              aria-label="サイト内を検索"
              onClick={() => setSearchOpen(true)}
            >
              <span>⌕</span>
              <span className="search-word">検索</span>
              <kbd>⌘ K</kbd>
            </button>
            <a
              href="/settings"
              className="settings-link"
              aria-label="表示と保存の設定"
            >
              ◐
            </a>
          </div>
        </div>
      </header>
      {!storageOK && (
        <p className="storage-warning" role="status">
          ブラウザ保存が使えません。今回の進捗は画面を閉じると失われます。
        </p>
      )}
      <div id="main" tabIndex={-1}>
        {path === "/" ? (
          <main>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="signal" /> JavaとRustを学ぶ
                </span>
                <h1>
                  Javaを動かして、
                  <br />
                  <em>自分で確かめる。</em>
                </h1>
                <p>
                  まず結果を予想し、小さく動かす。
                  <br className="desktop-break" />
                  時間を空けて、もう一度思い出す。
                </p>
                <div className="hero-actions">
                  <a className="primary" href="/lab">
                    コードを動かす <span>↗</span>
                  </a>
                  <a className="hero-link" href="/art">
                    宇宙をひらく <span>→</span>
                  </a>
                </div>
                <div className="hero-languages">
                  <span>Java</span>
                  <i>/</i>
                  <span>Rust</span>
                  <i>/</i>
                  <span>GLSL</span>
                </div>
              </div>
              <div className="hero-universe">
                <HomeUniverse paused={state.motion === "paused"} />
                <a
                  className="hero-image-credit"
                  href="/art"
                  target="_blank"
                  rel="noreferrer"
                >
                  JavaとRustで動く銀河 · 操作する ↗
                </a>
              </div>
              <span className="hero-bottom">予想 / 実行 / 説明 / 復習</span>
            </section>
            <section
              className="explore-section"
              aria-labelledby="explore-title"
            >
              <div className="section-top">
                <div>
                  <span className="eyebrow">教材と資料</span>
                  <h2 id="explore-title">
                    <span>学習と作品</span>
                  </h2>
                </div>
                <span className="section-number">01 — 08</span>
              </div>
              <div className="filter-bar">
                <div className="filter-tabs" aria-label="コンテンツの種類">
                  {["すべて", "作品", "学習", "リンク"].map((x) => (
                    <button
                      key={x}
                      aria-pressed={category === x}
                      className={category === x ? "active" : ""}
                      onClick={() => setCategory(x)}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                <div className="filter-right">
                  <button
                    aria-pressed={onlyFavorites}
                    className={
                      onlyFavorites
                        ? "active favorite-filter"
                        : "favorite-filter"
                    }
                    onClick={() => setOnlyFavorites((x) => !x)}
                  >
                    ☆ お気に入り
                  </button>
                  <label className="inline-search">
                    <span>⌕</span>
                    <input
                      aria-label="コンテンツを絞り込む"
                      placeholder="キーワードで探す"
                      maxLength={80}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>
              </div>
              <p className="result-count" role="status">
                {results.length}件{onlyFavorites ? " · お気に入り" : ""}
              </p>
              <div className="resource-grid">{results.map(card)}</div>
              {results.length === 0 && (
                <div className="empty-state">
                  <h3>該当するコンテンツがありません。</h3>
                  <p>別の言葉を試すか、絞り込みを解除してください。</p>
                  <button
                    onClick={() => {
                      setQuery("");
                      setCategory("すべて");
                      setOnlyFavorites(false);
                    }}
                  >
                    絞り込みを解除
                  </button>
                </div>
              )}
            </section>
            <section className="learning-banner">
              <div className="banner-mark">&lt;/&gt;</div>
              <div>
                <span className="eyebrow">学習の進め方</span>
                <h2>気になったところから、コードへ。</h2>
                <p>Javaの入力判定から、Rustの座標生成、画面に届く光まで。</p>
              </div>
              <a className="secondary" href="/learn">
                理解するための入口 →
              </a>
            </section>
          </main>
        ) : path === "/lab" ? (
          <Suspense fallback={<main className="page-shell" aria-busy="true">実験室を読み込んでいます…</main>}><CodeLab /></Suspense>
        ) : path === "/learn" ? (
          <Suspense
            fallback={
              <main className="page-shell" aria-busy="true">
                教材を読み込んでいます…
              </main>
            }
          >
            <Learning
              state={state}
              update={setState}
              search={url.split("?")[1] || ""}
            />
          </Suspense>
        ) : path === "/art" || path === "/game" || path === "/cosmicGameV3" ? (
          <ArtStudio
            paused={state.motion === "paused"}
            onPause={() =>
              setState((s) => ({
                ...s,
                motion: s.motion === "paused" ? "auto" : "paused",
              }))
            }
            search={url.split("?")[1] || ""}
          />
        ) : known ? (
          <Suspense
            fallback={
              <main className="page-shell" aria-busy="true">
                読み込んでいます…
              </main>
            }
          >
            <Secondary path={path} state={state} update={setState} />
          </Suspense>
        ) : (
          <main className="page-shell info-page">
            <span className="eyebrow">404 / ページが見つかりません</span>
            <h1>この軌道には、まだ何も。</h1>
            <p>以前の未完成ページは公開していません。</p>
            <a className="primary" href="/">
              ホームへ戻る →
            </a>
          </main>
        )}
      </div>
      <footer className="site-footer">
        <div className="footer-main">
          <a className="brand" href="/">
            <span className="brand-symbol">0</span>
            <span>
              0<small>みんなの学習</small>
            </span>
          </a>
          <p>
            誰でも使える、プログラミングの学習サイト。
            <br />
            自分で動かして、理解を確かめるために。
          </p>
          <div>
            <a
              href="https://github.com/oopdesc/0"
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
            </a>
            <a href="/contact">このサイトについて</a>
            <a href="/privacy">プライバシー</a>
            <a href="/accessibility">アクセシビリティ</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} 0 制作者</span>
          <span>宇宙 / Java / Rust</span>
          <span className="footer-status">
            <span className="signal" />
            オープンソースの学習サイト
          </span>
        </div>
      </footer>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-label="サイト内検索"
        onCancel={() => setSearchOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSearchOpen(false);
        }}
      >
        <div className="command-head">
          <label htmlFor="command-query">どこへ行きますか？</label>
          <button
            aria-label="検索を閉じる"
            onClick={() => setSearchOpen(false)}
          >
            Esc
          </button>
        </div>
        <input
          autoFocus
          id="command-query"
          placeholder="Java、Rust、作品…"
          maxLength={80}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
        />
        <div className="command-results">
          {commandResults.map((x) => (
            <a
              key={x.id}
              href={x.href}
              target={x.href.startsWith("https://") ? "_blank" : undefined}
              rel="noreferrer"
              onClick={() => setSearchOpen(false)}
            >
              <span>
                {x.title}
                <small>{x.tag}</small>
              </span>
              <b>↗</b>
            </a>
          ))}
          {!commandResults.length && <p>該当する項目はありません。</p>}
        </div>
      </dialog>
    </div>
  );
}
