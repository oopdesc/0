import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type sourceFiles from "./generated/site-sources.json";
import "./source-reader.css";

export default function SourceReader() {
  const [files, setFiles] = useState<typeof sourceFiles | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    async function load() {
      const response = await fetch("/learning-v2/site-sources.json", { signal: controller.signal });
      if (!response.ok) throw Error("実装のソースを取得できません。");
      const raw = await response.text();
      if (raw.length > 128000) throw Error("掲載ソースのサイズを確認できません。");
      const value = JSON.parse(raw);
      if (!Array.isArray(value) || value.length !== 6 || value.some(file =>
        !file || typeof file.id !== "string" || typeof file.path !== "string" ||
        typeof file.content !== "string" || typeof file.title !== "string" ||
        !["java", "rust"].includes(file.language) || !Array.isArray(file.cues) ||
        file.cues.some((cue: {line: number; title: string; explanation: string}) =>
          !cue || !Number.isInteger(cue.line) || cue.line < 1 || typeof cue.title !== "string" || typeof cue.explanation !== "string")))
        throw Error("掲載ソースの形式を確認できません。");
      if (!controller.signal.aborted) setFiles(value as typeof sourceFiles);
    }
    load().catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "掲載ソースを読み取れません。"); });
    return () => controller.abort();
  }, [retry]);
  if (error) return <p role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>読み直す</button></p>;
  return files ? <SourceFiles sources={files} /> : <p role="status">Java・Rustの実装を読み込んでいます…</p>;
}

function SourceFiles({sources}: {sources: typeof sourceFiles}) {
  const [id, setId] = useState(sources[0].id);
  const source = sources.find((file) => file.id === id) ?? sources[0];
  const [cue, setCue] = useState<number | null>(null);
  const [wrap, setWrap] = useState(false);
  const [notice, setNotice] = useState("");
  const viewer = useRef<HTMLPreElement>(null);
  const lines = useMemo(() => source.content.trimEnd().split("\n"), [source]);
  const reading = cue === null ? null : source.cues[cue];
  function scrollToLine(line: number) {
    if (!viewer.current) return;
    const target = viewer.current.querySelector<HTMLElement>(
      `[data-line="${line}"]`,
    );
    if (target)
      viewer.current.scrollTo({
        top: target.offsetTop - 12,
        behavior: "instant",
      });
  }
  useLayoutEffect(() => {
    if (reading) scrollToLine(reading.line);
  }, [reading, wrap]);
  function choose(next: string) {
    setId(next);
    setCue(null);
    setNotice("");
    viewer.current?.scrollTo({ top: 0, left: 0 });
  }
  function focusCue(index: number) {
    setCue(index);
    scrollToLine(source.cues[index].line);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(source.content);
      setNotice("このファイルの全文をコピーしました。");
    } catch {
      setNotice("コピーできませんでした。「ファイルを保存」から取得できます。");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([source.content], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = source.path.split("/").pop()!;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "このファイルを保存しました。実行手順と依存ファイルはGitHubで確認できます。",
    );
  }
  return (
    <section className="source-reader" aria-labelledby="source-reader-title">
      <header>
        <div>
          <h2 id="source-reader-title">このサイトの実装を読む</h2>
          <p>
            使っているコードを、そのまま教材に。読みどころを選ぶと該当行へ移動します。
          </p>
        </div>
        <label>
          読む実装
          <select value={id} onChange={(event) => choose(event.target.value)}>
            <optgroup label="Java">
              {sources
                .filter((file) => file.language === "java")
                .map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.title}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Rust">
              {sources
                .filter((file) => file.language === "rust")
                .map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.title}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      </header>
      <h3>{source.title}</h3>
      <p>{source.description}</p>
      <div className="source-cues" role="group" aria-label="コードの読みどころ">
        {source.cues.map((point, index) => (
          <button
            type="button"
            key={point.line}
            aria-pressed={cue === index}
            onClick={() => focusCue(index)}
          >
            {point.title}
            <small>{point.line}行目</small>
          </button>
        ))}
      </div>
      {reading && (
        <p className="source-guidance" role="status">
          {reading.explanation}
        </p>
      )}
      <div className="source-toolbar">
        <code>{source.path}</code>
        <label>
          <input
            type="checkbox"
            checked={wrap}
            onChange={(event) => setWrap(event.target.checked)}
          />
          行を折り返す
        </label>
      </div>
      <pre
        ref={viewer}
        className={wrap ? "source-code source-code--wrap" : "source-code"}
        tabIndex={0}
        aria-label={source.path + " の全文"}
      >
        <code>
          {lines.map((line, index) => (
            <span
              className={
                "source-line" +
                (reading && index + 1 === reading.line
                  ? " source-line--selected"
                  : "")
              }
              key={index}
              data-line={index + 1}
            >
              <span className="source-line-number" aria-hidden="true">
                {index + 1}
              </span>
              <span>{line || " "}</span>
            </span>
          ))}
        </code>
      </pre>
      <div className="source-actions">
        <button type="button" onClick={() => void copy()}>
          全文をコピー
        </button>
        <button type="button" onClick={download}>
          ファイルを保存 ↓
        </button>
        <a
          href={
            "https://github.com/oopdesc/0/blob/main/" +
            source.path +
            (reading ? "#L" + reading.line : "")
          }
          target="_blank"
          rel="noreferrer"
        >
          GitHubで読む ↗
        </a>
        <a href={source.practice}>関連する実験・課題へ →</a>
      </div>
      {notice && <p role="status">{notice}</p>}
      <p className="source-footnote">
        現行サイトの独自部分の転載・再配布・商用転用には、事前の許諾が必要です。個人の学習に利用できます。{" "}
        掲載ソースは公開ビルド時に元ファイルから取得しています。Javaの演習・Rustの銀河模型と、手元で動かすHTTP・DBプロジェクトを収録しています。{" "}
        <a href="/rights">利用条件</a>
      </p>
    </section>
  );
}
