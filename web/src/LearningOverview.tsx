import stats from "./generated/learning-stats.json";

export default function LearningOverview() {
  return (
    <section className="hub-content learning-overview">
      <div className="learning-summary">
        <div>
          <span className="eyebrow">JavaとRustを、自分で使える知識へ</span>
          <h2>
            <strong>{stats.total.toLocaleString()}</strong>
            問で、理解を確かめる。
          </h2>
          <p>
            まず出力を予測する。実行結果と比べて、違いを説明する。時間を空けてもう一度解く。
          </p>
        </div>
        <dl>
          <div>
            <dt>Java</dt>
            <dd>{stats.java.toLocaleString()}問</dd>
          </div>
          <div>
            <dt>Rust</dt>
            <dd>{stats.rust.toLocaleString()}問</dd>
          </div>
          <div>
            <dt>宇宙とコード</dt>
            <dd>{stats.experiments}実験</dd>
          </div>
        </dl>
      </div>
      <p className="hub-note">
        収録数は問題集{stats.questionBank.toLocaleString()}問と実行演習
        {stats.executionPractice}
        問の合計です。類題を含みます。実行演習では問題ごとに、ブラウザでの実行とコンパイラの検証記録を区別して表示します。
      </p>
      <div className="learning-paths">
        <a
          href="/learn?section=drill"
          className="learning-path learning-path-main"
        >
          <span>01 / 問題から学ぶ</span>
          <h3>{stats.questionBank.toLocaleString()}問の問題集</h3>
          <p>
            型・配列・オブジェクト指向・所有権。分野と難易度で選び、苦手な問題を復習できます。
          </p>
          <b>問題を選ぶ →</b>
        </a>
        <a href="/learn?section=verified" className="learning-path">
          <span>02 / 結果を確かめる</span>
          <h3>{stats.executionPractice}問の実行演習</h3>
          <p>
            JavaとRustの出力、コンパイルエラー、境界値を予測。理由を理解したら、答えを隠して再現します。
          </p>
          <b>Java・Rustを選ぶ →</b>
        </a>
        <a href="/learn?section=flow" className="learning-path">
          <span>03 / 処理をつなげる</span>
          <h3>ブラウザからDBまで</h3>
          <p>
            リクエストがJavaを通ってDBへ届き、応答として画面に戻るまでを、一段ずつ追います。
          </p>
          <b>処理の流れを見る →</b>
        </a>
      </div>
      <a href="/learn?section=orbit" className="orbit-course-entry">
        <div className="orbit-entry-art" aria-hidden="true">
          <i />
          <i />
          <i />
          <b />
        </div>
        <div>
          <span className="eyebrow">
            宇宙で確かめる・{stats.experiments}つの実験
          </span>
          <h3>コードを変えると、軌道が変わる。</h3>
          <p>
            配列・条件・多態性・所有権・Option・Result。短いコードを編集し、模型の変化と一緒に学びます。
          </p>
          <strong>実験を選ぶ →</strong>
        </div>
      </a>
      <div className="learning-utility-links">
        <a href="/learn?section=practice&mode=code">自由にコードを書く →</a>
        <a href="/learn?section=source">Eclipseからこのサイトを動かす →</a>
        <a href="/learn?section=references">日本語の公式資料を読む →</a>
      </div>
    </section>
  );
}
