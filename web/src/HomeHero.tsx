import { useEffect, useRef, useState } from "react";
import { SolarDiagram } from "./arena/astra/SolarDiagram";
import bodies from "./arena/astra/bodies.json";
import "./home.css";
import { loadManifest } from "./learning-v2/loader";
import { loadLast } from "./learning-v2/progress";
export default function HomeHero({ paused }: { paused: boolean }) {
  const [selected, setSelected] = useState("earth"),
    [language, setLanguage] = useState<"java" | "rust">("java"),
    [stopped, setStopped] = useState(false),
    [active, setActive] = useState(true),
    [copied, setCopied] = useState(false);
  const area = useRef<HTMLElement>(null);
  const [counts, setCounts] = useState<{ java: number | null; rust: number | null; exams: number | null }>({ java: null, rust: null, exams: null });
  const [last] = useState(() => { try { return loadLast(localStorage); } catch { return null; } });
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadManifest("java", controller.signal), loadManifest("rust", controller.signal)]).then(([j,r]) => setCounts({java:j.counts.normal,rust:r.counts.normal,exams:j.counts.exams+r.counts.exams})).catch(() => {});
    return () => controller.abort();
  }, []);
  const resume = last ? `/learn?section=drill&lang=${last.language}&q=${encodeURIComponent(last.id)}` : "/learn?section=drill&lang=java&q=java%3Aq0001";
  const body = bodies.find((b) => b.slug === selected)!;
  const code =
    language === "java"
      ? `String name = "${body.name}";\nSystem.out.println(name);`
      : `let name = "${body.name}";\nprintln!("{}", name);`;
  useEffect(() => {
    let inView = true;
    const sync = () => setActive(inView && !document.hidden);
    const observer = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    if (area.current) observer.observe(area.current);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <section ref={area} className="home-hero" aria-labelledby="home-title">
      <div className="home-intro">
        <span className="home-eyebrow">
          <span /> 自分の手で学ぶ、プログラミング
        </span>
        <h1 id="home-title">
          <span>コードを書いて、</span>
          <span>動きを確かめる。</span>
        </h1>
        <p>
          Javaを中心に、Rustと画面づくりも。
          <br />
          予想と結果を見比べながら、仕組みを理解する。
        </p>
        <div className="home-actions">
          <a className="home-primary" href="/learn?section=drill&lang=java&q=java%3Aq0001">
            はじめての一問 <span aria-hidden="true">↗</span>
          </a>
          <a className="home-secondary" href="/learn?section=drill">
            問題を選ぶ <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="home-quick-links"><a href={resume}>続きから →</a><a href="/learn?section=concepts">概念図 →</a><a href="/learn?section=exams">試験 →</a><a href="/art">太陽系の模型 →</a><a href="https://github.com/oopdesc/all-beings-flourishing" target="_blank" rel="noreferrer">著作を読む ↗</a></div>
        <div className="home-learning-numbers" aria-label="新しい教材の実際の件数">
          <a href="/learn?section=drill&lang=java">
            <strong>{counts.java ?? "—"}</strong><span>Javaの問題（コード記述を含む）</span>
          </a>
          <a href="/learn?section=drill&lang=rust">
            <strong>{counts.rust ?? "—"}</strong><span>Rustの問題（コード記述を含む）</span>
          </a>
          <a href="/learn?section=exams">
            <strong>{counts.exams ?? "—"}</strong><span>Java・Rustの試験・別集計</span>
          </a>
        </div>
        <div className="home-topics">
          <span>Java</span>
          <span>Rust</span>
          <span>TypeScript</span>
          <span>宇宙の模型</span>
        </div>
        <a className="home-source" href="/learn?section=source">
          <span aria-hidden="true">&lt;/&gt;</span> このサイトのコードを読む{" "}
          <span aria-hidden="true">→</span>
        </a>
      </div>
      <div
        className={`home-observatory ${paused || stopped || !active ? "astra-paused" : ""}`}
      >
        <div className="home-observatory-bar">
          <span>
            <i /> 太陽系の模型
          </span>
          <button
            aria-pressed={stopped}
            onClick={() => setStopped(!stopped)}
            aria-label={
              stopped ? "トップの模型を再生" : "トップの模型を一時停止"
            }
          >
            {stopped ? "▷ 再生" : "Ⅱ 停止"}
          </button>
        </div>
        <div className="home-solar">
          <SolarDiagram
            selected={selected}
            onSelect={(slug) => {
              setSelected(slug);
              setCopied(false);
            }}
            speed={0.5}
          />
          <span className="home-model-note">
            表示の大きさと速さは調整しています
          </span>
        </div>
        <div className="home-code-panel">
          <div className="home-code-tabs">
            <div role="group" aria-label="コードの表示言語">
              <button
                aria-pressed={language === "java"}
                onClick={() => {
                  setLanguage("java");
                  setCopied(false);
                }}
              >
                Java
              </button>
              <button
                aria-pressed={language === "rust"}
                onClick={() => {
                  setLanguage("rust");
                  setCopied(false);
                }}
              >
                Rust
              </button>
            </div>
            <select
              className="home-body-select"
              aria-label="トップで選ぶ天体"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setCopied(false);
              }}
            >
              {bodies
                .filter((b) => b.kind === "star" || b.kind === "planet")
                .map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
            </select>
            <button
              className="home-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "コピー済み" : "コピー"}
            </button>
          </div>
          <pre>
            <code>{code}</code>
          </pre>
          <div className="home-code-result">
            <span>出力の例</span>
            <output aria-live="polite">{body.name}</output>
            <a href="/art">模型を詳しく見る ↗</a>
          </div>
        </div>
      </div>
    </section>
  );
}
