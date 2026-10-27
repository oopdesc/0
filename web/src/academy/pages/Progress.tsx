import { useRef, useState } from 'react';
import { Link } from '../lib/router';
import type { State } from '../state/store';
import { exportState, importState, INTERVALS } from '../state/store';
import { replaceState, setPref } from '../state/useStore';
import { PROGRESS_LABEL, progressOf, trackProgress, type ProgressKey } from '../lib/learn';
import { CONCEPTS } from '../content/concepts';

const ORDER: ProgressKey[] = ['untouched', 'learning', 'unstable', 'recent_error', 'weak', 'due', 'reproduced', 'transfer'];

export function ProgressPage({ state }: { state: State }) {
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cards = Object.entries(state.cards).sort((a, b) => a[1].due - b[1].due);
  const due = cards.filter(([, c]) => c.due <= Date.now()).length;
  const recent = [...state.attempts].reverse().slice(0, 15);

  function download() {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zero-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function upload(file: File) {
    const text = await file.text();
    const res = importState(text);
    if (res.ok) {
      replaceState(res.state);
      setMsg('読み込みました。');
    } else {
      setMsg(res.error);
    }
  }

  return (
    <div className="page">
      <h1>進捗</h1>
      <p className="lead">記録はこのブラウザの localStorage にだけ保存されます。サーバには送りません。</p>

      <div className="statgrid">
        <div className="statcard">
          <span className="statcard__n">{state.attempts.length}</span>
          <span className="statcard__label">解答した回数</span>
        </div>
        <div className="statcard">
          <span className="statcard__n">{Object.keys(state.cards).length}</span>
          <span className="statcard__label">触れた問題</span>
        </div>
        <div className="statcard">
          <span className="statcard__n">{due}</span>
          <span className="statcard__label">復習期限</span>
        </div>
        <div className="statcard">
          <span className="statcard__n">{state.days.streak}</span>
          <span className="statcard__label">連続日数</span>
        </div>
      </div>

      {(['java', 'rust'] as const).map((lang) => {
        const t = trackProgress(lang, state);
        return (
          <section key={lang} className="progressblock">
            <h2 className="sectionhead">{lang === 'java' ? 'Java' : 'Rust'}</h2>
            <ul className="statrow statrow--wide">
              {ORDER.map((k) => (
                <li key={k}>
                  <span className={`statepip statepip--${k}`} aria-hidden="true" />
                  {PROGRESS_LABEL[k]} <strong>{t.counts[k]}</strong>
                </li>
              ))}
            </ul>
            <details className="progressdetails">
              <summary>概念ごとの状態（{t.total}）</summary>
              <ul className="conceptstates">
                {CONCEPTS.filter((c) => c.lang === lang).map((c) => {
                  const st = progressOf(c.id, state);
                  return (
                    <li key={c.id}>
                      <Link to={`/learn/${lang}/${c.id}`}>{c.name}</Link>
                      <span className={`statebadge statebadge--${st}`}>{PROGRESS_LABEL[st]}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          </section>
        );
      })}

      <section className="progressblock">
        <h2 className="sectionhead">復習の予定</h2>
        <p className="note">間隔は 1 / 3 / 7 / 14 / 30 日。正解で次の段階へ、間違えると 1 日に戻ります。</p>
        <ul className="dueList">
          {cards.slice(0, 12).map(([pid, card]) => (
            <li key={pid}>
              <span className={card.due <= Date.now() ? 'dueList__due is-due' : 'dueList__due'}>
                {new Date(card.due).toLocaleDateString('ja-JP')}
              </span>
              <Link to={`/p/${pid}`}>{pid}</Link>
              <span className="dueList__step">第 {card.step + 1} 段階（{INTERVALS[Math.min(card.step, 4)]} 日）</span>
            </li>
          ))}
          {cards.length === 0 && <li className="note">まだ予定はありません。</li>}
        </ul>
      </section>

      <section className="progressblock">
        <h2 className="sectionhead">最近の解答</h2>
        <ul className="recent__list">
          {recent.map((a, i) => (
            <li key={`${a.pid}-${a.at}-${i}`} className="recent__item">
              <span className={a.ok ? 'dot dot--ok' : 'dot dot--bad'} />
              <Link to={`/p/${a.pid}`} className="recent__title">
                {a.pid}
              </Link>
              <span className="recent__cause">{a.role}</span>
              <span className="recent__time">{(a.ms / 1000).toFixed(1)} 秒</span>
              <span className="recent__time">{new Date(a.at).toLocaleString('ja-JP')}</span>
            </li>
          ))}
          {recent.length === 0 && <li className="note">まだ解答がありません。</li>}
        </ul>
      </section>

      <section className="progressblock">
        <h2 className="sectionhead">設定</h2>
        <div className="settings">
          <label>
            動きを減らす
            <select value={state.reduceMotion} onChange={(e) => setPref('reduceMotion', e.target.value as State['reduceMotion'])}>
              <option value="auto">自動（OS の設定に従う）</option>
              <option value="on">常に減らす</option>
              <option value="off">減らさない</option>
            </select>
          </label>
          <label>
            宇宙の品質
            <select value={state.spaceQuality} onChange={(e) => setPref('spaceQuality', e.target.value as State['spaceQuality'])}>
              <option value="auto">自動（実測して決める）</option>
              <option value="ultra">Ultra 約 16,384</option>
              <option value="high">High 約 8,192</option>
              <option value="balanced">Balanced 約 4,096</option>
              <option value="battery">Battery 1,024〜2,048</option>
            </select>
          </label>
        </div>

        <div className="io">
          <button type="button" className="btn" onClick={download}>
            学習記録を書き出す（JSON）
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            学習記録を読み込む
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              if (confirm('この端末の学習記録をすべて消します。よろしいですか？（書き出しはできます）')) {
                localStorage.removeItem('0.academy.state.v1');
                location.reload();
              }
            }}
          >
            記録を消す
          </button>
        </div>
        {msg && <p className="note">{msg}</p>}
      </section>
    </div>
  );
}
