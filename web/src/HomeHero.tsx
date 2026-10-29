import { useState } from "react";
import HomeNebula from "./art/HomeNebula";
import QuestionInventory from "./QuestionInventory";
import stats from "./generated/learning-stats.json";
import { loadLast } from "./learning-v2/progress";
import "./home.css";
export default function HomeHero({ paused }: { paused: boolean }) {
  const [last] = useState(() => {
    try {
      return loadLast(localStorage);
    } catch {
      return null;
    }
  });
  const resume = last
    ? `/learn?section=drill&lang=${last.language}&q=${encodeURIComponent(last.id)}`
    : "/learn?section=drill&lang=java&q=java%3Aq0001";
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
        <QuestionInventory />
        <div className="home-actions">
          <a
            className="home-primary"
            href="/learn?section=drill&lang=java&q=java%3Aq0001"
          >
            はじめての一問 <span aria-hidden="true">↗</span>
          </a>
          <a className="home-secondary" href="/learn?section=catalog">
            問題を選ぶ <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="home-quick-links">
          <a href={resume}>続きから →</a>
          <a href="/learn?section=today">今日の学習 →</a>
          <a href="/learn?section=concepts">概念図 →</a>
          <a href="/learn?section=exams">試験 {stats.exams}本 →</a>
          <a
            href="https://github.com/oopdesc/all-beings-flourishing"
            target="_blank"
            rel="noreferrer"
          >
            著作を読む ↗
          </a>
        </div>
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
      <HomeNebula paused={paused} />
    </section>
  );
}
