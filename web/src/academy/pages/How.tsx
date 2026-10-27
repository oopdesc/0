import { Link } from '../lib/router';
import { PROBLEMS } from '../content';
import { CONCEPTS } from '../content/concepts';
import { CodeBlock } from '../components/CodeBlock';

const EXCERPT_VERIFY = `for (const p of PROBLEMS) {
  if (p.lang !== 'java' || !p.code) continue;
  const fixture = runJavaProblem(p.code, p.harness ?? 'body');
  // 教材の expect と、実際の JDK の結果を突き合わせる
  failures.push(...checkExpectation(p, fixture));
}
if (failures.length) process.exit(1);   // 合わなければビルドしない`;

const EXCERPT_RUN = `// ブラウザ内エンジン（サブセット）。実行のたびに全ステップを記録する。
const trace = runJava(code, { mode: 'body', trace: true });
trace.output;   // 実際の出力
trace.steps;    // 行・変数・呼び出しスタックの推移`;

export function HowPage() {
  const java = PROBLEMS.filter((p) => p.lang === 'java');
  const rust = PROBLEMS.filter((p) => p.lang === 'rust');
  const runnable = PROBLEMS.filter((p) => p.verified).length;

  return (
    <div className="page page--read">
      <h1>このサイトの仕組み</h1>
      <p className="lead">
        教材はコードで持ち、実行結果は実物のツールで確かめています。このページはその中身の説明で、
        TypeScript を「もう 1 つの学習トラック」にはしていません。読むための資料です。
      </p>

      <section>
        <h2>1. 教材はデータで、画面ではない</h2>
        <p>
          問題は <code>src/content/</code> の {PROBLEMS.length} 個のオブジェクト（{CONCEPTS.length} 概念）として並んでいます。
          画面はそれを読むだけなので、同じデータから学習・復習・進捗・検証がすべて作られます。
        </p>
        <ul className="facts">
          <li>Java {java.length} 問 / Rust {rust.length} 問</li>
          <li>検証済みの実測結果を持つ問題: {runnable} 問</li>
          <li>1 問につき 4 択（誤答の原因ラベル付き）・3 段階ヒント・誤解の名前・1 行ルール</li>
        </ul>
      </section>

      <section>
        <h2>2. Java は「本物」で検証し、ブラウザでは同じ意味で実行する</h2>
        <p>
          すべての Java 問題は、ビルド時に OpenJDK 21 でコンパイル・実行し、教材が主張する出力・例外・コンパイルエラーと
          一致しなければビルドが失敗します。ブラウザ内の実行エンジンは、その同じ問題で同じ出力になることをテストで確認しています。
        </p>
        <CodeBlock code={EXCERPT_VERIFY} lang="java" label="tools/verify-java.ts（抜粋）" dense />
        <p>
          ブラウザ内エンジンは Java の全文法ではありません。対応しているのは、この教材で扱う範囲（クラス・継承・interface・
          record・enum・コレクション・Stream・例外・finally）です。対応していない API は「未対応」と明示して止まります。
          対応範囲を偽って「何でも動く」とは言いません。
        </p>
        <CodeBlock code={EXCERPT_RUN} lang="java" label="src/engine/java（抜粋）" dense />
      </section>

      <section>
        <h2>3. Rust は実コンパイラの結果だけを出す</h2>
        <p>
          Rust のコンパイル可否・エラーコード（E0382 など）・出力は、すべて実際の rustc 1.99.1 で確認した結果です。
          ブラウザで Rust をコンパイルすることはできないので、その場で「コンパイルしたふり」はしません。
          問題画面に表示されるのは、ビルド時に実測して保存した結果です。
        </p>
      </section>

      <section>
        <h2>4. 宇宙ページは別チャンク</h2>
        <p>
          <Link to="/space" className="link">
            宇宙
          </Link>{' '}
          は WebGPU の計算シェーダで粒子を動かし、近傍の星を線で結びます。WebGPU が使えない環境では WebGL2 に落ち、
          それも無ければ静止した手続き生成の星空になります。学習ページを開いただけでは、このエンジンは読み込まれません。
          粒子の初期配置とリンク判定の一部は、Rust を wasm32 にコンパイルしたモジュールが計算しています。
        </p>
      </section>

      <section>
        <h2>5. 記録はこの端末だけ</h2>
        <p>
          学習記録は localStorage に保存し、設定画面から JSON で書き出し・読み込みができます。アカウントもサーバもありません。
          保存に失敗する環境（プライベートモードなど）でも、学習そのものは続けられます。
        </p>
      </section>

      <section>
        <h2>6. 読むためのソース</h2>
        <p>このサイト自体のコードは次の場所にあります。学習の対象ではなく、仕組みを知りたい人向けです。</p>
        <ul className="facts">
          <li>
            <code>src/engine/java/</code> — 字句解析・構文解析・型チェック・実行（すべて TypeScript）
          </li>
          <li>
            <code>src/engine/rust/</code> — Rust のサンプルを wasm へビルドする手順と境界の型
          </li>
          <li>
            <code>src/space/</code> — WGSL と WebGL2 の 2 バックエンド
          </li>
          <li>
            <code>tools/verify-java.ts</code>, <code>tools/verify-rust.ts</code> — 実ツールとの照合
          </li>
        </ul>
      </section>
    </div>
  );
}
