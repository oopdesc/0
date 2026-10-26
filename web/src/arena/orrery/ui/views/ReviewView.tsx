import { useState, useSyncExternalStore } from 'react';
import { store } from '../../core/appStore';
import { findChallenge, allChallenges } from '../../core/lessons';
import { dueCards, humanDue } from '../../core/learning/srs';

export function ReviewView() {
  const app = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [revealed, setRevealed] = useState(false);
  const now = Date.now();
  const due = dueCards(app.progress.review, now);
  const all = Object.values(app.progress.review).sort((a, b) => a.due - b.due);
  const queue = due.length > 0 ? due : all;
  const index = Math.min(app.reviewIndex, Math.max(0, queue.length - 1));
  const card = queue[index];
  const found = card ? findChallenge(card.id) : null;
  const challenge = found?.challenge;

  function grade(g: 0 | 1 | 2) {
    if (!card) return;
    store.gradeReview(card.id, g);
    setRevealed(false);
    store.setReviewIndex(0);
    store.setToast(g === 0 ? 'もう一度に設定しました' : g === 1 ? '短い間隔で再表示します' : '次回の復習を延期しました');
  }

  return (
    <div className="review-view">
      <header className="view-head">
        <p className="view-head__kicker">RETRIEVE</p>
        <h1>答えを見ずに、思い出す。</h1>
        <p className="view-head__lead">
          時間を空けて答えなしで再現することが記憶を固定します。
          正答を見た直後の「分かった」は、ここでは完了扱いしません。
        </p>
      </header>

      <div className="review-view__stats">
        <span>期限到来 <strong>{due.length}</strong></span>
        <span>登録カード <strong>{all.length}</strong></span>
        <span>保存パッチ <strong>{app.progress.patches.length}</strong></span>
      </div>

      {!card || !challenge ? (
        <div className="review-view__empty">
          <p>復習カードがありません。学習で課題に挑戦すると、自動でカードが作られます。</p>
          <button type="button" className="primary" onClick={() => store.navigate('learn')}>学習へ →</button>
        </div>
      ) : (
        <article className="review-card">
          <div className="review-card__head">
            <span>{index + 1} / {queue.length}</span>
            <span>次回: {humanDue(card, now)}</span>
          </div>
          <h2>{challenge.prompt}</h2>
          <p className="review-card__meta">{found!.lesson.title} · {challenge.dialect === 'java' ? 'Java' : 'Rust'} · {challenge.concept}</p>

          {!revealed ? (
            <div className="review-card__hidden">
              <p>まず頭の中で答えを作ってください。コードで再現できる課題は、エディタで書いてから確認するのが効果的です。</p>
              <button type="button" className="primary" onClick={() => setRevealed(true)}>答えと理由を見る</button>
              <button type="button" onClick={() => store.gotoLesson(found!.lesson.id, found!.index)}>コードで再現する</button>
            </div>
          ) : (
            <div className="review-card__answer">
              {challenge.options && <p className="review-card__correct">正答: {challenge.answer}</p>}
              {challenge.solution && <pre><code>{challenge.solution}</code></pre>}
              <h3>なぜそうなるか</h3>
              <p>{challenge.explanation}</p>
              <div className="review-card__patch"><span>1行パッチ</span><code>{challenge.patch}</code></div>
              <div className="review-card__grade" role="group" aria-label="復習の評価">
                <button type="button" onClick={() => grade(0)}>もう一度</button>
                <button type="button" onClick={() => grade(1)}>苦手</button>
                <button type="button" className="primary" onClick={() => grade(2)}>できた</button>
              </div>
            </div>
          )}
        </article>
      )}

      <section className="review-view__list" aria-labelledby="review-list-title">
        <h2 id="review-list-title" className="section-label">カード一覧</h2>
        <ul>
          {all.map((c) => {
            const ch = allChallenges().find((x) => x.id === c.id);
            return (
              <li key={c.id}>
                <span>{ch?.prompt ?? c.id}</span>
                <span>{humanDue(c, now)}</span>
                <button type="button" onClick={() => {
                  const i = queue.findIndex((q) => q.id === c.id);
                  store.setReviewIndex(i >= 0 ? i : 0);
                  setRevealed(false);
                }}>開く</button>
              </li>
            );
          })}
          {all.length === 0 && <li>まだカードがありません。</li>}
        </ul>
      </section>
    </div>
  );
}
