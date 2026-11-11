import { useEffect, useMemo, useRef, useState } from "react";
import { emptyProgress, loadProgress } from "./progress";
import { loadStudyIndex, studyHref, type StudyIndex } from "./studyPlanner";
import {
  confirmStudyRoundReplacement,
  roundHref,
  startStudyRound,
} from "./studyRound";
import { notebookItems, notebookLabels, notebookText } from "./notebook";
import "./notebook.css";

const filters = [
  ["review", "間違い・迷い"],
  ["saved", "あとで解く"],
  ["notes", "メモあり"],
  ["draft", "書きかけ"],
  ["all", "すべての記録"],
] as const;
function read() {
  try {
    return loadProgress(localStorage);
  } catch {
    return {
      state: emptyProgress(),
      writable: false,
      error: "このブラウザの記録を読み取れません。",
    };
  }
}

export default function NotebookView({
  search,
  navigate,
}: {
  search: string;
  navigate: (href: string) => void;
}) {
  const [saved, setSaved] = useState(read);
  const [index, setIndex] = useState<StudyIndex | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const params = new URLSearchParams(search);
  const filter =
    filters.find(([id]) => id === params.get("filter"))?.[0] ?? "review";
  const language = ["java", "rust"].includes(params.get("lang") ?? "")
    ? params.get("lang")!
    : "all";
  const query = (params.get("query") ?? "").slice(0, 120);
  const requestedPage = Number(params.get("page") ?? 0);
  const page =
    Number.isInteger(requestedPage) && requestedPage >= 0
      ? Math.min(300, requestedPage)
      : 0;
  const resultArea = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadStudyIndex(controller.signal)
      .then(setIndex)
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "索引を読み取れません。",
          );
      });
    const refresh = () => setSaved(read());
    addEventListener("focus", refresh);
    addEventListener("storage", refresh);
    return () => {
      controller.abort();
      removeEventListener("focus", refresh);
      removeEventListener("storage", refresh);
    };
  }, [reload]);
  const items = useMemo(
    () => (index ? notebookItems(index, saved.state) : []),
    [index, saved.state],
  );
  const matching = items.filter((entry) => {
    const terms = query
      .normalize("NFKC")
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const text = (
      entry.item.title +
      " " +
      entry.item.id +
      " " +
      (entry.note?.content ?? "")
    )
      .normalize("NFKC")
      .toLowerCase();
    return (
      (language === "all" || entry.item.language === language) &&
      terms.every((term) => text.includes(term))
    );
  });
  const matches = (entry: (typeof items)[number], tab: string) =>
    tab === "all" ||
    (tab === "review" && (entry.weak || entry.due)) ||
    (tab === "saved" && entry.note?.bookmarked) ||
    (tab === "notes" && !!entry.note?.content) ||
    (tab === "draft" && entry.draft);
  const shown = matching.filter((entry) => matches(entry, filter));
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(shown.length / 20) - 1),
  );
  function change(patch: Record<string, string | number>) {
    const next = new URLSearchParams({
      section: "notebook",
      filter,
      lang: language,
      query,
      page: "0",
    });
    for (const [key, value] of Object.entries(patch))
      next.set(key, String(value));
    history.replaceState(history.state, "", "/learn?" + next);
    dispatchEvent(new PopStateEvent("popstate"));
  }
  function turnPage(next: number) {
    change({ page: next });
    requestAnimationFrame(() => {
      resultArea.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
      resultArea.current?.focus({ preventScroll: true });
    });
  }
  function begin() {
    if (!shown.length || !confirmStudyRoundReplacement()) return;
    const round = startStudyRound(
      shown.slice(0, 5).map((entry) => entry.item.id),
      {
        language: language === "java" || language === "rust" ? language : "all",
        level: "all",
        kind: "all",
        limit: 5,
        includeNew: false,
      },
      filter === "review" ? "follow-up" : undefined,
    );
    if (round) navigate(roundHref(round));
    else setNotice("セットを保存できません。一覧の問題から一問ずつ開けます。");
  }
  function downloadNotes() {
    const url = URL.createObjectURL(
      new Blob([notebookText(shown, location.origin)], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "0-learning-notes.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("この一覧の問題リンクとメモを、テキストに保存しました。");
  }
  return (
    <main className="learning-notebook" aria-labelledby="notebook-title">
      <header>
        <h2 id="notebook-title">学習ノート</h2>
        <p>間違えたところと、自分で残した手がかりから、次の一問へ。</p>
        <a href="/learn?section=backup">記録とメモをバックアップ →</a>
      </header>
      <div className="notebook-search">
        <label>
          問題・メモから探す
          <input
            type="search"
            value={query}
            maxLength={120}
            placeholder="例：所有権、比較、空の入力"
            onChange={(event) => {
              change({ query: event.target.value });
            }}
          />
        </label>
        <label>
          言語
          <select
            value={language}
            onChange={(event) => {
              change({ lang: event.target.value });
            }}
          >
            <option value="all">JavaとRust</option>
            <option value="java">Java</option>
            <option value="rust">Rust</option>
          </select>
        </label>
      </div>
      <div
        className="notebook-filters"
        role="group"
        aria-label="記録を絞り込む"
      >
        {filters.map(([id, title]) => (
          <button
            type="button"
            key={id}
            aria-pressed={filter === id}
            onClick={() => {
              change({ filter: id });
            }}
          >
            {title}{" "}
            <span>{matching.filter((entry) => matches(entry, id)).length}</span>
          </button>
        ))}
      </div>
      {saved.error && <p role="alert">{saved.error}</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setReload((n) => n + 1)}>
            読み直す
          </button>
        </p>
      )}
      {!index && !error && <p role="status">学習の索引を読み込んでいます…</p>}
      {index && (
        <div className="notebook-start" ref={resultArea} tabIndex={-1}>
          <p role="status">
            {shown.length}問
            {filter === "review" && " · 直近の間違い・迷い、復習時期を優先"}
          </p>
          <button
            type="button"
            disabled={!shown.length || !saved.writable}
            onClick={begin}
          >
            この{Math.min(5, shown.length)}問を始める →
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {shown.length > 0 && (
        <button type="button" onClick={downloadNotes}>
          この一覧とメモをテキストで保存 ↓
        </button>
      )}
      {index && !shown.length && (
        <section className="notebook-empty">
          <h3>
            {items.length
              ? "この条件の記録はありません"
              : "最初の一問から、ノートが育ちます"}
          </h3>
          <p>問題の「あとで解く」で保存でき、自分の言葉でメモも残せます。</p>
          <a href="/learn?section=today">今日の学習を始める →</a>
        </section>
      )}
      <ol className="notebook-list">
        {shown.slice(currentPage * 20, (currentPage + 1) * 20).map((entry) => (
          <li key={entry.item.id}>
            <div className="notebook-meta">
              <span>{entry.item.language === "java" ? "Java" : "Rust"}</span>
              <span>{entry.item.writing ? "コード記述" : "結果を予測"}</span>
              {entry.weak && (
                <span>{notebookLabels[entry.record?.lastOutcome ?? ""]}</span>
              )}
              {entry.due && <span>復習の時期</span>}
              {entry.note?.bookmarked && <span>あとで解く</span>}
            </div>
            <h3>
              <a href={studyHref(entry.item)}>{entry.item.title} →</a>
            </h3>
            {entry.note?.content && (
              <p className="notebook-memo">{entry.note.content}</p>
            )}
            <small>
              {entry.item.id} ·{" "}
              {new Date(entry.updatedAt).toLocaleDateString("ja-JP")}
            </small>
          </li>
        ))}
      </ol>
      {shown.length > 20 && (
        <nav className="notebook-pages" aria-label="ノートのページ">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => turnPage(currentPage - 1)}
          >
            前へ
          </button>
          <span>
            {currentPage + 1} / {Math.ceil(shown.length / 20)}
          </span>
          <button
            type="button"
            disabled={(currentPage + 1) * 20 >= shown.length}
            onClick={() => turnPage(currentPage + 1)}
          >
            次へ
          </button>
        </nav>
      )}
      <p className="notebook-footnote">
        通常問題集の記録を表示します。解説を見た正答・自己確認・固定テストの結果は区別しています。
      </p>
    </main>
  );
}
