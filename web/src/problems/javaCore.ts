import type { Problem } from './schema';

/**
 * Java core problems (variables, operators, control flow, arrays, strings).
 *
 * Every `code` body is inserted into a `static void run()` of a generated
 * per-problem class, so it may declare local classes but must not rely on
 * static members inside a local class. `expected` values were produced by
 * `tools/verify-problems.mjs` against real javac/java (JDK 21).
 */

const j = (p: Omit<Problem, 'language'>): Problem => ({ language: 'java', ...p });

export const JAVA_CORE: Problem[] = [
  // ---------------------------------------------------------------- variables
  j({
    id: 'jv1', topic: 'java-vars', level: 1, questionType: 'predict-output',
    prompt: 'このコードの出力を予想してください。実行前に「3 になる」のか「3.5 になる」のかを決めてください。',
    code: `int a = 7 / 2;
System.out.println(a);`,
    prediction: { text: '出力を予想してから実行してください。', options: ['3', '3.5', '3.0', 'エラー'] },
    answer: '3', answerKind: 'text',
    expected: { output: ['3'], verifiedBy: 'javac 21 / java 21' },
    explanation: '7 と 2 はどちらも int リテラルなので、演算は整数除算。3.5 の小数部は捨られて 3 になる。',
    misconception: '代入先の型（ここでは int）が演算の結果を変えると誤解している。',
    misconceptionClass: 'type',
    oneLinePatch: 'int / int は小数点以下を切り捨てる。代入先の型は演算を遡って変えない',
    hints: ['割り算と代入、どちらが先に起きるか。', 'int 同士の割り算はどうなるか。', '3 と 3.5 のどちらか。'],
    variants: [
      {
        id: '7->11',
        label: '7 を 11 に置き換えた形',
        replace: { '7': '11', '2': '4' },
        expected: { output: ['2'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 'jv2',
    reviewInterval: 1, execution: 'jvm-verified', source: 'Java Language Specification §15.17.2', version: 1,
  }),
  j({
    id: 'jv2', topic: 'java-vars', level: 1, questionType: 'variable-trace',
    prompt: '変数の値を追う。x を 10 に変えたあと、y には何が入っているか。',
    code: `int x = 3;
int y = x;
x = 10;
System.out.println(y);`,
    prediction: { text: 'y の値を予想してください。', options: ['3', '10', '7', 'エラー'] },
    answer: '3', answerKind: 'text',
    expected: { output: ['3'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'int は値型。y = x で y に 3 がコピーされ、その後 x が変わっても y には影響しない。',
    misconception: 'Java の変数は参照なので、x を変えると y も変わると誤解している。',
    misconceptionClass: 'value-vs-reference',
    oneLinePatch: 'int のような値型はコピー。参照型の使人しか一緒に変わる',
    hints: ['x = 10 は x だけを変える。', 'y にコピーされたのは何？', '3 か 10 か。'],
    transfer: 'jv3',
    reviewInterval: 1, execution: 'jvm-verified', source: 'JLS §4.12', version: 1,
  }),
  j({
    id: 'jv3', topic: 'java-vars', level: 1, questionType: 'fill-blank',
    prompt: '穴埋め。配列 a の先頭と末尾を足した値を表示している。空欄に入る添字は？',
    code: `int[] a = {2, 4, 6, 8};
System.out.println(a[____] + a[a.length - 1]);`,
    starter: `int[] a = {2, 4, 6, 8};
System.out.println(a[____] + a[a.length - 1]);`,
    solution: `int[] a = {2, 4, 6, 8};
System.out.println(a[0] + a[a.length - 1]);`,
    prediction: { text: '空欄に入る値を予想してください。' },
    answer: '0', answerKind: 'text',
    expected: { output: ['10'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'a[0]=2、a[a.length-1]=a[3]=8。2+8=10。先頭は必ず添字 0。',
    misconception: '配列の先頭は 1 から始まると誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: '配列の添字は 0 から始まる。先頭は a[0]',
    hints: ['先頭の要素の添字は何か。', '末尾は a[a.length - 1]。', '2 + 8 = 10 になる空欄。'],
    transfer: 'jv5',
    reviewInterval: 1, execution: 'jvm-verified', source: 'JLS §10.5', version: 1,
  }),
  j({
    id: 'jv4', topic: 'java-vars', level: 2, questionType: 'compile',
    prompt: 'このコードはコンパイルできるか。できるなら出力も予想してください。',
    code: `int x = 1.5;
System.out.println(x);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時エラー'] },
    answer: 'コンパイルできない', answerKind: 'text',
    expected: { compiles: false, compileError: 'incompatible types: possible lossy conversion from double to int', verifiedBy: 'javac 21' },
    explanation: 'double から int への代入は、明示的な cast なしではコンパイルできない。小数部が切り捨てられることは許されない。',
    misconception: '小数点以下は自動で切り捨てられると誤解している。',
    misconceptionClass: 'compile-vs-runtime',
    oneLinePatch: 'double → int は明示的な (int) キャストが必要。暗黙の切り捨てはない',
    hints: ['double を int に代入できるか。', 'コンパイラは値の範囲より型の厳密さを先看する。', '(int) 1.5 なら通る。'],
    transfer: 'jv5',
    reviewInterval: 2, execution: 'compile-checked', source: 'JLS §5.2', version: 1,
  }),
  j({
    id: 'jv5', topic: 'java-vars', level: 2, questionType: 'predict-output',
    prompt: 'int の範囲を超える計算を予想してください。',
    code: `int a = 2147483647;
int b = a + 1;
System.out.println(b);`,
    prediction: { text: 'b の値を予想してください。', options: ['2147483648', '-2147483648', 'エラー', '0'] },
    answer: '-2147483648', answerKind: 'text',
    expected: { output: ['-2147483648'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'int は 32 ビット符号付きで 2147483647 が最大。+1 で符号反転して -2147483648 になる（符号反転対称）。',
    misconception: 'int は unlimited か、またはエラーになると誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: 'int は 32 ビット。範囲外は符号反転してラップする。チェックは任せると危い',
    hints: ['int の最大値は 2147483647。', '最大値 + 1 は何になるか。', '符号反転を想像する。'],
    transfer: 'jv3',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §4.2.2', version: 1,
  }),

  // ---------------------------------------------------------------- operators
  j({
    id: 'jo1', topic: 'java-ops', level: 1, questionType: 'predict-output',
    prompt: '演算子の優先順位を予想してください。',
    code: `System.out.println(1 + 2 * 3);`,
    prediction: { text: '出力を予想してください。', options: ['9', '7', '6', '3'] },
    answer: '7', answerKind: 'text',
    expected: { output: ['7'], verifiedBy: 'javac 21 / java 21' },
    explanation: '乗除は加減より優先。2*3=6 が先で、1+6=7。',
    misconception: '左から右へ同じ優先度で計算すると誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: '* / は + - より優先。括弧でしか変えられない',
    hints: ['* と + どちらが先か。', '2 * 3 を先に。', '1 + 6 = ?'],
    variants: [
      {
        id: '1->5',
        label: '1 を 5 に置き換えた形',
        replace: { '1': '5', '2': '4' },
        expected: { output: ['17'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 'jo4',
    reviewInterval: 1, execution: 'jvm-verified', source: 'JLS §15.6', version: 1,
  }),
  j({
    id: 'jo2', topic: 'java-ops', level: 2, questionType: 'predict-output',
    prompt: '% は「割り切れるかどうか」だけでなく、符号も残す。出力を予想してください。',
    code: `int a = -7;
System.out.println(a % 3);
System.out.println(7 % -3);`,
    prediction: { text: '2 行の出力を予想してください。', options: ['-1 と 1', '1 と -1', '-1 と -1', '1 と 1'] },
    answer: '-1 と 1', answerKind: 'text',
    expected: { output: ['-1', '1'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'Java の % は「割り算の余り」ではなく「被除数の符号を残す」演算。-7 % 3 = -1、7 % -3 = 1。',
    misconception: '% は数学の余りと同じ（非負）と誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'Java の % は被除数の符号を残す。非負にしたいなら Math.floorMod',
    hints: ['-7 = 3 * (-2) + ? の ? は。', '符号は被除数（左）に合わせる。', '-1 と 1。'],
    variants: [
      {
        id: '7->11',
        label: '7 を 11 に置き換えた形',
replace: { '7': '11', '2': '4' },
        expected: { output: ['-2', '2'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 'jo3',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §15.17.3', version: 1,
  }),
  j({
    id: 'jo3', topic: 'java-ops', level: 2, questionType: 'boundary',
    prompt: '境界を選ぶ。次のコードは実行時にどうなるか。',
    code: `System.out.println(1 / 0);`,
    prediction: { text: '実行結果を予想してください。', options: ['無限大', 'ArithmeticException', '0', 'コンパイルできない'] },
    answer: 'ArithmeticException', answerKind: 'text',
    expected: { runtimeError: 'java.lang.ArithmeticException', verifiedBy: 'javac 21 / java 21' },
    explanation: '整数の 0 での割り算は実行時に ArithmeticException。double なら Infinity になる。',
    misconception: '浮動小数と同じで無限大になると誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: 'int の 0 割は実行時例外。double の 0 割は Infinity',
    hints: ['int と double で挙動が違う。', '例外の名前を思い出す。', 'ArithmeticException。'],
    transfer: 'jv3',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §15.17.2', version: 1,
  }),
  j({
    id: 'jo4', topic: 'java-ops', level: 1, questionType: 'fill-blank',
    prompt: '穴埋め。出力が 20 になる演算子を入れる。',
    code: `System.out.println(5 + 5 ____ 3);`,
    starter: `System.out.println(5 + 5 ____ 3);`,
    solution: `System.out.println(5 + 5 * 3);`,
    prediction: { text: '空欄の演算子を予想してください。' },
    answer: '*', answerKind: 'text',
    expected: { output: ['20'], verifiedBy: 'javac 21 / java 21' },
    explanation: '5 + 5*3 = 5 + 15 = 20。足し算を先にしてしまうと (5+5)*3 = 30 になり、違う値になる。',
    misconception: '左から右へ順番に計算すると誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: '優先順位は * が + より高い。5 + 5 * 3 = 20',
    hints: ['* を入れると 5 + 15。', '足し算を先にするとどうなるか。', '5 * 3 = 15 で 5+15=20 にはならない。'],
    transfer: 'jo1',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §15.6', version: 1,
  }),

  // ---------------------------------------------------------------- control
  j({
    id: 'jc1', topic: 'java-if', level: 1, questionType: 'predict-output',
    prompt: 'else if の分岐を予想してください。',
    code: `int n = 3;
if (n > 5) System.out.println("big");
else if (n > 1) System.out.println("mid");
else System.out.println("small");`,
    prediction: { text: '表示される文字を予想してください。', options: ['big', 'mid', 'small', '何も表示しない'] },
    answer: 'mid', answerKind: 'text',
    expected: { output: ['mid'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'n=3 は n>5 を満たさないので、次の else if へ。n>1 は真なので mid。',
    misconception: 'すべての条件を調べると誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: 'if / else if は一度決まったら残りは実行しない',
    hints: ['n > 5 は偽。', '次に見る条件は？', 'n > 1 は真。'],
    transfer: 'jo1',
    reviewInterval: 1, execution: 'jvm-verified', source: 'JLS §14.13', version: 1,
  }),
  j({
    id: 'jc2', topic: 'java-if', level: 2, questionType: 'predict-output',
    prompt: '2 つの if が並んでいる。両方実行されるのか、 else がつながるのか。',
    code: `int n = 10;
if (n >= 10) System.out.println("A");
if (n > 10) System.out.println("B");
else System.out.println("C");`,
    prediction: { text: '出力を予想してください。', options: ['A と C', 'A と B', 'C だけ', 'A だけ'] },
    answer: 'A と C', answerKind: 'text',
    expected: { output: ['A', 'C'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'else は直前の if にだけつながる。2 つ目の if の条件は偽なので C。',
    misconception: 'else は全体につながると誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: 'else は直前の if にだけ対応する。付け間違えが論理の誤りの原因になる',
    hints: ['else はどの if に属するか。', '2 つ目の if の条件 n > 10 は偽。', 'A と C。'],
    transfer: 'jo1',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §14.13', version: 1,
  }),
  j({
    id: 'jc3', topic: 'java-if', level: 2, questionType: 'predict-output',
    prompt: 'switch の fall-through を予想してください。case のあとに break がないコード。',
    code: `int d = 2;
switch (d) {
  case 1: System.out.println("one");
  case 2: System.out.println("two");
  case 3: System.out.println("three");
}`,
    prediction: { text: '出力を予想してください。', options: ['two', 'two three', 'two three の後に停止', 'エラー'] },
    answer: 'two three', answerKind: 'text',
    expected: { output: ['two', 'three'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'd=2 で case 2 に入り、break がないので case 3 も実行される。出力は two と three。',
    misconception: '各 case は独立で、1 つだけ実行されると誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: 'switch は break がないと次の case へ流れ続ける（fall-through）',
    hints: ['case 2 に落ちたあと、何が起こるか。', 'break がない→次へ。', 'two のあとにもう 1 行出る。'],
    transfer: 'jo1',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §14.11', version: 1,
  }),
  j({
    id: 'jc4', topic: 'java-if', level: 2, questionType: 'fill-blank',
    prompt: '穴埋め。n が 3 以上 6 未満なら "in" を表示する。空欄の論理演算子は？',
    code: `int n = 5;
if (n >= 3 ____ n < 6) System.out.println("in");
else System.out.println("out");`,
    starter: `int n = 5;
if (n >= 3 ____ n < 6) System.out.println("in");
else System.out.println("out");`,
    solution: `int n = 5;
if (n >= 3 && n < 6) System.out.println("in");
else System.out.println("out");`,
    prediction: { text: '空欄の演算子を予想してください。' },
    answer: '&&', answerKind: 'text',
    expected: { output: ['in'], verifiedBy: 'javac 21 / java 21' },
    explanation: '&& は「両方真」のとき真。n=5 は 3 以上で 6 未満なので in。',
    misconception: '&& と || の違いを忘れている。',
    misconceptionClass: 'concept',
    oneLinePatch: '&& は両方真、|| はどちらか一方が真',
    hints: ['「かつ」はどれか。', '3 以上 かつ 6 未満。', '&&。'],
    transfer: 'jl4',
    reviewInterval: 1, execution: 'jvm-verified', source: 'JLS §15.23', version: 1,
  }),

  // ---------------------------------------------------------------- loops
  j({
    id: 'jl1', topic: 'java-loop', level: 2, questionType: 'variable-trace',
    prompt: 'for ループの合計を追う。何回実行されるかを数えてから答えてください。',
    code: `int s = 0;
for (int i = 1; i <= 5; i++) s += i;
System.out.println(s);`,
    prediction: { text: 's の値を予想してください。', options: ['10', '15', '20', '5'] },
    answer: '15', answerKind: 'text',
    expected: { output: ['15'], verifiedBy: 'javac 21 / java 21' },
    explanation: '1+2+3+4+5=15。i<=5 なので 5 まで入る。',
    misconception: 'ループは条件より 1 回少なく実行されると誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: 'i <= n は n 回目まで実行する。< なら n-1 回目まで',
    hints: ['何回足すか。', '1 から 5 まで。', '1+2+3+4+5。'],
    variants: [
      {
        id: '5->8',
        label: '5 を 8 に置き換えた形',
        replace: { '5': '8' },
        expected: { output: ['36'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 'jv3',
    reviewInterval: 1, execution: 'jvm-verified', source: 'JLS §14.14', version: 1,
  }),
  j({
    id: 'jl2', topic: 'java-loop', level: 2, questionType: 'predict-output',
    prompt: '条件をよく見て予想してください。< と <= の差が効く場所。',
    code: `int s = 0;
for (int i = 1; i < 5; i++) s += i;
System.out.println(s);`,
    prediction: { text: 's の値を予想してください。', options: ['10', '15', '9', '5'] },
    answer: '10', answerKind: 'text',
    expected: { output: ['10'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'i<5 なので 1,2,3,4 の 4 回。合計 10。',
    misconception: 'i<5 でも 5 回目まで入ると誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: '< はその値を含めない。<= なら含める',
    hints: ['最後に入る i はいくつまでか。', '1 から 4 まで。', '1+2+3+4=10。'],
    transfer: 'jv3',
    reviewInterval: 1, execution: 'jvm-verified', source: 'JLS §14.14', version: 1,
  }),
  j({
    id: 'jl3', topic: 'java-loop', level: 2, questionType: 'minimal-fix',
    prompt: 'この while は永遠に続く。最小の 1 行修正を手を動かして書いてください。',
    code: `int i = 0;
while (i < 10) {
  System.out.println(i);
}`,
    starter: `int i = 0;
while (i < 10) {
  System.out.println(i);
}`,
    solution: `int i = 0;
while (i < 10) {
  System.out.println(i);
  i++;
}`,
    prediction: { text: '直す場所を予想してください。' },
    answer: 'i++', answerKind: 'text',
    expected: { output: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'while は条件が真の間繰り返すが、i が増えないので一度も偽にならない。本体に i++ を入れる。',
    misconception: 'ループは自動で次の値へ進むと誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: 'while は条件を毎回見直すだけ。変数を進めるのは自分で書く',
    hints: ['i が増える処理があるか。', '本体に何を足すか。', 'i++。'],
    transfer: 'jo1',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §14.14', version: 1,
  }),
  j({
    id: 'jl4', topic: 'java-loop', level: 2, questionType: 'implement',
    prompt: '自力で書く。1 から 5 までを 1 行ずつ表示する for ループを書く。',
    starter: '',
    solution: `for (int i = 1; i <= 5; i++) System.out.println(i);`,
    prediction: { text: '動くコードを書いてから実行してください。' },
    answer: 'for (int i = 1; i <= 5; i++) System.out.println(i);', answerKind: 'code',
    expected: { output: ['1', '2', '3', '4', '5'], verifiedBy: 'javac 21 / java 21' },
    explanation: '初期化 → 終了条件 → 更新の 3 つが揃えばループになる。',
    misconception: 'for の 3 つの部分の役割をわかっていない。',
    misconceptionClass: 'concept',
    oneLinePatch: 'for は (初期化; 終了条件; 更新) の順に 1 回ずつ見る',
    hints: ['最初の値は？', 'どこまで続くか。', '毎回何をするか。'],
    transfer: 'jc4',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §14.14', version: 1,
  }),

  // ---------------------------------------------------------------- arrays
  j({
    id: 'ja1', topic: 'java-array', level: 2, questionType: 'predict-output',
    prompt: '配列の length は要素数。最後の要素の添字と比べて予想してください。',
    code: `int[] a = {5, 6, 7};
System.out.println(a.length);`,
    prediction: { text: '出力を予想してください。', options: ['2', '3', '4', '7'] },
    answer: '3', answerKind: 'text',
    expected: { output: ['3'], verifiedBy: 'javac 21 / java 21' },
    explanation: '要素は 3 つ。length は「個数」で「最後の添字」ではない。',
    misconception: 'length は最後の添字を返すと誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: '配列.length は要素数。最後の添字は length - 1',
    hints: ['要素はいくつあるか。', 'length は個数。', '3。'],
    transfer: 'jv3',
    reviewInterval: 1, execution: 'jvm-verified', source: 'JLS §10.6', version: 1,
  }),
  j({
    id: 'ja2', topic: 'java-array', level: 2, questionType: 'runtime-error',
    prompt: '境界を超えるアクセスを予想してください。',
    code: `int[] a = {5, 6, 7};
System.out.println(a[a.length]);`,
    prediction: { text: '実行結果を予想してください。', options: ['7', '3', 'ArrayIndexOutOfBoundsException', '0'] },
    answer: 'ArrayIndexOutOfBoundsException', answerKind: 'text',
    expected: { runtimeError: 'java.lang.ArrayIndexOutOfBoundsException', verifiedBy: 'javac 21 / java 21' },
    explanation: '有効な添字は 0〜2。a.length=3 は範囲外。',
    misconception: 'length の位置にも要素があると誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: '有効な添字は 0 <= i < a.length。= は入らない',
    hints: ['最後の要素の添字は？', '3 は有效か。', 'ArrayIndexOutOfBoundsException。'],
    transfer: 'jv3',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §10.5', version: 1,
  }),
  j({
    id: 'ja3', topic: 'java-array', level: 2, questionType: 'variable-trace',
    prompt: '配列の中身を入れ替える処理を追う。',
    code: `int[] a = {5, 1, 4};
int t = a[0];
a[0] = a[2];
a[2] = t;
System.out.println(a[0] + "," + a[2]);`,
    prediction: { text: '出力を予想してください。', options: ['5,4', '4,5', '4,1', '5,1'] },
    answer: '4,5', answerKind: 'text',
    expected: { output: ['4,5'], verifiedBy: 'javac 21 / java 21' },
    explanation: '一時変数 t=5。a[0]=a[2]=4。a[2]=t=5。結果は 4,5。',
    misconception: 'a[0] と a[2] が同時に変わられると誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: '代入は右辺を先に評価する。一時変数で交換する',
    hints: ['t には最初何が入るか。', '2 行目で a[0] は何になるか。', '4 と 5。'],
    transfer: 'jo1',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §15.26', version: 1,
  }),
  j({
    id: 'ja4', topic: 'java-array', level: 2, questionType: 'fill-blank',
    prompt: '穴埋め。先頭と末尾の和が 10 になるようにする。空欄の添字は？',
    code: `int[] a = {2, 4, 6, 8};
System.out.println(a[____] + a[a.length - 1]);`,
    starter: `int[] a = {2, 4, 6, 8};
System.out.println(a[____] + a[a.length - 1]);`,
    solution: `int[] a = {2, 4, 6, 8};
System.out.println(a[0] + a[a.length - 1]);`,
    prediction: { text: '空欄の値を予想してください。' },
    answer: '0', answerKind: 'text',
    expected: { output: ['10'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'a[0]=2、a[3]=8。2+8=10。',
    misconception: '先頭の添字は 1 と誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: '配列の先頭は a[0]。末尾は a[a.length - 1]',
    hints: ['先頭の要素の添字。', '末尾は 8。', '2 + 8 = 10 になる空欄。'],
    transfer: 'jl1',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §10.5', version: 1,
  }),

  // ---------------------------------------------------------------- strings
  j({
    id: 'js1', topic: 'java-string', level: 2, questionType: 'predict-output',
    prompt: '文字列の結合で、元の変数はどうなるか。',
    code: `String a = "Java";
String b = a;
b = b + "!";
System.out.println(a);`,
    prediction: { text: '出力を予想してください。', options: ['Java', 'Java!', '!', 'エラー'] },
    answer: 'Java', answerKind: 'text',
    expected: { output: ['Java'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'String は不変。b = b + "!" は新しい文字列を作って b に代入するだけで、a は変わらない。',
    misconception: '文字列も配列と同じで中身が変わると誤解している。',
    misconceptionClass: 'value-vs-reference',
    oneLinePatch: 'String は不変。+ は新しい文字列を作って代入するだけ',
    hints: ['String の中身は変えられるか。', 'b に新しい文字列が入る。', 'a は Java のまま。'],
    variants: [
      {
        id: 'Java->Rust',
        label: 'Java を Rust に置き換えた形',
        replace: { 'Java': 'Rust' },
        expected: { output: ['Rust'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 'js2',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §3.10.5', version: 1,
  }),
  j({
    id: 'js2', topic: 'java-string', level: 2, questionType: 'predict-output',
    prompt: '== と equals の違いを而出力で確かめる。',
    code: `String a = new String("Java");
String b = new String("Java");
System.out.println(a == b);
System.out.println(a.equals(b));`,
    prediction: { text: '2 行の出力を予想してください。', options: ['true と true', 'false と true', 'true と false', 'false と false'] },
    answer: 'false と true', answerKind: 'text',
    expected: { output: ['false', 'true'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'new で作れば別のオブジェクト。== は同一性なので偽。equals は内容なので真。',
    misconception: '== は文字列の内容を比べると誤解している。',
    misconceptionClass: 'value-vs-reference',
    oneLinePatch: 'String の中身の比較は equals。== はインスタンスの同一性',
    hints: ['new は新しいオブジェクトを作るか。', '== は何を見ているか。', 'false と true。'],
    transfer: 'js1',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §15.21', version: 1,
  }),
  j({
    id: 'js3', topic: 'java-string', level: 2, questionType: 'predict-output',
    prompt: '+ が文字列と数値のどちらに見える时机かで結果が変わる。',
    code: `System.out.println("a" + 1 + 2);
System.out.println(1 + 2 + "a");`,
    prediction: { text: '2 行の出力を予想してください。', options: ['a3 と 3a', 'a12 と 3a', 'a12 と 12a', 'a3 と 12a'] },
    answer: 'a12 と 3a', answerKind: 'text',
    expected: { output: ['a12', '3a'], verifiedBy: 'javac 21 / java 21' },
    explanation: '左から評価。文字列が出たら以降は結合。1 行目は "a"+1 → "a1"、+2 → "a12"。2 行目は 1+2=3 が先で "3a"。',
    misconception: '+ は常に左から右へ数値の足し算と誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: '+ は左結合。文字列が出た時点で以降は文字列結合',
    hints: ['左から順に評価する。', '1 行目は文字列が先。', '2 行目は数値の足し算が先。'],
    transfer: 'jm1',
    reviewInterval: 2, execution: 'jvm-verified', source: 'JLS §15.18.1', version: 1,
  }),
  j({
    id: 'js4', topic: 'java-string', level: 2, questionType: 'fill-blank',
    prompt: '穴埋め。substring の開始位置を決める。',
    code: `String s = "Java";
System.out.println(s.substring(____));`,
    starter: `String s = "Java";
System.out.println(s.substring(____));`,
    solution: `String s = "Java";
System.out.println(s.substring(1));`,
    prediction: { text: '空欄の値を予想してください。' },
    answer: '1', answerKind: 'text',
    expected: { output: ['ava'], verifiedBy: 'javac 21 / java 21' },
    explanation: 'substring(1) は 1 文字目以降。J,a,v,a の 1 文字目は a なので "ava"。',
    misconception: 'substring の開始位置は 1 から始まると誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: 'substring の開始位置は 0 から。s.substring(1) は先頭を除いたもの',
    hints: ['添字は何から始まるか。', '先頭を除きたい。', '1。'],
    transfer: 'jm1',
    reviewInterval: 2, execution: 'jvm-verified', source: 'java.lang.String#substring', version: 1,
  }),
];
