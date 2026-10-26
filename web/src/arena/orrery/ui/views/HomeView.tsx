import { HeroCanvas } from '../components/HeroCanvas';
import { ALL_LESSONS, TOTAL_CHALLENGES, TRACK_LABEL } from '../../core/lessons';
import { LOOP_ORDER, PHASE_LABEL } from '../../core/learning/loop';
import { store } from '../../core/appStore';

export function HomeView() {
  const javaCount = ALL_LESSONS.filter((l) => l.track === 'java').length;
  const rustCount = ALL_LESSONS.filter((l) => l.track === 'rust').length;

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__art" aria-hidden="true">
          <HeroCanvas />
        </div>
        <div className="hero__inner">
          <p className="hero__eyebrow">ORRERY — LEARN BY BUILDING A 宇宙</p>
          <h1 id="hero-title">コードを書く。<br /><em>宇宙が組み替わる。</em></h1>
          <p className="hero__lead">
            Java と Rust を、予測 → 実行 → 誤差 → 修正で自力で理解する学習世界。<br />
            書いたコードは、目の前のシミュレーションを実際に組み替えます。
          </p>
          <div className="hero__cta">
            <button type="button" className="primary" onClick={() => store.gotoLesson(ALL_LESSONS[0]!.id)}>
              学習をはじめる <span aria-hidden="true">→</span>
            </button>
            <button type="button" onClick={() => store.navigate('lab')}>宇宙を動かす <span aria-hidden="true">↗</span></button>
          </div>
          <p className="hero__note">アカウント不要・API key 不要・すべてブラウザ内で動作します。</p>
        </div>
      </section>

      <section className="loop-rail" aria-labelledby="loop-title">
        <h2 id="loop-title" className="section-label">学習ループ</h2>
        <ol>
          {LOOP_ORDER.map((p, i) => (
            <li key={p}>
              <span className="loop-rail__num">{String(i + 1).padStart(2, '0')}</span>
              <span>{PHASE_LABEL[p]}</span>
            </li>
          ))}
        </ol>
        <p className="loop-rail__note">
          「答えを見て分かったつもり」を防ぐため、最初に<strong>予測</strong>を書かせます。
          予測と結果がズレたときだけ Error Lab が開き、その誤差が教材になります。
        </p>
      </section>

      <section className="home__tracks" aria-labelledby="tracks-title">
        <div className="section-head">
          <h2 id="tracks-title">学習の入口</h2>
          <p>支援を少しずつ減らします。理解済みなら前の段階を飛ばせます。</p>
        </div>
        <div className="home__track-grid">
          <article className="track-card">
            <span className="track-card__index">01</span>
            <h3>{TRACK_LABEL.java}</h3>
            <p>基本型と整数除算、配列の境界、class/継承/override、コレクションと例外。天体をクラスとして設計する。</p>
            <p className="track-card__meta">{javaCount} レッスン · 実行可能な Java サブセット</p>
            <button type="button" onClick={() => store.gotoLesson('java-arith')}>Java から始める →</button>
          </article>
          <article className="track-card">
            <span className="track-card__index">02</span>
            <h3>{TRACK_LABEL.rust}</h3>
            <p>所有権と move、可変借用、Option / Result / match、Vec と iterator。WASM カーネルへ届くコードを書く。</p>
            <p className="track-card__meta">{rustCount} レッスン · 教育用借用チェッカー付き</p>
            <button type="button" onClick={() => store.gotoLesson('rust-ownership')}>Rust から始める →</button>
          </article>
          <article className="track-card">
            <span className="track-card__index">03</span>
            <h3>統合</h3>
            <p>Java と Rust を一対一対応させない比較、Concept Galaxy、Error Lab、時間を空けた復習。</p>
            <p className="track-card__meta">全 {TOTAL_CHALLENGES} チャレンジ · 進捗は localStorage</p>
            <button type="button" onClick={() => store.navigate('galaxy')}>概念地図を見る →</button>
          </article>
        </div>
      </section>

      <section className="home__honesty" aria-labelledby="honesty-title">
        <h2 id="honesty-title" className="section-label">この教材が正直に言っていること</h2>
        <div className="home__honesty-grid">
          <div><h3>実行について</h3><p>ブラウザ内で動くのは Java / Rust の<strong>教育用サブセット・インタプリタ</strong>です。javac / JVM / rustc ではありません。Stream、lambda、record、sealed、trait、lifetime は実行せず、読解と予測で扱います。</p></div>
          <div><h3>科学について</h3><p>宇宙はソフトニング付き中心引力による<strong>教育用簡略モデル</strong>。実観測データでも一般相対論シミュレーションでもありません。渦巻銀河と降着円盤は可視化・アートです。</p></div>
          <div><h3>WASM について</h3><p>488 バイトの実 WASM モジュールが重力ステップを計算します。失敗時は TypeScript 参照実装へ自動フォールバックします。Rust ソースも同梱しています。</p></div>
          <div><h3>プライバシー</h3><p>アカウント・解析・外部 API はありません。進捗はブラウザの localStorage に保存され、JSON で取り出せます。</p></div>
        </div>
      </section>
    </div>
  );
}
