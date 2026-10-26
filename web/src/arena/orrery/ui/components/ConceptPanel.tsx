import { getConcept, relatedConcepts } from '../../core/concepts/graph';
import { challengesForConcept } from '../../core/lessons';

interface Props {
  conceptId: string;
  onSelectConcept?: (id: string) => void;
  onOpenChallenge?: (id: string) => void;
  compact?: boolean;
}

export function ConceptPanel({ conceptId, onSelectConcept, onOpenChallenge, compact = false }: Props) {
  const concept = getConcept(conceptId);
  if (!concept) return null;
  const related = relatedConcepts(conceptId);
  const lessons = challengesForConcept(conceptId).slice(0, 3);

  const flow = [
    ['入力', concept.input],
    ['判断', concept.decision],
    ['処理', concept.process],
    ['結果', concept.result],
  ] as const;

  return (
    <article className={`concept ${compact ? 'concept--compact' : ''}`}>
      <header className="concept__head">
        <span className="concept__lang">{concept.language === 'both' ? '比較' : concept.language === 'java' ? 'Java' : 'Rust'}</span>
        <h3>{concept.label}</h3>
        <p>{concept.summary}</p>
      </header>

      <ol className="concept__flow" aria-label="入力から結果までの構造">
        {flow.map(([label, text], i) => (
          <li key={label}>
            <span className="concept__flow-index">0{i + 1}</span>
            <span className="concept__flow-label">{label}</span>
            <span className="concept__flow-text">{text}</span>
          </li>
        ))}
      </ol>

      {!compact && (
        <>
          <dl className="concept__triad">
            <div><dt>役割</dt><dd>{concept.role}</dd></div>
            <div><dt>不変条件</dt><dd>{concept.invariant}</dd></div>
            <div><dt>境界</dt><dd>{concept.boundary}</dd></div>
          </dl>

          {concept.misconception && (
            <p className="concept__warning"><strong>よくある誤読</strong> — {concept.misconception}</p>
          )}

          {related.length > 0 && (
            <section className="concept__related">
              <h4>関係</h4>
              <ul>
                {related.map(({ edge, concept: other }) => (
                  <li key={`${edge.from}-${edge.to}-${edge.relation}`} className={edge.warning ? 'is-warning' : ''}>
                    <button type="button" onClick={() => onSelectConcept?.(other.id)}>{other.label}</button>
                    <span className="concept__relation">{edge.relation}</span>
                    <span className="concept__note">{edge.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lessons.length > 0 && (
            <section className="concept__lessons">
              <h4>この概念を扱う課題</h4>
              <ul>
                {lessons.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onOpenChallenge?.(c.id)}>{c.prompt}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </article>
  );
}
