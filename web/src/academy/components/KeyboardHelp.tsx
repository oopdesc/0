/**
 * キーボード操作の一覧（? キーで開く）。
 * 画面に出しているヒント（Enter / 1〜9 / ⌘K）を 1 か所に集め、
 * 「案内は出ているが動かない」状態を作らないために、実際に効くキーだけを書く。
 */
import { useEffect, useState } from 'react';

const KEYS: { key: string; what: string }[] = [
  { key: '⌘K / Ctrl K', what: '検索と移動（問題・概念・ページ）' },
  { key: '/', what: '検索を開く（入力中でないとき）' },
  { key: '1〜9', what: '選択肢を選ぶ（4 択・追跡問題）' },
  { key: 'Enter', what: '予測を確定する／検索結果を開く' },
  { key: 'Esc', what: '検索を閉じる' },
  { key: 'Tab', what: '次の要素へ移動（結果一覧では次を選択）' },
  { key: '?', what: 'この一覧を開く・閉じる' },
];

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = (e.composedPath()[0] ?? e.target) as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (typing) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="iconbtn"
        onClick={() => setOpen(true)}
        aria-label="キーボード操作の一覧"
        title="キーボード操作（?）"
      >
        ?
      </button>
      {open && (
        <div className="keysheet" role="dialog" aria-modal="true" aria-label="キーボード操作">
          <div className="keysheet__panel">
            <h2 className="keysheet__title">キーボード操作</h2>
            <dl className="keysheet__list">
              {KEYS.map((k) => (
                <div key={k.key} className="keysheet__row">
                  <dt>
                    <kbd>{k.key}</kbd>
                  </dt>
                  <dd>{k.what}</dd>
                </div>
              ))}
            </dl>
            <p className="note">
              マウスだけでもすべて操作できます。キーボードは速さのためで、必須ではありません。
            </p>
            <button type="button" className="btn btn--primary" onClick={() => setOpen(false)}>
              閉じる
            </button>
          </div>
          <button type="button" className="palette__backdrop" aria-label="閉じる" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
