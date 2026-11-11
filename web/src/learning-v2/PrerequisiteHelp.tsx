import { useEffect, useRef, useState } from "react";
import {
  learningReturn,
  prerequisiteQuestion,
  questionConcepts,
} from "./learningNavigation";
import type { Concept, Question } from "./types";
import "./question-tools.css";

export default function PrerequisiteHelp({
  question,
  concepts,
  onOpen,
}: {
  question: Question;
  concepts: Concept[];
  onOpen: () => void;
}) {
  const prerequisites = questionConcepts(question, concepts);
  const [selected, setSelected] = useState<Concept | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  const intro =
    selected && prerequisiteQuestion(selected, question.id, question.language);
  const back =
    learningReturn(new URLSearchParams(location.search).get("returnTo")) ??
    learningReturn(location.pathname + location.search);
  const link = intro
    ? "/learn?" +
      new URLSearchParams({
        section: "drill",
        lang: question.language,
        q: intro,
        ...(back ? { returnTo: back } : {}),
      })
    : null;
  return (
    <div className="question-prerequisites">
      <span>この問題の前提</span>
      {prerequisites.length ? (
        prerequisites.map((concept) => (
          <button
            type="button"
            key={concept.id}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              onOpen();
              setSelected(concept);
            }}
          >
            {concept.name} <span aria-hidden="true">↗</span>
          </button>
        ))
      ) : question.prerequisiteConceptIds.length ? (
        <a href="#zlv-concepts">概念の一覧で確かめる →</a>
      ) : (
        <em>ここから始められます</em>
      )}
      <dialog
        ref={dialog}
        className="prerequisite-dialog"
        aria-labelledby="prerequisite-title"
        onClose={() => {
          setSelected(null);
          trigger.current?.focus({ preventScroll: true });
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        {selected && (
          <>
            <header>
              <span>前提を確かめる</span>
              <button type="button" onClick={() => dialog.current?.close()}>
                問題に戻る ×
              </button>
            </header>
            <h3 id="prerequisite-title">{selected.name}</h3>
            <p>{selected.summary}</p>
            {typeof selected.minimalExample === "string" &&
              selected.minimalExample && (
                <pre>
                  <code>{selected.minimalExample}</code>
                </pre>
              )}
            <p className="prerequisite-note">
              この例を開いた後の予測は、手がかりを使った回答として記録します。
            </p>
            {link && <a href={link}>この前提の基本問題を1問試す →</a>}
            <button type="button" onClick={() => dialog.current?.close()}>
              今の問題を続ける
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
