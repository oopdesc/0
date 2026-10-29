import { useMemo, useState } from "react";
import type { Language, Problem } from "./schema";
import { BRIDGE_PROBLEMS, JAVA_PROBLEMS, RUST_PROBLEMS, QUESTION_LABEL } from "./index";
import { topicsFor, TOPIC_MAP } from "./topics";
import { BUCKET_LABEL, BUCKET_ORDER, bucketCounts, bucketFor, loadProgress, saveProgress, type ProgressBucket, type ProgressState } from "./store";
import Player from "./Player";
import "./player.css";

interface TrackPageProps {
  language: Language | "bridge";
  onNavigate: (href: string) => void;
  initialQuestionId?: string;
}

const TITLE: Record<string, string> = {
  java: "Java を学ぶ",
  rust: "Rust を学ぶ",
  bridge: "Java と Rust の対応",
};

const LEAD: Record<string, string> = {
  java: "Java の型・制御・OOP・コレクション・例外を、実行結果から逆にたどります。TeaVM で動かせる問題はブラウザ内で実際に Java が動きます。",
  rust: "Rust の所有権・借用・Option/Result・trait・ライフタイムを、コンパイラと実行結果と一緒に学びます。",
  bridge: "Java と Rust は対応しているように見えますが、対応が破れる場所を知っています。その違いこそが学習の要点です。",
};

export default function TrackPage({ language, onNavigate, initialQuestionId }: TrackPageProps) {
  const [state, setState] = useState<ProgressState>(() => loadProgress());
  const [selected, setSelected] = useState<string | null>(initialQuestionId ?? null);
  const [bucket, setBucket] = useState<ProgressBucket | "all">("all");
  const [topic, setTopic] = useState<string>("すべて");
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);

  const problems = useMemo(() => {
    const all: Problem[] = language === "bridge" ? BRIDGE_PROBLEMS : JAVA_RUST[language]!;
    return all;
  }, [language]);

  const counts = useMemo(
    () => bucketCounts(problems, state, Date.now()),
    [problems, state, tick],
  );

  const visible = useMemo(() => {
    const now = Date.now();
    return problems.filter((p) => {
      if (bucket !== "all" && bucketFor(p, state.records[p.id], now) !== bucket) return false;
      if (topic !== "すべて" && p.topic !== topic) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = `${p.id} ${p.topic} ${p.prompt} ${p.questionType} ${p.misconception} ${p.explanation}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [problems, bucket, topic, query, state, tick]);

  const current = selected ? problems.find((p) => p.id === selected) : null;

  if (current) {
    return (
      <Player
        problem={current}
        record={state.records[current.id]}
        state={state}
        onChange={(next) => {
          setState(next);
          setTick((n) => n + 1);
        }}
        onExit={() => setSelected(null)}
      />
    );
  }

  const topics = ["すべて", ...topicsFor(language === "bridge" ? "bridge" : language).map((t) => t.id)];

  return (
    <div className="lp-">
      <main className="lp-main">
        <p className="lp-sub">
          <button type="button" onClick={() => onNavigate("/learn")}>
            ← 学習へ
          </button>
        </p>
        <h1>{TITLE[language]}</h1>
        <p className="lp-sub">{LEAD[language]}</p>
        <div className="lp-meta">
          <span className="lp-chip">
            問題数 <strong>{problems.length}</strong>
          </span>
          <span className="lp-chip">
            学習済み <strong>{counts.find((c) => c.bucket === "reproduced")!.count + counts.find((c) => c.bucket === "transferred")!.count}</strong>
          </span>
          <span className="lp-chip">
            復習期限 <strong>{counts.find((c) => c.bucket === "review")!.count}</strong>
          </span>
          <button type="button" onClick={() => onNavigate("/review")}>
            今日の復習 →
          </button>
        </div>

        <div className="lp-buckets" role="group" aria-label="学習状況">
          {BUCKET_ORDER.map((b) => (
            <button
              key={b}
              type="button"
              className="lp-bucket"
              aria-pressed={bucket === b}
              onClick={() => setBucket((current) => (current === b ? "all" : b))}
            >
              <b>{counts.find((c) => c.bucket === b)!.count}</b>
              <span>{BUCKET_LABEL[b]}</span>
            </button>
          ))}
        </div>

        <div className="lp-filters">
          <label className="lp-rule" htmlFor="lp-topic">
            トピック
          </label>
          <select
            id="lp-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{
              background: "var(--lp-soft)",
              color: "var(--text)",
              border: "1px solid var(--lp-border)",
              borderRadius: 10,
              padding: "9px 12px",
              fontFamily: "inherit",
              fontSize: 14,
            }}
          >
            {topics.map((t) => (
              <option key={t} value={t}>
                {TOPIC_MAP[t]?.name ?? t}
              </option>
            ))}
          </select>
          <input
            className="lp-input lp-search"
            value={query}
            placeholder="問題を検索"
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="lp-rule">表示 {visible.length} 件</span>
        </div>

        <ul className="lp-list">
          {visible.map((problem) => {
            const record = state.records[problem.id];
            const b = bucketFor(problem, record, Date.now());
            return (
              <li key={problem.id}>
                <div className="lp-row">
                  <div className="lp-grow">
                    <div>
                      <span className="lp-chip" style={{ marginRight: 8 }}>
                        {QUESTION_LABEL[problem.questionType]}
                      </span>
                      <strong>{TOPIC_MAP[problem.topic]?.name ?? problem.topic}</strong>
                      <span className="lp-rule" style={{ marginLeft: 8 }}>
                        L{problem.level}
                      </span>
                    </div>
                    <div style={{ marginTop: 4 }}>{problem.prompt}</div>
                  </div>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setSelected(problem.id)}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    解く
                  </button>
                </div>
                <div className="lp-dots" aria-label={`学習状況 ${BUCKET_LABEL[b]}`}>
                  <span className={`lp-dot ${record?.attempts ? "on" : ""}`} title="解答済み" />
                  <span className={`lp-dot ${record?.lastReproduced ? "on" : ""}`} title="再現成功" />
                  <span
                    className={`lp-dot ${record?.reviewDueAt && record.reviewDueAt <= Date.now() ? "off" : ""}`}
                    title="復習期限"
                  />
                  <span className="lp-rule" style={{ marginLeft: 8 }}>
                    {BUCKET_LABEL[b]}
                    {record?.attempts ? ` · ${record.attempts} 回` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        {visible.length === 0 && <p className="lp-note">条件に合う問題がありません。</p>}

        <p className="lp-rule" style={{ marginTop: 26 }}>
          保存はこのブラウザの localStorage だけです。アカウントもサーバーも使いません。
          <button
            type="button"
            onClick={() => {
              if (confirm("このブラウザの学習記録をすべて消します。")) {
                localStorage.removeItem("cosmic.problems.progress.v1");
                const fresh = loadProgress();
                setState(fresh);
                saveProgress(fresh);
                setTick((n) => n + 1);
              }
            }}
            style={{ marginLeft: 10 }}
          >
            記録を消す
          </button>
        </p>
      </main>
    </div>
  );
}

const JAVA_RUST: Record<string, Problem[]> = {
  java: JAVA_PROBLEMS,
  rust: RUST_PROBLEMS,
};
