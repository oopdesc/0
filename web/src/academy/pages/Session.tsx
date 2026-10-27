import { useMemo, useState } from 'react';
import { Link, useRouter } from '../lib/router';
import { useStore, recordAttempt } from '../state/useStore';
import { todayFive, reviewQueueDetailed, todayKey, PROGRESS_LABEL } from '../lib/learn';
import { Loop, type LoopResult } from '../components/Loop';
import { pinToday } from '../state/useStore';

export function SessionPage({ mode }: { mode: 'today' | 'review' }) {
  const state = useStore();
  const { navigate } = useRouter();
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<{ id: string; ok: boolean }[]>([]);

  const list = useMemo(() => {
    if (mode === 'today') {
      const five = todayFive(state);
      if (state.today.date !== todayKey()) pinToday(five.map((p) => p.id), todayKey());
      return five.map((problem) => ({ problem, sourceId: problem.id }));
    }
    return reviewQueueDetailed(state);
  }, [mode, state.today.date]); // セッション中は固定する（回答のたびに並び替えない）

  const current = list[done];
  const shown = current?.problem;

  if (!list.length) {
    return (
      <div className="page">
        <h1>{mode === 'today' ? '今日の 5 問' : '復習'}</h1>
        <p className="lead">
          {mode === 'review'
            ? 'いま復習期限の問題はありません。次の期限が来るとここに並びます。'
            : '今日の問題を準備できませんでした。問題一覧から選んでください。'}
        </p>
        <div className="row">
          <Link to="/browse" className="btn btn--primary">
            問題一覧へ
          </Link>
          <Link to="/learn" className="btn btn--ghost">
            学ぶ
          </Link>
        </div>
      </div>
    );
  }

  if (!current) {
    const ok = results.filter((r) => r.ok).length;
    return (
      <div className="page sessiondone">
        <h1>{mode === 'today' ? '今日の 5 問、完了' : '復習、完了'}</h1>
        <p className="lead">
          {ok} / {results.length} 問が予測どおり。間違えた問題は 間違いを振り返る に残り、同じ原因の問題が優先されます。
        </p>
        <ul className="sessiondone__list">
          {results.map((r) => (
            <li key={r.id} className={r.ok ? 'is-ok' : 'is-bad'}>
              <span>{r.ok ? '一致' : 'ずれ'}</span>
              <Link to={`/p/${r.id}`}>{r.id}</Link>
            </li>
          ))}
        </ul>
        <div className="row">
          <Link to="/progress" className="btn btn--primary">
            進捗を見る
          </Link>
          <Link to="/errors" className="btn btn--ghost">
            間違いを振り返る
          </Link>
        </div>
      </div>
    );
  }

  function finish(r: LoopResult) {
    recordAttempt({
      pid: current!.sourceId,
      ok: r.ok,
      ms: r.ms,
      role: mode === 'review' ? 'review' : 'predict',
      surface: mode,
      concepts: shown!.concepts,
      cause: r.usedSolution ? 'solution' : r.cause,
    });
    setResults((x) => [...x, { id: current!.sourceId, ok: r.ok }]);
    setDone((x) => x + 1);
  }

  return (
    <div className="session">
      <header className="session__head">
        <div>
          <h1>{mode === 'today' ? '今日の 5 問' : '復習'}</h1>
          <p className="lead">
            {mode === 'today'
              ? '期限が来た問題・苦手な概念・まだ見ていない問題から、日付を種にして選んでいます。'
              : '期限が来た問題だけ。答えを見ずに、前回の記憶だけで答える。'}
          </p>
        </div>
        <ol className="session__pips" aria-label={`進捗 ${done} / ${list.length}`}>
          {list.map((p, i) => (
            <li
              key={p.problem.id}
              className={i < done ? (results[i]?.ok ? 'is-ok' : 'is-bad') : i === done ? 'is-now' : ''}
              title={p.problem.title}
            />
          ))}
        </ol>
        <p className="session__count">
          {done + 1} / {list.length}
        </p>
      </header>

      <div className="session__main">
        {state.cards[current.sourceId] && (
          <p className="note">
            前回の状態: {PROGRESS_LABEL[state.cards[current.sourceId].due <= Date.now() ? 'due' : 'unstable']}
            {shown.id !== current.sourceId && (
              <>
                {' '}
                ・今回は同じ核心の別の問題（<span className="mono">{shown.id}</span>）で確認します
              </>
            )}
          </p>
        )}
        <Loop key={`${mode}:${shown.id}`} problem={shown} role={mode === 'review' ? 'review' : 'predict'} state={state} onFinish={finish} />
      </div>

      <div className="session__actions">
        <button type="button" className="btn btn--ghost btn--tiny" onClick={() => navigate('/progress')}>
          進捗へ
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--tiny"
          onClick={() => {
            setResults((x) => [...x, { id: current.sourceId, ok: false }]);
            setDone((x) => x + 1);
          }}
        >
          この問題を飛ばす（記録しない）
        </button>
      </div>
    </div>
  );
}
