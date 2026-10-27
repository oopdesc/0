import type { Problem } from './schema';

/**
 * Rust core problems (let/mut, expressions, control flow, ownership, borrowing,
 * strings).
 *
 * `code` is written in idiomatic Rust with `println!`. The generated runner
 * rewrites `println!(` to `writeln!(out, ` so the same source can be captured
 * inside a function AND executed by the real rustc for verification.
 */

const r = (p: Omit<Problem, 'language'>): Problem => ({ language: 'rust', ...p });

export const RUST_CORE: Problem[] = [
  // -------------------------------------------------------------------- let
  r({
    id: 'rv1', topic: 'rust-let', level: 1, questionType: 'predict-output',
    prompt: 'let は不変。値を変えようとしたらどうなるか。',
    code: `let x = 5;
println!("{}", x);`,
    prediction: { text: '出力を予想してください。', options: ['5', 'エラー', '0', '変更される'] },
    answer: '5', answerKind: 'text',
    expected: { output: ['5'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'let は既定で不変。読み取りだけなら問題ない。',
    misconception: 'let は変更できると誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'Rust の let は不変。変更には let mut',
    hints: ['x は読み取りだけか。', '値は何か。', '5。'],
    variants: [
      {
        id: '5->9',
        label: '5 を 9 に置き換えた形',
        replace: { '5': '9' },
        expected: { output: ['9'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 'rc1',
    reviewInterval: 1, execution: 'rust-verified', source: 'The Rust Book ch.3', version: 1,
  }),
  r({
    id: 'rv2', topic: 'rust-let', level: 1, questionType: 'compile',
    prompt: '不変の変数を書き換えようとしている。コンパイルできるか。',
    code: `let x = 5;
x = 10;
println!("{}", x);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時エラー'] },
    answer: 'コンパイルできない', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0384', verifiedBy: 'rustc 1.99' },
    explanation: 'let で宣言された変数は不変。書き換えには let mut が必要（E0384）。',
    misconception: '他の言語と同じで再代入できると誤解している。',
    misconceptionClass: 'compile-vs-runtime',
    oneLinePatch: '書き換えたいなら let mut x。再代入はコンパイルエラー',
    hints: ['let と let mut の違い。', 'x = 10 は許されるか。', 'コンパイルできない。'],
    transfer: 're4',
    reviewInterval: 1, execution: 'compile-checked', source: 'rustc E0384', version: 1,
  }),
  r({
    id: 'rv3', topic: 'rust-let', level: 1, questionType: 'variable-trace',
    prompt: '可変変数の値を追う。',
    code: `let mut x = 3;
x = x + 2;
println!("{}", x);`,
    prediction: { text: '出力を予想してください。', options: ['3', '5', '2', 'エラー'] },
    answer: '5', answerKind: 'text',
    expected: { output: ['5'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'x は mut なので書き換え可能。3 + 2 = 5。',
    misconception: 'x = x + 2 は宣告より前の値を使うと誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: '代入の右辺は代入前の値。x = x + 2 は 3 + 2',
    hints: ['右辺の x は今の値。', '3 + 2 は？', '5。'],
    variants: [
      {
        id: '3->7',
        label: '3 を 7 に置き換えた形',
        replace: { '3': '7', '2': '4' },
        expected: { output: ['11'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 're1',
    reviewInterval: 1, execution: 'rust-verified', source: 'The Rust Book ch.3', version: 1,
  }),
  r({
    id: 'rv4', topic: 'rust-let', level: 2, questionType: 'fill-blank',
    prompt: '穴埋め。合計が 15 になるようにする。空欄の値は？',
    code: `let mut total = 0;
for i in 0..____ {
  total += i;
}
println!("{}", total);`,
    starter: `let mut total = 0;
for i in 0..____ {
  total += i;
}
println!("{}", total);`,
    solution: `let mut total = 0;
for i in 0..6 {
  total += i;
}
println!("{}", total);`,
    prediction: { text: '空欄の値を予想してください。' },
    answer: '6', answerKind: 'text',
    expected: { output: ['15'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '0..6 は 0〜5。合計 15。',
    misconception: '0..6 は 6 も含むと誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: 'Range の終端は含まない。0..6 は 0〜5',
    hints: ['0 から何まで足すか。', '0+1+2+3+4+5 は？', '6。'],
    transfer: 'rc2',
    reviewInterval: 1, execution: 'rust-verified', source: 'std::ops::Range', version: 1,
  }),

  // ------------------------------------------------------------ expressions
  r({
    id: 're1', topic: 'rust-expr', level: 1, questionType: 'predict-output',
    prompt: '式の評価順を予想してください。',
    code: `println!("{}", 1 + 2 * 3);`,
    prediction: { text: '出力を予想してください。', options: ['9', '7', '6', '3'] },
    answer: '7', answerKind: 'text',
    expected: { output: ['7'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '乗算が加算より優先。2*3=6、1+6=7。',
    misconception: '左から右へ同じ優先度と誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: '* は + より優先。Rust も同じ',
    hints: ['* と + どちらが先か。', '2 * 3 = 6。', '1 + 6 = 7。'],
    variants: [
      {
        id: '1->5',
        label: '1 を 5 に置き換えた形',
        replace: { '1': '5', '2': '4' },
        expected: { output: ['17'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 'rv3',
    reviewInterval: 1, execution: 'rust-verified', source: 'Rust Operator Precedence', version: 1,
  }),
  r({
    id: 're2', topic: 'rust-expr', level: 2, questionType: 'predict-output',
    prompt: 'Rust の % は負の数でも余りが負になる。',
    code: `let a = -7;
println!("{}", a % 3);
println!("{}", 7 % -3);`,
    prediction: { text: '2 行の出力を予想してください。', options: ['-1 と -1', '1 と 1', '-1 と 1', '1 と -1'] },
    answer: '-1 と 1', answerKind: 'text',
    expected: { output: ['-1', '1'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'Rust の % は被除数の符号を残す。-7 % 3 = -1、7 % -3 = 1。',
    misconception: '余りは常に非負と誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'Rust の % は被除数の符号を残す。非負にしたいなら rem_euclid',
    hints: ['符号はどっちに合わせる？', '被除数（左）の符号を残す。', '-1 と 1。'],
    transfer: 're3',
    reviewInterval: 2, execution: 'rust-verified', source: 'std::ops::Rem', version: 1,
  }),
  r({
    id: 're3', topic: 'rust-expr', level: 2, questionType: 'fill-blank',
    prompt: '穴埋め。出力が 20 になる演算子は？',
    code: `println!("{}", 5 + 5 ____ 3);`,
    starter: `println!("{}", 5 + 5 ____ 3);`,
    solution: `println!("{}", 5 + 5 * 3);`,
    prediction: { text: '空欄の演算子を予想してください。' },
    answer: '*', answerKind: 'text',
    expected: { output: ['20'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '5 + 5*3 = 5 + 15 = 20。',
    misconception: '左から順に計算すると誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: '* は + より優先。5 + 5 * 3 = 20',
    hints: ['* を入れると 5 + 15。', '合計 30 になるのは？', '*。'],
    transfer: 'rv3',
    reviewInterval: 2, execution: 'rust-verified', source: 'Rust Operator Precedence', version: 1,
  }),
  r({
    id: 're4', topic: 'rust-expr', level: 2, questionType: 'compile',
    prompt: '型の不一致。コンパイルできるか。',
    code: `let x: i32 = 1.5;
println!("{}", x);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時エラー'] },
    answer: 'コンパイルできない', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0308', verifiedBy: 'rustc 1.99' },
    explanation: '1.5 は f64。i32 への代入には明示的なキャストが必要（E0308）。',
    misconception: '浮動小数から整数へ自動で切り捨てられると誤解している。',
    misconceptionClass: 'compile-vs-runtime',
    oneLinePatch: '型は明示する。1.5 を i32 にするには as i32',
    hints: ['1.5 の型は？', 'i32 に代入できるか。', 'コンパイルできない。'],
    transfer: 'rv2',
    reviewInterval: 2, execution: 'compile-checked', source: 'rustc E0308', version: 1,
  }),

  // ------------------------------------------------------------------ control
  r({
    id: 'rc1', topic: 'rust-control', level: 2, questionType: 'predict-output',
    prompt: 'if は式。分岐の結果をそのまま使える。',
    code: `let n = 3;
let msg = if n > 5 { "big" } else { "small" };
println!("{}", msg);`,
    prediction: { text: '出力を予想してください。', options: ['big', 'small', '3', 'エラー'] },
    answer: 'small', answerKind: 'text',
    expected: { output: ['small'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'n=3 は n>5 を満たさないので else 側の "small"。if は式なので値を代入できる。',
    misconception: 'if は文で値を返さないと誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'Rust の if は式。分岐の値を代入できる',
    hints: ['n > 5 は真か偽か。', 'else 側の値は？', 'small。'],
    transfer: 'rv1',
    reviewInterval: 2, execution: 'rust-verified', source: 'The Rust Book ch.3', version: 1,
  }),
  r({
    id: 'rc2', topic: 'rust-control', level: 2, questionType: 'predict-output',
    prompt: 'for は Range を消费する。何回実行されるか。',
    code: `let mut s = 0;
for i in 1..=5 {
  s += i;
}
println!("{}", s);`,
    prediction: { text: '出力を予想してください。', options: ['10', '15', '20', '5'] },
    answer: '15', answerKind: 'text',
    expected: { output: ['15'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '1..=5 は 1 から 5 まで（= を含む）。合計 15。',
    misconception: '1..=5 は 5 を含まないと誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: '..= は終端を含む。.. は含まない',
    hints: ['..= と .. の違い。', '1 から 5 まで足す。', '15。'],
    transfer: 'rv4',
    reviewInterval: 2, execution: 'rust-verified', source: 'std::ops::RangeInclusive', version: 1,
  }),
  r({
    id: 'rc3', topic: 'rust-control', level: 2, questionType: 'minimal-fix',
    prompt: 'この while は永遠に続く。最小の 1 行修正を書く。',
    code: `let mut i = 0;
while i < 10 {
  println!("{}", i);
}`,
    starter: `let mut i = 0;
while i < 10 {
  println!("{}", i);
}`,
    solution: `let mut i = 0;
while i < 10 {
  println!("{}", i);
  i += 1;
}`,
    prediction: { text: '直す場所を予想してください。' },
    answer: 'i += 1', answerKind: 'text',
    expected: { output: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'i が増えないので条件が一度も偽にならない。本体に i += 1 を入れる。',
    misconception: 'ループは自動で進むと誤解している。',
    misconceptionClass: 'evaluation-order',
    oneLinePatch: 'while は条件だけ見る。進めるのは自分で書く',
    hints: ['i が増えるか。', '本体に何を足すか。', 'i += 1。'],
    transfer: 'rv3',
    reviewInterval: 2, execution: 'rust-verified', source: 'The Rust Book ch.3', version: 1,
  }),
  r({
    id: 'rc4', topic: 'rust-control', level: 2, questionType: 'implement',
    prompt: '自力で書く。1 から 5 までを表示する for ループ。',
    starter: '',
    solution: `for i in 1..=5 {
  println!("{}", i);
}`,
    prediction: { text: '動くコードを書いてから実行してください。' },
    answer: 'for i in 1..=5 { println!("{}", i); }', answerKind: 'code',
    expected: { output: ['1', '2', '3', '4', '5'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '1..=5 は 1 から 5 までを含む。',
    misconception: 'for の範囲の終端の扱い。',
    misconceptionClass: 'boundary',
    oneLinePatch: '1..=5 は 5 を含む。1..5 は 4 まで',
    hints: ['どこからどこまでか。', '終端を含む型は？', '1..=5。'],
    transfer: 'rv4',
    reviewInterval: 2, execution: 'rust-verified', source: 'The Rust Book ch.3', version: 1,
  }),

  // ---------------------------------------------------------------- ownership
  r({
    id: 'ro1', topic: 'rust-ownership', level: 2, questionType: 'compile',
    prompt: 'String を代入したあと、元の変数をまだ使っている。コンパイルできるか。',
    code: `let s = String::from("orbit");
let t = s;
println!("{}", s);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'E0382 になる', 'panic する', 'エラーなし'] },
    answer: 'E0382 になる', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0382', verifiedBy: 'rustc 1.99' },
    explanation: 'String は Copy ではない。let t = s; で所有権が t に移り、s は未初期化になる（E0382）。',
    misconception: '代入はコピーだから元も使えると誤解している。',
    misconceptionClass: 'ownership',
    oneLinePatch: 'move された値は原則として元の binding から使えない',
    hints: ['String は Copy か。', 't が所有権を持ったあと s は？', 'E0382。'],
    transfer: 'ro2',
    reviewInterval: 2, execution: 'compile-checked', source: 'rustc E0382', version: 1,
  }),
  r({
    id: 'ro2', topic: 'rust-ownership', level: 2, questionType: 'predict-output',
    prompt: 'Copy 型は move にならない。出力を予想してください。',
    code: `let a = 3;
let b = a;
println!("{}", a);`,
    prediction: { text: '出力を予想してください。', options: ['3', '0', 'コンパイルできない', 'エラー'] },
    answer: '3', answerKind: 'text',
    expected: { output: ['3'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'i32 は Copy トレイトを実装しているので代入はビットコピー。元の a も有効。',
    misconception: 'すべての代入が move になると誤解している。',
    misconceptionClass: 'ownership',
    oneLinePatch: 'move か Copy かは値ではなく型で決まる',
    hints: ['i32 は Copy か。', 'a はまだ使えるか。', '3。'],
    variants: [
      {
        id: '3->8',
        label: '3 を 8 に置き換えた形',
        replace: { '3': '8' },
        expected: { output: ['8'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 'ro1',
    reviewInterval: 2, execution: 'rust-verified', source: 'The Rust Book ch.4', version: 1,
  }),
  r({
    id: 'ro3', topic: 'rust-ownership', level: 2, questionType: 'minimal-fix',
    prompt: 'move 後の使用を消さずに、正しい変数を使う形へ直す。',
    code: `let s = String::from("orbit");
let t = s;
println!("{}", s);`,
    starter: `let s = String::from("orbit");
let t = s;
println!("{}", s);`,
    solution: `let s = String::from("orbit");
let t = s;
println!("{}", t);`,
    prediction: { text: '直し方を予想してください。' },
    answer: 't を表示する', answerKind: 'text',
    expected: { output: ['orbit'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '所有権を持っているのは t。s を消すか、表示を t に変える。',
    misconception: '両方使えると誤解している。',
    misconceptionClass: 'move',
    oneLinePatch: 'move 後は新しい所有者（t）を使う',
    hints: ['今値を持っているのはどちらか。', '表示すべき変数は？', 't。'],
    transfer: 'ro4',
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.4', version: 1,
  }),
  r({
    id: 'ro4', topic: 'rust-ownership', level: 2, questionType: 'compile',
    prompt: '関数に値を渡したあと、元の変数を使えるか。',
    code: `fn take(s: String) {}
let s = String::from("orbit");
take(s);
println!("{}", s);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'E0382 になる', 'panic する', '実行時エラー'] },
    answer: 'E0382 になる', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0382', verifiedBy: 'rustc 1.99' },
    explanation: '関数への値渡しも move。s の所有権は take に移る。',
    misconception: '関数呼び出しは参照渡しだから元が残ると誤解している。',
    misconceptionClass: 'move',
    oneLinePatch: '値渡しは move。参照渡しにしたいなら &',
    hints: ['take は値を受け取るか。', 's はまだ有効か。', 'E0382。'],
    transfer: 'ro3',
    reviewInterval: 3, execution: 'compile-checked', source: 'rustc E0382', version: 1,
  }),

  // ----------------------------------------------------------------- borrowing
  r({
    id: 'rb1', topic: 'rust-borrow', level: 2, questionType: 'compile',
    prompt: '2 つ目の可変参照は作れるか。',
    code: `let mut x = 1;
let a = &mut x;
let b = &mut x;
println!("{}", a);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'E0499 になる', 'E0502 になる', 'panic する'] },
    answer: 'E0499 になる', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0499', verifiedBy: 'rustc 1.99' },
    explanation: 'a が生きている間に b を作るのはデータ競合。可変参照は同時に 1 つ（E0499）。',
    misconception: '可変参照は複数作れると誤解している。',
    misconceptionClass: 'borrowing',
    oneLinePatch: '可変参照は同時に 1 つ。不変参照は複数可',
    hints: ['&mut は排他か。', 'a が生きている間に b を作る。', 'E0499。'],
    transfer: 'rb2',
    reviewInterval: 3, execution: 'compile-checked', source: 'rustc E0499', version: 1,
  }),
  r({
    id: 'rb2', topic: 'rust-borrow', level: 2, questionType: 'predict-output',
    prompt: '不変参照は複数作れる。',
    code: `let mut x = 1;
let a = &x;
let b = &x;
println!("{} {}", a, b);`,
    prediction: { text: '出力を予想してください。', options: ['1 1', 'エラー', '2 2', '1 0'] },
    answer: '1 1', answerKind: 'text',
    expected: { output: ['1 1'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '複数の不変参照は同時には作れる。読み取りは競合しない。',
    misconception: '参照は 1 つだけと誤解している。',
    misconceptionClass: 'borrowing',
    oneLinePatch: '不変参照は複数可。可変参照だけ 1 つ',
    hints: ['読み取りは競合するか。', 'a と b の値。', '1 1。'],
    transfer: 'rb1',
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.4', version: 1,
  }),
  r({
    id: 'rb3', topic: 'rust-borrow', level: 3, questionType: 'minimal-fix',
    prompt: '可変借用を並べて使うとエラーになる。最小の修正を書く。',
    code: `let mut x = 1;
let a = &mut x;
*a += 1;
let b = &mut x;
*b += 2;
println!("{}", x);`,
    starter: `let mut x = 1;
let a = &mut x;
*a += 1;
let b = &mut x;
*b += 2;
println!("{}", x);`,
    solution: `let mut x = 1;
let a = &mut x;
*a += 1;
println!("{}", x);
let b = &mut x;
*b += 2;
println!("{}", x);`,
    prediction: { text: '直し方を予想してください。' },
    answer: 'a の使用寿命を终わらせてから b を作る', answerKind: 'text',
    expected: { output: ['2', '4'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'a が最後に使われた地点で使用壽命が終わる。そのあとなら b を作れる。',
    misconception: '参照はスコープ全体で生きていると誤解している。',
    misconceptionClass: 'borrowing',
    oneLinePatch: '借用は最後に使われた地点まで生きる。之後就ち再借用できる',
    hints: ['a はどこで最後に使われるか。', 'その後なら b は作れるか。', '使用寿命を区切る。'],
    transfer: 'rb1',
    prerequisite: ['ro1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.4', version: 1,
  }),
  r({
    id: 'rb4', topic: 'rust-borrow', level: 3, questionType: 'api-meaning',
    prompt: 'スライスの型 &[T] が表すものとして正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      '配列の任意の連続した範囲への不変参照',
      '配列そのもの',
      '可変配列',
      '配列の長さ',
    ] },
    answer: '配列の任意の連続した範囲への不変参照', answerKind: 'option',
    expected: { value: '配列の任意の連続した範囲への不変参照', verifiedBy: 'rustc 1.99' },
    explanation: 'スライスは「どこかの配列の一部」への参照。長さは動的。',
    misconception: 'スライスは新しい配列と誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'スライス &[T] は配列の一部への参照。長さは動的',
    hints: ['& がついているか。', '長さは静的か動的か。', '範囲への参照。'],
    transfer: 'rst3',
    prerequisite: ['ro1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.4', version: 1,
  }),

  // ------------------------------------------------------------------ strings
  r({
    id: 'rs1', topic: 'rust-string', level: 2, questionType: 'compile',
    prompt: '文字列リテラルは &str。String に代入できるか。',
    code: `let s: String = "orbit";
println!("{}", s);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時エラー'] },
    answer: 'コンパイルできない', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0308', verifiedBy: 'rustc 1.99' },
    explanation: '"orbit" の型は &\'static str。String への代入には to_string() や to_owned() が必要（E0308）。',
    misconception: '文字列リテラルは String と誤解している。',
    misconceptionClass: 'type',
    oneLinePatch: 'リテラルは &str。String にするには to_string() を使う',
    hints: ['"orbit" の型は？', 'String への代入には？', 'コンパイルできない。'],
    transfer: 'rs3',
    reviewInterval: 2, execution: 'compile-checked', source: 'rustc E0308', version: 1,
  }),
  r({
    id: 'rs2', topic: 'rust-string', level: 2, questionType: 'predict-output',
    prompt: 'String から &str を見る。',
    code: `let s = String::from("orbit");
println!("{}", s.as_str().len());`,
    prediction: { text: '出力を予想してください。', options: ['5', '6', '4', 'エラー'] },
    answer: '5', answerKind: 'text',
    expected: { output: ['5'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '"orbit" は 5 文字。as_str() で &str にしてから len()。',
    misconception: '文字数を数えるのに chars() が必要と誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'str::len はバイト数、chars().count() は文字数。ASCII なら同じ',
    hints: ['"orbit" は何文字か。', 'len() は何を使うか。', '5。'],
    variants: [
      {
        id: 'orbit->cosmos',
        label: 'orbit を cosmos に置き換えた形',
        replace: { 'orbit': 'cosmos' },
        expected: { output: ['6'], verifiedBy: 'toolchain' },
        rule: '元の規則がそのまま適用できる',
      },
    ],
    transfer: 'rst1',
    reviewInterval: 2, execution: 'rust-verified', source: 'str::len', version: 1,
  }),
  r({
    id: 'rs3', topic: 'rust-string', level: 3, questionType: 'compile',
    prompt: '文字列リテラルを可変にしようとしている。',
    code: `let mut s = "orbit";
s.push('!');
println!("{}", s);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時エラー'] },
    answer: 'コンパイルできない', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0599', verifiedBy: 'rustc 1.99' },
    explanation: '&str には push というメソッドが存在しない（E0599）。可変にしたいなら String を使う。',
    misconception: 'let mut にすれば文字列の中身が変えられると誤解している。',
    misconceptionClass: 'type',
    oneLinePatch: '&str は不変。中身を変えるなら String',
    hints: ['&str に push はあるか。', 'mut はどれを変えるのか。', 'コンパイルできない。'],
    transfer: 'rs1',
    prerequisite: ['ro1'],
    reviewInterval: 3, execution: 'compile-checked', source: 'rustc E0599', version: 1,
  }),
  r({
    id: 'rs4', topic: 'rust-string', level: 3, questionType: 'predict-output',
    prompt: 'clone と + の違い。元の変数を残すにはどれを使えるか。',
    code: `let a = String::from("Java");
let b = a.clone();
println!("{}", b);
let c = a + "!";
println!("{}", c);`,
    prediction: { text: '2 行の出力を予想してください。', options: ['Java と Java', 'Java と Java!', 'Java! と Java', 'エラー'] },
    answer: 'Java と Java!', answerKind: 'text',
    expected: { output: ['Java', 'Java!'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'clone は複製を作るので a は残る。a + "!" は a を消費して新しい String を作るので、その後 a は使えなくなる。',
    misconception: 'a + "!" は a を変更すると誤解している。',
    misconceptionClass: 'move',
    oneLinePatch: '+ は左辺を消費する。元を残したいなら clone を使う',
    hints: ['b には何が入るか。', 'a + "!" の結果は？', 'Java と Java!。'],
    transfer: 'ro3',
    prerequisite: ['ro1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'std::ops::Add', version: 1,
  }),
];
