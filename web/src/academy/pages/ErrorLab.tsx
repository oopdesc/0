import { useMemo } from 'react';
import { Link } from '../lib/router';
import { PROBLEMS } from '../content';
import { CAUSES } from '../content/causes';
import { useStore } from '../state/useStore';
import { causeName, causeDrill, getProblem } from '../lib/learn';

/**
 * 間違いを振り返る。
 * 間違えた問題を「原因の分類」で束ね、同じ原因の問題へ戻す。
 * 記録は端末内だけ。件数は正直に、実際に間違えた回数しか出さない。
 */
export function ErrorLabPage() {
  const state = useStore();

  const byCause = useMemo(() => {
    const map = new Map<string, { count: number; last: number; pids: string[] }>();
    for (const e of state.errors) {
      const cur = map.get(e.cause) ?? { count: 0, last: 0, pids: [] };
      cur.count++;
      cur.last = Math.max(cur.last, e.at);
      if (!cur.pids.includes(e.pid)) cur.pids.push(e.pid);
      map.set(e.cause, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [state.errors]);

  const recent = state.errors.slice(0, 12);

  return (
    <div className="page">
      <h1>間違いを振り返る</h1>
      <p className="lead">
        間違いは捨てずに、原因の名前で分類する。同じ原因が続いているなら、それは知識ではなく「考え方の癖」。
        下の分類から、その癖に効く問題へ戻れる。
      </p>

      {state.errors.length === 0 ? (
        <div className="empty">
          <p>まだ記録がありません。1 問解くと、間違えたときの原因がここに溜まります。</p>
          <Link to="/today" className="btn btn--primary">
            今日の 5 問
          </Link>
        </div>
      ) : (
        <>
          <section className="causes">
            <h2 className="sectionhead">原因の分類</h2>
            <ul className="causelist">
              {byCause.map(([cause, info]) => {
                const drill = PROBLEMS.filter((p) => p.misconception.cause === cause || p.answer.mode === 'choice' && p.answer.options.some((o) => o.cause === cause));
                return (
                  <li key={cause} className="causelist__item">
                    <div className="causelist__head">
                      <h3>{causeName(cause)}</h3>
                      <span className="causelist__count">{info.count} 回</span>
                    </div>
                    <p className="causelist__drill">{causeDrill(cause) || '関連する問題を解き直す'}</p>
                    <p className="causelist__last">最終: {new Date(info.last).toLocaleString('ja-JP')}</p>
                    <div className="causelist__links">
                      {drill.slice(0, 3).map((p) => (
                        <Link key={p.id} to={`/p/${p.id}`} className="btn btn--ghost btn--tiny">
                          {p.title}
                        </Link>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="recent">
            <h2 className="sectionhead">最近の誤差</h2>
            <ul className="recent__list">
              {recent.map((e, i) => {
                const p = getProblem(e.pid);
                return (
                  <li key={`${e.pid}-${e.at}-${i}`} className="recent__item">
                    <span className="recent__cause">{causeName(e.cause)}</span>
                    {p ? (
                      <Link to={`/p/${p.id}`} className="recent__title">
                        {p.title}
                      </Link>
                    ) : (
                      <span>{e.pid}</span>
                    )}
                    <span className="recent__time">{new Date(e.at).toLocaleDateString('ja-JP')}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="catalog">
            <h2 className="sectionhead">原因の一覧（教材全体）</h2>
            <ul className="catalog__list">
              {CAUSES.map((c) => {
                const n = PROBLEMS.filter((p) => p.misconception.cause === c.id).length;
                return (
                  <li key={c.id}>
                    <strong>{c.label}</strong>
                    <span>{c.drill}</span>
                    <span className="catalog__n">{n} 問</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
