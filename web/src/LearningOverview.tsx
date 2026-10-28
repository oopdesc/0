import { useEffect, useState } from 'react';
import { loadManifest } from './learning-v2/loader';
import { loadLast } from './learning-v2/progress';
import type { Lang, Manifest } from './learning-v2/types';
import './learning-v2/learning-v2.css';

export default function LearningOverview() {
  const [java, setJava] = useState<Manifest | null>(null);
  const [rust, setRust] = useState<Manifest | null>(null);
  const [last] = useState<{ language: Lang; id: string } | null>(() => { try { return loadLast(localStorage); } catch { return null; } });
  useEffect(() => {
    const controller = new AbortController();
    loadManifest('java', controller.signal).then(setJava).catch(() => {});
    loadManifest('rust', controller.signal).then(setRust).catch(() => {});
    return () => controller.abort();
  }, []);
  const resume = last ? `/learn?section=drill&lang=${last.language}&q=${encodeURIComponent(last.id)}` : '/learn?section=drill&lang=java&q=java%3Aq0001';
  return <main className="zlv zlv-landing">
    <div className="zlv-topline"><span>0 / はじめに</span><span>知る、試す、また戻ってくる。</span></div>
    <div className="zlv-landing-hero"><div><span className="zlv-kicker">学びを積み重ねる <span>✳</span></span><h2>わからないから、<br /><em>はじめよう。</em></h2><p>ひとつ予測して、ひとつ理由を知る。<br />小さな「わかった」を、自分の手で重ねていく場所です。</p><a className="zlv-landing-primary" href="/learn?section=drill&lang=java&q=java%3Aq0001">はじめての一問へ <span>→</span></a></div><div className="zlv-landing-note"><span>自分の学習ノート</span><b>01 <i>—</i> 03</b><p>読む。<br />考える。<br />自分でやってみる。</p><small>順番は自由。いつでも戻れます。</small><div aria-hidden="true">✳</div></div></div>
    <p className="zlv-write-note"><a href="/learn?section=concepts">概念図から全体を見渡す →</a>　学ぶ前にも、復習にも。JavaとRustのつながりを図で確かめられます。</p>
    <div className="zlv-landing-counts"><p><strong>{java ? java.counts.normal.toLocaleString() : '—'}</strong><span>Javaの問題<br /><small>うち記述 {java ? java.counts.writing : '—'}問</small></span></p><p><strong>{rust ? rust.counts.normal.toLocaleString() : '—'}</strong><span>Rustの問題<br /><small>{rust ? `うち記述 ${rust.counts.writing}問` : '未提供時は従来教材へ'}</small></span></p><p><strong>{java && rust ? java.counts.exams + rust.counts.exams : '—'}</strong><span>Java・Rustの試験<br /><small>通常問題とは別集計</small></span></p></div>
    <div className="zlv-landing-section"><div><span className="zlv-kicker">始める場所を選ぶ</span><h3>今日は、どこから？</h3></div><p>学習の順番にロックはありません。</p></div>
    <div className="zlv-landing-grid"><a href="/learn?section=drill&lang=java&q=java%3Aq0001"><span>01 / 最初の一歩</span><b>はじめて</b><p>プログラムの入口と、一行の表示から。</p><strong>一問目を開く ↗</strong></a><a href={resume}><span>02 / 続きから</span><b>続きから</b><p>{last ? '最後に開いた問題へ戻ります。' : 'まだ記録がなければ、最初の問題へ。'}</p><strong>学習を再開 ↗</strong></a><a href="/learn?section=drill"><span>03 / 分野を選ぶ</span><b>問題を選ぶ</b><p>単元や前提から、好きな場所を選ぶ。</p><strong>一覧を見る ↗</strong></a><a href="/learn?section=exams"><span>04 / 試験</span><b>試験</b><p>通常問題とは別の、非公式な模試。</p><strong>試験の準備状況 ↗</strong></a></div>
    <div className="zlv-landing-links"><a href="/learn?section=flow"><span>05 / 処理を追う</span><strong>ブラウザからDBまで、処理を追う。</strong><b>→</b></a><a href="/learn?section=writing"><span>06 / 自分で書く</span><strong>自分でコードを書く問題を選ぶ。</strong><b>→</b></a><a href="/learn?section=projects"><span>07 / 組み立てる</span><strong>小さなプロジェクトに挑戦する。</strong><b>→</b></a><a href="/learn?section=diagnostics"><span>途中確認</span><strong>既習問題で途中確認する。</strong><b>→</b></a><a href="/learn?section=orbit"><span>08 / 実験する</span><strong>宇宙の模型でコードを確かめる。</strong><b>→</b></a></div>
    <p className="zlv-write-note"><a href="/learn?section=supplemental#/browse">もっと解く：補充問題集 →</a>　以前の教材から追加の練習を選べます。新教材とは別の集計です。</p>
    <p className="zlv-archive">コード記述問題は上記の内数です。固定テストで確認できる課題と、手元で確認する課題を区別しています。 <a href="/learn?section=legacy-verified">ブラウザで動く例</a> / <a href="/learn?section=legacy-practice&mode=code">コード実験</a></p>
  </main>;
}
