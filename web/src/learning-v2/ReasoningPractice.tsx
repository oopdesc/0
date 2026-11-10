import { useState } from "react";

export function ReasoningPractice({ explanation, steps, writing }: { explanation: string; steps: string[]; writing: boolean }) {
  const [visible, setVisible] = useState<number | null>(null);
  if (!steps.length) return <p>{explanation}</p>;
  const practicing = visible !== null;
  return <>
    {!practicing && <p>{explanation}</p>}
    <button type="button" onClick={() => setVisible(practicing ? null : 0)}>
      {practicing ? "理由をすべて表示する" : "理由を隠して言い直す"}
    </button>
    {practicing && <p>
      {writing
        ? "境界になる入力を一つ選び、どの条件を通り、何を返すかを説明してみましょう。"
        : "結果を決める行と、その時点の値や型を説明してみましょう。実行できない場合は、どこで何が起きるかを言ってみましょう。"}
    </p>}
    {(!practicing || visible > 0) && <ol>{steps.slice(0, visible ?? steps.length).map((step, i) => <li key={i}>{step}</li>)}</ol>}
    {practicing && visible < steps.length && <button type="button" onClick={() => setVisible(visible + 1)}>
      理由を一段だけ確認する（{visible} / {steps.length}）
    </button>}
  </>;
}
