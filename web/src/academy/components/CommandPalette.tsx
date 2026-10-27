/**
 * コマンドパレット（⌘K / Ctrl+K、または / キー）。
 *
 * 検索対象は「問題・概念・ページ」の 3 種類だけ。絞り込みは
 *   java / rust        言語
 *   kind:debug-fix     形式（KIND_LABEL の id）
 *   level:3            難易度
 *   weak / due / mastered / unverified   学習状態
 * を空白区切りで書ける。結果はキーボードだけで辿れる（↑↓ Enter Esc）。
 *
 * ここから問題を開いても、予測を飛ばすことはできない。移動の近道であって、
 * 学習の手順を省略する機能ではない。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PROBLEMS } from '../content';
import { CONCEPTS } from '../content/concepts';
import { KIND_LABEL, type Problem } from '../content/types';
import { useStore } from '../state/useStore';
import { useRouter } from '../lib/router';
import { progressOf } from '../lib/learn';

type Hit =
  | { type: 'problem'; id: string; title: string; sub: string }
  | { type: 'concept'; id: string; title: string; sub: string; lang: 'java' | 'rust' }
  | { type: 'page'; id: string; title: string; sub: string; to: string };

const PAGES: { to: string; label: string; hint: string }[] = [
  { to: '/today', label: '今日の5問', hint: '待っている問題から 5 問' },
  { to: '/review', label: '復習', hint: '期限が来た問題' },
  { to: '/learn', label: '学ぶ', hint: 'カリキュラム' },
  { to: '/map', label: '概念マップ', hint: '前提関係の図' },
  { to: '/browse', label: '問題一覧', hint: '絞り込み検索' },
  { to: '/errors', label: 'ERROR LAB', hint: '間違えた原因の分類' },
  { to: '/rules', label: '自分のルール', hint: '保存した 1 行ルール' },
  { to: '/progress', label: '進捗', hint: '記録と書き出し' },
  { to: '/compare', label: 'Java と Rust', hint: '対応表' },
  { to: '/how', label: 'このサイトの仕組み', hint: '実行の扱い' },
];

function problemSub(p: Problem): string {
  return `${p.lang === 'java' ? 'Java' : 'Rust'} · ${KIND_LABEL[p.kind]} · Lv${p.level} · ${p.id}`;
}

function search(query: string, state: ReturnType<typeof useStore>): Hit[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const text: string[] = [];
  let lang: 'java' | 'rust' | null = null;
  let kind: string | null = null;
  let level: number | null = null;
  let status: 'weak' | 'due' | 'mastered' | 'unverified' | null = null;

  for (const w of words) {
    const lower = w.toLowerCase();
    if (lower === 'java' || lower === 'rust') lang = lower;
    else if (lower.startsWith('kind:')) kind = lower.slice(5);
    else if (lower.startsWith('level:')) level = Number(lower.slice(6)) || null;
    else if (lower === 'weak' || lower === 'due' || lower === 'mastered' || lower === 'unverified') status = lower;
    else text.push(lower);
  }

  const hits: Hit[] = [];

  for (const c of CONCEPTS) {
    if (lang && c.lang !== lang) continue;
    const name = c.name.toLowerCase();
    if (text.length && !text.every((t) => name.includes(t) || c.id.includes(t) || c.summary.toLowerCase().includes(t))) continue;
    if (kind || level) continue;
    hits.push({ type: 'concept', id: c.id, title: c.name, sub: `${c.lang === 'java' ? 'Java' : 'Rust'} の概念 · ${c.id}`, lang: c.lang });
  }

  for (const p of PROBLEMS) {
    if (lang && p.lang !== lang) continue;
    if (kind && p.kind !== kind) continue;
    if (level && p.level !== level) continue;
    if (status) {
      const key = progressOf(p.concepts[0], state);
      if (status === 'weak' && key !== 'weak' && key !== 'recent_error') continue;
      if (status === 'due' && !(state.cards[p.id] && state.cards[p.id].due <= Date.now())) continue;
      if (status === 'mastered' && key !== 'transfer' && key !== 'reproduced') continue;
      if (status === 'unverified' && p.verified) continue;
    }
    if (text.length) {
      const hay = `${p.title} ${p.id} ${p.prompt} ${p.concepts.join(' ')} ${p.answer.mode === 'code' ? '' : ''}`.toLowerCase();
      if (!text.every((t) => hay.includes(t))) continue;
    }
    hits.push({ type: 'problem', id: p.id, title: p.title, sub: problemSub(p) });
  }

  if (!lang && !kind && !level && !status) {
    for (const pg of PAGES) {
      if (text.length && !text.every((t) => `${pg.label} ${pg.hint}`.toLowerCase().includes(t))) continue;
      hits.push({ type: 'page', id: pg.to, title: pg.label, sub: pg.hint, to: pg.to });
    }
  }

  // 学習中の概念と未着手の問題を先に出す（同じ名前なら短い id を優先）
  return hits.slice(0, 14);
}

export function CommandPalette() {
  const state = useStore();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const hits = useMemo(() => (open ? search(query, state) : []), [open, query, state]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = (e.composedPath()[0] ?? e.target) as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!typing && e.key === '/') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    const onOpen = () => setOpen(true);
    window.addEventListener('0:academy-search', onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('0:academy-search', onOpen); };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  function go(hit: Hit | undefined) {
    if (!hit) return;
    setOpen(false);
    if (hit.type === 'problem') navigate(`/p/${hit.id}`);
    else if (hit.type === 'concept') navigate(`/learn/${hit.lang}/${hit.id}`);
    else navigate(hit.to);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, Math.max(0, hits.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[index]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setIndex((i) => (i + 1) % Math.max(1, hits.length));
    }
  }

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="検索と移動">
      <div className="palette__panel">
        <label className="palette__label" htmlFor="palette-input">
          検索（問題・概念・ページ）
        </label>
        <input
          id="palette-input"
          ref={inputRef}
          className="palette__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKey}
          placeholder="例: stream / rust kind:debug-fix / weak / level:2"
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={hits[index] ? `palette-hit-${index}` : undefined}
        />
        <p className="palette__filters">
          絞り込み: <code>java</code> <code>rust</code> <code>kind:debug-fix</code> <code>level:3</code>{' '}
          <code>weak</code> <code>due</code> <code>mastered</code> <code>unverified</code>
        </p>
        {hits.length === 0 ? (
          <p className="palette__empty">一致する問題・概念・ページがありません。</p>
        ) : (
          <ul className="palette__list" id="palette-list" role="listbox" ref={listRef}>
            {hits.map((h, i) => (
              <li
                key={`${h.type}-${h.id}`}
                id={`palette-hit-${i}`}
                role="option"
                aria-selected={i === index}
                className={`palette__item ${i === index ? 'is-active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(h)}
              >
                <span className={`palette__badge palette__badge--${h.type}`}>
                  {h.type === 'problem' ? '問題' : h.type === 'concept' ? '概念' : 'ページ'}
                </span>
                <span className="palette__title">{h.title}</span>
                <span className="palette__sub">{h.sub}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="palette__foot">
          ↑↓ で移動 · Enter で開く · Esc で閉じる · <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> でいつでも開く
        </p>
      </div>
      <button type="button" className="palette__backdrop" aria-label="閉じる" onClick={() => setOpen(false)} />
    </div>
  );
}
