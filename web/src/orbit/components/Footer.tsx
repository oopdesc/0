import { ArrowUpRight } from 'lucide-react';
interface Props { onReset: () => void; storageAvailable: boolean }
export function Footer({ onReset, storageAvailable }: Props) {
  return <footer className="footer" id="about"><div className="shell"><div className="footer-main"><div><p className="eyebrow">A NOTE ON THIS UNIVERSE</p><h2>これは、観測された<br />宇宙ではありません。</h2></div><div className="footer-explanation"><p>画面の天体は、学習のために単純化した円軌道とデジタルアートです。重力・距離・大きさ・速度は実測値ではなく、物理シミュレーションでもありません。</p><p>学習データはこのブラウザ内に保存。アカウント、追跡、外部AI APIは不要です。{!storageAvailable && '現在、このブラウザでは保存を利用できません。'}</p><button type="button" onClick={onReset}>この端末の学習記録を消去する <ArrowUpRight size={14} /></button></div></div><div className="footer-bottom"><a href="#top" className="footer-brand">✳ <b>ORBIT</b> <span>CODE & COSMOS</span></a><span>MADE FOR CURIOUS MINDS <i>·</i> BUILT TO BE EXPLORED</span><a href="#top">BACK TO TOP ↑</a></div></div></footer>;
}
