import { useMemo, useState, useSyncExternalStore } from 'react';
import { ErrorLabPanel } from '../components/ErrorLabPanel';
import { store } from '../../core/appStore';
import { findChallenge, allChallenges } from '../../core/lessons';
import { dueCards, humanDue } from '../../core/learning/srs';

export function ErrorLabView() {
  const app = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [openId, setOpenId] = useState<string | null>(null);
  const now = Date.now();

  const entries = useMemo(() => {
    return Object.entries(app.progress.attempts)
      .filter(([, a]) => a.count > 0)
      .sort((a, b) => b[1].at - a[1].at)
      .map(([id, attempt]) => ({ id, attempt, found: findChallenge(id) }))
      .filter((x) => Boolean(x.found));
  }, [app.progress.attempts]);

  const patches = app.progress.patches;
  const due = dueCards(app.progress.review, now);

  return (
    <div className="errors-view">
      <header className="view-head">
        <p className="view-head__kicker">誤りの記録</p>
        <h1>間違いを、そのまま教材にする。</h1>
        <p className="view-head__lead">
          予測と結果の差分・原因・正しい規則・1行パッチ・修正版を並べて見ます。
          「×」で終わらせず、誤差そのものを復習対象にします。
        </p>
      </header>

      <div className="errors-view__stats">
        <div><span>試行した課題</span><strong>{entries.length}</strong></div>
        <div><span>保存した1行パッチ</span><strong>{patches.length}</strong></div>
        <div><span>今日の復習</span><strong>{due.length}</strong></div>
      </div>

      <section className="errors-view__list" aria-labelledby="attempts-title">
        <h2 id="attempts-title" className="section-label">試行ログ</h2>
        {entries.length === 0 && (
          <p className="empty">まだ試行がありません。<button type="button" onClick={() => store.navigate('learn')}>学習を始める →</button></p>
        )}
        <ul>
          {entries.map(({ id, attempt, found }) => {
            const c = found!.challenge;
            const isOpen = openId === id;
            return (
              <li key={id} className={attempt.last === 'pass' ? 'is-pass' : 'is-fail'}>
                <button type="button" className="errors-view__row" aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : id)}>
                  <span className="errors-view__badge">{found!.lesson.track.toUpperCase()}</span>
                  <span className="errors-view__prompt">{c.prompt}</span>
                  <span className="errors-view__result">{attempt.last === 'pass' ? '正解' : '要復習'}</span>
                  <span className="errors-view__count">×{attempt.count}</span>
                </button>
                {isOpen && (
                  <div className="errors-view__detail">
                    <ErrorLabPanel
                      prediction={attempt.prediction || '（予測なし）'}
                      actual={attempt.actual || '（記録なし）'}
                      explanation={c.explanation}
                      patch={c.patch}
                      solution={c.solution}
                      onSavePatch={() => store.savePatch(c)}
                      patchSaved={patches.some((p) => p.text === c.patch)}
                      onRebuild={() => store.gotoLesson(found!.lesson.id, found!.index)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="errors-view__patches" aria-labelledby="patches-title">
        <h2 id="patches-title" className="section-label">保存した1行パッチ</h2>
        {patches.length === 0 && <p className="empty">まだありません。誤差が出たときに「復習に保存」してください。</p>}
        <ul>
          {patches.map((p) => (
            <li key={p.id}>
              <code>{p.text}</code>
              <span>{p.concept}</span>
              <button type="button" onClick={() => {
                const f = findChallenge(p.source);
                if (f) store.gotoLesson(f.lesson.id, f.index);
              }}>課題へ</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="errors-view__due" aria-labelledby="due-title">
        <h2 id="due-title" className="section-label">復習予定</h2>
        <ul>
          {due.slice(0, 10).map((card) => {
            const c = allChallenges().find((x) => x.id === card.id);
            return (
              <li key={card.id}>
                <span>{c?.prompt ?? card.id}</span>
                <span>{humanDue(card, now)}</span>
              </li>
            );
          })}
          {due.length === 0 && <li>現在、期限の来ている復習はありません。</li>}
        </ul>
        <button type="button" onClick={() => store.navigate('review')}>復習画面へ →</button>
      </section>
    </div>
  );
}
