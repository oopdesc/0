import { Link, useRouter } from "../lib/router";
import { PROBLEMS } from "../content";
import type { State } from "../state/store";
import { dueIds } from "../state/store";
import {
  familiesOf,
  progressOf,
  trackProgress,
  todayFive,
  PROGRESS_LABEL,
} from "../lib/learn";
import { PAIRS } from "../content/pairs";

export function Home({ state }: { state: State }) {
  const { navigate } = useRouter();
  const unseen = PROBLEMS.find((p) => !state.cards[p.id]);
  const due = dueIds(state).length;
  const java = trackProgress("java", state);
  const rust = trackProgress("rust", state);
  const five = todayFive(state);

  return (
    <div className="home">
      <section className="hero">
        <p className="hero__kicker">学習サイト / Java 21・Rust 1.99</p>
        <h1 className="hero__title">
          予測してから、
          <wbr />
          動かす。
        </h1>
        <p className="hero__lead">
          Java と Rust
          を、読んで理解した気にならずに身につける。まず自分の予測を書き、実際の結果と見比べ、
          ずれの理由に名前を付けて、1
          行のルールに直す。時間を空けて、もう一度思い出す。
        </p>
        <div className="hero__actions">
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => navigate(unseen ? `/p/${unseen.id}` : "/today")}
          >
            {unseen ? "今すぐ 1 問解く" : "今日の 5 問へ"}
          </button>
          <Link to="/today" className="btn btn--ghost btn--lg">
            今日の 5 問
          </Link>
          {due > 0 && (
            <Link to="/review" className="btn btn--ghost btn--lg">
              復習 {due} 問
            </Link>
          )}
        </div>
        <p className="hero__meta">
          {PROBLEMS.length} 問 /
          採点データと検証記録の整合を確認した問題を収録。登録不要、記録はこの端末だけ。
        </p>
      </section>

      <section className="tracks" aria-label="学習トラック">
        {(["java", "rust"] as const).map((lang) => {
          const t = lang === "java" ? java : rust;
          const fams = familiesOf(lang);
          return (
            <article key={lang} className={`trackcard trackcard--${lang}`}>
              <header className="trackcard__head">
                <h2>{lang === "java" ? "Java" : "Rust"}</h2>
                <p>
                  {lang === "java"
                    ? "21 (LTS) — オブジェクト指向と実務の流れ"
                    : "1.99 — 所有権と型で考える"}
                </p>
              </header>
              <div className="trackcard__bar" aria-hidden="true">
                <span style={{ width: `${pct(t)}%` }} />
              </div>
              <p className="trackcard__stat">
                {t.total} 概念のうち {t.total - t.counts.untouched} に着手 /
                定着 {t.counts.reproduced + t.counts.transfer}
              </p>
              <ul className="trackcard__fams">
                {fams.map((f) => {
                  const concepts = PROBLEMS.filter(
                    (p) => p.family === f.id,
                  ).flatMap((p) => p.concepts);
                  const touched = [...new Set(concepts)].filter(
                    (c) => progressOf(c, state) !== "untouched",
                  ).length;
                  return (
                    <li key={f.id}>
                      <Link
                        to={`/learn/${lang}/${f.id}`}
                        className="trackcard__fam"
                      >
                        <span>{f.name}</span>
                        <small>
                          {touched}/{new Set(concepts).size}
                        </small>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link to={`/learn/${lang}`} className="btn btn--ghost">
                {lang === "java" ? "Java を学ぶ" : "Rust を学ぶ"}
              </Link>
            </article>
          );
        })}
      </section>

      <section className="howto" aria-labelledby="howto-title">
        <h2 id="howto-title">この 9 ステップだけを繰り返す</h2>
        <ol className="howto__list">
          {[
            ["問題", "まずコードを読む。"],
            ["予測", "何が起きるかを先に書く。"],
            ["確定", "予測を固定する。ここまで結果は見えない。"],
            ["実行", "問題ごとの実行結果・検証記録を確認する。"],
            ["差分", "予測と実際を並べる。"],
            ["理由", "思い込みに名前を付ける。"],
            ["1 行", "次の判断に使えるルールにする。"],
            ["再挑戦", "同じ核心を別の問題ですぐ確認。"],
            ["想起", "1・3・7・14・30 日後に、答えを見ずに思い出す。"],
          ].map(([t, d], i) => (
            <li key={t}>
              <span className="howto__n">{i + 1}</span>
              <strong>{t}</strong>
              <span>{d}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="todaypeek" aria-labelledby="peek-title">
        <h2 id="peek-title">今日の 5 問（いま決まっている分）</h2>
        <ol className="todaypeek__list">
          {five.map((p, i) => (
            <li key={p.id}>
              <span className="todaypeek__n">{i + 1}</span>
              <Link to={`/p/${p.id}`}>{p.title}</Link>
              <span className={`chip chip--${p.lang}`}>{p.lang}</span>
              <span className="todaypeek__state">
                {state.cards[p.id]
                  ? PROGRESS_LABEL[progressOf(p.concepts[0], state)]
                  : "未学習"}
              </span>
            </li>
          ))}
        </ol>
        <Link to="/today" className="btn btn--primary">
          5 問をはじめる
        </Link>
      </section>

      <section className="pairteaser">
        <h2>同じ考え方を、2 つの言語で</h2>
        <p>
          Java と Rust
          で「同じことを書くとどうなるか」を並べた対応表があります。
          JavaとRustの付属検証記録を並べ、値の扱いや処理の違いを比べられます。
        </p>
        <Link to="/compare" className="btn btn--ghost">
          対応表を見る（{PAIRS.length} 組）
        </Link>
      </section>

      <section className="spaceteaser">
        <div className="spaceteaser__text">
          <h2>休むときは、宇宙へ</h2>
          <p>
            カーソルの軌跡から星が生まれ、近い星どうしが細い線で結ばれます。手を止めて、光の流れを眺めてみてください。
          </p>
          <Link to="/space" className="btn btn--ghost">
            宇宙を開く
          </Link>
        </div>
        <div className="spaceteaser__art" aria-hidden="true" />
      </section>
    </div>
  );
}

function pct(t: { total: number; counts: Record<string, number> }): number {
  const done = t.total - t.counts.untouched;
  return Math.round((done / Math.max(1, t.total)) * 100);
}
