import { useEffect, useState } from "react";
import "./question-tools.css";

const key = "0.learning-v2.reading.v1";
const focusKey = "0.learning-v2.focus.v1";
function readOptions() {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return { large: value?.large === true, wrap: value?.wrap === true };
  } catch {
    return { large: false, wrap: false };
  }
}
export default function QuestionTools() {
  const [focused, setFocused] = useState(() => {
    try {
      return sessionStorage.getItem(focusKey) === "1";
    } catch {
      return false;
    }
  });
  const [options, setOptions] = useState(readOptions);
  useEffect(() => {
    document.documentElement.dataset.questionText = options.large
      ? "large"
      : "normal";
    document.documentElement.dataset.questionWrap = String(options.wrap);
    try {
      localStorage.setItem(key, JSON.stringify(options));
    } catch {
      /* Reading still works without persistence. */
    }
    return () => {
      delete document.documentElement.dataset.questionText;
      delete document.documentElement.dataset.questionWrap;
    };
  }, [options]);
  useEffect(() => {
    try {
      sessionStorage.setItem(focusKey, focused ? "1" : "0");
    } catch {
      /* Focus is still available in this view. */
    }
    if (!focused) return;
    document.documentElement.dataset.questionFocus = "true";
    const exit = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]"))
        setFocused(false);
    };
    addEventListener("keydown", exit);
    return () => {
      delete document.documentElement.dataset.questionFocus;
      removeEventListener("keydown", exit);
    };
  }, [focused]);
  return (
    <div className="question-tools" aria-label="問題の表示">
      <button
        type="button"
        aria-pressed={focused}
        onClick={() => setFocused((value) => !value)}
      >
        {focused ? "通常の表示へ戻る" : "集中表示"}
      </button>
      <details>
        <summary>文字・コードの表示</summary>
        <div>
          <label>
            <input
              type="checkbox"
              checked={options.large}
              onChange={(event) =>
                setOptions({ ...options, large: event.target.checked })
              }
            />
            文字を大きく
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.wrap}
              onChange={(event) =>
                setOptions({ ...options, wrap: event.target.checked })
              }
            />
            コードを折り返す
          </label>
        </div>
      </details>
      {focused && <small>Escでも通常表示に戻れます</small>}
    </div>
  );
}
