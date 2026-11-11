import { useEffect, useRef, useState } from "react";
import { loadManifest, loadProjects } from "./loader";
import { loadProgress, projectDraftKey } from "./progress";
import { persistProjectDraft } from "./projectDraft";
import { fetchProjectArchive } from "./projectArchive";
import { projectHref, projectSelection } from "./projectNavigation";
import type { Project } from "./types";
import "./learning-v2.css";

type Mission = Project["missions"][number];
function saveFile(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name.split("/").pop() || "Main.java";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ProjectView({
  search = "",
  navigate = (href: string) => window.location.assign(href),
}: {
  search?: string;
  navigate?: (href: string) => void;
}) {
  const language =
    new URLSearchParams(search).get("lang") === "rust" ? "rust" : "java";
  const [projects, setProjects] = useState<Project[] | null>(null),
    [error, setError] = useState("");
  const [version, setVersion] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setProjects(null);
    setError("");
    loadManifest(language, controller.signal)
      .then(async (m) => {
        const result = await loadProjects(m, controller.signal);
        return { result, version: m.contentVersion };
      })
      .then((x) => {
        if (!controller.signal.aborted) {
          setProjects(x.result);
          setVersion(x.version);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "読み込めません。");
      });
    return () => controller.abort();
  }, [retry, language]);
  const { projectIndex, missionIndex, missing } = projectSelection(
    projects ?? [],
    search,
  );
  const project = projects?.[projectIndex],
    mission = project?.missions[missionIndex];
  const selectProject = (index: number) => {
    const p = projects?.[index];
    if (p) navigate(projectHref(language, p.id));
  };
  const selectMission = (index: number) => {
    const m = project?.missions[index];
    if (project && m) navigate(projectHref(language, project.id, m.id));
  };
  return (
    <main className="zlv zlv-projects">
      <div className="zlv-topline">
        <span>0 / 小さな制作</span>
        <span>自分の手で、少しずつ</span>
      </div>
      <header className="zlv-header">
        <div>
          <span className="zlv-kicker">自分で組み立てる ✳</span>
          <h2>
            小さく作って、
            <br />
            つながりを知る。
          </h2>
          <p>開始状態から一つずつ編集し、テストと理由をたどります。</p>
        </div>
        <div className="zlv-summary">
          <span>制作中の題材</span>
          <strong>
            {projects?.length ?? "—"}
            <small> 件</small>
          </strong>
          <p>完成したプロジェクト数ではありません</p>
        </div>
      </header>
      <nav className="zlv-language" aria-label="プロジェクトの言語">
        <a
          href="/learn?section=projects&lang=java"
          aria-current={language === "java" ? "page" : undefined}
        >
          Java
        </a>
        <a
          href="/learn?section=projects&lang=rust"
          aria-current={language === "rust" ? "page" : undefined}
        >
          Rust
        </a>
      </nav>
      <p className="zlv-build-note">
        課題ごとに開始ファイルとテストを用意しています。ブラウザで下書きし、ZIPを手元へ展開して実行します。
      </p>
      {error && (
        <div className="zlv-placeholder" role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>読み直す</button>
        </div>
      )}
      {!projects && !error && (
        <p role="status">小プロジェクトを読み込んでいます…</p>
      )}
      {projects && !projects.length && (
        <p>このpackには小プロジェクトがまだありません。</p>
      )}
      {projects && missing && (
        <p role="status">
          指定した課題が見つかりません。下のメニューから選び直せます。
        </p>
      )}
      {project && mission && (
        <div className="zlv-project-picker">
          <label>
            作る題材
            <select
              value={projectIndex}
              onChange={(e) => selectProject(Number(e.target.value))}
            >
              {projects?.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            取り組む課題
            <select
              value={missionIndex}
              onChange={(e) => selectMission(Number(e.target.value))}
            >
              {project.missions.map((m, i) => (
                <option key={m.id} value={i}>
                  {i + 1}. {m.title}
                </option>
              ))}
            </select>
          </label>
          <p>
            <a href={projectHref(language, project.id, mission.id)}>
              この課題への直接リンク ↗
            </a>
          </p>
        </div>
      )}
      {project && mission && (
        <div className="zlv-flow-layout">
          <aside className="zlv-sidebar" aria-label="小プロジェクトと課題">
            <div className="zlv-aside-title">
              <div>
                <span>小プロジェクト</span>
                <h3>作るものを選ぶ</h3>
              </div>
            </div>
            <ol className="zlv-flow-list">
              {projects?.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={i === projectIndex}
                    onClick={() => selectProject(i)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {p.title}
                  </button>
                </li>
              ))}
            </ol>
            <div className="zlv-list-head">
              <span>この題材の課題</span>
              <b>{project.missions.length}課題</b>
            </div>
            <ol className="zlv-flow-list">
              {project.missions.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-pressed={i === missionIndex}
                    onClick={() => selectMission(i)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {m.title}
                  </button>
                </li>
              ))}
            </ol>
          </aside>
          <MissionPanel
            key={`${mission.id}@${version}`}
            project={project}
            mission={mission}
            version={version}
          />
        </div>
      )}
    </main>
  );
}

function MissionPanel({
  project,
  mission,
  version,
}: {
  project: Project;
  mission: Mission;
  version: string;
}) {
  const [storage] = useState(() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  });
  const [loaded] = useState(() => (storage ? loadProgress(storage) : null));
  const [files, setFiles] = useState(() =>
    mission.files.map(
      (f, i) =>
        loaded?.state.drafts[projectDraftKey(mission.id, version, i)]
          ?.content ?? f.content,
    ),
  );
  const savedRaw = useRef(
    mission.files.map(
      (_, i) =>
        loaded?.state.drafts[projectDraftKey(mission.id, version, i)]?.content,
    ),
  );
  const [notice, setNotice] = useState(
    loaded?.error ??
      (!storage
        ? "このブラウザでは保存できません。入力はページを離れると失われます。"
        : ""),
  );
  const [archiveBusy, setArchiveBusy] = useState(false);
  function updateFile(index: number, content: string) {
    setFiles((old) => old.map((value, i) => (i === index ? content : value)));
    if (!storage || !loaded?.writable) {
      setNotice(
        "自動保存できません。入力は画面上に残っています。ページを離れる前に編集ファイルを保存してください。",
      );
      return;
    }
    const result = persistProjectDraft(
      storage,
      projectDraftKey(mission.id, version, index),
      content,
      savedRaw.current[index],
    );
    if (result.ok) savedRaw.current[index] = result.content;
    setNotice(
      result.ok
        ? "下書きをこのブラウザに保存しました。コードは未実行です。"
        : result.error,
    );
  }
  async function downloadStarter(working = false) {
    setArchiveBusy(true);
    try {
      const edits = working
        ? Object.fromEntries(
            mission.files.flatMap((file, i) =>
              file.editable ? [[file.path, files[i]]] : [],
            ),
          )
        : undefined;
      const archive = await fetchProjectArchive(mission.id, undefined, edits);
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(archive).buffer], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${mission.id.replace(/^(java|rust):/, "")}${working ? "-work-in-progress" : ""}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        working
          ? "現在の下書きを組み込んだ作業用ZIPを保存しました。未実行・未判定です。READMEの手順で確かめてください。"
          : "開始状態とテストをダウンロードしました。編集した下書きは別に保存してください。",
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "開始ファイルを取得できません。",
      );
    } finally {
      setArchiveBusy(false);
    }
  }
  return (
    <article className="zlv-card zlv-project-card">
      <div className="zlv-card-top">
        <span>制作 / {project.title}</span>
        <span className="zlv-tag">実装課題</span>
      </div>
      <h3>{mission.title}</h3>
      <p>{mission.instructions}</p>
      <p className="zlv-build-note">
        {project.extensions?.note ||
          "このプロジェクトの完成状況を確認してください。"}
      </p>
      <section className="zlv-project-requirements">
        <h4>できたか確かめる条件</h4>
        <ul>
          {mission.acceptance.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
        <p>
          前提:{" "}
          {mission.prerequisiteConceptIds
            .map((id) => id.replace(/^(java:c-|rust:)/, ""))
            .join(" / ") ||
            (project.language === "rust"
              ? "Rustの基本文法・Cargo。開始ZIPの手順も確認してください。"
              : "開始ZIPの手順を確認してください。")}
        </p>
      </section>
      <p>
        <button
          type="button"
          disabled={archiveBusy}
          onClick={() => void downloadStarter()}
        >
          {archiveBusy
            ? "ZIPを準備中…"
            : "この課題の開始状態・テストをZIPで取得 ↓"}
        </button>
      </p>
      <p>
        課題ごとに新しいZIPから始め、次の編集ファイルを同じ相対パスに保存してください。各ZIPの共通部には、ほかの課題の完成例も含まれます。ZIPはクリック時にブラウザで作ります。
      </p>
      <p>
        <button
          type="button"
          disabled={archiveBusy}
          onClick={() => void downloadStarter(true)}
        >
          現在の下書きを組み込んだ作業用ZIP ↓
        </button>
      </p>
      <p className="zlv-build-note">
        下書きのコピーを開始ファイルへ組み込みます。実行・テストの成功判定は行いません。
      </p>
      {mission.files.map((f, i) => (
        <section key={f.path}>
          <div className="zlv-code-head">
            <span>{f.path}</span>
            <span>{f.editable ? "編集できます" : "参照用"}</span>
          </div>
          <label className="zlv-sr" htmlFor={`zlv-project-file-${i}`}>
            編集ファイル {f.path}
          </label>
          <textarea
            id={`zlv-project-file-${i}`}
            className="zlv-editor zlv-project-editor"
            spellCheck={false}
            readOnly={!f.editable}
            value={files[i]}
            onChange={(e) => updateFile(i, e.target.value)}
          />
          <div className="zlv-code-actions">
            <button type="button" onClick={() => saveFile(f.path, files[i])}>
              編集ファイルを保存 ↓
            </button>
            <span>このブラウザに下書き</span>
          </div>
        </section>
      ))}
      {notice && (
        <p className="zlv-notice" role="status">
          {notice}
        </p>
      )}
      <div className="zlv-write-note">
        <strong>未実行・未判定</strong>
        <p>
          {project.language === "rust"
            ? "Rust stable・CargoとCコンパイラを用意し、ZIPの展開先で次を実行します。"
            : "JDK 17以上とMavenを用意し、ZIPの展開先で次を実行します。"}
          表示だけでは実行しません。
        </p>
        <pre>
          <code>{mission.testCommand.join(" ")}</code>
        </pre>
        <p>実測はその環境でのテスト結果を確認してください。</p>
      </div>
      <details className="zlv-disclosure">
        <summary>ヒント</summary>
        <ol>
          {mission.hints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ol>
      </details>
      <details className="zlv-disclosure">
        <summary>模範差分と理由を見る</summary>
        <p>{mission.explanation}</p>
        <pre>
          <code>{mission.solutionDiff}</code>
        </pre>
      </details>
      <p className="zlv-archive">
        <a
          href={
            project.language === "rust"
              ? "https://github.com/oopdesc/0/tree/main/projects/rust/book-api-http"
              : "/learning-v2/java/examples/flow/README.md"
          }
          target="_blank"
          rel="noreferrer"
        >
          ローカル実行について ↗
        </a>
        　
        <a href={`/learn?section=drill&lang=${project.language}`}>
          問題集に戻る →
        </a>
      </p>
    </article>
  );
}
