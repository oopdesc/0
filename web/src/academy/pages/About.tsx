import { Link } from '../lib/router';

export function AboutPage() {
  return (
    <div className="page page--read">
      <h1>作品と本</h1>
      <p className="lead">
        このサイトは、問題を解くことで言語の判断力を身につけるための教材です。読むだけの解説記事ではありません。
      </p>

      <section>
        <h2>本</h2>
        <p>
          著者の本『All Beings Flourishing』は CC BY-SA 4.0 で公開されています。ここでは学習内容に混ぜず、
          作品としてリンクだけ置きます。
        </p>
        <p>
          <a className="btn btn--ghost" href="https://github.com/oopdesc/all-beings-flourishing" rel="noopener noreferrer" target="_blank">
            All Beings Flourishing（GitHub）
          </a>
        </p>
        <p className="note">リンク先の内容は CC BY-SA 4.0。このサイトの教材本文とは別物です。</p>
      </section>

      <section>
        <h2>このサイトの作り</h2>
        <ul className="facts">
          <li>静的サイト。サーバ側の処理も関数も使わない（Functions 0）。</li>
          <li>Java の実行はブラウザ内エンジン。検証は OpenJDK 21 で実施。</li>
          <li>Rust のコンパイル結果は rustc 1.99.1 で実測したものを表示。</li>
          <li>宇宙ページは WebGPU → WebGL2 → 静止画の順に落ちる。</li>
          <li>外部のフォント・画像・動画・解析タグは読み込まない。</li>
        </ul>
      </section>

      <section>
        <h2>ライセンス</h2>
        <p>
          コードは MIT。第三者のコードに由来する部分は
          <Link to="/licenses" className="link">
            ライセンス
          </Link>
          にまとめています。
        </p>
      </section>
    </div>
  );
}
