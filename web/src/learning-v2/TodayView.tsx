import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadStudyIndex,
  planStudy,
  studyHref,
  studySummary,
} from "./studyPlanner";
import type { StudyIndex, StudyFilter } from "./studyPlanner";
import {
  emptyProgress,
  exportProgress,
  importProgress,
  loadProgress,
  saveProgress,
} from "./progress";
import type { Lang, Level } from "./types";
import "./today.css";
const levels = { beginner: "初級", intermediate: "中級", advanced: "上級" };
const reasons = {
  due: "復習の時期",
  retry: "もう一度確かめる",
  draft: "下書きの続き",
  new: "新しい一問",
};
function readStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function readState() {
  const storage = readStorage();
  return storage
    ? loadProgress(storage)
    : {
        state: emptyProgress(),
        writable: false,
        error: "このブラウザでは記録を保存できません。学習は続けられます。",
      };
}
export default function TodayView({ search = "" }: { search?: string }) {
  const [index, setIndex] = useState<StudyIndex | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(readState),
    [now, setNow] = useState(Date.now()),
    [notice, setNotice] = useState(""),
    [skipped, setSkipped] = useState<Set<string>>(new Set());
  const params = new URLSearchParams(search);
  const [language, setLanguage] = useState<StudyFilter["language"]>(
    params.get("lang") === "java" || params.get("lang") === "rust"
      ? (params.get("lang") as Lang)
      : "all",
  );
  const [level, setLevel] = useState<StudyFilter["level"]>(
    ["beginner", "intermediate", "advanced"].includes(params.get("level") || "")
      ? (params.get("level") as Level)
      : "all",
  );
  const [kind, setKind] = useState<StudyFilter["kind"]>(
      params.get("kind") === "code" ? "code" : "all",
    ),
    [limit, setLimit] = useState(10),
    [includeNew, setIncludeNew] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    loadStudyIndex(ctrl.signal)
      .then(setIndex)
      .catch((e) => {
        if (!ctrl.signal.aborted)
          setError(e instanceof Error ? e.message : "読み込めません。");
      });
    return () => ctrl.abort();
  }, [retry]);
  useEffect(() => {
    const refresh = () => {
      setSaved(readState());
      setNow(Date.now());
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const plan = useMemo(
    () =>
      index
        ? planStudy(
            index,
            saved.state,
            { language, level, kind, limit, includeNew },
            now,
          )
        : [],
    [index, saved.state, language, level, kind, limit, includeNew, now],
  );
  const summary = index ? studySummary(index, saved.state, now) : null;
  const shown = plan.filter((x) => !skipped.has(x.item.id));
  async function importFile(input?: File) {
    if (!input) return;
    setNotice("");
    try {
      if (input.size > 1_048_576)
        throw Error("記録ファイルは1MiBまで取り込めます。");
      const storage = readStorage(),
        current = readState();
      if (!storage || !current.writable)
        throw Error(current.error || "保存できないため取り込みません。");
      const result = importProgress(await input.text(), current.state);
      if (!result.ok) throw Error(result.error);
      const stored = saveProgress(storage, result.state);
      if (!stored.ok) throw Error(stored.error || "保存できません。");
      setSaved({ ...current, state: result.state });
      setNow(Date.now());
      setSkipped(new Set());
      setNotice(
        result.legacyOnly
          ? "以前の教材の記録を保管しました。新しい問題の合格には置き換えません。"
          : "学習記録を統合しました。新しい下書きと、ほかの言語の記録も残しています。",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "取り込めません。");
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  function exportFile() {
    const current = readState();
    if (!current.writable) {
      setNotice(current.error || "保存記録を読み取れません。");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([exportProgress(current.state)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "0-learning-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("学習記録を書き出しました。ファイルは手元で保管してください。");
  }
  return (
    <main className="study-home">
      <header className="study-heading">
        <div>
          <p className="study-kicker">少し思い出す。ひとつ試す。</p>
          <h2>今日の学習</h2>
          <p>
            答えを見る前に考え、理由を確かめる。
            <br />
            今の記録から、次の一歩を選びます。
          </p>
        </div>
        <div className="study-day">
          <span>
            {new Date(now).toLocaleDateString("ja-JP", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </span>
          <strong>
            続ける場所は、
            <br />
            自分で選べる。
          </strong>
          <a href="/learn?section=concepts">学びの地図を開く ↗</a>
        </div>
      </header>
      {saved.error && (
        <p role="status" className="study-notice">
          {saved.error}
        </p>
      )}
      {error && (
        <div role="alert" className="study-notice">
          <p>{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>読み直す</button>
          <a href="/learn?section=drill">問題一覧を開く →</a>
        </div>
      )}
      {!index && !error && <p role="status">学習の索引を読み込んでいます…</p>}
      {summary && (
        <>
          <section
            className="study-metrics"
            aria-label="このブラウザの学習記録"
          >
            <article>
              <span>取り組んだ問題</span>
              <strong>
                {summary.seen}
                <small> / {summary.total.toLocaleString()}</small>
              </strong>
              <p>現行教材の記録</p>
            </article>
            <article>
              <span>復習の目安が来た問題</span>
              <strong>
                {summary.due}
                <small>問</small>
              </strong>
              <p>日を空けて、もう一度</p>
            </article>
            <article>
              <span>見直したい問題</span>
              <strong>
                {summary.retry}
                <small>問</small>
              </strong>
              <p>最後の回答を手がかりに</p>
            </article>
            <article>
              <span>自力の予測正答</span>
              <strong>
                {summary.independent}
                <small>問</small>
              </strong>
              <p>実装や自己申告とは別集計</p>
            </article>
          </section>
          <section className="study-queue" aria-labelledby="study-queue-title">
            <div className="study-section-head">
              <div>
                <p className="study-kicker">
                  復習 → 見直し → 続き → 新しい問題
                </p>
                <h3 id="study-queue-title">次に取り組む一問</h3>
              </div>
              <p>この一覧以外の問題も、いつでも開けます。</p>
            </div>
            <div className="study-filters">
              <label>
                言語
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value as StudyFilter["language"]);
                    setSkipped(new Set());
                  }}
                >
                  <option value="all">JavaとRust</option>
                  <option value="java">Java</option>
                  <option value="rust">Rust</option>
                </select>
              </label>
              <label>
                段階
                <select
                  value={level}
                  onChange={(e) => {
                    setLevel(e.target.value as StudyFilter["level"]);
                    setSkipped(new Set());
                  }}
                >
                  <option value="all">すべての段階</option>
                  <option value="beginner">初級</option>
                  <option value="intermediate">中級</option>
                  <option value="advanced">上級</option>
                </select>
              </label>
              <label>
                取り組み方
                <select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as StudyFilter["kind"]);
                    setSkipped(new Set());
                  }}
                >
                  <option value="all">予測と実装</option>
                  <option value="prediction">結果を予測する</option>
                  <option value="code">コードを書く</option>
                </select>
              </label>
              <label>
                今回の問題数
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setSkipped(new Set());
                  }}
                >
                  <option value={5}>5問</option>
                  <option value={10}>10問</option>
                  <option value={20}>20問</option>
                </select>
              </label>
              <label className="study-check">
                <input
                  type="checkbox"
                  checked={includeNew}
                  onChange={(e) => {
                    setIncludeNew(e.target.checked);
                    setSkipped(new Set());
                  }}
                />
                未学習も含める
              </label>
            </div>
            <p className="study-method">
              復習日は1・3・7・14・30日を目安にしています。個人に最適な日数を自動推定する機能ではありません。記録がない前提は案内だけに使い、学習順序をロックしません。
            </p>
            <ol className="study-list">
              {shown.map((p, i) => (
                <li key={p.item.id}>
                  <span className="study-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="study-item">
                    <div>
                      <span
                        className={"study-reason study-reason--" + p.reason}
                      >
                        {reasons[p.reason]}
                      </span>
                      <span>
                        {p.item.language === "java" ? "Java" : "Rust"} ·{" "}
                        {levels[p.item.level]} ·{" "}
                        {p.item.writing ? "実装" : "予測"}
                      </span>
                    </div>
                    <a className="study-title" href={studyHref(p.item)}>
                      {p.item.title}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                    {p.prerequisiteNames.length > 0 && (
                      <details>
                        <summary>
                          先に確かめると役立つこと（{p.prerequisiteNames.length}
                          ）
                        </summary>
                        <p>{p.prerequisiteNames.join(" / ")}</p>
                        <a href="/learn?section=concepts">
                          概念図で全体を見渡す →
                        </a>
                      </details>
                    )}
                  </div>
                  <button
                    className="study-skip"
                    onClick={() =>
                      setSkipped((old) => new Set([...old, p.item.id]))
                    }
                    aria-label={p.item.title + "を今回の一覧から外す"}
                  >
                    今回は飛ばす
                  </button>
                </li>
              ))}
            </ol>
            {!shown.length && (
              <div className="study-empty">
                <h4>今の条件では、候補がありません。</h4>
                <p>
                  今日の復習がない場合は、未学習を含めるか、単元から気になる問題を選べます。学習済みの問題も自由に開けます。
                </p>
                <a href="/learn?section=drill">単元から選ぶ →</a>
              </div>
            )}
            {skipped.size > 0 && (
              <p className="study-method">
                今回の一覧から{skipped.size}
                問を外しました。学習済みにはしていません。{" "}
                <button onClick={() => setSkipped(new Set())}>
                  一覧に戻す
                </button>
              </p>
            )}
          </section>
          <section className="study-understand">
            <div>
              <p className="study-kicker">理解の確かめ方</p>
              <h3>
                答えを閉じて、
                <br />
                理由を説明してみる。
              </h3>
            </div>
            <ol>
              <li>
                <b>01 予測する</b>
                <p>選択肢を覚える前に、どの規則で結果が決まるか考える。</p>
              </li>
              <li>
                <b>02 確かめる</b>
                <p>
                  解説・境界・誤答の理由を読む。実装は手元のコンパイラでも試す。
                </p>
              </li>
              <li>
                <b>03 日を空ける</b>
                <p>
                  もう一度自力で考える。ヒント後の正答や自己確認は分けて記録する。
                </p>
              </li>
            </ol>
            <p>
              <a href="/learn?section=flow">ブラウザからDBまで、処理を追う →</a>
              　<a href="/learn?section=projects">小さな制作で確かめる →</a>　
              <a href="/learn?section=exams">試験で見直す →</a>
            </p>
          </section>
          <section className="study-records">
            <div>
              <h3>学習記録を手元に残す</h3>
              <p>
                この端末での記録です。別の端末へ移るときは、JSONを書き出して取り込めます。下書きも含むため、自分で保管してください。
              </p>
              <p>
                固定テスト合格の履歴 {summary.codePassed}問 ·
                ヒント/当日再挑戦の正答履歴 {summary.assisted}問 ·
                後日の自己確認履歴 {summary.recall}
                問。これらは習得率として合算しません。
              </p>
              {summary.retained > 0 && (
                <p>
                  索引に対応しない以前の記録{summary.retained}
                  件も保存しています。
                </p>
              )}
            </div>
            <div>
              <button onClick={exportFile}>学習記録を書き出す ↓</button>
              <button onClick={() => file.current?.click()}>
                学習記録を取り込む
              </button>
              <input
                ref={file}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => void importFile(e.target.files?.[0])}
              />
            </div>
          </section>
        </>
      )}
      {notice && (
        <p role="status" className="study-notice">
          {notice}
        </p>
      )}
    </main>
  );
}
