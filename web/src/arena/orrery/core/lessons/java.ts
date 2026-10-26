import type { Challenge, Lesson, Track } from './schema';

type Seed = Omit<Challenge, 'dialect'> & { dialect?: Challenge['dialect'] };
const jc = (c: Seed): Challenge => ({ dialect: 'java', ...c });

const arithmetic: Lesson = {
  id: 'java-arith',
  track: 'java',
  kicker: '01 / 基本型',
  title: '7 ÷ 2 は、なぜ 3 なのか',
  summary: '代入先の型は演算の型を変えない。予測と現実の最初のズレを、整数除算で体験する。',
  concepts: ['java-division', 'java-primitive'],
  minutes: 8,
  challenges: [
    jc({
      id: 'j-arith-1', kind: 'example', concept: 'java-division',
      prompt: 'まず完成例を動かす。出力を声に出して言ってから実行してみよう。',
      code: 'int a = 7 / 2;\nprintln(a);',
      solution: 'int a = 7 / 2;\nprintln(a);',
      expectedOutput: ['3'],
      explanation: '7 と 2 はどちらも int リテラルなので整数除算になる。結果 3.5 の小数部は捨てられて 3。',
      patch: 'int / int は小数点以下を切り捨てる',
    }),
    jc({
      id: 'j-arith-2', kind: 'predict', concept: 'java-division',
      prompt: '予測してから実行する。代入先を double にすると表示はどうなる？',
      code: 'int a = 7 / 2;\ndouble b = a;\nprintln(b);',
      solution: 'int a = 7 / 2;\ndouble b = a;\nprintln(b);',
      options: ['3', '3.0', '3.5', 'コンパイルエラー'], answer: '3.0',
      expectedOutput: ['3.0'],
      explanation: '割り算は int 同士で先に 3 になる。その後 double へ widening されて 3.0。代入先の型は演算結果の型を変えない。',
      patch: '代入先の型は、すでに終わった演算の型を遡って変えない',
      hints: ['どちらが先？ 割り算と代入、どちらが先に起きるか。'],
    }),
    jc({
      id: 'j-arith-3', kind: 'fill', concept: 'java-division',
      prompt: '穴を埋めて 3.5 を表示する。',
      code: 'double c = 7.0 / ____;\nprintln(c);',
      starter: 'double c = 7.0 / ____;\nprintln(c);',
      solution: 'double c = 7.0 / 2;\nprintln(c);',
      answer: '2', expectedOutput: ['3.5'],
      explanation: '片方が 7.0（double）なので、もう片方の int 2 が double に昇格してから浮動小数点除算になる。',
      patch: '片方が double なら演算全体が double になる',
      hints: ['7.0 の「.0」が何を変えているか考える。'],
    }),
    jc({
      id: 'j-arith-4', kind: 'order', concept: 'java-division',
      prompt: '正しい順に並べ替えて、7 を 2 で割った小数結果を表示する。',
      lines: ['double x = 7.0;', 'double y = 2;', 'println(x / y);'],
      solution: 'double x = 7.0;\ndouble y = 2;\nprintln(x / y);',
      expectedOutput: ['3.5'],
      explanation: '宣言 → 宣言 → 演算と出力。最初から浮動小数リテラルにしておけば昇格を待たなくてよい。',
      patch: '精度は「演算の前に」揃える',
    }),
    jc({
      id: 'j-arith-5', kind: 'build', concept: 'java-division',
      prompt: '自力で書く。9 を 2 で割った結果を 4.5 と表示するコードを 1 行で。',
      starter: '',
      solution: 'println(9.0 / 2);',
      expectedOutput: ['4.5'],
      explanation: '9.0 / 2 は double / int → double 除算で 4.5。9 / 2 なら 4 になる。',
      patch: '小数結果が欲しければ、被除数か除数を最初から小数にする',
      hints: ['9 / 2 は 4 になる。では 9.0 / 2 は？'],
    }),
    jc({
      id: 'j-arith-6', kind: 'transfer', concept: 'java-division',
      prompt: '初見類題。次のコードの出力を予測してから実行して確かめる。',
      code: 'int n = 5;\nprintln(n / 2);\nprintln(n / 2.0);',
      solution: 'int n = 5;\nprintln(n / 2);\nprintln(n / 2.0);',
      options: ['2 と 2.5', '2.5 と 2.5', '2 と 2', 'エラー'], answer: '2 と 2.5',
      expectedOutput: ['2', '2.5'],
      explanation: '同じ変数 n でも、右オペランドが 2 か 2.0 かで演算の型が切り替わる。型は「式ごと」に決まる。',
      patch: '型は変数ではなく、その式のオペランドで決まる',
    }),
  ],
};

const arrays: Lesson = {
  id: 'java-arrays',
  track: 'java',
  kicker: '02 / 配列と境界',
  title: '最後の要素は a[a.length] ではない',
  summary: '.length は最大 index ではなく要素数。境界を不変条件として読む練習。',
  concepts: ['java-array', 'java-exception'],
  minutes: 9,
  challenges: [
    jc({
      id: 'j-arr-1', kind: 'example', concept: 'java-array',
      prompt: '完成例。配列の「長さ」と「最後の位置」は別物だと確認する。',
      code: 'int[] a = {5, 6, 7};\nprintln(a.length);\nprintln(a[a.length - 1]);',
      solution: 'int[] a = {5, 6, 7};\nprintln(a.length);\nprintln(a[a.length - 1]);',
      expectedOutput: ['3', '7'],
      explanation: '要素数は 3、有効な添字は 0,1,2。最後の要素は a[3-1] = a[2] = 7。',
      patch: '配列.length は要素数。最後の index は length - 1',
    }),
    jc({
      id: 'j-arr-2', kind: 'predict', concept: 'java-array',
      prompt: '予測してから実行する。a[a.length] は何を表示する？',
      code: 'int[] a = {5, 6, 7};\nprintln(a[a.length]);',
      options: ['7', '3', '0', 'エラー（範囲外アクセス）'], answer: 'エラー（範囲外アクセス）',
      explanation: 'Java では ArrayIndexOutOfBoundsException。この教材ランタイムも同じ境界違反をエラーとして表示する。',
      patch: '有効な添字は 0 <= i < a.length。等号は入らない',
    }),
    jc({
      id: 'j-arr-3', kind: 'fill', concept: 'java-array',
      prompt: '穴埋め。最後の要素 7 を安全に取り出す。',
      code: 'int[] a = {5, 6, 7};\nprintln(a[a.length - ____]);',
      starter: 'int[] a = {5, 6, 7};\nprintln(a[a.length - ____]);',
      solution: 'int[] a = {5, 6, 7};\nprintln(a[a.length - 1]);',
      answer: '1', expectedOutput: ['7'],
      explanation: 'length - 1 が「境界の内側」に留まる唯一の調整。',
      patch: '境界にアクセスするときは必ず -1 を疑う',
    }),
    jc({
      id: 'j-arr-4', kind: 'debug', concept: 'java-exception',
      prompt: 'このコードは実行時に落ちる。原因を 1 行で直す。',
      starter: 'int[] a = {5, 6, 7};\nprintln(a[a.length]);',
      solution: 'int[] a = {5, 6, 7};\nprintln(a[a.length - 1]);',
      expectedOutput: ['7'],
      explanation: 'エラーは「間違い」ではなく「境界の通知」。有効範囲の不変条件を壊していた。',
      patch: 'エラーは境界条件が壊れた場所を教えてくれる',
      hints: ['エラーメッセージに出ている index と要素数を見比べる。'],
    }),
    jc({
      id: 'j-arr-5', kind: 'build', concept: 'java-array',
      prompt: '自力で書く。配列 {2,4,6,8} の先頭と末尾を足して 10 と表示する。',
      starter: '',
      solution: 'int[] a = {2, 4, 6, 8};\nprintln(a[0] + a[a.length - 1]);',
      expectedOutput: ['10'],
      explanation: '先頭 a[0] と末尾 a[a.length-1] を足す。要素数に依存しない書き方が重要。',
      patch: '配列の両端は a[0] と a[a.length - 1]',
    }),
    jc({
      id: 'j-arr-6', kind: 'transfer', concept: 'java-array',
      prompt: '初見類題。型が変わっても境界の規則は同じか確かめる。',
      code: 'String[] s = {"a", "b", "c"};\nprintln(s.length);\nprintln(s[2]);',
      solution: 'String[] s = {"a", "b", "c"};\nprintln(s.length);\nprintln(s[2]);',
      expectedOutput: ['3', 'c'],
      explanation: 'String[] でも .length は要素数。型が違っても不変条件は共通。',
      patch: '.length の意味は要素の型に依存しない',
    }),
  ],
};

const oop: Lesson = {
  id: 'java-oop',
  track: 'java',
  kicker: '03 / オブジェクト指向',
  title: '天体を class にすると、呼ばれるメソッドが変わる',
  summary: 'class → 天体、継承 → 分類、override → 実体側の振る舞い。宇宙の構成要素として OOP を読む。',
  concepts: ['java-class', 'java-inheritance', 'java-polymorphism'],
  minutes: 12,
  challenges: [
    jc({
      id: 'j-oop-1', kind: 'example', concept: 'java-polymorphism',
      prompt: '完成例。Planet は Body の一種。super で親の実装を呼べる。',
      code: `class Body {
  String kind() { return "body"; }
}
class Planet extends Body {
  String kind() { return "planet"; }
  String parent() { return super.kind(); }
}
Planet p = new Planet();
println(p.kind());
println(p.parent());`,
      solution: `class Body {
  String kind() { return "body"; }
}
class Planet extends Body {
  String kind() { return "planet"; }
  String parent() { return super.kind(); }
}
Planet p = new Planet();
println(p.kind());
println(p.parent());`,
      expectedOutput: ['planet', 'body'],
      explanation: 'p.kind() は Planet の override が実行される。super.kind() は親クラス Body の実装を明示的に呼ぶ。',
      patch: 'override された instance method は実体側が実行される',
    }),
    jc({
      id: 'j-oop-2', kind: 'predict', concept: 'java-polymorphism',
      prompt: '予測してから実行。変数の宣言型が Body でも、呼ばれるメソッドは？',
      code: `class Body { String kind() { return "body"; } }
class Planet extends Body { String kind() { return "planet"; } }
Body b = new Planet();
println(b.kind());`,
      solution: `class Body { String kind() { return "body"; } }
class Planet extends Body { String kind() { return "planet"; } }
Body b = new Planet();
println(b.kind());`,
      options: ['body', 'planet', 'コンパイルエラー', 'null'], answer: 'planet',
      expectedOutput: ['planet'],
      explanation: '宣言型は「どのメソッドを呼べるか」を決め、実体型は「どの実装が呼ばれるか」を決める。動的ディスパッチ。',
      patch: '宣言型＝呼べる範囲、実体型＝実行される実装',
    }),
    jc({
      id: 'j-oop-3', kind: 'fill', concept: 'java-inheritance',
      prompt: '穴埋め。親の実装を呼び出すキーワードを入れる。',
      code: `class Body { String kind() { return "body"; } }
class Planet extends Body {
  String parent() { return ____ .kind(); }
}
println(new Planet().parent());`,
      starter: `class Body { String kind() { return "body"; } }
class Planet extends Body {
  String parent() { return ____ .kind(); }
}
println(new Planet().parent());`,
      solution: `class Body { String kind() { return "body"; } }
class Planet extends Body {
  String parent() { return super.kind(); }
}
println(new Planet().parent());`,
      answer: 'super', expectedOutput: ['body'],
      explanation: 'super は「親クラスの実装を探す」ための修飾。this は「自分自身のインスタンス」。',
      patch: 'super は親の実装、this は自分のインスタンス',
    }),
    jc({
      id: 'j-oop-4', kind: 'debug', concept: 'java-polymorphism',
      prompt: 'デバッグ。override のつもりが呼ばれていない。シグネチャを直す。',
      starter: `class Body { String kind() { return "body"; } }
class Planet extends Body { String kind(int n) { return "planet"; } }
Body b = new Planet();
println(b.kind());`,
      solution: `class Body { String kind() { return "body"; } }
class Planet extends Body { String kind() { return "planet"; } }
Body b = new Planet();
println(b.kind());`,
      expectedOutput: ['planet'],
      explanation: '引数が違えば別メソッド（overload）で、override にはならない。@Override を付けるとコンパイラが検出してくれる。',
      patch: 'override はシグネチャ完全一致。引数を変えると overload になる',
      hints: ['メソッド名だけでなく、引数の並びも比べる。'],
    }),
    jc({
      id: 'j-oop-5', kind: 'build', concept: 'java-class',
      prompt: '自力で書く。Body を継承した Star を作り、kind() が "star" を返すようにして表示する。',
      starter: 'class Body { String kind() { return "body"; } }',
      solution: `class Body { String kind() { return "body"; } }
class Star extends Body { String kind() { return "star"; } }
Star s = new Star();
println(s.kind());`,
      expectedOutput: ['star'],
      explanation: 'extends で分類を作り、同じシグネチャのメソッドを書き直すと実体側が選ばれる。',
      patch: 'class は設計図、extends は分類、override は振る舞いの差し替え',
    }),
    jc({
      id: 'j-oop-6', kind: 'transfer', concept: 'java-inheritance',
      prompt: '初見類題。Java で「複数の型として扱える能力の契約」を宣言する構文は？',
      options: ['interface', 'abstract class', 'final class', 'static method'], answer: 'interface',
      reading: 'interface は実装を持たない契約（Java 8 以降は default メソッドも持てる）。abstract class は共通実装を持てるが、クラス継承は 1 つだけ。sealed は「どのクラスが継承できるか」を制限する。この教材ランタイムは interface / sealed / record を実行しない。読解と予測で扱う。',
      explanation: '契約だけを共有したい場合は interface。状態と共通実装も共有したい場合は abstract class。',
      patch: '契約＝interface、共通実装＝abstract class、継承先の制限＝sealed',
    }),
  ],
};

const cosmos: Lesson = {
  id: 'java-cosmos',
  track: 'java',
  kicker: '04 / コレクションと宇宙',
  title: 'Stream を for に展開して、銀河を組み立てる',
  summary: 'Stream/lambda はこの教材ランタイムでは実行しない。等価な for で「入力→判断→処理→結果」を追い、天体を生成する。',
  concepts: ['java-collections', 'sim-model'],
  minutes: 11,
  challenges: [
    jc({
      id: 'j-cos-1', kind: 'explain', concept: 'java-collections',
      prompt: 'まず読み解く。Stream の 1 段は for の 1 役に相当する。',
      options: ['filter は if、map は変換、collect は追加', 'filter は追加、map は削除', 'Stream は常に即時実行', 'Stream は配列を破壊する'],
      answer: 'filter は if、map は変換、collect は追加',
      reading: 'planets.stream().filter(p -> p.mass() > 10).map(p -> p.x()).collect(...) は、「全件を順に見て、条件で選び、値を変換して、集める」というパイプライン。元のコレクションは壊さない。この教材ランタイムは lambda / Stream を実行しないため、等価な for ループで構造を追う。',
      explanation: 'Stream は「どう回すか」ではなく「何を適用するか」を宣言する。だから同じ構造を for に展開して読める。',
      patch: 'Stream の各段は、for の中の if / 変換 / 追加に対応する',
    }),
    jc({
      id: 'j-cos-2', kind: 'trace', concept: 'sim-model',
      prompt: '処理を追う。各周回で orbit() が何体増やすか数えてから実行する。',
      code: `clear();
star(0, 0, 2600);
int[] radii = {40, 80, 120};
for (int i = 0; i < radii.length; i++) {
  orbit(0, 0, radii[i], 4, 0.7);
}
println(bodyCount());`,
      solution: `clear();
star(0, 0, 2600);
int[] radii = {40, 80, 120};
for (int i = 0; i < radii.length; i++) {
  orbit(0, 0, radii[i], 4, 0.7);
}
println(bodyCount());`,
      expectedOutput: ['13'], expectedBodies: 13,
      explanation: 'star 1 体 + orbit 3 回 × 4 体 = 13 体。orbit の第 4 引数は「何体作るか」なので、回数と掛け算になる。',
      patch: 'ループの結果は「回数 × 1回の効果」で数えられる',
    }),
    jc({
      id: 'j-cos-3', kind: 'fill', concept: 'java-collections',
      prompt: '穴埋め。半径の配列を 4 つにして、合計 13 体の宇宙を作る。',
      code: `clear();
star(0, 0, 2600);
int[] radii = {40, 80, 120, ____};
for (int i = 0; i < radii.length; i++) {
  orbit(0, 0, radii[i], 3, 0.7);
}
println(bodyCount());`,
      starter: `clear();
star(0, 0, 2600);
int[] radii = {40, 80, 120, ____};
for (int i = 0; i < radii.length; i++) {
  orbit(0, 0, radii[i], 3, 0.7);
}
println(bodyCount());`,
      solution: `clear();
star(0, 0, 2600);
int[] radii = {40, 80, 120, 160};
for (int i = 0; i < radii.length; i++) {
  orbit(0, 0, radii[i], 3, 0.7);
}
println(bodyCount());`,
      answer: '160', expectedOutput: ['13'], expectedBodies: 13,
      explanation: '配列が 4 要素ならループは 4 回。1 + 4×3 = 13。blank の数値自体は天体数に影響しない（半径だから）。',
      patch: 'データの要素数がループ回数を決める',
      hints: ['1 + 4 × 3 = 13。何周する必要がある？'],
    }),
    jc({
      id: 'j-cos-4', kind: 'order', concept: 'sim-model',
      prompt: '並べ替え。宇宙を初期化してから星と軌道を作る正しい手順は？',
      lines: ['clear();', 'star(0, 0, 2600);', 'orbit(0, 0, 100, 6, 0.6);', 'println(bodyCount());'],
      solution: 'clear();\nstar(0, 0, 2600);\norbit(0, 0, 100, 6, 0.6);\nprintln(bodyCount());',
      expectedOutput: ['7'], expectedBodies: 7,
      explanation: 'clear() を最後に呼ぶと全部消える。副作用の順序が結果を決める。',
      patch: '副作用のある処理は「初期化 → 生成 → 観測」の順で読む',
    }),
    jc({
      id: 'j-cos-5', kind: 'project', concept: 'sim-model',
      prompt: '小プロジェクト。星 1 体・惑星 2 体・軌道 8 体の小宇宙を自力で作り、体数を表示する。',
      starter: '// ここから書く\n',
      solution: `clear();
star(0, 0, 2600, "#f4c07a", "Sol");
planet(60, 0, 3, "#79c7bd", "Terra");
planet(100, 0, 4, "#d98a63", "Mars");
orbit(0, 0, 150, 8, 0.5);
println(bodyCount());`,
      expectedOutput: ['11'], expectedBodies: 11,
      explanation: '1 + 2 + 8 = 11 体。コードを変えれば宇宙が変わる。これがこの教材の中心。',
      patch: 'コードの 1 行は、宇宙の 1 つの構造に対応する',
      hints: ['star / planet / orbit / bodyCount を組み合わせる。'],
    }),
    jc({
      id: 'j-cos-6', kind: 'transfer', concept: 'sim-model',
      prompt: '初見類題。副作用の順番を変えたら、宇宙はどうなるか予測して確かめる。',
      code: 'star(0, 0, 100);\nclear();\nprintln(bodyCount());',
      solution: 'star(0, 0, 100);\nclear();\nprintln(bodyCount());',
      options: ['0', '1', '100', 'エラー'], answer: '0',
      expectedOutput: ['0'], expectedBodies: 0,
      explanation: 'clear() は後から呼ぶと、それ以前に作った天体も全部消す。宣言的ではなく手続き的なので順序が結果を決める。',
      patch: '副作用の順序を変えると結果が変わる。初期化は最初に置く',
    }),
  ],
};

export const JAVA_LESSONS: Lesson[] = [arithmetic, arrays, oop, cosmos];
export const JAVA_TRACK: Track = 'java';
