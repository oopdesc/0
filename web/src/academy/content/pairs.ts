/**
 * Java と Rust の「同じ考え方、違う結果」を並べるための対応表。
 *
 * ここに書くのは「どの 2 問を並べるか」と「何が違うか」だけ。
 * コードと出力は問題データ（実測記録つき）から引くので、この表が新しい主張を増やさない。
 */
export interface Pair {
  id: string;
  title: string;
  /** 何の概念か（1 行） */
  idea: string;
  java: string;
  rust: string;
  /** 並べたときに見える違い。ここが学習の中心。 */
  difference: string;
  /** 間違えやすいポイント（1 行ルール） */
  trap: string;
}

export const PAIRS: Pair[] = [
  {
    id: 'int-division',
    title: '整数どうしの割り算',
    idea: '両方とも「整数 / 整数」は整数になる。切り捨ての向きは同じか。',
    java: 'j-core-02',
    rust: 'r-core-03',
    difference:
      'どちらも小数点以下を捨てる。ただし Rust は「型が同じであること」を強制するので、7 / 2.0 は型エラー（E0277）になる。Java は int と double の混在を自動で昇格させる。',
    trap: '整数除算の結果は同じ。違うのは「混ぜられるか」',
  },
  {
    id: 'string-equality',
    title: '文字列の比較',
    idea: '同じ中身の文字列を == で比べたとき、何が返るか。',
    java: 'j-core-18',
    rust: 'r-core-08',
    difference:
      'Java の == は参照の同一性なので、new String した別インスタンスでは false になる（equals が中身）。Rust の == は PartialEq の実装で中身を比べるので true。同じ記号が別の意味を持つ代表例。',
    trap: 'Java の == は「同じものか」、Rust の == は「同じ値か」',
  },
  {
    id: 'null-vs-option',
    title: '「値が無い」の表し方',
    idea: '無いかもしれない値を、型でどう表すか。',
    java: 'j-err-08',
    rust: 'r-data-08',
    difference:
      'Java の null はどの参照型にも入る。無いことを型は教えてくれないので、実行してみるまで分からず NullPointerException になる。Rust の Option は型に「無いかもしれない」が入るので、開ける前に扱いを決めさせられる（unwrap すれば panic するが、それは選んだ結果）。',
    trap: 'null は実行時に分かる。Option はコンパイル時に分かる',
  },
  {
    id: 'mutation',
    title: '状態を書き換えるメソッド',
    idea: 'オブジェクトの状態を変えるとき、何を宣言するか。',
    java: 'j-oop-21',
    rust: 'r-data-07',
    difference:
      'Java はフィールドを書き換えるのに宣言が要らない。Rust は &mut self を取るので、呼び出し側の変数も mut である必要がある。読み手は「この呼び出しで状態が変わる」ことを型から知れる。',
    trap: 'Rust は「書き換える」ことが型に出る。Java は出ない',
  },
  {
    id: 'copy-vs-move',
    title: '代入したときに何が起きるか',
    idea: 'a を b に代入したあと、a はまだ使えるか。',
    java: 'j-core-07',
    rust: 'r-own-02',
    difference:
      'Java の代入は参照のコピー。元の変数も同じオブジェクトを指したまま使える。Rust は String の代入が move になり、元の変数は使えなくなる（E0382）。i32 などの Copy 型だけはコピーされる。',
    trap: 'Java は参照をコピー、Rust は所有権を移す',
  },
  {
    id: 'overflow',
    title: '整数のオーバーフロー',
    idea: 'int の上限を超えたらどうなるか。',
    java: 'j-core-03',
    rust: 'r-core-05',
    difference:
      'どちらも 32bit に収まらない分は折り返すが、Rust はデバッグビルドで panic する（リリースビルドでは折り返し）。Java は常に折り返す。同じ「あふれ」でも、気づけるかどうかが違う。',
    trap: 'Rust のデバッグビルドは溢れを panic で教える。Java は黙って折り返す',
  },
  {
    id: 'shadowing',
    title: '同じ名前の変数をもう一度',
    idea: '内側のブロックで同名の変数を宣言できるか。',
    java: 'j-core-19',
    rust: 'r-core-18',
    difference:
      'Java は外側が有効な間は同名を宣言できない（already-defined）。Rust はシャドーイングを許すので、内側のスコープで別の型の値にすら作り直せる。',
    trap: 'Java は同名禁止、Rust は隠して作り直せる',
  },
  {
    id: 'private',
    title: '外から触れないようにする',
    idea: '内部のフィールドを外から読ませない仕組みは、どこで止めるか。',
    java: 'j-oop-20',
    rust: 'r-adv-11',
    difference:
      'Java の private はクラス単位。同じクラスの中なら触れる。Rust の可視性はモジュール単位で、既定が private（pub を付けたものだけ外から見える）。境界の引き方が違う。',
    trap: 'Java はクラスの境界、Rust はモジュールの境界',
  },
  {
    id: 'exhaustive-switch',
    title: '分岐の網羅性',
    idea: '取りうる値の一部しか書かなかったとき、いつ気づくか。',
    java: 'j-core-20',
    rust: 'r-data-04',
    difference:
      'Java の switch は default を書かなくてもコンパイルできる（実行時に素通りする）。Rust の match は全パターンを要求するので、enum にバリアントを足した瞬間にコンパイルエラーで漏れが見つかる。',
    trap: 'Rust は書き忘れをコンパイルで止める。Java は実行で素通り',
  },
  {
    id: 'collect-vs-iterator',
    title: '変換して集める',
    idea: '写像して集める流れは、両方でどう書くか。',
    java: 'j-fn-07',
    rust: 'r-abs-04',
    difference:
      'Java の Stream は遅延するパイプラインで、collect して初めて List になる。Rust のイテレータも遅延し、collect で初めて Vec になる。どちらも「終端操作を忘れると何も起きない」。',
    trap: 'どちらも遅延。collect を忘れると何も起きない',
  },
  {
    id: 'error-handling',
    title: '失敗するかもしれない処理',
    idea: '失敗をどう呼び出し元に伝えるか。',
    java: 'j-err-11',
    rust: 'r-adv-09',
    difference:
      'Java の checked 例外は「投げる」か「捕まえる」かをコンパイル時に強制される。Rust は Result を返し、? で伝播する。どちらも「無視できない」が、Java は制御フロー（throw）、Rust は値（Result）で表す。',
    trap: 'Java は throw / catches、Rust は Result と ?',
  },
  {
    id: 'determinism',
    title: '同じ計算を 2 回',
    idea: '種から作る疑似乱数は、2 回呼ぶと同じ値になるか。',
    java: 'j-core-12',
    rust: 'r-int-06',
    difference:
      'どちらも決定的。状態だけで結果が決まる純粋な計算なら、同じ入力からは同じ出力になる。シミュレーションの再現性はこの性質に乗っている。',
    trap: '乱数に見える計算も、種が同じなら同じ列',
  },
];
