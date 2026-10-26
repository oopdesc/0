import { useEffect, useRef, useState } from "react";
import { lessons, type Track } from "./lessons";
import { recordReview, type SavedState } from "./state";
import JavaPractice from "./JavaPractice";
import { loadJavaArt } from "./java-model";

export default function Learning({
  state,
  update,
  search,
}: {
  state: SavedState;
  update: (s: SavedState) => void;
  search: string;
}) {
  const initial = new URLSearchParams(search).get("track");
  const [track, setTrack] = useState<Track>(
    initial === "Rust" || initial === "TypeScript" ? initial : "Java",
  );
  const [selected, setSelected] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (initial === "Java" || initial === "Rust" || initial === "TypeScript")
      setTrack(initial);
  }, [initial]);
  const items = lessons.filter((x) => x.track === track);
  const current = items.find((x) => x.id === selected) || items[0];
  const complete = state.completed.includes(current.id);
  const [reviewMessage, setReviewMessage] = useState("");
  const [copyError, setCopyError] = useState("");
  const latest = useRef({ state, lessonId: current.id });
  latest.current = { state, lessonId: current.id };
  useEffect(() => {
    setReviewMessage("");
    setCopyError("");
  }, [current.id]);
  const due = lessons.filter((l) => state.reviews[l.id]?.due <= Date.now());
  async function review(recalled: boolean) {
    const lessonId = current.id;
    try {
      const model = await loadJavaArt();
      if (latest.current.lessonId !== lessonId) return;
      const base = latest.current.state;
      const days = model.reviewDays(
        base.reviews[lessonId]?.successes || 0,
        recalled,
      );
      const next = recordReview(base, lessonId, recalled, days);
      latest.current = { state: next, lessonId };
      update(next);
      setReviewMessage(
        next === base
          ? "今日の記録は保存済みです。次の復習日にもう一度試してください。"
          : `${days}日後にもう一度、解答を閉じて説明してみましょう。`,
      );
    } catch {
      if (latest.current.lessonId !== lessonId) return;
      setReviewMessage(
        "復習の記録を更新できませんでした。再読み込みしてください。",
      );
    }
  }
  async function copy() {
    const lessonId = current.id;
    try {
      await navigator.clipboard.writeText(current.code);
      if (latest.current.lessonId !== lessonId) return;
      setCopied(true);
      setCopyError("");
    } catch {
      if (latest.current.lessonId !== lessonId) return;
      setCopied(false);
      setCopyError(
        "コピーできませんでした。コードを選択してコピーしてください。",
      );
    }
  }
  return (
    <main className="page-shell">
      <div className="page-heading learn-heading">
        <span className="eyebrow">02 / 動かして学ぶ</span>
        <h1>Javaを動かして学ぶ</h1>
        <p>
          解答を見る前に予想する。コードを小さく動かす。理由を自分の言葉で説明する。
        </p>
        <div className="progress-summary">
          <div className="progress-track">
            <span
              style={{
                width: `${(state.completed.length / lessons.length) * 100}%`,
              }}
            />
          </div>
          <span>
            {state.completed.length} / {lessons.length} 学習済み
          </span>
        </div>
      </div>
      <section className="review-summary">
        <strong>今日の復習 {due.length}件</strong>
        <p>
          答えを開く前に、前回の処理を説明してみてください。復習の間隔は自己確認に応じて1・3・7・14・30日です。
        </p>
        {due.map((l) => (
          <button
            key={l.id}
            onClick={() => {
              setTrack(l.track);
              setSelected(l.id);
              setReviewMessage("");
            }}
          >
            {l.title} →
          </button>
        ))}
      </section>
      {track === "Java" && <JavaPractice />}
      <div className="track-tabs" aria-label="学ぶ言語">
        {(["Java", "Rust", "TypeScript"] as Track[]).map((x) => (
          <button
            key={x}
            aria-pressed={track === x}
            className={track === x ? "active" : ""}
            onClick={() => {
              setTrack(x);
              setSelected("");
              setCopied(false);
            }}
          >
            {x}
            <span>
              {
                lessons.filter(
                  (l) => l.track === x && state.completed.includes(l.id),
                ).length
              }
              /{lessons.filter((l) => l.track === x).length}
            </span>
          </button>
        ))}
      </div>
      <div className="learning-layout">
        <aside className="lesson-list" aria-label="教材">
          {items.map((item, i) => (
            <button
              key={item.id}
              aria-current={item.id === current.id ? "step" : undefined}
              className={item.id === current.id ? "selected" : ""}
              onClick={() => {
                setSelected(item.id);
                setCopied(false);
              }}
            >
              <span className="lesson-number">
                {state.completed.includes(item.id) ? "✓" : `0${i + 1}`}
              </span>
              <span>
                {item.title}
                <small>
                  {item.minutes}分 · {item.track}
                </small>
              </span>
              <span>→</span>
            </button>
          ))}
          <div className="study-note">
            <span>ひとつずつ、でいい。</span>
            <p>5分で予想。20分で実験。最後の5分で、理由を3行に。</p>
          </div>
        </aside>
        <article className="lesson-content" key={current.id}>
          <div className="lesson-label">
            <span>
              {current.track} / {items.indexOf(current) + 1} / {items.length}
            </span>
            <span>{current.minutes}分</span>
          </div>
          <h2>{current.title}</h2>
          <p className="lesson-question">{current.question}</p>
          <div className="code-window">
            <div className="code-title">
              <span>
                <i />
                <i />
                <i />
              </span>
              <span>{current.file.split("/").slice(-1)}</span>
              <button onClick={copy}>
                {copied ? "コピー済み" : "コードをコピー"}
              </button>
            </div>
            <pre tabIndex={0} aria-label={`${current.track}のコード例`}>
              <code>{current.code}</code>
            </pre>
          </div>
          <p className="caption">
            学習用に抜粋・省略したコードです。完全な実装は{" "}
            <code>{current.file}</code> をEclipseで開いてください。{" "}
            <a
              href={`https://github.com/oopdesc/0/blob/main/${current.file.split("/").map(encodeURIComponent).join("/")}`}
              target="_blank"
              rel="noreferrer"
            >
              公開ソースを読む ↗
            </a>
          </p>
          {copyError && <p role="status">{copyError}</p>}
          <details className="answer">
            <summary>自分の説明と、考え方を比べる</summary>
            <p>{current.answer}</p>
          </details>
          <section className="exercise">
            <span className="eyebrow">自分で試す</span>
            <h3>小さな実験</h3>
            <p>{current.exercise}</p>
            <a href="/code">Eclipseでの起動方法 →</a>
          </section>
          <section className="review-actions">
            <h3>解答を閉じて、思い出す</h3>
            <p>
              今の処理と理由を説明できましたか？記録はこのブラウザだけに保存されます。
            </p>
            <div>
              <button onClick={() => review(false)}>
                まだ説明できない · 明日復習
              </button>
              <button onClick={() => review(true)}>
                説明できた · 次回を記録
              </button>
            </div>
            {reviewMessage && <p role="status">{reviewMessage}</p>}
          </section>
          <div className="completion">
            <p>答えを閉じても、理由を説明できましたか？</p>
            <button
              className={complete ? "completed-button" : "primary"}
              aria-pressed={complete}
              onClick={() =>
                update({
                  ...state,
                  completed: complete
                    ? state.completed.filter((x) => x !== current.id)
                    : [...state.completed, current.id],
                })
              }
            >
              {complete ? "✓ 理解した · 取り消す" : "自分の言葉で説明できた ✓"}
            </button>
            <small>実行結果の自動判定ではなく、自分で確かめた記録です。</small>
          </div>
        </article>
      </div>
    </main>
  );
}
