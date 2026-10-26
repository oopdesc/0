import { useState } from 'react';
import { ConceptGraph } from '../components/ConceptGraph';
import { ConceptPanel } from '../components/ConceptPanel';
import { CONCEPTS } from '../../core/concepts/graph';
import { store } from '../../core/appStore';
import { findChallenge } from '../../core/lessons';

export function GalaxyView() {
  const [selectedId, setSelectedId] = useState(CONCEPTS[0]!.id);

  return (
    <div className="galaxy-view">
      <header className="view-head">
        <p className="view-head__kicker">概念のつながり</p>
        <h1>概念は、点ではなく関係として理解する。</h1>
        <p className="view-head__lead">
          線を選ぶと関係の理由が読めます。Java と Rust の似た概念を安易に一対一対応させないよう、
          誤解を生みやすい辺には警告を付けています。
        </p>
      </header>

      <div className="galaxy-view__grid">
        <ConceptGraph selectedId={selectedId} onSelect={setSelectedId} />
        <aside className="galaxy-view__detail" aria-label="概念の詳細">
          <ConceptPanel conceptId={selectedId} onSelectConcept={setSelectedId}
            onOpenChallenge={(id) => {
              const f = findChallenge(id);
              if (f) store.gotoLesson(f.lesson.id, f.index);
            }} />
        </aside>
      </div>
    </div>
  );
}
