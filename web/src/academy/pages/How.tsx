import { PROBLEMS } from '../content';
import { Link } from '../lib/router';

export function HowPage() {
 const java=PROBLEMS.filter(p=>p.lang==='java').length,rust=PROBLEMS.filter(p=>p.lang==='rust').length;
 const replayed=PROBLEMS.filter(p=>p.verified?.checkedAt==='2026-10-29').length;
 return <div className="page page--read"><h1>補充問題集の使い方</h1><p className="page__lead">答えを選ぶ前に予測し、解説を読んで、時間を空けて思い出すための問題集です。</p>
  <section><h2>問題を探す</h2><p>Java {java}問、Rust {rust}問を収録しています。通常の問題集と一部が重なるため、二つの件数を足した数が独立した問題数になるわけではありません。</p><p><Link to="/browse">問題を選ぶ →</Link>　<Link to="/map">概念のつながりから選ぶ →</Link></p></section>
  <section><h2>答えた後に確かめること</h2><p>予測を確定すると、正解とその理由、ほかの選択肢が違う理由を読めます。間違えた理由を短い言葉で残し、類題や復習で確かめてください。選択肢の正解と、実際にコードを書いて解けることは別なので、通常の問題集のコード演習も併せて使えます。</p></section>
  <section><h2>実行記録の範囲</h2><p>2026年10月29日に{replayed}問について、表示コードまたは穴埋めの完成形をJDK 21.0.13・rustc 1.99.1で再照合しました。出力・コンパイルエラー・実行時エラー・コンパイルだけを確認する例を区別しています。これは全解説を人が逐語校閲したという意味ではありません。</p><p>JavaScriptや診断メッセージを読む3問は概念の確認として扱い、Rustで検証済みとは表示しません。unsafeを含む1問は今回の自動実行対象から外し、以前の記録であることを明記しています。</p><p>画面の保存済み記録は、いま実行した結果ではありません。Javaの一部にはブラウザ内の簡易実行・追跡機能がありますが、Javaの全文法を扱うJDKそのものではありません。自由に編集したコードの確認は、通常のコード演習または手元のコンパイラで行ってください。</p><p><a href="/learning-v2/supplemental-verification.json" target="_blank" rel="noreferrer">照合の件数と対象外の一覧 ↗</a></p></section>
  <section><h2>学習記録を残す</h2><p>記録はこのブラウザに保存します。設定画面からJSONに書き出して保管できます。ブラウザのデータを消す前や別端末へ移る前に書き出してください。学習内容や下書きを外部へ自動送信する仕組みはありません。</p><p><Link to="/settings">記録を書き出す →</Link>　<a href="/learn?section=drill">通常の問題集へ戻る →</a></p></section>
 </div>;
}
