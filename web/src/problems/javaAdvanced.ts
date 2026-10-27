import type { Problem } from './schema';

/**
 * Java advanced problems (methods, OOP, inheritance, collections, functional,
 * errors, practical).
 *
 * `execution` distinguishes two honest paths:
 *   - 'browser-java' : the body is compiled into the TeaVM bundle and really
 *                     runs in the browser as Java bytecode-to-JS.
 *   - 'jvm-verified' : the expected output was produced by real javac/java
 *                     (JDK 21) but the browser only shows the verified
 *                     result, because the construct (Stream, record, ...) is
 *                     outside what TeaVM ships.
 */

const j = (p: Omit<Problem, 'language'>): Problem => ({ language: 'java', ...p });

export const JAVA_ADVANCED: Problem[] = [
  // ------------------------------------------------------------------ methods
  j({
    id: 'jm1', topic: 'java-method', level: 2, questionType: 'call-trace',
    prompt: '呼出しを追う。内側の add が先に評価される。',
    code: `class H {
  int add(int a, int b) { return a + b; }
}
System.out.println(new H().add(new H().add(1, 2), 3));`,
    prediction: { text: '出力を予想してください。', options: ['6', '4', '9', 'エラー'] },
    answer: '6', answerKind: 'text',
    expected: { output: ['6'], verifiedBy: 'javac 21 / java 21' },
    explanation: '内側 add(1,2)=3。外側 add(3,3)=6。',
    misconception: '呼出しは外側から内側へ私はないと誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: '引数は呼び出す前に評価される。内側が先',
    hints: ['内側の add は何を返すか。', '外側の呼び出しは？', '6。'],
    transfer: 'js3',
    reviewInterval: 2, execution: 'browser-java', source: 'JLS §15.12', version: 1,
  }),
  j({
    id: 'jm2', topic: 'java-method', level: 2, questionType: 'predict-output',
    prompt: '同じ名前のメソッドが 2 つある。どちらが呼ばれるか。',
    code: `class H {
  void show(int a) { System.out.println("int:" + a); }
  void show(String a) { System.out.println("str:" + a); }
}
new H().show(5);
new H().show("5");`,
    prediction: { text: '2 行の出力を予想してください。', options: ['int:5 と str:5', 'str:5 と int:5', 'int:5 と int:5', 'エラー'] },
    answer: 'int:5 と str:5', answerKind: 'text',
    expected: { output: ['int:5', 'str:5'], verifiedBy: 'javac 21 / java 21' },
    explanation: '同名でも引数の型が違えば別メソッド（overload）。型から正しい方を選ぶ。',
    misconception: 'メソッド名が同じなら 1 つだけと誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'overload は名前が同じで引数の型が違うメソッド。呼び先は引数の型で決まる',
    hints: ['show(5) は引数が int。', 'show("5") は引数が String。', 'int:5 と str:5。'],
    transfer: 'jcl2',
    reviewInterval: 2, execution: 'browser-java', source: 'JLS §8.4.9', version: 1,
  }),
  j({
    id: 'jm3', topic: 'java-method', level: 2, questionType: 'predict-output',
    prompt: '配列を引数に渡したあと、元の配列はどうなるか。',
    code: `class H {
  void change(int[] a) { a[0] = 99; }
}
int[] arr = {1};
new H().change(arr);
System.out.println(arr[0]);`,
    prediction: { text: '出力を予想してください。', options: ['1', '99', '0', 'エラー'] },
    answer: '99', answerKind: 'text',
    expected: { output: ['99'], verifiedBy: 'javac 21 / java 21' },
    explanation: '配列は参照型。引数に渡したのも同じ配列なので、中身を変えると元も変わる。',
    misconception: 'Java はすべて値渡しだから元は変わらないと誤解している。',
    misconceptionClass: 'value-vs-reference',
    oneLinePatch: '配列は参照。メソッド内で中身を変えると元の配列も変わる',
    hints: ['arr と引数 a は同じものを指しているか。', 'a[0] = 99 はどこに書かれるか。', '99。'],
    transfer: 'js1',
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §8.4.1', version: 1,
  }),
  j({
    id: 'jm4', topic: 'java-method', level: 3, questionType: 'minimal-fix',
    prompt: 'このメソッドは値を変えられない。最小の修正を書く。',
    code: `class H {
  int triple(int x) { return x * 3; }
}
int v = 4;
new H().triple(v);
System.out.println(v);`,
    starter: `class H {
  int triple(int x) { return x * 3; }
}
int v = 4;
new H().triple(v);
System.out.println(v);`,
    solution: `class H {
  void triple(int[] x) { x[0] = x[0] * 3; }
}
int[] v = {4};
new H().triple(v);
System.out.println(v[0]);`,
    prediction: { text: '直し方を予想してください。' },
    answer: 'int[] を受け取って中身を変える', answerKind: 'text',
    expected: { output: ['12'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'int は値型なので、メソッド内でchanged ても外には戻らない。配列を渡せば参照なので変えられる。',
    misconception: '戻り値を使わなくてもメソッドが値を変えられるとと誤解している。',
    misconceptionClass: 'value-vs-reference',
    oneLinePatch: '値型は値渡し。中身を変えたいなら配列やフィールドを使う',
    hints: ['int を渡しても外の変数は変わらない。', '参照型なら変えられるか。', '配列を使う。'],
    transfer: 'js1',
    prerequisite: ['js1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §8.4.1', version: 1,
  }),

  // --------------------------------------------------------------------- class
  j({
    id: 'jcl1', topic: 'java-class', level: 2, questionType: 'predict-output',
    prompt: '2 つの変数が同じオブジェクトを指している。',
    code: `class P {
  int v = 1;
}
P p = new P();
P q = p;
q.v = 9;
System.out.println(p.v);`,
    prediction: { text: '出力を予想してください。', options: ['1', '9', 'エラー', '0'] },
    answer: '9', answerKind: 'text',
    expected: { output: ['9'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'q = p は同じオブジェクトを指す。q.v = 9 はそのオブジェクトのフィールドを変える。',
    misconception: 'q = p でコピーされると誤解している。',
    misconceptionClass: 'value-vs-reference',
    oneLinePatch: '参照の代入は同じオブジェクトを指す。コピーではない',
    hints: ['p と q は同じものを指しているか。', 'フィールドは 1 つ。', '9。'],
    transfer: 'js1',
    reviewInterval: 2, execution: 'browser-java', source: 'JLS §4.3.1', version: 1,
  }),
  j({
    id: 'jcl2', topic: 'java-class', level: 2, questionType: 'predict-output',
    prompt: 'コンストラクタを 2 つ持つ。new の渡し方でどれが呼ばれるか。',
    code: `class C {
  int n;
  C() { n = 7; }
  C(int k) { n = k; }
}
System.out.println(new C().n + "," + new C(3).n);`,
    prediction: { text: '出力を予想してください。', options: ['7,3', '3,7', '7,7', 'エラー'] },
    answer: '7,3', answerKind: 'text',
    expected: { output: ['7,3'], verifiedBy: 'javac 21 / java 21' },
    explanation: '引数なしは C()、引数付きは C(int)。それぞれの初期化が走る。',
    misconception: 'コンストラクタは 1 つだけと誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'コンストラクタは引数の型で選ぶ。overload と同じ',
    hints: ['new C() はどれか。', 'new C(3) はどれか。', '7 と 3。'],
    transfer: 'jm2',
    reviewInterval: 2, execution: 'browser-java', source: 'JLS §8.8', version: 1,
  }),
  j({
    id: 'jcl3', topic: 'java-class', level: 3, questionType: 'variable-trace',
    prompt: 'インスタンス変数とクラス変数（静的フィールド）を追う。',
    code: `int[] total = {0};
class Counter {
  int mine = 0;
  Counter() { total[0]++; mine++; }
}
Counter a = new Counter();
Counter b = new Counter();
System.out.println(total[0] + "," + a.mine + "," + b.mine);`,
    prediction: { text: '出力を予想してください。', options: ['2,1,1', '1,1,1', '2,2,2', '1,2,1'] },
    answer: '2,1,1', answerKind: 'text',
    expected: { output: ['2,1,1'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'total は全インスタンスで共有。mine はインスタンスごと。a と b で 2 回呼ばれる。',
    misconception: 'クラス変数もインスタンスごとに別になると誤解している。',
    misconceptionClass: 'scope',
    oneLinePatch: 'static フィールドはクラスで 1 つ。インスタンス変数はそれぞれ別',
    hints: ['new は何回あるか。', 'total は何回増えるか。', 'mine はインスタンスごと。'],
    transfer: 'jcl4',
    prerequisite: ['js1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §8.3', version: 1,
  }),
  j({
    id: 'jcl4', topic: 'java-class', level: 3, questionType: 'implement',
    prompt: '自力で書く。kind() が "star" を返す Star クラスを作って表示する。',
    starter: `class Body {
  String kind() { return "body"; }
}`,
    solution: `class Body {
  String kind() { return "body"; }
}
class Star extends Body {
  String kind() { return "star"; }
}
System.out.println(new Star().kind());`,
    prediction: { text: '動くコードを書いてから実行してください。' },
    answer: 'class Star extends Body { String kind() { return "star"; } }', answerKind: 'code',
    expected: { output: ['star'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'extends で分類を作り、同じシグネチャのメソッドを書き直すと実体側が選ばれる。',
    misconception: '継承すると親の実装がそのまま使われるとと誤解している。',
    misconceptionClass: 'override-overload',
    oneLinePatch: 'override された instance method は実体側が実行される',
    hints: ['Star は Body のサブクラス。', 'kind を書き直す。', '"star" を返す。'],
    transfer: 'ji1',
    prerequisite: ['js1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §8.4.8', version: 1,
  }),

  // --------------------------------------------------------------- inheritance
  j({
    id: 'ji1', topic: 'java-inherit', level: 3, questionType: 'override-choice',
    prompt: '宣言型は亲、実体は子。呼ばれるメソッドはどれか。',
    code: `class A {
  String kind() { return "A"; }
}
class B extends A {
  String kind() { return "B"; }
}
A a = new B();
System.out.println(a.kind());`,
    prediction: { text: '出力を予想してください。', options: ['A', 'B', 'エラー', 'null'] },
    answer: 'B', answerKind: 'text',
    expected: { output: ['B'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'instance method は動的ディスパッチ。宣言型は「呼べるか」、実体型は「実行されるか」を決める。',
    misconception: '宣言型のメソッドが呼ばれると誤解している。',
    misconceptionClass: 'override-overload',
    oneLinePatch: 'instance method は実体側が実行される。宣言型は呼べる範囲だけ決める',
    hints: ['a が指すオブジェクトのクラスは？', 'kind() はどこにあるか。', 'B。'],
    transfer: 'jcl4',
    prerequisite: ['js1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §8.4.8', version: 1,
  }),
  j({
    id: 'ji2', topic: 'java-inherit', level: 3, questionType: 'override-choice',
    prompt: 'static メソッドは override されない。呼ばれるのはどれか。',
    code: `class A {
  static String kind() { return "A"; }
}
class B extends A {
  static String kind() { return "B"; }
}
A a = new B();
System.out.println(a.kind());`,
    prediction: { text: '出力を予想してください。', options: ['A', 'B', 'エラー', 'null'] },
    answer: 'A', answerKind: 'text',
    expected: { output: ['A'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'static メソッドは静的バインディング。呼び出し側の型（A）で決まる（hiding）。',
    misconception: 'static メソッドも多態すると誤解している。',
    misconceptionClass: 'override-overload',
    oneLinePatch: 'static メソッドは宣言型で決まる。多態しない',
    hints: ['static はオブジェクトよりクラスに属する。', 'a の宣言型は？', 'A。'],
    transfer: 'jcl4',
    prerequisite: ['js1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §8.4.8', version: 1,
  }),
  j({
    id: 'ji3', topic: 'java-inherit', level: 3, questionType: 'override-choice',
    prompt: 'フィールドは多態しない。表示される値はどれか。',
    code: `class A {
  int v = 1;
}
class B extends A {
  int v = 2;
}
A a = new B();
System.out.println(a.v);`,
    prediction: { text: '出力を予想してください。', options: ['1', '2', 'エラー', '0'] },
    answer: '1', answerKind: 'text',
    expected: { output: ['1'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'フィールドは静的バインディング。a の型（A）のフィールドを見る。',
    misconception: 'フィールドもメソッドと同じく実体側が選ばれると誤解している。',
    misconceptionClass: 'override-overload',
    oneLinePatch: 'フィールドは多態しない。参照の型で決まる',
    hints: ['a.v は宣言型のフィールドか実体側か。', 'フィールドは静的解決。', '1。'],
    transfer: 'jcl4',
    prerequisite: ['js1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §8.3', version: 1,
  }),
  j({
    id: 'ji4', topic: 'java-inherit', level: 3, questionType: 'minimal-fix',
    prompt: 'override のつもりが呼ばれていない。最小の修正を書く。',
    code: `class A {
  void m() { System.out.println("A"); }
}
class B extends A {
  void m(int x) { System.out.println("B"); }
}
new B().m();`,
    starter: `class A {
  void m() { System.out.println("A"); }
}
class B extends A {
  void m(int x) { System.out.println("B"); }
}
new B().m();`,
    solution: `class A {
  void m() { System.out.println("A"); }
}
class B extends A {
  @Override
  void m() { System.out.println("B"); }
}
new B().m();`,
    prediction: { text: '直し方を予想してください。' },
    answer: 'void m() にシグネチャを合わせる', answerKind: 'text',
    expected: { output: ['B'], verifiedBy: 'javac 21 / java 21' },
    explanation: '引数が違えば overload で override にならない。亲の m() が呼ばれる。シグネチャを一致させる。',
    misconception: 'メソッド名が同じなら override になると誤解している。',
    misconceptionClass: 'override-overload',
    oneLinePatch: 'override はシグネチャ完全一致。引数を変えると overload になる',
    hints: ['@Override を付けるとコンパイラが教える。', 'm() と m(int) は別物か。', 'シグネチャを揃える。'],
    transfer: 'jcl4',
    prerequisite: ['js1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §8.4.8', version: 1,
  }),

  // --------------------------------------------------------------- collections
  j({
    id: 'jco1', topic: 'java-collections', level: 3, questionType: 'predict-output',
    prompt: 'List と Set では重複の扱いが違う。出力を予想してください。',
    code: `java.util.List<String> list = new java.util.ArrayList<>();
list.add("a");
list.add("b");
list.add("a");
System.out.println(list.size());`,
    prediction: { text: '出力を予想してください。', options: ['2', '3', 'エラー', '1'] },
    answer: '3', answerKind: 'text',
    expected: { output: ['3'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'List は順序を保ち、重複も保持する。add を 3 回呼べば size は 3。',
    misconception: 'List も重複を排除するとと誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'List は重複を許す。Set こそ重複を排除する',
    hints: ['add は何回呼ばれたか。', 'List は重複を残すか。', '3。'],
    transfer: 'jco2',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'jvm-verified', source: 'java.util.List#add', version: 1,
  }),
  j({
    id: 'jco2', topic: 'java-collections', level: 3, questionType: 'predict-output',
    prompt: '同じ操作を Set でするとどうなるか。',
    code: `java.util.Set<String> set = new java.util.HashSet<>();
set.add("a");
set.add("b");
set.add("a");
System.out.println(set.size());`,
    prediction: { text: '出力を予想してください。', options: ['2', '3', 'エラー', '1'] },
    answer: '2', answerKind: 'text',
    expected: { output: ['2'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'Set は重複を排除するので、要素は a と b の 2 つ。',
    misconception: 'Set も List と同じように入れると誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'Set は重複を排除する。順序は保証されない',
    hints: ['同じ文字を 2 回入れた。', 'Set の規則は？', '2。'],
    transfer: 'jco1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'jvm-verified', source: 'java.util.Set#add', version: 1,
  }),
  j({
    id: 'jco3', topic: 'java-collections', level: 3, questionType: 'compile',
    prompt: '泛型の型引数を間違えた。コンパイルできるか。',
    code: `java.util.List<String> list = new java.util.ArrayList<Integer>();`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時エラー'] },
    answer: 'コンパイルできない', answerKind: 'text',
    expected: { compiles: false, compileError: 'incompatible types: java.util.ArrayList<java.lang.Integer> cannot be converted to java.util.List<java.lang.String>', verifiedBy: 'javac 21' },
    explanation: 'List<String> に ArrayList<Integer> は代入できない。泛型は不変（invariant）。',
    misconception: 'List は共通の親型だから代入できると誤解している。',
    misconceptionClass: 'type',
    oneLinePatch: '泛型は不変。List<String> と List<Integer> は互いに代入できない',
    hints: ['List<String> と ArrayList<Integer> は同じか。', '泛型の型引数は一致させる。', 'コンパイルできない。'],
    transfer: 'jco4',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'compile-checked', source: 'JLS §4.5', version: 1,
  }),
  j({
    id: 'jco4', topic: 'java-collections', level: 3, questionType: 'predict-output',
    prompt: 'Map の同じキーに 2 回代入するとどうなるか。',
    code: `java.util.Map<String, Integer> map = new java.util.HashMap<>();
map.put("a", 1);
map.put("a", 2);
System.out.println(map.get("a"));`,
    prediction: { text: '出力を予想してください。', options: ['1', '2', 'エラー', 'null'] },
    answer: '2', answerKind: 'text',
    expected: { output: ['2'], verifiedBy: 'javac 21 / java 21' },
    explanation: '同じキーへの put は上書き。値は最後の 2 になる。',
    misconception: '2 つとも残ると誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'Map はキーごとに 1 つ。同じキーは上書きする',
    hints: ['キーは同じか。', 'put は上書きか追加か。', '2。'],
    transfer: 'jco1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'jvm-verified', source: 'java.util.Map#put', version: 1,
  }),

  // ----------------------------------------------------------------- functional
  j({
    id: 'jf1', topic: 'java-functional', level: 3, questionType: 'predict-output',
    prompt: 'ラムダ式の結果を予想してください。',
    code: `java.util.function.Function<Integer, Integer> f = x -> x * 2;
System.out.println(f.apply(5));`,
    prediction: { text: '出力を予想してください。', options: ['5', '10', '25', 'エラー'] },
    answer: '10', answerKind: 'text',
    expected: { output: ['10'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'ラムダはメソッド相当のオブジェクト。apply(5) は 5*2=10。',
    misconception: 'ラムダは即座に実行されると誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'ラムダは値（関数オブジェクト）。呼ばないと動かない',
    hints: ['x に何が入るか。', '何を返すか。', '10。'],
    transfer: 'jf4',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'jvm-verified', source: 'JLS §15.27', version: 1,
  }),
  j({
    id: 'jf2', topic: 'java-functional', level: 3, questionType: 'variable-trace',
    prompt: 'Stream の各段を追う。filter → map → sum の流れ。',
    code: `java.util.List<Integer> xs = java.util.Arrays.asList(1, 2, 3, 4);
int sum = xs.stream()
  .filter(x -> x % 2 == 0)
  .mapToInt(Integer::intValue)
  .sum();
System.out.println(sum);`,
    prediction: { text: 'sum の値を予想してください。', options: ['6', '10', '3', '4'] },
    answer: '6', answerKind: 'text',
    expected: { output: ['6'], verifiedBy: 'javac 21 / java 21' },
    explanation: '偶数は 2 と 4。合計 6。',
    misconception: 'filter は数を減らさず通すと誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'Stream は filter → map → terminal op の順。終端演算で実行される',
    hints: ['filter は何が残るか。', '2 と 4。', '合計は？'],
    transfer: 'jco1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'jvm-verified', source: 'java.util.stream.Stream', version: 1,
  }),
  j({
    id: 'jf3', topic: 'java-functional', level: 3, questionType: 'predict-output',
    prompt: 'Optional が空のときの代替値を予想してください。',
    code: `java.util.Optional<String> o = java.util.Optional.empty();
System.out.println(o.orElse("none"));`,
    prediction: { text: '出力を予想してください。', options: ['null', 'none', 'Optional.empty', 'エラー'] },
    answer: 'none', answerKind: 'text',
    expected: { output: ['none'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'orElse は中身があるときはそれを返し、空なら与えた代替値を返す。',
    misconception: '空の Optional は null を返すと誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'Optional.orElse は空なら代替値を返す。null ではない',
    hints: ['o の中身はあるか。', '空のとき何が返るか。', 'none。'],
    transfer: 'jco1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'jvm-verified', source: 'java.util.Optional#orElse', version: 1,
  }),
  j({
    id: 'jf4', topic: 'java-functional', level: 3, questionType: 'api-meaning',
    prompt: 'Optional を使わない場合と使う場合の違いとして正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      'Optional は使わなくてもコンパイルできる。検査は明示的に書く',
      'Optional は使わなければコンパイルできない',
      'Optional は実行時に null を生成する',
      'Optional は配列の別名',
    ] },
    answer: 'Optional は使わなくてもコンパイルできる。検査は明示的に書く', answerKind: 'option',
    expected: { value: 'Optional は使わなくてもコンパイルできる。検査は明示的に書く', verifiedBy: 'javac 21' },
    explanation: 'Java の Optional はライブラリの型。Rust の Option のように「扱い忘れがコンパイルエラー」にはならない。',
    misconception: 'Java の Optional は Rust の Option と同じ強制力を持つと誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'Java の Optional は任意。Rust の Option は必須。検出时机が違う',
    hints: ['Java は「なければ null」を許す。', 'Optional は便利さのための型。', '使わなくてもコンパイルできる。'],
    transfer: 'jf1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'jvm-verified', source: 'java.util.Optional', version: 1,
  }),

  // ------------------------------------------------------------------- errors
  j({
    id: 'je1', topic: 'java-errors', level: 3, questionType: 'predict-output',
    prompt: 'try / catch / finally のどの行が実行されるか。',
    code: `try {
  System.out.println("try");
} catch (Exception e) {
  System.out.println("catch");
} finally {
  System.out.println("finally");
}`,
    prediction: { text: '出る行を予想してください。', options: ['try と catch', 'try と finally', 'catch と finally', 'try だけ'] },
    answer: 'try と finally', answerKind: 'text',
    expected: { output: ['try', 'finally'], verifiedBy: 'javac 21 / java 21' },
    explanation: '例外が起きないなら catch はスキップ。finally は例外の有無に関わらず実行される。',
    misconception: 'finally は例外が起きたときだけ実行されると誤解している。',
    misconceptionClass: 'exception',
    oneLinePatch: 'finally は必ず実行される。catch は例外が起きたらだけ',
    hints: ['例外は起きるか。', 'finally の実行条件は？', 'try と finally。'],
    transfer: 'je3',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §14.20', version: 1,
  }),
  j({
    id: 'je2', topic: 'java-errors', level: 3, questionType: 'predict-output',
    prompt: 'return があっても finally が先に走る。',
    code: `class H {
  int f() {
    try { return 1; }
    finally { System.out.println("fin"); }
  }
}
System.out.println(new H().f());`,
    prediction: { text: '出力を予想してください。', options: ['fin と 1', '1 と fin', 'fin だけ', '1 だけ'] },
    answer: 'fin と 1', answerKind: 'text',
    expected: { output: ['fin', '1'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'return の値は保留され、finally が実行されてから戻る。戻り値は 1。',
    misconception: 'return が finally より先に実行されると誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: 'return があっても finally が先に走る。戻り値はそのまま',
    hints: ['finally の位置は？', 'return の値はどうなるか。', 'fin と 1。'],
    transfer: 'jp4',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §14.20.2', version: 1,
  }),
  j({
    id: 'je3', topic: 'java-errors', level: 3, questionType: 'runtime-error',
    prompt: 'null へのアクセスは実行時にどうなるか。',
    code: `String s = null;
System.out.println(s.length());`,
    prediction: { text: '実行結果を予想してください。', options: ['0', 'NullPointerException', 'コンパイルできない', 'エラーなし'] },
    answer: 'NullPointerException', answerKind: 'text',
    expected: { runtimeError: 'java.lang.NullPointerException', verifiedBy: 'javac 21 / java 21' },
    explanation: 's は null。null にメソッドを呼べないので実行時例外。',
    misconception: 'null は空文字列と同じだから 0 を返すと誤解している。',
    misconceptionClass: 'exception',
    oneLinePatch: 'null と "": は別物。null へのメソッド呼出は実行時例外',
    hints: ['null と空文字列は同じか。', 'null にメソッドを呼べるか。', 'NullPointerException。'],
    transfer: 'je1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JLS §15.11', version: 1,
  }),
  j({
    id: 'je4', topic: 'java-errors', level: 3, questionType: 'api-meaning',
    prompt: 'checked exception と unchecked exception の違いとして正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      'checked exception は throws か catch が必須。unchecked は必須ではない',
      'すべての例外は throws の宣言が必須',
      'checked exception は実行時だけ検査される',
      '例外はすべてコンパイラが無視する',
    ] },
    answer: 'checked exception は throws か catch が必須。unchecked は必須ではない', answerKind: 'option',
    expected: { value: 'checked exception は throws か catch が必須。unchecked は必須ではない', verifiedBy: 'javac 21' },
    explanation: 'IOException のような checked exception は、呼び出し側が扱うか宣言するかを決めなければコンパイルできない。RuntimeException は豁免。',
    misconception: 'すべての例外を throws に書くと誤解している。',
    misconceptionClass: 'compile-vs-runtime',
    oneLinePatch: 'checked exception はコンパイル時に処理を迫る。unchecked は迫らない',
    hints: ['IOException と NullPointerException で何が違うか。', 'コンパイラが強制するのはどちらか。', 'checked だけ必須。'],
    transfer: 'jp1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'compile-checked', source: 'JLS §11.1', version: 1,
  }),

  // ----------------------------------------------------------------- practical
  j({
    id: 'jp1', topic: 'java-practical', level: 3, questionType: 'boundary',
    prompt: '入力の範囲を詰める処理。境界の 0 と 100 を含むか。',
    code: `class H {
  int clamp(int v) { return Math.max(0, Math.min(100, v)); }
}
System.out.println(new H().clamp(-5) + "," + new H().clamp(50) + "," + new H().clamp(100));`,
    prediction: { text: '出力を予想してください。', options: ['0,50,100', '0,50,0', '-5,50,100', '0,0,0'] },
    answer: '0,50,100', answerKind: 'text',
    expected: { output: ['0,50,100'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'Math.min(100, v) で 100 以下にしてから Math.max(0, ...) で 0 以上。境界は含む。',
    misconception: '境界値は除外されるとと誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: 'Math.max / Math.min は等号を含む。境界は取り込む',
    hints: ['100 は 100 以下か。', '-5 は 0 以上か。', '0,50,100。'],
    transfer: 'jp2',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'browser-java', source: 'java.lang.Math', version: 1,
  }),
  j({
    id: 'jp2', topic: 'java-practical', level: 3, questionType: 'predict-output',
    prompt: 'JSON を文字列で組み立てる。引用符の入れ方は？',
    code: String.raw`class H {
  String point(int x, int y) {
    return "{\"x\":" + x + ",\"y\":" + y + "}";
  }
}
System.out.println(new H().point(1, 2));`,
    prediction: { text: '出力を予想してください。', options: ['{x:1,y:2}', '{"x":1,"y":2}', 'x=1,y=2', 'エラー'] },
    answer: '{"x":1,"y":2}', answerKind: 'text',
    expected: { output: ['{"x":1,"y":2}'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'JSON のキーには二重引用符が必要。文字列リテラル内で " を書くには \" を使う。',
    misconception: 'JSON のキーには引用符が要らないと誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'JSON のキーと文字列値は必ず二重引用符。Java リテラルでは \" で書く',
    hints: ['出力の両端は？', 'キー x の前後に何があるか。', '{"x":1,"y":2}。'],
    transfer: 'jp3',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'browser-java', source: 'JSON (RFC 8259)', version: 1,
  }),
  j({
    id: 'jp3', topic: 'java-practical', level: 3, questionType: 'debug-trace',
    prompt: '例外のスタックトレースを読んで、原因の行を決める。',
    code: `int[] a = {1, 2};
System.out.println(a[5]);`,
    prediction: { text: '例外の種類と、原因の行を予想してください。', options: [
      'ArrayIndexOutOfBoundsException で 2 行目',
      'NullPointerException で 1 行目',
      'ArithmeticException で 2 行目',
      'ArrayIndexOutOfBoundsException で 1 行目',
    ] },
    answer: 'ArrayIndexOutOfBoundsException で 2 行目', answerKind: 'option',
    expected: { runtimeError: 'java.lang.ArrayIndexOutOfBoundsException', value: '2', verifiedBy: 'javac 21 / java 21' },
    explanation: '配列 a の長さは 2。添字 5 は範囲外。原因は 2 行目のアクセス。',
    misconception: '例外のメッセージの数字を原因の値と取り违える。',
    misconceptionClass: 'exception',
    oneLinePatch: 'スタックトレースの先頭が原因。メッセージの数字は長さや添字',
    hints: ['例外の型はどれか。', 'どの行が原因か。', '2 行目。'],
    transfer: 'je1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'jvm-verified', source: 'java.lang.ArrayIndexOutOfBoundsException', version: 1,
  }),
  j({
    id: 'jp4', topic: 'java-practical', level: 3, questionType: 'trace',
    prompt: 'HTTP のリクエストフローを追う。どの層が先に動くか。',
    prediction: { text: '順番を予想してください。', options: [
      'ブラウザ → HTTP → Java → JDBC → DB → Java → HTTP → ブラウザ',
      'DB → JDBC → Java → HTTP → ブラウザ',
      'Java → DB → ブラウザ',
      'ブラウザ → DB → JDBC → Java',
    ] },
    answer: 'ブラウザ → HTTP → Java → JDBC → DB → Java → HTTP → ブラウザ', answerKind: 'option',
    expected: { value: 'ブラウザ → HTTP → Java → JDBC → DB → Java → HTTP → ブラウザ', verifiedBy: 'javac 21' },
    explanation: 'リクエストは浏览器から入り、サーバー側では Controller → Service → Repository(JDBC) → DB の順。応答は逆順。',
    misconception: 'DB が先に動くと誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: 'リクエストは外→内、レスポンスは内→外。層の順序は固定',
    hints: ['ブラウザが最初に何をするか。', 'サーバー側はどの順か。', '応答は逆順。'],
    transfer: 'je2',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'reading', source: 'Spring の層構成', version: 1,
  }),
];
