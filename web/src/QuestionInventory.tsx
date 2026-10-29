import stats from "./generated/learning-stats.json";
import "./question-inventory.css";
export default function QuestionInventory() {
  const n = stats.unique,
    fmt = (x: number) => x.toLocaleString("ja-JP");
  return (
    <section className="question-inventory" aria-label="重複を除いた問題数">
      <p className="inventory-total">
        <a
          className="inventory-browse"
          href="/learn?section=catalog"
          aria-label={"重複を除いた全" + fmt(n.total) + "問を探す"}
        >
          <span>重複を除いて</span>
          <strong>
            {fmt(n.total)}
            <small>問</small>
          </strong>
          <span>ここで、試せます。</span>
        </a>
      </p>
      <div className="inventory-languages">
        <a href="/learn?section=catalog&lang=java">
          Java <b>{fmt(n.java)}</b>
        </a>
        <a href="/learn?section=catalog&lang=rust">
          Rust <b>{fmt(n.rust)}</b>
        </a>
        <a href="/learn?section=catalog&kind=code">
          うち記述 <b>{fmt(n.writing)}</b>
        </a>
      </div>
      <details className="inventory-detail">
        <summary>通常・補充・試験を含む、問題数の内訳</summary>
        <dl>
          <div>
            <dt>通常問題から</dt>
            <dd>{fmt(n.normal)}問</dd>
          </div>
          <div>
            <dt>補充問題の追加分</dt>
            <dd>{fmt(n.supplementalAdditional)}問</dd>
          </div>
          <div>
            <dt>試験の追加分</dt>
            <dd>{fmt(n.examAdditional)}問</dd>
          </div>
          <div>
            <dt>ブラウザで動く例などの追加分</dt>
            <dd>{fmt(n.legacyAdditional)}問</dd>
          </div>
        </dl>
        <p>
          記述問題は合計の内数です。{stats.exams}本の試験にある
          {fmt(n.examOccurrences)}
          設問も照合し、再掲は足していません。実験・制作課題は問題数に含めません。
        </p>
        <p>
          同じ元IDの再掲、同じ設問・コード・選択肢、同じコードと回答を使う予測問題をまとめています。
          {fmt(n.occurrences)}件の掲載から{fmt(n.removed)}
          件の重複を除いた集計です。
        </p>
        <p>
          <a
            href="https://github.com/oopdesc/0/blob/main/docs/QUESTION_COUNT.md"
            target="_blank"
            rel="noreferrer"
          >
            集計方法を見る ↗
          </a>
        </p>
      </details>
    </section>
  );
}
