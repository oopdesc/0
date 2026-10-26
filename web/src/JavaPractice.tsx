import { useEffect, useState } from "react";
import { loadJavaArt, type JavaArt } from "./java-model";
const labs = [
  {
    id: "clamp",
    title: "整数と範囲の判定",
    input: "101",
    hint: "101、-1、1.5、2147483648、１２を比べてください。",
    question: "0〜100に収める処理です。この入力は何になるでしょうか。",
    code: "// 十進数字を半角へ揃え、Integer.parseIntで変換する。\nint value = parseInteger(input);\nreturn Math.max(0, Math.min(100, value));",
  },
  {
    id: "filter",
    title: "配列を条件で絞る",
    input: " JAVA ",
    hint: "java、rust、空欄、全角のＪＡＶＡを試してください。",
    question:
      "trimと小文字化の後に部分一致で絞ります。どの項目が残るでしょうか。",
    code: "String query = input.trim().toLowerCase(Locale.ROOT);\nfor (String item : source) {\n    if (item.toLowerCase(Locale.ROOT).contains(query)) {\n        // 結果へ追加する\n    }\n}",
  },
  {
    id: "copy",
    title: "元の配列を変えずに並べ替える",
    input: "3,1,2",
    hint: "カンマ区切りの整数を12個以内で入力できます。",
    question: "並べ替えの後、元の配列にも変化があるでしょうか。",
    code: "int[] sorted = Arrays.copyOf(original, original.length);\nArrays.sort(sorted);\n// originalとsortedをそれぞれ表示する。",
  },
  {
    id: "json",
    title: "文字列とJSONの表現",
    input: 'Hello "Java"',
    hint: "引用符、改行、バックスラッシュを入れてください。",
    question:
      "文字列の中に引用符や改行があると、JSONではどう書き出すでしょうか。",
    code: "if (c == '\"' || c == '\\\\') {\n    out.append('\\\\').append(c);\n}\n// 改行などの制御文字もエスケープする。",
  },
] as const;
export default function JavaPractice() {
  const [model, setModel] = useState<JavaArt | null>(null),
    [active, setActive] = useState(0),
    [input, setInput] = useState<string>(labs[0].input),
    [prediction, setPrediction] = useState(""),
    [explanation, setExplanation] = useState(""),
    [result, setResult] = useState<{
      ok: boolean;
      result: string;
      explanation: string;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    loadJavaArt()
      .then((m) => {
        if (live) setModel(m);
      })
      .catch(() => {
        if (live)
          setError("Java演習を読み込めませんでした。再読み込みしてください。");
      });
    return () => {
      live = false;
    };
  }, []);
  const lab = labs[active];
  function choose(n: number) {
    setActive(n);
    setInput(labs[n].input);
    setPrediction("");
    setExplanation("");
    setResult(null);
  }
  function run() {
    if (!model) return;
    try {
      setResult(JSON.parse(model.run(lab.id, input)));
    } catch {
      setError(
        "実行結果を読み取れませんでした。入力を変えて再試行してください。",
      );
    }
  }
  return (
    <section className="java-lab" aria-labelledby="java-lab-title">
      <div className="lab-intro">
        <span className="eyebrow">Java / ブラウザで実行する</span>
        <h2 id="java-lab-title">まず、ここで動かしてみる</h2>
        <p>
          Javaの処理をこのブラウザで実行します。インストールは不要です。入力や予想はサーバーへ送信しません。
        </p>
      </div>
      <div className="lab-tabs" aria-label="Java演習を選ぶ">
        {labs.map((l, i) => (
          <button
            key={l.id}
            onClick={() => choose(i)}
            aria-pressed={active === i}
          >
            {i + 1}. {l.title}
          </button>
        ))}
      </div>
      <div className="lab-work">
        <div>
          <h3>{lab.title}</h3>
          <pre tabIndex={0}>
            <code>{lab.code}</code>
          </pre>
          <p>{lab.question}</p>
          <label>
            入力
            <textarea
              aria-label="Java演習の入力"
              maxLength={160}
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <small>{lab.hint}</small>
        </div>
        <div className="lab-cycle">
          <label>
            1. 実行前の予想
            <textarea
              aria-label="実行前の予想"
              placeholder="結果と、その理由を短く書いてください。"
              maxLength={500}
              rows={3}
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={!model || !prediction.trim()}
            onClick={run}
          >
            2. Javaで実行する ▶
          </button>
          {result && (
            <div
              className={`lab-result ${result.ok ? "" : "lab-error"}`}
              role="status"
            >
              <strong>
                {result.ok ? "実行結果" : "入力を確認してください"}
              </strong>
              <pre>{result.result}</pre>
              <p>{result.explanation}</p>
            </div>
          )}
          {result && (
            <label>
              3. 結果を自分の言葉で説明する
              <textarea
                aria-label="結果の説明"
                placeholder="予想と同じだった点、違った点、次に変えて試す入力。"
                maxLength={1000}
                rows={4}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </label>
          )}
          <p className="caption">
            自由なJavaコードの実行環境ではありません。表示している4つの処理を、TeaVMでブラウザ用に変換して実行しています。完全なソースはEclipseで編集・デバッグできます。
          </p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
