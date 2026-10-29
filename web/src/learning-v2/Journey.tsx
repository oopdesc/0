import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { loadCatalog, type CatalogItem, catalogHref } from "./catalog";
import {
  emptyJourney,
  readJourney,
  saveJourney,
  validateJourney,
  completeJourney,
  mergeJourney,
  validateJourneyOrder,
  journeyHref,
  originalHref,
  completionLabel,
  JOURNEY_KEY,
  JOURNEY_EVENT,
  completionFlags,
  type JourneyProgress,
  type CompletionKind,
} from "./journey-state";
import "./journey.css";
import learningStats from "../generated/learning-stats.json";
const PackQuestion = lazy(() => import("./JourneyPackQuestion"));
const Academy = lazy(() => import("../Academy"));
const Legacy = lazy(() => import("../CuratedProblems"));
const levels = { beginner: "初級", intermediate: "中級", advanced: "上級" };
const sources = {
  normal: "通常問題",
  supplemental: "補充問題",
  exam: "試験からの練習",
  legacy: "ブラウザ演習",
};
const navigate = (href: string) => {
  history.pushState({}, "", href);
  dispatchEvent(new PopStateEvent("popstate"));
  scrollTo({ top: 0, behavior: "instant" });
};
export default function Journey({ search }: { search: string }) {
  const [items, setItems] = useState<CatalogItem[] | null>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const [initial] = useState(() => {
    try {
      return readJourney(localStorage);
    } catch {
      return {
        state: emptyJourney(),
        writable: false,
        error: "このブラウザでは保存できません。",
      };
    }
  });
  const [progress, setProgress] = useState(initial.state),
    progressRef = useRef(progress);
  progressRef.current = progress;
  const [notice, setNotice] = useState(initial.error),
    [celebrate, setCelebrate] = useState(""),
    [language, setLanguage] = useState("all"),
    [page, setPage] = useState(0),
    [jump, setJump] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const params = new URLSearchParams(search),
    step = params.get("step");
  useEffect(() => {
    const c = new AbortController();
    setError("");
    async function load() {
      const list = await loadCatalog(c.signal),
        r = await fetch("/learning-v2/journey.json", { signal: c.signal });
      if (!r.ok) throw Error("カリキュラムの索引を取得できません。");
      const text = await r.text();
      if (text.length > 64000) throw Error("索引が大きすぎます。");
      const ordered = validateJourneyOrder(JSON.parse(text), list);
      if (!c.signal.aborted) setItems(ordered);
    }
    load().catch((e) => {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "読み込めません。");
    });
    return () => c.abort();
  }, [reload]);
  const known = useMemo(() => new Set(items?.map((x) => x.id)), [items]);
  const active = items?.find((x) => x.id === step),
    position = active ? items!.indexOf(active) : -1;
  const completed = items?.filter((x) => progress.records[x.id]) ?? [],
    level = completed.length,
    total = items?.length ?? learningStats.unique.total;
  const next =
    items?.find((x, i) => i > position && !progress.records[x.id]) ??
    items?.find((x) => !progress.records[x.id]);
  const filtered =
      items?.filter((x) => language === "all" || x.language === language) ?? [],
    pages = Math.max(1, Math.ceil(filtered.length / 24)),
    currentPage = Math.min(page, pages - 1);
  const activeRef = useRef(active);
  activeRef.current = active;
  const knownRef = useRef(known);
  knownRef.current = known;
  function commit(nextState: JourneyProgress) {
    let saved: JourneyProgress;
    try {
      if (!initial.writable) throw Error(initial.error || "保存できません。");
      saved = saveJourney(localStorage, nextState);
      setNotice("");
    } catch (e) {
      setNotice(
        "レベル記録を保存できません。画面を閉じる前に書き出してください。" +
          (e instanceof Error ? e.message : ""),
      );
      saved = mergeJourney(progressRef.current, nextState);
    }
    progressRef.current = saved;
    setProgress(saved);
  }
  function clear(kind: CompletionKind) {
    const item = activeRef.current;
    if (!item) return;
    const first = !progressRef.current.records[item.id];
    commit(
      completeJourney(progressRef.current, item.id, kind, knownRef.current),
    );
    setCelebrate(
      first
        ? "一問、積み重なりました。レベルが1上がりました。"
        : "この一問は記録済みです。レベルは二重に加算しません。",
    );
  }
  const clearRef = useRef(clear);
  clearRef.current = clear;
  useEffect(() => {
    const completion = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (
        d &&
        d.id === activeRef.current?.id &&
        typeof d.kind === "string" &&
        Object.hasOwn(completionFlags, d.kind)
      )
        clearRef.current(d.kind as CompletionKind);
    };
    const sync = (e: StorageEvent) => {
      if (e.key !== JOURNEY_KEY) return;
      try {
        const old = readJourney(localStorage);
        if (!old.writable) {
          setNotice(old.error);
          return;
        }
        const merged = mergeJourney(progressRef.current, old.state);
        progressRef.current = merged;
        setProgress(merged);
      } catch {
        setNotice("別のタブの記録を読み取れません。");
      }
    };
    addEventListener(JOURNEY_EVENT, completion);
    addEventListener("storage", sync);
    return () => {
      removeEventListener(JOURNEY_EVENT, completion);
      removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    setCelebrate("");
  }, [step]);
  function exportFile() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(progressRef.current, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "0-curriculum-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      if (!items) throw Error("索引の読み込み後に取り込めます。");
      if (file.size > 1000000)
        throw Error("1MBを超えるファイルは取り込めません。");
      const added = validateJourney(JSON.parse(await file.text()), known);
      commit(mergeJourney(progressRef.current, added));
    } catch (e) {
      setNotice(
        "取り込みを中止しました。既存の記録はそのままです。" +
          (e instanceof Error ? e.message : ""),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <main className={"journey" + (active ? " journey-active" : "")}>
      <header className="journey-header">
        <div>
          <span className="journey-eyebrow">一問から、遠くまで。</span>
          <h1>レベルアップ・カリキュラム</h1>
          <p>
            JavaとRustの入口から、コードを書けるところまで。
            {total.toLocaleString()}問を一本の道でたどります。
          </p>
        </div>
        <div className="journey-level">
          <span>学習レベル</span>
          <strong>Lv. {level.toLocaleString()}</strong>
          <small>/ {total.toLocaleString()}</small>
        </div>
      </header>
      <div className="journey-meter">
        <progress
          aria-label="カリキュラムの完了数"
          value={level}
          max={total || 1}
        />
        <span>
          {level.toLocaleString()}問を完了 · 残り{" "}
          {Math.max(0, total - level).toLocaleString()}問
        </span>
      </div>
      <p className="journey-note">
        一問の完了でレベルが1つ上がります。同じ問題の別形式・再挑戦は重ねて数えません。どこからでも始められます。
      </p>
      {notice && (
        <p className="journey-message" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="journey-message" role="alert">
          {error}{" "}
          <button onClick={() => setReload((x) => x + 1)}>読み直す</button>
        </div>
      )}
      {!items && !error && <p role="status">学習の道を読み込んでいます…</p>}
      {step && !active && items && (
        <p role="alert">
          このステップは見つかりません。一覧から選び直してください。
        </p>
      )}
      {active ? (
        <>
          <nav className="journey-step-nav" aria-label="カリキュラムの移動">
            <a href="/learn?section=journey">道の一覧へ</a>
            {position > 0 && (
              <a href={journeyHref(items![position - 1])}>← 前の一問</a>
            )}
            <span>
              ステップ {position + 1} / {total}
            </span>
            {position < total - 1 && (
              <a href={journeyHref(items![position + 1])}>次の一問 →</a>
            )}
          </nav>
          <section className="journey-current">
            <div>
              <span>
                {active.language === "java" ? "Java" : "Rust"} ·{" "}
                {levels[active.level]} · {sources[active.source]}
              </span>
              <h3>{active.title}</h3>
            </div>
            <span className="journey-stamp">
              {progress.records[active.id]
                ? "✓ " + completionLabel(progress.records[active.id].evidence)
                : "これからの一問"}
            </span>
          </section>
          <Suspense fallback={<p role="status">問題を読み込んでいます…</p>}>
            {active.source === "normal" || active.source === "exam" ? (
              <PackQuestion key={active.id} item={active} />
            ) : active.source === "supplemental" ? (
              <Academy key={active.id} questionId={active.id.slice(8)} />
            ) : (
              <Legacy
                key={active.id}
                initialQuestionId={active.id.slice(9)}
                initialLanguage={
                  active.id.slice(9).startsWith("b-")
                    ? "bridge"
                    : active.language
                }
              />
            )}
          </Suspense>
          <section className="journey-finish" aria-label="この一問の完了">
            <div>
              <h3>
                {progress.records[active.id]
                  ? "次の一歩へ。"
                  : "解いて、理由まで確かめたら。"}
              </h3>
              <p>
                正答すると自動で記録します。コードを手元で試した場合や、答えを見て学び直した場合は、自分で確認して完了にできます。自己確認はコンパイラの合格にはなりません。
              </p>
            </div>
            <div className="journey-actions">
              <button onClick={() => clear("self-check")}>
                自分で確かめて完了
              </button>
              {position < total - 1 && (
                <a
                  className="journey-primary"
                  href={journeyHref(items![position + 1])}
                >
                  {progress.records[active.id]
                    ? "次の一問へ →"
                    : "記録せず次の一問へ →"}
                </a>
              )}
            </div>
            <p role="status" className="journey-celebrate">
              {celebrate ||
                "一度に一問。休憩しても、ここからまた続けられます。"}
            </p>
            <a href={originalHref(active)}>この問題を元の問題集で開く →</a>
            {active.codeKey && active.codeKey !== active.id && (
              <a href={catalogHref(active.codeKey, active.language)}>
                コードを書く別形式で試す →
              </a>
            )}
          </section>
        </>
      ) : (
        items && (
          <>
            <div className="journey-actions">
              {next ? (
                <a className="journey-primary" href={journeyHref(next)}>
                  {level ? "未完了の一問から続ける" : "最初の一問から始める"} →
                </a>
              ) : (
                <p>
                  すべての問題を完了しました。もう一度解く問題を、自由に選んでください。
                </p>
              )}
              <a href="/learn?section=concepts">概念のつながりを見る →</a>
            </div>
            <section className="journey-road" aria-label="学習の道">
              <div className="journey-filters">
                <label>
                  道を眺める
                  <select
                    value={language}
                    onChange={(e) => {
                      setLanguage(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="all">JavaとRust · すべて</option>
                    <option value="java">Java</option>
                    <option value="rust">Rust</option>
                  </select>
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number(jump);
                    if (Number.isInteger(n) && n >= 1 && n <= total)
                      navigate(journeyHref(items[n - 1]));
                  }}
                >
                  <label>
                    ステップへ移動
                    <input
                      aria-label="移動するステップ番号"
                      type="number"
                      min={1}
                      max={total}
                      value={jump}
                      onChange={(e) => setJump(e.target.value)}
                    />
                  </label>
                  <button>移動</button>
                </form>
              </div>
              <ol>
                {filtered
                  .slice(currentPage * 24, currentPage * 24 + 24)
                  .map((item) => (
                    <li
                      key={item.id}
                      className={progress.records[item.id] ? "is-complete" : ""}
                    >
                      <span className="journey-node">
                        {progress.records[item.id]
                          ? "✓"
                          : items.indexOf(item) + 1}
                      </span>
                      <div>
                        <small>
                          ステップ {items.indexOf(item) + 1} ·{" "}
                          {item.language === "java" ? "Java" : "Rust"} ·{" "}
                          {levels[item.level]}
                        </small>
                        <a href={journeyHref(item)}>
                          {item.title} <span aria-hidden="true">→</span>
                        </a>
                        <p>{item.topics}</p>
                      </div>
                      <span className="journey-row-state">
                        {progress.records[item.id]
                          ? completionLabel(progress.records[item.id].evidence)
                          : sources[item.source]}
                      </span>
                    </li>
                  ))}
              </ol>
              <nav className="journey-pages" aria-label="道のページ">
                <button
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  ← 前
                </button>
                <span>
                  {currentPage + 1} / {pages}
                </span>
                <button
                  disabled={currentPage >= pages - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  次 →
                </button>
              </nav>
            </section>
          </>
        )
      )}
      <details className="journey-records">
        <summary>記録の保存と、この道の使い方</summary>
        <p>
          初級から上級へ、前提になる問題を先に置いたおすすめの道です。つまずいたら概念図へ戻れます。順番の強制やロックはありません。
        </p>
        <p>
          レベルは積み重ねの記録で、技能の認定ではありません。このカリキュラムの記録は、この端末・このブラウザに保存されます。通常問題集や試験の既存記録は残し、ここでの自己確認を試験の得点に変換しません。端末を変える前に書き出してください。取り込みは既存記録と統合します。
        </p>
        <div className="journey-actions">
          <button onClick={exportFile}>レベル記録を書き出す ↓</button>
          <button
            disabled={busy || !items}
            onClick={() => input.current?.click()}
          >
            {busy ? "取り込み中…" : "レベル記録を取り込む"}
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </div>
      </details>
    </main>
  );
}
