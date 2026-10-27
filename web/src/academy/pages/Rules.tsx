/**
 * 自分のルール。解いた問題から持ち帰った「1 行ルール」を、自分の言葉の資産として並べる。
 *
 * ・保存は Loop の STEP 7 から（同じ文言は増やさない）
 * ・使った回数は、ルールを見ながら解いた記録（解いた回数そのものではない）
 * ・ここから問題へ戻れる。読むだけでは定着に数えない。
 */
import { useMemo, useState } from 'react';
import { Link } from '../lib/router';
import { useStore, removeRule } from '../state/useStore';
import { getProblem, conceptName } from '../lib/learn';

export function RulesPage() {
  const state = useStore();
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('all');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return state.rules
      .filter((r) => (filter === 'all' ? true : filter === 'unused' ? r.uses === 0 : r.uses > 0))
      .filter((r) => {
        if (!words.length) return true;
        const p = getProblem(r.pid);
        const hay = `${r.text} ${r.concept ?? ''} ${p?.title ?? ''} ${p?.id ?? ''}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
  }, [state.rules, filter, q]);

  return (
    <div className="page page--read">
      <h1>自分のルール</h1>
      <p className="lead">
        問題から持ち帰った 1 行を、自分の言葉で貯めておく場所です。ルールは「覚えた証拠」ではなく、
        次に同じ形の問題へ出会ったときに思い出す手がかりです。読むだけでは定着に数えません。
      </p>

      {state.rules.length === 0 ? (
        <div className="empty">
          <p>まだ保存されたルールがありません。問題を解いたあとの「持ち帰る 1 行」から保存できます。</p>
          <Link to="/today" className="btn btn--primary">
            今日の 5 問をはじめる
          </Link>
        </div>
      ) : (
        <>
          <div className="rules__tools">
            <label className="rules__search">
              <span>絞り込み</span>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="例: stream / 借用 / 境界"
                aria-label="ルールを検索"
              />
            </label>
            <div className="rules__tabs" role="group" aria-label="使った回数で絞る">
              {(['all', 'unused', 'used'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn btn--ghost btn--tiny ${filter === f ? 'is-active' : ''}`}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? `すべて ${state.rules.length}` : f === 'unused' ? 'まだ使っていない' : '使った'}
                </button>
              ))}
            </div>
          </div>

          {list.length === 0 ? (
            <p className="note">条件に合うルールがありません。</p>
          ) : (
            <ol className="rules">
              {list.map((r) => {
                const p = getProblem(r.pid);
                return (
                  <li key={r.id} className="rules__item">
                    <p className="rules__text">{r.text}</p>
                    <p className="rules__meta">
                      {p ? (
                        <Link to={`/p/${p.id}`} className="link">
                          {p.title}
                        </Link>
                      ) : (
                        <span>{r.pid}</span>
                      )}
                      {r.concept && <> · {conceptName(r.concept)}</>}· 保存 {new Date(r.at).toLocaleDateString('ja-JP')}
                      {r.uses > 0 && <> · 使用 {r.uses} 回</>}
                    </p>
                    <div className="rules__actions">
                      <CopyRule text={r.text} />
                      <button type="button" className="btn btn--ghost btn--tiny" onClick={() => removeRule(r.id)}>
                        消す
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      <p className="note">
        ルールはこのブラウザにだけ保存されます（サーバーへは送りません）。同じ 1 行は重複して保存されません。
      </p>
    </div>
  );
}

function CopyRule({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--ghost btn--tiny"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? 'コピーしました' : 'コピー'}
    </button>
  );
}
