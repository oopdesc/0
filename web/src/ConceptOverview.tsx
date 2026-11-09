import { lazy, Suspense, useState } from "react";
import ConceptMapViewport from "./ConceptMapViewport";
import { useDisplay } from "./DisplayPreferences";
import { ConceptGraph } from "./arena/orrery/ui/components/ConceptGraph";
import { ConceptPanel } from "./arena/orrery/ui/components/ConceptPanel";
import { CONCEPTS } from "./arena/orrery/core/concepts/graph";
import { store } from "./arena/orrery/core/appStore";
import { findChallenge } from "./arena/orrery/core/lessons";
import "./arena/orrery/styles/scoped.css";

const Pathway = lazy(() => import("./ConceptPathway"));
const Lab = lazy(() => import("./arena/orrery/App").then(module => ({ default: module.App })));

export default function ConceptOverview({ search }: { search: string }) {
  const [diagram, setDiagram] = useState<"pathway" | "compare">("pathway");
  const { theme } = useDisplay();
  const [selected, setSelected] = useState(CONCEPTS[0].id);
  const [exercise, setExercise] = useState(false);

  function openChallenge(id: string) {
    const found = findChallenge(id);
    if (!found) return;
    store.gotoLesson(found.lesson.id, found.index);
    setExercise(true);
  }

  return (
    <main className="hub-content">
      <p><a href="/learn?section=overview">学習の入口へ戻る →</a></p>
      <div className="concept-view-switch" role="group" aria-label="概念図の見方">
        <button type="button" aria-pressed={diagram === "pathway"} onClick={() => setDiagram("pathway")}>枝分かれで学ぶ</button>
        <button type="button" aria-pressed={diagram === "compare"} onClick={() => setDiagram("compare")}>JavaとRustを比べる</button>
      </div>
      {diagram === "pathway" ? (
        <Suspense fallback={<p>学びの地図を読み込んでいます…</p>}><Pathway routeSearch={search} /></Suspense>
      ) : (
        <div className="arena-orrery concept-map-compare" data-theme={theme}>
          {exercise ? (
            <>
              <button type="button" onClick={() => setExercise(false)}>← 概念図に戻る</button>
              <Suspense fallback={<p>演習を読み込んでいます…</p>}><Lab /></Suspense>
            </>
          ) : (
            <div className="galaxy-view">
              <header className="view-head">
                <p className="view-head__kicker">学ぶ前にも、復習にも</p>
                <h2>JavaとRustの概念図</h2>
                <p className="view-head__lead">点を選ぶと、その役割・前提・境界と関連する演習が開きます。JavaとRustの似た言葉も、違いを確かめながらつなげてください。</p>
              </header>
              <ConceptMapViewport label="JavaとRustの概念図">
                <div className="galaxy-view__grid">
                  <ConceptGraph selectedId={selected} onSelect={setSelected} scrollable />
                  <aside className="galaxy-view__detail" aria-label="概念の詳細">
                    <ConceptPanel conceptId={selected} onSelectConcept={setSelected} onOpenChallenge={openChallenge} />
                  </aside>
                </div>
              </ConceptMapViewport>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
