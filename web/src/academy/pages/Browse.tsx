import { useMemo, useState } from 'react';
import { Link } from '../lib/router';
import { PROBLEMS, FAMILIES } from '../content';
import { CONCEPTS } from '../content/concepts';
import { useStore } from '../state/useStore';
import { PROGRESS_LABEL, progressOf } from '../lib/learn';
import { KIND_LABEL, LEVEL_LABEL, type ProblemKind } from '../content/types';

export function BrowsePage() {
  const state = useStore();
  const [lang, setLang] = useState<'all' | 'java' | 'rust'>('all');
  const [family, setFamily] = useState('all');
  const [level, setLevel] = useState('all');
  const [kind, setKind] = useState('all');
  const [concept, setConcept] = useState('all');
  const [q, setQ] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (lang !== 'all' && p.lang !== lang) return false;
      if (family !== 'all' && p.family !== family) return false;
      if (level !== 'all' && String(p.level) !== level) return false;
      if (kind !== 'all' && p.kind !== kind) return false;
      if (concept !== 'all' && !p.concepts.includes(concept)) return false;
      if (onlyDue && !(state.cards[p.id] && state.cards[p.id].due <= Date.now())) return false;
      if (needle) {
        const hay = `${p.id} ${p.title} ${p.prompt} ${p.patch} ${p.concepts.join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [lang, family, level, kind, concept, q, onlyDue, state.cards]);

  const fams = FAMILIES.filter((f) => lang === 'all' || f.lang === lang);
  const concepts = CONCEPTS.filter((c) => (lang === 'all' || c.lang === lang) && (family === 'all' || c.family === family));

  return (
    <div className="page">
      <h1>問題一覧</h1>
      <p className="lead">
        {PROBLEMS.length} 問。すべて実際のツールで検証済み（Java は OpenJDK 21、Rust は rustc 1.99）。
      </p>

      <div className="filters">
        <label>
          言語
          <select value={lang} onChange={(e) => { setLang(e.target.value as 'all' | 'java' | 'rust'); setFamily('all'); setConcept('all'); }}>
            <option value="all">すべて</option>
            <option value="java">Java</option>
            <option value="rust">Rust</option>
          </select>
        </label>
        <label>
          分野
          <select value={family} onChange={(e) => { setFamily(e.target.value); setConcept('all'); }}>
            <option value="all">すべて</option>
            {fams.map((f) => (
              <option key={f.id} value={f.id}>
                {f.lang === 'java' ? 'Java' : 'Rust'} / {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          概念
          <select value={concept} onChange={(e) => setConcept(e.target.value)}>
            <option value="all">すべて</option>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          レベル
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="all">すべて</option>
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                {l} — {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label>
          種類
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">すべて</option>
            {(Object.keys(KIND_LABEL) as ProblemKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="filters__search">
          検索
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="タイトル・本文・id" />
        </label>
        <label className="filters__check">
          <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} />
          復習期限のみ
        </label>
      </div>

      <p className="filters__count">{rows.length} 問</p>

      <ul className="problemlist problemlist--dense">
        {rows.map((p) => {
          const st = progressOf(p.concepts[0], state);
          return (
            <li key={p.id}>
              <Link to={`/p/${p.id}`} className="problemlist__row">
                <span className={`problemlist__lang chip chip--${p.lang}`}>{p.lang}</span>
                <span className="problemlist__title">{p.title}</span>
                <span className="problemlist__kind">{KIND_LABEL[p.kind]}</span>
                <span className="problemlist__level">Lv.{p.level}</span>
                <span className={`problemlist__state statepip--${st}`}>{PROGRESS_LABEL[st]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="note">条件に合う問題がありません。フィルタを緩めてください。</p>}
    </div>
  );
}
