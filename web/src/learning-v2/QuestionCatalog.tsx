import { useEffect, useMemo, useRef, useState } from "react";
import {
  catalogHref,
  catalogState,
  catalogSearch,
  loadCatalog,
  searchCatalog,
  type CatalogItem,
  type CatalogFilter,
} from "./catalog";
import stats from "../generated/learning-stats.json";
import "./catalog.css";
const sourceNames = {
  normal: "通常問題",
  supplemental: "補充問題",
  exam: "試験",
  legacy: "ブラウザ演習",
};
const levels = { beginner: "初級", intermediate: "中級", advanced: "上級" };
const pageSize = 30;
export default function QuestionCatalog({ search }: { search: string }) {
  const resultArea = useRef<HTMLDivElement>(null);
  const { filter, page } = catalogState(search);
  const { language, level, kind, source, query } = filter;
  const [items, setItems] = useState<CatalogItem[] | null>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    loadCatalog(ctrl.signal)
      .then(setItems)
      .catch((e) => {
        if (!ctrl.signal.aborted)
          setError(e instanceof Error ? e.message : "読み込めません。");
      });
    return () => ctrl.abort();
  }, [reload]);
  const filtered = useMemo(
    () => searchCatalog(items ?? [], { language, level, kind, source, query }),
    [items, language, level, kind, source, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    current = Math.min(page, pages - 1);
  const change = (patch: Partial<CatalogFilter>, nextPage = 0) => {
    const url = catalogSearch({ ...filter, ...patch }, nextPage);
    history.replaceState(history.state, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  };
  const clear = () =>
    change({
      language: "all",
      level: "all",
      kind: "all",
      source: "all",
      query: "",
    });
  const turnPage = (next: number) => {
    change({}, next);
    requestAnimationFrame(() => {
      resultArea.current?.scrollIntoView({ block: "start", behavior: "instant" });
      resultArea.current?.focus({ preventScroll: true });
    });
  };
  return (
    <main className="question-catalog" aria-labelledby="catalog-title">
      <header className="catalog-heading">
        <div>
          <span>問題を選ぶ</span>
          <h2 id="catalog-title">
            {stats.unique.total.toLocaleString("ja-JP")}問から、
            <br />
            今日の一問を。
          </h2>
          <p>
            問題集の境目を越えて、自分に合う一問を探せます。
            <br />
            順番は自由。解説を読み、手を動かして確かめてください。
          </p>
        </div>
        <aside>
          <a href="/learn?section=today">今日の復習 →</a>
          <a href="/learn?section=concepts">概念図から探す →</a>
          <a href="/learn?section=drill">単元ごとに進める →</a>
        </aside>
      </header>
      <div
        className="catalog-filters"
        role="search"
        aria-label="全問題を絞り込む"
      >
        <label className="catalog-search">
          キーワード・問題ID
          <input
            type="search"
            value={query}
            maxLength={160}
            placeholder="例：所有権、例外、HTTP"
            onChange={(e) => change({ query: e.target.value })}
          />
        </label>
        <label>
          言語
          <select
            value={language}
            onChange={(e) => change({ language: e.target.value })}
          >
            <option value="all">JavaとRust</option>
            <option value="java">Java</option>
            <option value="rust">Rust</option>
          </select>
        </label>
        <label>
          難しさ
          <select
            value={level}
            onChange={(e) => change({ level: e.target.value })}
          >
            <option value="all">すべて</option>
            <option value="beginner">初級</option>
            <option value="intermediate">中級</option>
            <option value="advanced">上級</option>
          </select>
        </label>
        <label>
          取り組み方
          <select
            value={kind}
            onChange={(e) => change({ kind: e.target.value })}
          >
            <option value="all">すべて</option>
            <option value="prediction">予測・読み取り</option>
            <option value="code">コードを書く</option>
          </select>
        </label>
        <label>
          教材
          <select
            value={source}
            onChange={(e) => change({ source: e.target.value })}
          >
            <option value="all">すべて</option>
            {Object.entries(sourceNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <div role="alert" className="catalog-empty">
          <p>{error}</p>
          <button onClick={() => setReload((n) => n + 1)}>読み直す</button>
        </div>
      ) : !items ? (
        <p role="status">全問題の索引を読み込んでいます…</p>
      ) : (
        <>
          <div className="catalog-result" ref={resultArea} tabIndex={-1}>
            <p role="status">
              <strong>{filtered.length.toLocaleString("ja-JP")}問</strong>{" "}
              {filtered.length > 0 &&
                `${current * pageSize + 1}〜${Math.min((current + 1) * pageSize, filtered.length)}問を表示`}
            </p>
            <button onClick={clear}>絞り込みを解除</button>
          </div>
          {filtered.length === 0 ? (
            <div className="catalog-empty">
              <h3>この条件の問題は見つかりませんでした。</h3>
              <p>
                短い言葉に変えるか、難しさ・教材の指定を外してみてください。
              </p>
            </div>
          ) : (
            <ol className="catalog-list" start={current * pageSize + 1}>
              {filtered
                .slice(current * pageSize, (current + 1) * pageSize)
                .map((q) => (
                  <li key={q.id}>
                    <span className="catalog-number" aria-hidden="true">
                      {q.language === "java" ? "J" : "R"}
                    </span>
                    <div>
                      <div className="catalog-tags">
                        <span>{q.language === "java" ? "Java" : "Rust"}</span>
                        <span>{levels[q.level]}</span>
                        <span>{sourceNames[q.source]}</span>
                        {q.codeKey && <span>記述あり</span>}
                      </div>
                      <a
                        className="catalog-question-link"
                        href={catalogHref(
                          kind === "code" && q.codeKey ? q.codeKey : q.id,
                          q.language,
                        )}
                      >
                        {q.title}
                        <span aria-hidden="true"> ↗</span>
                      </a>
                      <small>
                        {q.id}
                        {q.topics && (
                          <span className="catalog-topic">{q.topics}</span>
                        )}
                      </small>
                    </div>
                    {q.codeKey && kind !== "code" && (
                      <a
                        className="catalog-code-link"
                        href={catalogHref(q.codeKey, q.language)}
                      >
                        コードを書く →
                      </a>
                    )}
                  </li>
                ))}
            </ol>
          )}
          {pages > 1 && (
            <nav className="catalog-pages" aria-label="問題一覧のページ">
              <button
                disabled={current === 0}
                onClick={() => turnPage(current - 1)}
              >
                ← 前の30問
              </button>
              <span>
                {current + 1} / {pages}ページ
              </span>
              <button
                disabled={current === pages - 1}
                onClick={() => turnPage(current + 1)}
              >
                次の30問 →
              </button>
            </nav>
          )}
        </>
      )}
      <p className="catalog-footnote">
        同じ元IDの再掲と、同じ設問・コード・回答の予測問題をまとめた一覧です。記述は合計の内数です。
        <a
          href="https://github.com/oopdesc/0/blob/main/docs/QUESTION_COUNT.md"
          target="_blank"
          rel="noreferrer"
        >
          集計方法 ↗
        </a>
      </p>
    </main>
  );
}
