import { Link } from '../lib/router';
import { PROBLEMS } from '../content';
import { CONCEPTS } from '../content/concepts';
import { useStore } from '../state/useStore';
import {
  PROGRESS_LABEL,
  familiesOf,
  FAMILY_BY_ID,
  progressOf,
  trackProgress,
  type ProgressKey,
} from '../lib/learn';

const ORDER: ProgressKey[] = ['untouched', 'learning', 'unstable', 'recent_error', 'weak', 'due', 'reproduced', 'transfer'];

export function TrackPage({ lang, concept }: { lang: 'java' | 'rust' | null; concept: string | null }) {
  const state = useStore();

  if (!lang) {
    return (
      <div className="page">
        <h1>学ぶ</h1>
        <p className="lead">Java と Rust。問題は「その概念を本当に判断できるか」だけを問う形で並んでいる。</p>
        <div className="tracklist">
          {(['java', 'rust'] as const).map((l) => {
            const t = trackProgress(l, state);
            return (
              <article key={l} className={`tracklist__item tracklist__item--${l}`}>
                <h2>{l === 'java' ? 'Java 21' : 'Rust 1.99'}</h2>
                <p>
                  {PROBLEMS.filter((p) => p.lang === l).length} 問 / {t.total} 概念
                </p>
                <ul className="statrow">
                  {ORDER.map((k) => (
                    <li key={k}>
                      <span className={`statepip statepip--${k}`} aria-hidden="true" />
                      {PROGRESS_LABEL[k]} <strong>{t.counts[k]}</strong>
                    </li>
                  ))}
                </ul>
                <Link to={`/learn/${l}`} className="btn btn--primary">
                  {l === 'java' ? 'Java の全体像' : 'Rust の全体像'}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  const fams = familiesOf(lang);
  const familyParam = concept ? fams.find((f) => f.id === concept) : undefined;

  if (familyParam) {
    const ps = PROBLEMS.filter((p) => p.family === familyParam.id);
    const cs = [...new Set(ps.flatMap((p) => p.concepts))];
    return (
      <div className="page">
        <nav className="crumbs">
          <Link to="/learn">学ぶ</Link> / <Link to={`/learn/${lang}`}>{lang === 'java' ? 'Java' : 'Rust'}</Link> /{' '}
          {familyParam.name}
        </nav>
        <h1>{familyParam.name}</h1>
        <p className="lead">{familyParam.blurb}</p>
        <h2 className="sectionhead">概念</h2>
        <ul className="conceptlist">
          {cs.map((c) => {
            const st = progressOf(c, state);
            const info = CONCEPTS.find((x) => x.id === c);
            return (
              <li key={c} className={`conceptlist__row conceptlist__row--${st}`}>
                <Link to={`/learn/${lang}/${c}`} className="conceptlist__link">
                  <strong>{info?.name ?? c}</strong>
                  <span>{info?.rule}</span>
                </Link>
                <span className="conceptlist__state">{PROGRESS_LABEL[st]}</span>
                <span className="conceptlist__count">
                  {ps.filter((p) => p.concepts.includes(c)).length} 問
                </span>
              </li>
            );
          })}
        </ul>
        <h2 className="sectionhead">この分野の問題</h2>
        <ul className="problemlist">
          {ps.map((p) => (
            <li key={p.id}>
              <Link to={`/p/${p.id}`} className="problemlist__row">
                <span className={`problemlist__lang chip chip--${p.lang}`}>{p.lang}</span>
                <span className="problemlist__title">{p.title}</span>
                <span className="problemlist__level">Lv.{p.level}</span>
                <span className="problemlist__state">{state.cards[p.id] ? '学習済み' : '未学習'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (concept) {
    const c = CONCEPTS.find((x) => x.id === concept);
    if (!c) return <p className="page">概念が見つかりません。</p>;
    const problems = PROBLEMS.filter((p) => p.concepts.includes(concept));
    const st = progressOf(concept, state);
    const fam = FAMILY_BY_ID.get(c.family);
    return (
      <div className="page">
        <nav className="crumbs">
          <Link to="/learn">学ぶ</Link> / <Link to={`/learn/${lang}`}>{lang === 'java' ? 'Java' : 'Rust'}</Link> /{' '}
          <Link to={`/learn/${lang}/${c.family}`}>{fam?.name ?? c.family}</Link>
        </nav>
        <header className="concepthead">
          <h1>{c.name}</h1>
          <span className={`statebadge statebadge--${st}`}>{PROGRESS_LABEL[st]}</span>
        </header>
        <p className="lead">{c.summary}</p>
        <div className="rulebox">
          <span className="rulebox__label">持ち帰る 1 行</span>
          <p>{c.rule}</p>
        </div>
        {c.contrast && (
          <div className="contrast">
            <span className="rulebox__label">Java と Rust の違い</span>
            <p>{c.contrast}</p>
          </div>
        )}
        {c.prereqs.length > 0 && (
          <p className="note">
            先に知っておくと楽:
            {c.prereqs.map((p) => (
              <Link key={p} to={`/learn/${lang}/${p}`} className="link">
                {' '}
                {CONCEPTS.find((x) => x.id === p)?.name ?? p}
              </Link>
            ))}
          </p>
        )}
        <h2 className="sectionhead">この概念の問題</h2>
        <ul className="problemlist">
          {problems.map((p) => {
            const card = state.cards[p.id];
            return (
              <li key={p.id}>
                <Link to={`/p/${p.id}`} className="problemlist__row">
                  <span className={`problemlist__lang chip chip--${p.lang}`}>{p.lang}</span>
                  <span className="problemlist__title">{p.title}</span>
                  <span className="problemlist__level">Lv.{p.level}</span>
                  <span className="problemlist__state">
                    {card ? (card.due <= Date.now() ? '復習期限' : `${card.step + 1} 段階目`) : '未学習'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="page">
      <nav className="crumbs">
        <Link to="/learn">学ぶ</Link> / {lang === 'java' ? 'Java' : 'Rust'}
      </nav>
      <h1>{lang === 'java' ? 'Java 21' : 'Rust 1.99'}</h1>
      <p className="lead">
        {lang === 'java'
          ? '値と式から始めて、クラス設計、コレクション、Stream、例外、そして HTTP・DB まで。'
          : '所有権と借用を先に体に入れる。コンパイルできるかどうかを、実行する前に判断できるようにする。'}
      </p>
      <div className="famgrid">
        {fams.map((f) => {
          const ps = PROBLEMS.filter((p) => p.family === f.id);
          const cs = [...new Set(ps.flatMap((p) => p.concepts))];
          const done = cs.filter((c) => progressOf(c, state) !== 'untouched').length;
          return (
            <article key={f.id} className="famcard">
              <header>
                <h2>
                  <Link to={`/learn/${lang}/${f.id}`}>{f.name}</Link>
                </h2>
                <p>{f.blurb}</p>
              </header>
              <div className="famcard__bar" aria-hidden="true">
                <span style={{ width: `${Math.round((done / Math.max(1, cs.length)) * 100)}%` }} />
              </div>
              <p className="famcard__stat">
                {ps.length} 問 / {cs.length} 概念・着手 {done}
              </p>
              <ul className="famcard__concepts">
                {cs.slice(0, 8).map((c) => {
                  const st = progressOf(c, state);
                  const name = CONCEPTS.find((x) => x.id === c)?.name ?? c;
                  return (
                    <li key={c}>
                      <Link to={`/learn/${lang}/${c}`} className={`conceptchip conceptchip--${st}`} title={PROGRESS_LABEL[st]}>
                        {name}
                      </Link>
                    </li>
                  );
                })}
                {cs.length > 8 && <li className="conceptchip conceptchip--more">+{cs.length - 8}</li>}
              </ul>
              <Link to={`/learn/${lang}/${f.id}`} className="btn btn--ghost btn--tiny">
                この分野を開く
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
