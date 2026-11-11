import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadStudyIndex,
  delayedReviewSummary,
  planStudy,
  studyHref,
  studySummary,
  studyTopics,
} from "./studyPlanner";
import type { StudyIndex, StudyFilter } from "./studyPlanner";
import {
  emptyProgress,
  exportProgress,
  importProgress,
  loadProgress,
  saveProgress,
} from "./progress";
import { confirmStudyRoundReplacement, readStudyFilter, readStudyRound, roundHref, roundResultLabel, startStudyRound, todayHref } from "./studyRound";
import { completedStudy, dailyStudyFilter, followUpLimit, shortSessionSize, studyPreferencesKey } from "./studySession";
import { applicationExamples, applicationHistory, planApplications } from "./applicationPractice";
import "./today.css";
import "./study-round.css";
const reviewDate = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
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
export default function TodayView({ search, navigate }: { search: string; navigate: (href: string) => void }) {
  const [index, setIndex] = useState<StudyIndex | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(readState),
    [now, setNow] = useState(Date.now),
    [notice, setNotice] = useState(""),
    [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [defaults] = useState(() => dailyStudyFilter(search, readStorage()));
  const [language, setLanguage] = useState(defaults.language);
  const [level, setLevel] = useState(defaults.level);
  const [kind, setKind] = useState(defaults.kind);
  const [limit, setLimit] = useState(defaults.limit);
  const [includeNew, setIncludeNew] = useState(defaults.includeNew);
  const [concept, setConcept] = useState(defaults.concept);
  const [conditionsNotice, setConditionsNotice] = useState("");
  const [applicationKind, setApplicationKind] = useState<"prediction" | "code">("prediction");
  const [applicationNotice, setApplicationNotice] = useState("");
  const activeConcept = concept && index?.concepts[concept] ? concept : undefined;
  const [roundNotice, setRoundNotice] = useState("");
  const round = readStudyRound();
  const activeRound = round && round.outcomes.length < round.ids.length ? round : null;
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
  const shown = useMemo(
    () =>
      index
        ? planStudy(
            index,
            saved.state,
            { language, level, kind, limit, includeNew, concept: activeConcept },
            now,
            skipped,
          )
        : [],
    [index, saved.state, language, level, kind, limit, includeNew, now, skipped, activeConcept],
  );
  const shortSession = shown.slice(0, shortSessionSize);
  const dueOnly = shown.filter(({ reason }) => reason === "due").slice(0, 5);
  const summary = useMemo(() => index ? studySummary(index, saved.state, now) : null, [index, saved.state, now]);
  const delayed = useMemo(() => index ? delayedReviewSummary(index, saved.state) : null, [index, saved.state]);
  const topics = useMemo(() => index ? studyTopics(index, saved.state, language).slice(0, 5) : [], [index, saved.state, language]);
  const applications = useMemo(() => index ? planApplications(index, saved.state, language, applicationKind, now) : null,
    [index, saved.state, language, applicationKind, now]);
  const applicationResults = useMemo(() => index ? applicationHistory(index, saved.state) : null, [index, saved.state]);
  const nextUpdateAt = Math.min(applications?.next ?? Infinity, summary?.nextReviewAt ?? Infinity);
  useEffect(() => {
    if (!Number.isFinite(nextUpdateAt)) return;
    const delay = Math.min(2_147_483_647, Math.max(10, nextUpdateAt - Date.now()));
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [nextUpdateAt, now]);

  const completed = round && index && completedStudy(round, index.items);
  function beginRound(questions = shown) {
    if (!confirmStudyRoundReplacement()) return;
    const started = startStudyRound(questions.map(p => p.item.id),
      { language, level, kind, limit, includeNew, concept: activeConcept });
    if (started) navigate(roundHref(started));
    else setRoundNotice("このブラウザではセットを保存できません。一覧から一問ずつ開けます。");
  }
  function beginFollowUp() {
    if (!round || !completed) return;
    const latest = readStudyRound();
    if (latest?.token !== round.token || latest.outcomes.length !== latest.ids.length) {
      setRoundNotice("別の画面で学習セットが切り替わりました。現在の結果を確認してください。");
      return;
    }
    // A retry uses the original questions, so it is never another first-attempt application check.
    const started = startStudyRound(completed.followUpIds, round.filter, "follow-up");
    if (started) navigate(roundHref(started));
    else setRoundNotice("復習セットを保存できませんでした。結果の一覧から一問ずつ開けます。");
  }
  function beginApplications() {
    if (!index || !confirmStudyRoundReplacement()) return;
    const candidates = planApplications(index, readState().state, language, applicationKind);
    if (!candidates.ready.length) {
      setSaved(readState());
      setApplicationNotice("この端末の記録が更新されました。今の候補を確認してください。");
      return;
    }
    const started = startStudyRound(candidates.ready.map(({ item }) => item.id),
      { language, level, kind, limit, includeNew, concept: activeConcept }, "application");
    if (started) navigate(roundHref(started));
    else setApplicationNotice("学習セットを保存できませんでした。");
  }
  function saveStudyPreferences() {
    try {
      localStorage.setItem(studyPreferencesKey, todayHref({ language, level, kind, limit, includeNew, concept: activeConcept }).split("?")[1]);
      setConditionsNotice("次に「今日の学習」を開くと、この条件から始まります。");
    } catch {
      setConditionsNotice("このブラウザでは条件を保存できません。");
    }
  }
  function resetStudyPreferences() {
    const standard = readStudyFilter(new URLSearchParams());
    setLanguage(standard.language);
    setLevel(standard.level);
    setKind(standard.kind);
    setLimit(standard.limit);
    setIncludeNew(standard.includeNew);
    setConcept(undefined);
    setSkipped(new Set());
    try {
      localStorage.removeItem(studyPreferencesKey);
      setConditionsNotice("保存した条件を解除し、標準に戻しました。");
    } catch {
      setConditionsNotice("画面の条件を標準に戻しました。保存した条件は解除できませんでした。");
    }
  }
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
          <a href="/learn?section=concepts">学びの地図を開く ↗</a>
        </div>
      </header>
      {round && (
        <section className="study-round" aria-label={activeRound ? "中断した学習" : "前回の学習結果"}>
          <div>
            <strong>{round.purpose === "application" ? activeRound ? "応用チェックの続き" : "応用チェックの結果" :
              round.purpose === "follow-up" ? activeRound ? "解き直しの続き" : "解き直しの結果" :
              activeRound ? "続きから学ぶ" : "このセットは終了しました"}</strong>
            <p>取り組んだ問題 {round.outcomes.filter(x => x === "attempted").length}問 · 飛ばした問題 {round.outcomes.filter(x => x === "skipped").length}問 · 全{round.ids.length}問</p>
            {completed && <p>{completed.counts.map(([label, count]) => `${label} ${count}問`).join(" · ")}</p>}
            {completed && round.purpose === "follow-up" && <p>日を空けた復習で、答えを思い出せるか確かめましょう。</p>}
          </div>
          {activeRound && <a className="study-round-action" href={roundHref(activeRound)}>第{round.outcomes.length + 1}問から再開 →</a>}
          {completed && completed.followUpIds.length > 0 && (
            <button type="button" className="study-round-action" onClick={beginFollowUp}>
              見直し{completed.followUpIds.length}問を解き直す →
            </button>
          )}
          {completed && completed.rows.length > 0 && <details className="study-round-review">
            <summary>問題ごとの結果（{completed.rows.length}問）</summary>
            {completed.followUpIds.length > 0 && <p>誤答や実装の差分、迷った正答、補助あり正答、飛ばした問題の順に、元の問題を最大{followUpLimit}問選びます。</p>}
            <ul>{completed.rows.map(({ item, label }) => <li key={item.id}><a href={studyHref(item)}>{item.title}</a> · {label}</li>)}</ul>
          </details>}
        </section>
      )}
      {!activeRound && shortSession.length > 0 && (
        <section className="study-round" aria-label="短い学習セット">
          <div>
            <strong>まず{shortSession.length}問</strong>
            <p>今の条件から、復習や見直しを優先して選んだ問題を一問ずつ進めます。</p>
            <p>{shortSession.map(({ reason }) => reasons[reason]).join(" → ")}</p>
          </div>
          <button type="button" className="study-round-action" onClick={() => beginRound(shortSession)}>
            {shortSession.length}問だけ始める →
          </button>
          {dueOnly.length > 0 && (dueOnly.length !== shortSession.length || shortSession.some(({ reason }) => reason !== "due")) && (
            <button type="button" onClick={() => beginRound(dueOnly)}>
              期限が来た復習{dueOnly.length}問だけ →
            </button>
          )}
        </section>
      )}
      {roundNotice && <p className="study-notice" role="status">{roundNotice}</p>}
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
          <nav className="study-jumps" aria-label="今日の学習のページ内移動">
            <a href="#study-queue-title">問題・学習条件</a>
            <a href="#study-metrics">記録・復習予定</a>
            {applications && <a href="#application-title">応用チェック</a>}
          </nav>
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
            <details className="study-topics study-config">
              <summary>学習条件 <span>{language === "all" ? "JavaとRust" : language === "java" ? "Java" : "Rust"} · {limit}問</span></summary>
              <div className="study-filters" onChange={() => setConditionsNotice("")}>
                <label>
                  言語
                  <select
                    value={language}
                    onChange={(e) => {
                      const next = e.target.value as StudyFilter["language"];
                      setLanguage(next);
                      if (next !== "all" && concept && !concept.startsWith(next + ":")) setConcept(undefined);
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
              <div className="study-round-start">
                <button type="button" onClick={saveStudyPreferences}>この条件を次回も使う</button>
                <button type="button" onClick={resetStudyPreferences}>条件を標準に戻す</button>
                {conditionsNotice && <span role="status">{conditionsNotice}</span>}
              </div>
            </details>
            <details className="study-topics" open={activeConcept ? true : undefined}>
              <summary>最後の回答から、テーマを選んで復習</summary>
              {topics.length ? (
                <ul aria-label="復習するテーマ">
                  {topics.map(topic => (
                    <li key={topic.id}>
                      <button type="button" aria-pressed={activeConcept === topic.id} onClick={() => {
                        setConditionsNotice("");
                        setConcept(topic.id);
                        setLanguage(topic.language);
                        setLevel("all");
                        setKind("all");
                        setIncludeNew(true);
                        setSkipped(new Set());
                      }}>{topic.name}</button>
                      <span>{topic.language === "java" ? "Java" : "Rust"} · 誤答・実装の差分 {topic.wrong}問 · 迷った正答 {topic.tentative}問 · 補助あり正答 {topic.assisted}問</span>
                    </li>
                  ))}
                </ul>
              ) : <p>誤答、迷った正答、ヒントを使った正答から、見直すテーマを表示します。</p>}
              {activeConcept && <p>
                選択中：<strong>{index?.concepts[activeConcept].name}</strong>{" "}
                <button type="button" onClick={() => { setConcept(undefined); setSkipped(new Set()); }}>テーマの絞り込みを解除</button>
              </p>}
            </details>
            <p className="study-method">
              復習時期が来た問題に自力で正答すると、次の間隔が1・3・7・14・30日の順に延びます。前提の確認は自由です。
            </p>
            {shown.length > 0 && <div className="study-round-start">
              <button type="button" className="study-round-action" onClick={() => beginRound()}>この{shown.length}問を始める →</button>
              <span>{activeRound ? "新しいセットを始めると、前の続きは置き換わります。学習記録は残ります。" : "一問ずつ進めます。途中で閉じても、このブラウザから再開できます。"}</span>
            </div>}
            {shown.length > 0 && <details className="study-topics study-candidates">
              <summary>候補{shown.length}問を見る</summary>
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
            </details>}
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
          <section
            className="study-metrics"
            id="study-metrics"
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
              <p>{summary.due > 0 ? "今取り組める復習があります。" :
                summary.nextReviewAt !== null ? `次は ${reviewDate.format(summary.nextReviewAt)} から` : "回答すると、次の目安がここに出ます。"}</p>
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
          {delayed && <details className="study-topics">
            <summary>日を空けた復習の結果を見る</summary>
            <p>復習の時期にヒントや解答を見ずに答えた記録を、問題ごとの直近1回で数えます。機能追加後に取り組んだ分から表示します。</p>
            <ul>
              {(["java", "rust"] as const).map(lang => {
                const row = delayed[lang], total = row.correct + row.tentative + row.wrong;
                return <li key={lang}><strong>{lang === "java" ? "Java" : "Rust"}</strong>
                  <span>{total ? `正答 ${row.correct + row.tentative} / ${total} 問（迷いのある正答 ${row.tentative} 問）` : "復習の記録はまだありません"}</span></li>;
              })}
            </ul>
          </details>}
          {applications && <section className="study-records study-application" aria-labelledby="application-title">
            <div>
              <h3 id="application-title">応用チェック</h3>
              <p>自力で正答してから24時間以上たったテーマを、回答やヒントの記録がない別の問題で確かめます。</p>
              {applications.ready.length ? <p role="status">今回のセットは {applications.ready.length} 問です。</p> :
                applications.next ? <p role="status">次の候補は {reviewDate.format(applications.next)} 以降に開けます。</p> :
                <p>出力を直接入力する練習を、<a href={applicationExamples.java}>Javaの一問</a>または
                  <a href={applicationExamples.rust}>Rustの一問</a>から試せます。</p>}
              {applicationNotice && <p role="status">{applicationNotice}</p>}
              {applicationResults && applicationResults.size > 0 && <details>
                <summary>応用チェックの履歴</summary>
                <p>各問題の初回結果です。実装の自己確認と固定テストの合格は別々に数えます。</p>
                <ul>{[...applicationResults].map(([result, count]) => <li key={result}>{roundResultLabel(result)} {count}問</li>)}</ul>
              </details>}
            </div>
            <div>
              <label>応用の種類 <select value={applicationKind} onChange={event => {
                setApplicationKind(event.target.value === "code" ? "code" : "prediction");
                setApplicationNotice("");
              }}>
                <option value="prediction">結果を予測する</option>
                <option value="code">コードを書く</option>
              </select></label>
              {applicationKind === "code" && <small>編集したコードは手元の実行環境で確かめられます。</small>}
              {applications.ready.length > 0 && <button type="button" onClick={beginApplications}>応用チェックを始める →</button>}
            </div>
          </section>}
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
              <p><a href="/learn?section=backup">模試や学習セットもまとめてバックアップ →</a></p>
              <p>
                この端末での記録です。別の端末へ移るときは、JSONを書き出して取り込めます。下書きも含むため、自分で保管してください。
              </p>
              <p>
                固定テスト合格の履歴 {summary.codePassed}問 ·
                ヒント/当日再挑戦の正答履歴 {summary.assisted}問 ·
                最後の回答が迷いのある正答 {summary.tentative}問 ·
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
