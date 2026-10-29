import { useState } from "react";
const checks = [
  {
    id: "view",
    title: "横から見ると、何が変わる？",
    prompt:
      "正面と横の視点を比べると、薄い円盤に見えます。この模型では何が変わったのでしょう。",
    options: [
      "星の配置が、視点に合わせて平らになった。",
      "カメラの位置が変わり、同じ配置が重なって見えた。",
    ],
    answer: 1,
    reason:
      "視点ボタンはカメラだけを動かします。星の三次元座標を潰しているわけではありません。正面・横・斜めを行き来し、同じ構造の見え方を比べてみてください。",
  },
  {
    id: "seed",
    title: "同じ種から、同じ配置をつくれる？",
    prompt:
      "同じ実装で「星の配置の種」と個数を同じにして生成します。星の初期配置はどうなるでしょう。",
    options: ["同じ初期配置を再現できる。", "毎回必ず違う配置になる。"],
    answer: 0,
    reason:
      "Rustの生成関数は、同じ入力から同じ座標列を作ります。ただし、動いた時間や視点まで同じとは限らないため、画面の写真が必ず一致するという意味ではありません。再現性と見た目を分けて考えます。",
  },
  {
    id: "light",
    title: "明るさと、星の数は同じもの？",
    prompt: "「明るさ」だけを上げます。星の配置や個数も増えるでしょうか。",
    options: [
      "明るい点が増えて見えたら、生成した個数も増えている。",
      "描画の光が変わるだけで、生成した個数は変わらない。",
    ],
    answer: 1,
    reason:
      "明るさはシェーダーへ渡す値です。個数は描画の細かさ、配置は乱数の種で決まります。どの入力がどの処理を変えるのか、一度に一つずつ動かして確かめると追いやすくなります。",
  },
] as const;
export default function ObservationGuide({
  onFront,
  onSide,
  available,
}: {
  onFront: () => void;
  onSide: () => void;
  available: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  return (
    <section
      className="observation-guide"
      aria-labelledby="observation-guide-title"
    >
      <header>
        <div>
          <span className="eyebrow">眺める、その先へ</span>
          <h2 id="observation-guide-title">予測してから、動かしてみる。</h2>
        </div>
        <p>
          正解を急がず、ひとつだけ変えて比べる。
          <br />
          この三つは、模型の仕組みを確かめる小さな問いです。
        </p>
      </header>
      <div className="observation-steps">
        {checks.map((q, i) => (
          <article key={q.id}>
            <span className="observation-step">0{i + 1}</span>
            <h3>{q.title}</h3>
            <p>{q.prompt}</p>
            {i === 0 && (
              <div className="observation-presets">
                <button disabled={!available} onClick={onFront}>
                  正面を試す
                </button>
                <button disabled={!available} onClick={onSide}>
                  横を試す
                </button>
              </div>
            )}
            <fieldset>
              <legend className="sr-only">{q.title}</legend>
              {q.options.map((text, j) => (
                <button
                  key={j}
                  type="button"
                  aria-pressed={answers[q.id] === j}
                  onClick={() => setAnswers((old) => ({ ...old, [q.id]: j }))}
                >
                  {text}
                </button>
              ))}
            </fieldset>
            {answers[q.id] !== undefined && (
              <div className="observation-feedback" role="status">
                <strong>
                  {answers[q.id] === q.answer
                    ? "その見方で確かめられます。"
                    : "実際の操作と比べてみましょう。"}
                </strong>
                <p>{q.reason}</p>
              </div>
            )}
          </article>
        ))}
      </div>
      <footer>
        <p>
          これはこのサイトの描画モデルについての確認です。天体物理の実測や重力計算とは区別しています。
        </p>
        <a href="/learn?section=concepts&lang=rust">Rustの概念図へ →</a>
        <a href="/learn?section=flow&lang=java">Javaから画面までの流れへ →</a>
      </footer>
    </section>
  );
}
