import { useMemo, useRef, useState } from "react";
import type { Problem } from "./schema";
import {
  ALL_PROBLEMS,
  JAVA_PROBLEMS,
  RUST_PROBLEMS,
  BRIDGE_PROBLEMS,
  QUESTION_LABEL,
} from "./index";
import {
  BUCKET_LABEL,
  applyAttempt,
  exportProgressJson,
  importProgressJson,
  mergeProgress,
  bucketCounts,
  BUCKET_ORDER,
  buildTodaySet,
  loadProgress,
  saveProgress,
  TODAY_REASON_LABEL,
  type ProgressState,
} from "./store";
import Player from "./Player";
import "./player.css";

export default function ReviewPage({ onNavigate }: { onNavigate: (href: string) => void }) {
  const [state, setState] = useState<ProgressState>(() => loadProgress());
  const [selected, setSelected] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [importNote, setImportNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const knownIds = useMemo(() => new Set(ALL_PROBLEMS.map((p) => p.id)), []);

  const now = Date.now();

  const due = useMemo(
    () =>
      ALL_PROBLEMS.filter((p) => {
        const r = state.records[p.id];
        return r && r.reviewDueAt !== null && r.reviewDueAt <= now;
      }),
    [state, now, tick],
  );

  const counts = useMemo(
    () => bucketCounts([...JAVA_PROBLEMS, ...RUST_PROBLEMS, ...BRIDGE_PROBLEMS], state, now),
    [state, now, tick],
  );

  const current: Problem | undefined = selected
    ? ALL_PROBLEMS.find((p) => p.id === selected)
    : undefined;

  const doExport = () => {
    downloadProgress(state);
    setImportNote("記録を書き出しました。");
  };

  const onPickFile = async (file: File) => {
    try {
      const incoming = importProgressJson(await file.text(), { now: Date.now(), knownIds });
      const next = mergeProgress(state, incoming, Date.now());
      setState(next);
      saveProgress(next);
      setTick((n) => n + 1);
      const count = Object.keys(incoming.records).length;
      setImportNote(
        count > 0 ? `取り込みました（${count} 件）。` : "このファイルには読み込める記録がありませんでした。",
      );
    } catch (error) {
      setImportNote(`取り込めませんでした：${(error as Error).message}`);
    }
  };

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

  return (
    <div className="lp-">
      <main className="lp-main">
        <p className="lp-sub">
          <button type="button" onClick={() => onNavigate("/learn")}>
            ← 学習へ
          </button>
        </p>
        <h1>今日の復習</h1>
        <p className="lp-sub">
          答えを隠したまま書けるか。説明を見ただけでは「学習した」になりません。書けて初めて、次を伸ばします。
        </p>

        <div className="lp-buckets" role="group" aria-label="学習状況">
          {BUCKET_ORDER.map((b) => (
            <span key={b} className="lp-bucket" style={{ cursor: "default" }}>
              <b>{counts.find((c) => c.bucket === b)!.count}</b>
              <span>{BUCKET_LABEL[b]}</span>
            </span>
          ))}
        </div>

        <h2>今日の5問</h2>
        <p className="lp-sub">
          期限の来ている復習、苦手概念、新規、転移を1つずつ組み立てます。迷わずここから始めてください。
        </p>
        <ul className="lp-list">
          {buildTodaySet(ALL_PROBLEMS, state, now).map(
            ({ problem, reason }) => (
              <li key={problem.id}>
                <div className="lp-row">
                  <div className="lp-grow">
                    <div>
                      <span className="lp-chip" style={{ marginRight: 8 }}>
                        {TODAY_REASON_LABEL[reason]}
                      </span>
                      <strong>{problem.topic}</strong>
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
              </li>
            ),
          )}
        </ul>

        <h2 style={{ marginTop: 34 }}>復習期限が来ている問題</h2>
        {due.length === 0 ? (
          <p className="lp-note">
            期限の来ている問題はありません。新しい問題を解くか、別の言語のトラックに行ってください。
          </p>
        ) : (
          <ul className="lp-list">
            {due.map((problem) => {
              const record = state.records[problem.id]!;
              return (
                <li key={problem.id}>
                  <div className="lp-row">
                    <div className="lp-grow">
                      <div>
                        <span className="lp-chip" style={{ marginRight: 8 }}>
                          {QUESTION_LABEL[problem.questionType]}
                        </span>
                        <strong>{problem.topic}</strong>
                      </div>
                      <div style={{ marginTop: 4 }}>{problem.prompt}</div>
                      <div className="lp-rule" style={{ marginTop: 4 }}>
                        直近の正答連続 {record.streak} 回 · 次は {record.reviewInterval} 日後に予定
                      </div>
                    </div>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => setSelected(problem.id)}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      復習する
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <h2 style={{ marginTop: 34 }}>間隔の調整</h2>
        <p className="lp-rule">
          復習の間隔は成绩に応じて 1 / 3 / 7 / 14 / 30 日から選ばれます。ここではそれぞれの間隔を試せます。
        </p>
        <div className="lp-actions">
          {[1, 3, 7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                const next: ProgressState = {
                  ...state,
                  records: Object.fromEntries(
                    Object.entries(state.records).map(([id, r]) => [
                      id,
                      { ...r, reviewInterval: Math.max(1, Math.round(days * (r.reviewInterval / Math.max(1, state.settings.intervals[0]!)))), reviewDueAt: now + days * 86_400_000 },
                    ]),
                  ),
                };
                setState(next);
                saveProgress(next);
                setTick((n) => n + 1);
              }}
            >
              {days} 日後にそろえる
            </button>
          ))}
        </div>

        <h2 style={{ marginTop: 34 }}>記録の書き出し・取り込み</h2>
        <p className="lp-rule">
          このブラウザの学習記録は JSON として書き出せます。別のブラウザや別の機械に持ち越すときにお使いください。書き出したファイルにはアカウント情報も、書いた答えの文章も含まれません。
        </p>
        <div className="lp-actions">
          <button type="button" onClick={() => doExport()}>
            記録を書き出す
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            記録を取り込む
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onPickFile(file);
              event.target.value = "";
            }}
          />
        </div>
        {importNote && <p className="lp-note">{importNote}</p>}

        <p className="lp-rule" style={{ marginTop: 28 }}>
          <button type="button" onClick={() => onNavigate("/learn/java")}>
            Java のトラック
          </button>
          <button type="button" onClick={() => onNavigate("/learn/rust")} style={{ marginLeft: 10 }}>
            Rust のトラック
          </button>
        </p>
      </main>
    </div>
  );
}

/** Kept for symmetry with the track page; the review queue also accepts direct picks. */
/** Trigger a JSON download of the current record. */
function downloadProgress(state: ProgressState): void {
  const blob = new Blob([exportProgressJson(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "cosmic-problems-progress.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function markReviewSeen(state: ProgressState, problem: Problem, ok: boolean) {
  const next = applyAttempt(state, problem, { prediction: "", actual: "", ok, blind: true });
  saveProgress(next.state);
  return next.state;
}
