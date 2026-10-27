import { useEffect, useMemo } from 'react';
import { Link, useRouter } from '../lib/router';
import { useStore, recordAttempt } from '../state/useStore';
import { getProblem, familyOf, PROGRESS_LABEL, progressOf } from '../lib/learn';
import { Loop, type LoopResult } from '../components/Loop';
import { PROBLEMS } from '../content';

export function ProblemPage({ id }: { id: string }) {
  const state = useStore();
  const { path, navigate } = useRouter();
  const problem = getProblem(id);

  const role = useMemo<LoopResult extends never ? never : 'predict' | 'retry' | 'review'>(() => {
    const q = new URLSearchParams(window.location.hash.split('?')[1] || '').get('r');
    return q === 'retry' || q === 'review' ? q : 'predict';
  }, [path]);

  useEffect(() => {
    document.title = problem ? `${problem.title} — 0` : '0';
  }, [problem]);

  if (!problem) {
    return (
      <div className="page">
        <h1>問題が見つかりません</h1>
        <p className="lede">id: {id}</p>
        <Link to="/browse" className="btn btn--primary">
          問題一覧へ
        </Link>
      </div>
    );
  }

  const fam = familyOf(problem);
  const index = PROBLEMS.findIndex((p) => p.id === problem.id);
  const prev = PROBLEMS[index - 1];
  const next = PROBLEMS[index + 1];

  function finish(r: LoopResult) {
    recordAttempt({
      pid: problem!.id,
      ok: r.ok,
      ms: r.ms,
      role,
      surface: role === 'predict' ? 'first' : role,
      concepts: problem!.concepts,
      cause: r.usedSolution ? 'solution' : r.cause,
    });
  }

  return (
    <div className="problemPage">
      <nav className="crumbs">
        <Link to="/learn">学ぶ</Link> / <Link to={`/learn/${problem.lang}`}>{problem.lang === 'java' ? 'Java' : 'Rust'}</Link> /{' '}
        <Link to={`/learn/${problem.lang}/${problem.family}`}>{fam?.name ?? problem.family}</Link>
      </nav>

      <div className="problemPage__grid">
        <Loop key={`${problem.id}:${role}`} problem={problem} role={role} state={state} onFinish={finish} />

        <aside className="problemPage__side" aria-label="この問題の情報">
          <section className="sidecard">
            <h3>この問題の位置</h3>
            <dl className="sidecard__facts">
              <div>
                <dt>問題</dt>
                <dd className="mono">{problem.id}</dd>
              </div>
              <div>
                <dt>レベル</dt>
                <dd>{problem.level} / 5</dd>
              </div>
              <div>
                <dt>目安</dt>
                <dd>{problem.estSec ?? 60} 秒</dd>
              </div>
              <div>
                <dt>状態</dt>
                <dd>{PROGRESS_LABEL[progressOf(problem.concepts[0], state)]}</dd>
              </div>
              {state.cards[problem.id] && (
                <div>
                  <dt>次回</dt>
                  <dd>{new Date(state.cards[problem.id].due).toLocaleDateString('ja-JP')}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="sidecard">
            <h3>関連</h3>
            <ul className="sidecard__list">
              {problem.concepts.map((c) => (
                <li key={c}>
                  <Link to={`/learn/${problem.lang}/${c}`}>{c}</Link>
                </li>
              ))}
            </ul>
            {problem.transfer && (
              <p className="sidecard__note">
                類題: <Link to={`/p/${problem.transfer}?r=retry`}>{problem.transfer}</Link>
              </p>
            )}
          </section>

          <section className="sidecard">
            <h3>移動</h3>
            <div className="sidecard__nav">
              {prev && (
                <button type="button" className="btn btn--ghost btn--tiny" onClick={() => navigate(`/p/${prev.id}`)}>
                  ← {prev.title.slice(0, 12)}…
                </button>
              )}
              {next && (
                <button type="button" className="btn btn--ghost btn--tiny" onClick={() => navigate(`/p/${next.id}`)}>
                  {next.title.slice(0, 12)}… →
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
