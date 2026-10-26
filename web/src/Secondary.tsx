import { ThemeButton } from "./DisplayPreferences";
import { useRef, useState } from "react";
import type { SavedState } from "./state";
import { LESSON_IDS } from "./lesson-ids";
import { exportProgress, importProgress, mergeProgress } from "./progress";
type Props = { state: SavedState; update: (state: SavedState) => void };
function Code() {
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  async function check(language: string) {
    setBusy(language);
    try {
      const response = await fetch(`/local/${language}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      const data: unknown = await response.json();
      if (
        !response.ok ||
        !data ||
        typeof data !== "object" ||
        !("status" in data) ||
        data.status !== "ok"
      )
        throw new Error();
      setResults((v) => ({ ...v, [language]: "接続できました · 読取専用" }));
    } catch {
      setResults((v) => ({
        ...v,
        [language]: "未接続です。Eclipseから学習用APIを起動してください。",
      }));
    } finally {
      setBusy(null);
    }
  }
  return (
    <main className="page-shell">
      <div className="page-heading">
        <span className="eyebrow">03 / サイトの仕組み</span>
        <h1>
          読む。動かす。<em>自分でつくる。</em>
        </h1>
        <p>
          このサイト自体が、3つの言語をつなぐ教材です。小さな変更をひとつずつ、既存のEclipseから。
        </p>
      </div>
      <div className="architecture">
        <article>
          <span>01</span>
          <h2>TypeScript</h2>
          <p>画面・状態・検索。型と実行時検証を使い分ける。</p>
          <code>web/src/</code>
        </article>
        <b>↔</b>
        <article>
          <span>02</span>
          <h2>Java 21</h2>
          <p>表示設定・4つの演習はブラウザ内で実行。HTTPは手元のAPIで学ぶ。</p>
          <code>frontend/java/ · backend/java/</code>
        </article>
        <b>↔</b>
        <article>
          <span>03</span>
          <h2>Rust</h2>
          <p>座標の生成と境界のテスト。同じ共通処理をWasmとAPIへ。</p>
          <code>backend/rust/</code>
        </article>
      </div>
      <section className="panel">
        <h2>Eclipseで始める</h2>
        <ol className="readable-list">
          <li>
            リポジトリのREADME「Eclipseから編集・デバッグする」を使い、既存のEclipseへプロジェクトを取り込みます。
          </li>
          <li>
            External Toolsの <strong>Portfolio — Webを起動</strong>{" "}
            を実行。ブラウザで <code>http://127.0.0.1:18420</code> を開きます。
          </li>
          <li>
            Javaは <strong>Portfolio — Java API</strong>、Rustは{" "}
            <strong>Portfolio — Rust API</strong>{" "}
            を起動。テスト用の入口も共有しています。
          </li>
          <li>
            1つ予想を書き、breakpointで止めて値を確認します。会社のプロジェクト・DBは使いません。
          </li>
        </ol>
        <a
          className="text-link"
          href="https://github.com/oopdesc/0"
          target="_blank"
          rel="noreferrer"
        >
          ソースと日本語の手順を開く ↗
        </a>
      </section>
      <section className="panel">
        <h2>ローカルAPIの接続確認</h2>
        <p>
          公開版は静的サイトです。JavaとRustのHTTP
          APIはMacで起動した開発版から使います。
        </p>
        {import.meta.env.DEV ? (
          <div className="api-grid">
            {["java", "rust"].map((language) => (
              <div key={language}>
                <button
                  disabled={busy !== null}
                  onClick={() => check(language)}
                >
                  {language === "java" ? "Java" : "Rust"}に接続
                </button>
                <p role="status">
                  {results[language] || "まだ接続していません"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="notice">
            この公開画面からMacへの接続は行いません。Eclipseから起動したローカル画面で試してください。
          </p>
        )}
      </section>
      <section className="panel">
        <h2>軽さも、仕様にする。</h2>
        <p>
          公開成果物は30MiB以下、JavaScriptのgzip合計は512KiB以下をビルドで検査。Vercel
          Functions・外部DB・有料AI
          APIは使いません。月次の転送枠はアクセス数にも依存するため、VercelのUsageで別に確認します。
        </p>
      </section>
    </main>
  );
}

function Info({ path }: { path: string }) {
  const chat = path === "/aichat";
  const privacy = path === "/privacy";
  const accessibility = path === "/accessibility";
  const excel = path === "/excelvba";
  return (
    <main className="page-shell info-page">
      <span className="eyebrow">0 / このサイトについて</span>
      <h1>
        {chat
          ? "AIと学ぶ。自分で確かめる。"
          : privacy
            ? "このサイトと、あなたのデータ。"
            : accessibility
              ? "誰もが使える入口に。"
              : excel
                ? "表の考え方から、コードへ。"
                : "つくることから、つながる。"}
      </h1>
      {chat ? (
        <>
          <p>
            学習の中心は、普段のChatGPTのチャット。説明を自分で書いてから、確認の質問を1つ頼んでみてください。このサイトからAPIを呼び出すことはありません。
          </p>
          <blockquote>
            「私はこの処理をこう理解しました。答えを先に出さず、理解を確かめる質問を1つしてください。」
          </blockquote>
          <a
            className="primary"
            href="https://chatgpt.com/"
            target="_blank"
            rel="noreferrer"
          >
            ChatGPTを開く ↗
          </a>
          <p className="caption">
            既存アカウントの範囲で利用してください。新規契約・APIキー・課金機能は不要です。秘密情報や会社の情報は送らないでください。
          </p>
        </>
      ) : privacy ? (
        <>
          <p>
            アカウント登録、広告・解析SDK、個人文書の公開ダウンロードはありません。サーバーへ学習の履歴を送信しません。
          </p>
          <h2>ブラウザに保存するもの</h2>
          <p>
            お気に入りの作品ID、学習済みの教材ID、復習日・自己確認回数、動きの設定を、このブラウザのlocalStorageへ保存します。表示テーマも別の保存項目に記録します。別の端末へ自動同期はしません。設定画面から記録ファイルで移したり、個別にリセットしたりできます。
          </p>
          <h2>配信と外部リンク</h2>
          <p>
            ファイルはVercelから配信され、ホスティング側が通常のアクセス情報を扱う場合があります。外部リンクを開いた先では各サービスの方針が適用されます。
          </p>
        </>
      ) : accessibility ? (
        <>
          <p>
            キーボード操作、フォーカス表示、検索ダイアログのEscape操作、動きの停止、OSの視差効果設定を用意しています。
          </p>
          <p>
            装飾的な宇宙表現を止めても、教材やリンクは利用できます。読みやすさ・操作のしやすさは継続して確認します。
          </p>
          <a href="/settings" className="primary">
            表示の設定へ →
          </a>
        </>
      ) : excel ? (
        <>
          <p>
            表で行っていた「条件で絞る・順番を決める・型をそろえる」を、JavaのListとTypeScriptの配列へつなげます。
          </p>
          <section className="panel">
            <h2>最初の小さな課題</h2>
            <p>
              9件の教材をJavaだけに絞る処理を、表のフィルターと比較してください。次に空の条件・全角文字・長すぎる入力を考えます。
            </p>
            <a className="text-link" href="/learn?track=Java">
              Javaの検索処理を読む →
            </a>
          </section>
        </>
      ) : (
        <>
          <p>
            誰でも使えるオープンソースの学習サイトです。結果を予想し、Javaを動かし、自分で説明し、日を空けて復習するための教材と演習を用意しています。
          </p>
          <div className="contact-links">
            <a
              className="primary"
              href="https://github.com/oopdesc/0"
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
            </a>
            <a
              className="secondary"
              href="https://teavm.org/docs/"
              target="_blank"
              rel="noreferrer"
            >
              Javaをブラウザで動かす仕組み ↗
            </a>
          </div>
          <p className="caption">
            学習の記録や演習への入力は、外部サーバーへ送信しません。ソフトウェアの利用条件と画像の出典は公開ソースのLICENSE・MEDIA_CREDITSを確認できます。
          </p>
        </>
      )}
    </main>
  );
}

function Settings({ state, update }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<SavedState | null>(null);
  const [message, setMessage] = useState("");
  function saveProgress() {
    const url = URL.createObjectURL(
      new Blob([exportProgress(state)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `0-learning-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "学習済み項目・お気に入り・復習予定を書き出しました。回答本文は含みません。",
    );
  }
  async function readProgress(file?: File) {
    setIncoming(null);
    if (!file) return;
    try {
      if (file.size > 12000)
        throw Error("12KB以内の学習記録を選んでください。");
      setIncoming(importProgress(await file.text()));
      setMessage("取込内容を確認してから、統合ボタンを押してください。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "記録を読み込めませんでした。",
      );
    }
  }
  return (
    <main className="page-shell info-page">
      <span className="eyebrow">あなたの設定</span>
      <h1>自分のペースで。</h1>
      <section className="panel">
        <h2>明るい表示・暗い表示</h2>
        <p>
          初期表示はライトモードです。ボタンひとつで切り替えられます。設定はこのブラウザに保存します。
        </p>
        <ThemeButton />
      </section>
      <section className="panel">
        <h2>宇宙の動き</h2>
        <p>
          停止してもすべての教材を使えます。OSの動きを減らす設定がある場合は、その設定を優先します。
        </p>
        <button
          aria-pressed={state.motion === "paused"}
          onClick={() =>
            update({
              ...state,
              motion: state.motion === "paused" ? "auto" : "paused",
            })
          }
        >
          {state.motion === "paused"
            ? "動きは停止中 · 再開する"
            : "動きは有効 · 停止する"}
        </button>
      </section>
      <section className="panel">
        <h2>記録を別の端末へ移す</h2>
        <p>
          JSONファイルに書き出し、別の端末でこの設定画面から取り込めます。ファイルはサーバーへ送信しません。取り込みは既存の完了マークとお気に入りへ追加し、復習は新しい日付の記録を採用します。
        </p>
        <div className="button-row">
          <button onClick={saveProgress}>記録を書き出す ↓</button>
          <button onClick={() => fileInput.current?.click()}>
            記録ファイルを選ぶ
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void readProgress(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {incoming && (
          <div className="progress-import-preview">
            <p>
              選んだ記録：学習済み {incoming.completed.length}件、お気に入り{" "}
              {incoming.favorites.length}件、復習予定{" "}
              {Object.keys(incoming.reviews).length}件。
            </p>
            <button
              onClick={() => {
                update(mergeProgress(state, incoming));
                setIncoming(null);
                setMessage(
                  "既存の記録と統合しました。動きの設定は維持しています。",
                );
              }}
            >
              このブラウザの記録へ統合する
            </button>
            <button
              onClick={() => {
                setIncoming(null);
                setMessage("取込みを取り消しました。");
              }}
            >
              取り消す
            </button>
          </div>
        )}
        {message && <p role="status">{message}</p>}
      </section>
      <section className="panel">
        <h2>このブラウザの学習記録</h2>
        <p>
          理解した教材 {state.completed.length} / {LESSON_IDS.length}
          、お気に入り {state.favorites.length}
          件。アカウントやクラウドへの送信はありません。
        </p>
        <div className="button-row">
          <button
            onClick={() => {
              if (
                confirm(
                  "このブラウザの復習予定だけをリセットしますか？完了マークは残ります。",
                )
              )
                update({ ...state, reviews: {} });
            }}
          >
            復習予定をリセット
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "このブラウザの教材の完了マークだけをリセットしますか？",
                )
              )
                update({ ...state, completed: [] });
            }}
          >
            完了マークをリセット
          </button>
          <button
            onClick={() => {
              if (confirm("このブラウザのお気に入りだけをリセットしますか？"))
                update({ ...state, favorites: [] });
            }}
          >
            お気に入りをリセット
          </button>
        </div>
      </section>
    </main>
  );
}

export default function Secondary({
  path,
  state,
  update,
}: { path: string } & Props) {
  return path === "/code" ? (
    <Code />
  ) : path === "/settings" ? (
    <Settings state={state} update={update} />
  ) : (
    <Info path={path} />
  );
}
