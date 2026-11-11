import { useEffect, useMemo, useState } from "react";
import {
  loadStudyIndex,
  planStudy,
  studyHref,
  type StudyIndex,
} from "./studyPlanner";
import { emptyProgress, loadProgress } from "./progress";
import {
  confirmStudyRoundReplacement,
  roundHref,
  startStudyRound,
  todayHref,
} from "./studyRound";
import { findStudyTopic, inStudyTopic, studyTopicGroups } from "./topics";
import "./notebook.css";

export default function TopicView({
  search,
  navigate,
}: {
  search: string;
  navigate: (href: string) => void;
}) {
  const params = new URLSearchParams(search);
  const selected = findStudyTopic(params.get("topic"));
  const language =
    selected?.language ?? (params.get("lang") === "rust" ? "rust" : "java");
  const [index, setIndex] = useState<StudyIndex | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "prediction" | "code">("all");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadStudyIndex(controller.signal)
      .then(setIndex)
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "索引を取得できません。",
          );
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    setPage(0);
  }, [selected?.id, kind]);
  const items = useMemo(
    () =>
      index && selected
        ? index.items.filter((item) => inStudyTopic(selected, item))
        : [],
    [index, selected],
  );
  const shown = items.filter(
    (item) => kind === "all" || item.writing === (kind === "code"),
  );
  const pages = Math.max(1, Math.ceil(shown.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const filter = {
    language,
    level: "all" as const,
    kind,
    limit: 5,
    includeNew: true,
    ...(selected ? { topic: selected.id } : {}),
  };
  function begin() {
    if (!index || !selected || !confirmStudyRoundReplacement()) return;
    try {
      const saved = loadProgress(localStorage);
      if (!saved.writable) throw Error(saved.error ?? "記録を保存できません。");
      const planned = planStudy(index, saved.state ?? emptyProgress(), filter);
      if (!planned.length) {
        setError(
          "今の条件では復習時期・未学習の候補がありません。一覧から好きな問題を開けます。",
        );
        return;
      }
      const round = startStudyRound(
        planned.map((entry) => entry.item.id),
        filter,
      );
      if (!round)
        throw Error("学習セットを保存できません。一覧から一問ずつ開けます。");
      navigate(roundHref(round));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "学習セットを開始できません。",
      );
    }
  }
  const topicHref = (id: string) =>
    "/learn?" + new URLSearchParams({ section: "topics", topic: id });
  const groups = studyTopicGroups.filter(
    (topic) =>
      topic.language === language &&
      (topic.title + topic.description)
        .toLowerCase()
        .includes(query.normalize("NFKC").toLowerCase().trim()),
  );
  const showJpa =
    language === "java" &&
    "hibernate jpa orm 永続化 データベース 楽観ロック n+1".includes(
      query.normalize("NFKC").toLowerCase().trim(),
    );
  return (
    <main className="learning-notebook topic-browser">
      <header>
        <h2>{selected?.title ?? "分野から学ぶ"}</h2>
        <p>
          {selected?.description ??
            "学びたい分野を選び、その中だけで予測・記述・復習を進められます。"}
        </p>
        {selected && (
          <a href={"/learn?section=topics&lang=" + language}>← 分野の一覧へ</a>
        )}
      </header>
      {error && (
        <p role="status">
          {error}{" "}
          {!index && (
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              読み直す
            </button>
          )}
        </p>
      )}
      {!index && !error && <p role="status">収録問題を確認しています…</p>}
      {selected ? (
        <>
          <div className="notebook-search">
            <label>
              取り組み方
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
              >
                <option value="all">予測とコード記述</option>
                <option value="prediction">結果を予測する</option>
                <option value="code">コードを書く</option>
              </select>
            </label>
          </div>
          <div className="notebook-start">
            <p>
              {shown.length}問 · うちコード記述{" "}
              {shown.filter((item) => item.writing).length}問
            </p>
            <button
              type="button"
              disabled={!index || !shown.length}
              onClick={begin}
            >
              この分野から最大5問を始める →
            </button>
            <a href={todayHref(filter)}>問題数・難しさを選ぶ →</a>
          </div>
          <ol className="notebook-list">
            {shown
              .slice(currentPage * 20, (currentPage + 1) * 20)
              .map((item) => (
                <li key={item.id}>
                  <div className="notebook-meta">
                    <span>
                      {
                        {
                          beginner: "初級",
                          intermediate: "中級",
                          advanced: "上級",
                        }[item.level]
                      }
                    </span>
                    <span>{item.writing ? "コード記述" : "結果を予測"}</span>
                  </div>
                  <h3>
                    <a href={studyHref(item)}>{item.title} →</a>
                  </h3>
                </li>
              ))}
          </ol>
          {pages > 1 && (
            <nav className="notebook-pages" aria-label="分野の問題のページ">
              <button
                type="button"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                前へ
              </button>
              <span>
                {currentPage + 1} / {pages}
              </span>
              <button
                type="button"
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                次へ
              </button>
            </nav>
          )}
        </>
      ) : (
        <>
          <div className="notebook-filters">
            {(["java", "rust"] as const).map((lang) => (
              <a
                key={lang}
                href={"/learn?section=topics&lang=" + lang}
                aria-current={language === lang ? "page" : undefined}
              >
                {lang === "java" ? "Java" : "Rust"}
              </a>
            ))}
          </div>
          <div className="notebook-search">
            <label>
              学びたい分野
              <input
                type="search"
                value={query}
                maxLength={100}
                placeholder="例：参照、コレクション、Stream"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="topic-cards">
            {showJpa && (
              <a href="/learn?section=practice-lab&lab=jpa">
                <h3>Hibernate / JPA の実装演習</h3>
                <p>
                  楽観ロック、N+1、JPQL、トランザクション。実際のORMとDBを使い、4つの不具合を直します。
                </p>
                <strong>4つの修正課題 · 実テスト8件 →</strong>
              </a>
            )}
            {groups.map((topic) => (
              <a key={topic.id} href={topicHref(topic.id)}>
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
                <strong>
                  {index
                    ? index.items.filter((item) => inStudyTopic(topic, item))
                        .length + "問 →"
                    : "件数を確認中"}
                </strong>
              </a>
            ))}
          </div>
          {!groups.length && !showJpa && (
            <p>
              一致する分野がありません。検索語を変えるか、
              <a href="/learn?section=catalog">全問題から検索</a>できます。
            </p>
          )}
          {language === "java" && (
            <details className="topic-coverage">
              <summary>Hibernate・JPAを学びたいとき</summary>
              <p>
                N+1・楽観ロック・クエリのパラメータ化・rollbackを実際のHibernateとH2で学べる実装課題があります。通常問題の件数とは分けた教材です。
              </p>
              <a href="/learn?section=practice-lab&lab=jpa">
                Hibernate/JPAの実装課題へ →
              </a>
              　<a href={topicHref("java-http-db")}>HTTP・DB・SQLへ →</a>　
              <a href="/learn?section=projects&lang=java">小プロジェクトへ →</a>
            </details>
          )}
        </>
      )}
    </main>
  );
}
