import { firstLineDifference } from "./comparison";
import type { Question } from "./types";

export function PredictionReview({
  question,
  selected,
  output,
}: {
  question: Question;
  selected: string[];
  output: string;
}) {
  const { answer } = question;
  if (answer.mode === "choice" || answer.mode === "multichoice") {
    const incorrect = selected.filter(id => !answer.correctOptionIds.includes(id));
    const missed = answer.correctOptionIds.filter(id => !selected.includes(id));
    const option = (id: string) => answer.options.find(entry => entry.id === id)?.text ?? id;
    return (
      <div className="zlv-write-note">
        <strong>あなたの回答で見直すところ</strong>
        {incorrect.length > 0 && (
          <ul>{incorrect.map(id => {
            const why = question.solution.wrongReasons.find(reason => reason.optionId === id)?.reason;
            return <li key={id}><b>{option(id)}</b>{why && <p>{why}</p>}</li>;
          })}</ul>
        )}
        {missed.length > 0 && <p>選ばなかった正解：{missed.map(option).join("、")}</p>}
      </div>
    );
  }
  if ((answer.mode === "output" || answer.mode === "trace") && answer.comparison === "exact-lines") {
    const difference = firstLineDifference(output, answer.expectedOutput);
    if (!difference) return null;
    const lineText = (value: string | undefined) => value === undefined ? "（行なし）" : JSON.stringify(value);
    return (
      <div className="zlv-write-note">
        <strong>最初に異なるのは {difference.line} 行目</strong>
        <p>あなたの出力</p>
        <pre>{lineText(difference.actual)}</pre>
        <p>期待される出力</p>
        <pre>{lineText(difference.expected)}</pre>
      </div>
    );
  }
  return null;
}
