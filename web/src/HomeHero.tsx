import { useEffect, useRef, useState, type MouseEvent } from "react";
import HomeNebula from "./art/HomeNebula";
import QuestionInventory from "./QuestionInventory";
import stats from "./generated/learning-stats.json";
import { loadLast, loadProgress } from "./learning-v2/progress";
import { resumeStudyRound, roundHref, startStudyRound } from "./learning-v2/studyRound";
import "./home.css";
export default function HomeHero({ paused, onStartMotion, suspended, focusArtwork, navigate }: { navigate: (href: string) => void; paused: boolean; onStartMotion: () => void; suspended: boolean; focusArtwork: boolean }) {
  const [last] = useState(() => {
    try {
      return loadLast(localStorage);
    } catch {
      return null;
    }
  });
  const [roundResume] = useState(resumeStudyRound);
  const [starting, setStarting] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function startLearning(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    const active = resumeStudyRound();
    if (active) {
      navigate(active);
      return;
    }
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setStarting(true);
    const today = "/learn?section=today";
    try {
      const [{ loadStudyIndex, planStudy }, { dailyStudyFilter, shortSessionSize }] = await Promise.all([
        import("./learning-v2/studyPlanner"),
        import("./learning-v2/studySession"),
      ]);
      const index = await loadStudyIndex(controller.signal);
      if (controller.signal.aborted) return;
      const resumed = resumeStudyRound();
      if (resumed) {
        navigate(resumed);
        return;
      }
      const progress = loadProgress(localStorage);
      const filter = dailyStudyFilter("", localStorage);
      const ids = planStudy(index, progress.state, { ...filter, limit: shortSessionSize }).map(({ item }) => item.id);
      const round = progress.writable && startStudyRound(ids, filter);
      navigate(round ? roundHref(round) : today);
    } catch {
      if (!controller.signal.aborted) navigate(today);
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setStarting(false);
    }
  }
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-intro">
        <span className="home-eyebrow">
          <span /> 自分の手で学ぶ、プログラミング
        </span>
        <h1 id="home-title">
          <span>コードを書いて、</span>
          <span>仕組みをつかむ。</span>
        </h1>
        <p>
          予想する。動かす。理由を確かめる。
          <br />
          JavaとRustを、一問ずつ自分の力に。
        </p>
        <div className="home-actions">
          <a
            className="home-primary"
            href={roundResume ?? "/learn?section=today"}
            onClick={startLearning}
            aria-busy={starting || undefined}
          >
            {roundResume ? "学習の続きから" : starting ? "問題を選んでいます…" : "3問から始める"} <span aria-hidden="true">→</span>
          </a>
          <a className="home-secondary" href="/learn?section=catalog">
            問題を選ぶ <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="home-quick-links">
          <a href="/learn?section=journey">全{stats.unique.total.toLocaleString()}問を一本の道で →</a>
          <a href="/learn?section=today">今日の学習 →</a>
          <a href="/learn?section=topics">分野から学ぶ →</a>
          <a href="/learn?section=workflow">実務の流れ →</a>
          <a href="/learn?section=notebook">学習ノート →</a>
          {last && !roundResume && <a href={`/learn?section=drill&lang=${last.language}&q=${encodeURIComponent(last.id)}`}>最近の問題 →</a>}
          <a href="/learn?section=concepts">概念図 →</a>
          <a href="/learn?section=exams">試験 {stats.exams}本 →</a>
          <a href="/books">著作を読む →</a>
        </div>
        <QuestionInventory />
        <div className="home-topics">
          <span>Java</span>
          <span>Rust</span>
          <span>HTTP / DB</span>
          <span>自分でコードを書く</span>
        </div>
        <a className="home-source" href="/learn?section=source">
          <span aria-hidden="true">&lt;/&gt;</span> このサイトのコードを読む{" "}
          <span aria-hidden="true">→</span>
        </a>
      </div>
      <HomeNebula focusArtwork={focusArtwork} suspended={suspended} paused={paused} onStartMotion={onStartMotion} />
    </section>
  );
}
