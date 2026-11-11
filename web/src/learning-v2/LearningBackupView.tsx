import { useRef, useState } from "react";
import {
  backupCounts, exportLearningBackup, learningBackupLimit,
  parseLearningBackup, readLearningBackup, restoreLearningBackup,
} from "./learningBackup";
import { resumeStudyRound } from "./studyRound";
import "./today.css";

function describe(counts: ReturnType<typeof backupCounts>) {
  return `練習の記録 ${counts.practice}件 · 下書き ${counts.drafts}件 · 学習ノート ${counts.notes}件 · 模試 ${counts.exams}回 · レベルアップの記録 ${counts.journey}件 · 学習セットの残り ${counts.remaining}問`;
}

function loadCurrent() {
  try { return { counts: backupCounts(readLearningBackup(localStorage)), error: "" }; }
  catch { return { counts: null, error: "このブラウザの学習記録を読み取れませんでした。" }; }
}

export default function LearningBackupView() {
  const fileInput = useRef<HTMLInputElement>(null);
  const fileSequence = useRef(0);
  const [current, setCurrent] = useState(loadCurrent);
  const [incoming, setIncoming] = useState<{ raw: string; data: ReturnType<typeof parseLearningBackup> } | null>(null);
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);

  function download() {
    try {
      const raw = exportLearningBackup(localStorage);
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "0-learning-backup.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("学習バックアップを書き出しました。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "書き出せませんでした。");
    }
  }

  async function preview(file?: File) {
    if (!file) return;
    const sequence = ++fileSequence.current;
    setIncoming(null);
    setNotice("");
    setReading(true);
    try {
      if (file.size > learningBackupLimit) throw Error("このファイルは一括バックアップのサイズ上限を超えています。");
      const raw = await file.text();
      const data = parseLearningBackup(raw);
      if (fileSequence.current === sequence) setIncoming({ raw, data });
    } catch (error) {
      if (fileSequence.current === sequence)
        setNotice(error instanceof SyntaxError ? "JSONファイルとして読み取れませんでした。"
          : error instanceof Error ? error.message : "ファイルを読み取れませんでした。");
    } finally {
      if (fileSequence.current === sequence) setReading(false);
    }
  }

  function restore() {
    if (!incoming) return;
    try {
      const result = restoreLearningBackup(localStorage, incoming.raw);
      setCurrent({ counts: result.counts, error: "" });
      setNotice(result.keptRound
        ? "記録を統合しました。この端末で進めていた学習セットを残しました。"
        : "学習記録を統合しました。");
      setIncoming(null);
    } catch (error) {
      setCurrent(loadCurrent());
      setNotice(error instanceof Error ? error.message : "取り込めませんでした。");
    }
  }

  const resume = resumeStudyRound();
  return (
    <main className="study-home" aria-labelledby="learning-backup-title">
      <header className="study-heading">
        <div>
          <p className="study-kicker">このブラウザの記録</p>
          <h2 id="learning-backup-title">学習バックアップ</h2>
          <p>練習・模試・レベルアップの記録と、進行中の学習セットをまとめて持ち出せます。途中回答とコードの下書きも含みます。</p>
        </div>
      </header>
      <section className="study-records" aria-label="書き出しと取り込み">
        <div>
          <h3>現在の記録</h3>
          {current.counts ? <p>{describe(current.counts)}</p> : <p>{current.error}</p>}
          <p>ファイルは端末内で処理します。自分で保管し、別の端末では同じ画面から選んでください。</p>
        </div>
        <div>
          <button type="button" onClick={download}>一括バックアップを書き出す ↓</button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={reading}>バックアップを選ぶ</button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="学習バックアップファイル"
            hidden
            onChange={event => {
              void preview(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </section>
      {incoming && (
        <section className="study-records" aria-label="取り込む内容の確認">
          <div>
            <h3>取り込む内容</h3>
            <p>作成日 {new Date(incoming.data.createdAt).toLocaleString("ja-JP")}</p>
            <p>{describe(backupCounts(incoming.data))}</p>
            <p>既存の記録と統合します。進行中のセットが別にある場合は、この端末のセットを優先します。</p>
          </div>
          <div>
            <button type="button" onClick={restore}>この内容を取り込む</button>
            <button type="button" onClick={() => setIncoming(null)}>取り消す</button>
          </div>
        </section>
      )}
      {notice && <p role="status" className="study-notice">{notice}</p>}
      <p>{resume && <><a href={resume}>学習セットの続きへ →</a>　</>}<a href="/learn?section=today">今日の学習へ →</a></p>
    </main>
  );
}
