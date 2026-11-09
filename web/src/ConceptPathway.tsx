import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ConceptMapViewport, { MAP_ZOOM_LEVELS } from "./ConceptMapViewport";
import {
  FAMILY_NAMES,
  PATHWAY_CONCEPTS,
  layoutPathway,
  linkedPackQuestions,
  readPathwayLocation,
  relatedPath,
} from "./learning-v2/conceptPathway";
import { loadConcepts, loadManifest } from "./learning-v2/loader";
import type { Concept, Lang, Manifest } from "./learning-v2/types";

export default function ConceptPathway({ routeSearch }: { routeSearch: string }) {
  const { lang, conceptId } = readPathwayLocation(routeSearch);
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("all");
  const [focus, setFocus] = useState(false);
  const [zoomMode, setZoomMode] = useState<number | "fit">(1);
  const [chartWidth, setChartWidth] = useState(0);
  const [pack, setPack] = useState<{ manifest: Manifest; concepts: Concept[] } | null>(null);
  const [error, setError] = useState(false);
  const chart = useRef<HTMLDivElement>(null);
  const pan = useRef({ left: 0, top: 0 });
  const centerNext = useRef<string | null>(conceptId);
  const nodes = useMemo(() => PATHWAY_CONCEPTS.filter(node => node.lang === lang), [lang]);
  const current = nodes.find(node => node.id === conceptId) ?? nodes[0];
  const ancestors = useMemo(() => relatedPath(current.id), [current.id]);
  const children = useMemo(() => nodes.filter(node => node.prereqs.includes(current.id)), [nodes, current.id]);
  const families = [...new Set(nodes.map(node => node.family))];
  const languageName = lang === "java" ? "Java" : "Rust";
  const visible = useMemo(() => {
    if (focus) return nodes.filter(node => ancestors.has(node.id) || children.includes(node));
    const query = search.trim().toLocaleLowerCase();
    const matches = nodes.filter(node =>
      (family === "all" || node.family === family) &&
      (!query || [node.name, node.rule, node.summary].join(" ").toLocaleLowerCase().includes(query)),
    );
    // Include the prerequisites that give each search result context.
    const ids = new Set(matches.flatMap(node => [...relatedPath(node.id)]));
    return nodes.filter(node => ids.has(node.id));
  }, [nodes, ancestors, children, focus, search, family]);
  const layout = useMemo(() => layoutPathway(visible, lang), [visible, lang]);
  const fitZoom = chartWidth > 0 ? Math.min(1, chartWidth / layout.width) : 1;
  const zoom = zoomMode === "fit" ? fitZoom : zoomMode;
  const linked = pack ? linkedPackQuestions(current, pack.concepts, pack.manifest) : [];

  useLayoutEffect(() => {
    const view = chart.current;
    if (!view) return;
    const measure = () => setChartWidth(view.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(view);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setPack(null);
    setError(false);
    loadManifest(lang, controller.signal)
      .then(async manifest => ({ manifest, concepts: await loadConcepts(manifest, controller.signal) }))
      .then(result => { if (!controller.signal.aborted) setPack(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [lang]);

  const restoreViewport = useCallback(() => chart.current?.scrollTo(pan.current), []);
  function centerOn(id: string) {
    const view = chart.current;
    const point = layout.positions.get(id);
    if (!view || !point) return;
    view.scrollTo({
      left: (point.x + 79) * zoom - view.clientWidth / 2,
      top: point.y * zoom - view.clientHeight / 2,
    });
  }
  useLayoutEffect(() => {
    restoreViewport();
    if (centerNext.current === current.id && layout.positions.has(current.id)) {
      centerNext.current = null;
      centerOn(current.id);
    }
  }, [current.id, layout, zoom, restoreViewport]);

  function updateLocation(language: Lang, id: string) {
    const url = new URL(location.href);
    url.searchParams.set("mapLang", language);
    url.searchParams.set("concept", id);
    history.replaceState(history.state, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  }
  function choose(id: string, reveal = false) {
    if (reveal || focus) {
      if (layout.positions.has(id) && (!focus || id === current.id)) {
        centerOn(id);
      } else {
        centerNext.current = id;
        if (!focus) {
          setFamily("all");
          setSearch("");
        }
      }
    }
    updateLocation(lang, id);
  }
  function changeLanguage(next: Lang) {
    if (next === lang) return;
    const id = readPathwayLocation("?mapLang=" + next).conceptId;
    setFamily("all");
    setSearch("");
    setFocus(false);
    centerNext.current = id;
    updateLocation(next, id);
  }
  function changeZoom(mode: number | "fit") {
    const next = mode === "fit" ? fitZoom : mode;
    const view = chart.current;
    if (view) {
      const centerX = view.clientWidth / 2;
      const centerY = view.clientHeight / 2;
      const scale = next / zoom;
      pan.current = {
        left: (view.scrollLeft + centerX) * scale - centerX,
        top: (view.scrollTop + centerY) * scale - centerY,
      };
    }
    setZoomMode(mode);
  }

  return (
    <section className="concept-pathway" aria-labelledby="pathway-title">
      <header>
        <span className="pathway-eyebrow">全体を見渡して、今いる場所を確かめる</span>
        <h2 id="pathway-title">枝分かれでたどる、学びの地図</h2>
        <p>JavaとRustの概念を、前提から次の一歩へたどれます。点を選ぶと「先に知ること」と「次につながること」がわかります。</p>
        <p className="pathway-note">矢印は前提から応用へ進む学習順序を表します。継承や型の派生とは別の関係です。順番を飛ばしても学べます。</p>
      </header>
      <ConceptMapViewport label="枝分かれでたどる、学びの地図" restoreViewport={restoreViewport}>
        <div className="pathway-tools">
          <div role="group" aria-label="概念図の言語">
            {(["java", "rust"] as const).map(language => (
              <button key={language} type="button" aria-pressed={lang === language} onClick={() => changeLanguage(language)}>
                {language === "java" ? "Java" : "Rust"} <small>{PATHWAY_CONCEPTS.filter(node => node.lang === language).length}概念</small>
              </button>
            ))}
          </div>
          <label>
            分野
            <select value={family} onChange={event => { setFamily(event.target.value); setFocus(false); }}>
              <option value="all">全体を見渡す</option>
              {families.map(name => <option key={name} value={name}>{FAMILY_NAMES[name] ?? name}</option>)}
            </select>
          </label>
          <label>
            概念を探す
            <input type="search" value={search} maxLength={100} placeholder="所有権、参照、型…"
              onChange={event => { setSearch(event.target.value); setFocus(false); }} />
          </label>
        </div>
        <div className="pathway-workspace">
          <div className="pathway-chart-area">
            <div className="pathway-chart-tools">
              <span role="status">{visible.length}概念を表示 · 左から右へ</span>
              <label>
                <input type="checkbox" checked={focus} onChange={event => {
                  centerNext.current = current.id;
                  setFocus(event.target.checked);
                }} />
                選んだ概念の道筋だけ
              </label>
              <label>
                図の大きさ
                <select aria-label="概念図の表示倍率" value={zoomMode} onChange={event => changeZoom(event.target.value === "fit" ? "fit" : Number(event.target.value))}>
                  <option value="fit">自動（画面幅）</option>
                  {MAP_ZOOM_LEVELS.map(level => <option key={level} value={level}>{level * 100}%</option>)}
                </select>
              </label>
              <button type="button" onClick={() => changeZoom("fit")} disabled={visible.length === 0}>
                幅に合わせる
              </button>
              <button type="button" onClick={() => {
                if (zoomMode === "fit") {
                  centerNext.current = current.id;
                  changeZoom(1);
                } else {
                  centerOn(current.id);
                }
              }} disabled={!layout.positions.has(current.id)}>
                選んだ概念へ
              </button>
            </div>
            <div ref={chart} className="pathway-scroll" tabIndex={0} role="region"
              aria-label="横と縦にスクロールできる枝分かれ図"
              onScroll={event => {
                const { scrollLeft, scrollTop } = event.currentTarget;
                pan.current = { left: scrollLeft, top: scrollTop };
              }}>
              {visible.length === 0 ? (
                <p className="pathway-empty">一致する概念がありません。検索語や分野を変えてください。</p>
              ) : (
                <svg role="group" aria-label={languageName + "の学習順序。下の概念一覧でも選べます。"}
                  viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width * zoom} height={layout.height * zoom}>
                  <defs>
                    <marker id={`pathway-arrow-${lang}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M0 0L10 5L0 10z" fill="currentColor" />
                    </marker>
                  </defs>
                  {visible.flatMap(node => node.prereqs.map(parent => {
                    const start = layout.positions.get(parent);
                    const end = layout.positions.get(node.id);
                    if (!start || !end) return null;
                    const active = (ancestors.has(node.id) && ancestors.has(parent)) || parent === current.id;
                    return (
                      <path key={parent + "-" + node.id} className={active ? "pathway-edge is-active" : "pathway-edge"}
                        d={`M${start.x + 158},${start.y} C${start.x + 178},${start.y} ${end.x - 20},${end.y} ${end.x},${end.y}`}
                        markerEnd={`url(#pathway-arrow-${lang})`} />
                    );
                  }))}
                  {visible.map(node => {
                    const position = layout.positions.get(node.id)!;
                    const selected = node.id === current.id;
                    return (
                      <g key={node.id} transform={`translate(${position.x},${position.y})`}
                        role="button" tabIndex={0} aria-label={`概念を選択：${node.name}`} aria-pressed={selected}
                        className={`pathway-node ${selected ? "is-selected" : ancestors.has(node.id) ? "is-prerequisite" : ""}`}
                        onClick={() => choose(node.id)}
                        onKeyDown={event => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            choose(node.id);
                          }
                        }}>
                        <rect x={0} y={-18} width={158} height={36} rx={9} />
                        <text x={10} y={4}>{node.name.length > 12 ? node.name.slice(0, 12) + "…" : node.name}</text>
                        <title>{node.name + "：" + node.rule}</title>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
            <p className="pathway-note">図は上下・左右にスクロールできます。色の濃い点が選択中で、太い矢印がその前後のつながりです。</p>
            <details className="pathway-list">
              <summary>文字の一覧から選ぶ（{nodes.length}概念）</summary>
              <div>
                {nodes.map(node => (
                  <button key={node.id} type="button" aria-pressed={node.id === current.id} onClick={() => choose(node.id, true)}>
                    {node.name}
                  </button>
                ))}
              </div>
            </details>
          </div>
          <aside className="pathway-detail" aria-label="選んだ概念の説明">
            <span>{languageName} / {FAMILY_NAMES[current.family] ?? current.family}</span>
            <h3>{current.name}</h3>
            <strong>{current.rule}</strong>
            <p>{current.summary}</p>
            <h4>先に知っておくと役立つこと</h4>
            {current.prereqs.length ? (
              <ul>
                {current.prereqs.map(id => {
                  const node = nodes.find(item => item.id === id);
                  return node && <li key={id}><button type="button" onClick={() => choose(id, true)}>{node.name} ←</button></li>;
                })}
              </ul>
            ) : <p>この図では、ここを出発点にできます。</p>}
            <h4>次につながること</h4>
            {children.length ? (
              <ul>
                {children.map(node => (
                  <li key={node.id}><button type="button" onClick={() => choose(node.id, true)}>{node.name} →</button></li>
                ))}
              </ul>
            ) : <p>関連問題を解き、理解を自分の言葉で確かめましょう。</p>}
            {current.contrast && <details><summary>もう一方の言語と比べる</summary><p>{current.contrast}</p></details>}
            <div className="pathway-practice">
              <h4>この概念を使って解く</h4>
              {linked.length ? (
                <>
                  <p>新しい教材に関連問題が{linked.length}問あります。</p>
                  <div>
                    {linked.slice(0, 4).map((id, index) => (
                      <a key={id} href={`/learn?section=drill&lang=${lang}&q=${encodeURIComponent(id)}`}>関連問題{index + 1}を開く →</a>
                    ))}
                  </div>
                </>
              ) : <p>{error ? "新しい教材の索引を読み込めませんでした。" : pack ? "新しい教材に対応する問題は未収録です。" : "問題の索引を確認しています…"}</p>}
              <a href={`/learn?section=supplemental#/learn/${lang}/${current.id}`}>補充問題でこの概念を学ぶ →</a>
            </div>
            <p className="pathway-note">
              仕様を調べる{" "}
              <a target="_blank" rel="noreferrer" href={lang === "java" ? "https://docs.oracle.com/javase/jp/21/docs/api/index.html" : "https://doc.rust-jp.rs/book-ja/"}>
                {lang === "java" ? "Java公式・日本語API" : "Rust入門書・日本語訳"} ↗
              </a>
            </p>
          </aside>
        </div>
      </ConceptMapViewport>
      <p className="pathway-note"><a href="/learn?section=supplemental#/map">以前の全体マップを開く →</a></p>
    </section>
  );
}
