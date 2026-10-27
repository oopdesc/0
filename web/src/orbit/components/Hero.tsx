import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { OrbitScene, type Quality } from './OrbitScene';
import type { ModelState } from '../domain/types';
interface Props { model: ModelState; playing: boolean; onToggle: () => void; speed: number; quality: Quality }
export function Hero(props: Props) {
  return <>
    <section className="hero shell" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="tiny-square" /> AN INTERACTIVE LEARNING UNIVERSE <span className="hero-kicker-number">/ 001</span></div>
        <h1 id="hero-title">コードで、<br /><em>宇宙</em>をつくろう。</h1>
        <p className="hero-lead">予測して、動かして、間違いから学ぶ。<br />JavaとRustで、あなただけの宇宙を。</p>
        <div className="hero-actions"><a className="button button-primary" href="#lab">実験室に入る <ArrowUpRight size={17} /></a><a className="text-link" href="#how">学び方を見る <ArrowDown size={14} /></a></div>
        <div className="hero-index"><span>JAVA <b>+</b> RUST</span><span className="index-divider" /> <span>NO ACCOUNT REQUIRED</span></div>
      </div>
      <div className="hero-art"><OrbitScene {...props} /></div>
    </section>
    <section className="method-strip shell" id="how" aria-label="学習の流れ">
      <div className="method-label"><span>THE LEARNING LOOP</span><strong>つくることが、理解になる。</strong></div>
      <ol><li><small>01 / PREDICT</small><b>予測する</b></li><li><small>02 / RUN</small><b>動かして比べる</b></li><li><small>03 / REPAIR</small><b>間違いから直す</b></li><li><small>04 / RECALL</small><b>自力でつくる</b></li></ol>
    </section>
  </>;
}
