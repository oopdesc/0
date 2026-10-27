import type { Problem } from './schema';

/**
 * Java × Rust comparison problems.
 *
 * Requirement 19: comparisons are useful, but one-to-one mapping is forbidden.
 * Each problem targets a place where the two languages look similar yet
 * diverge, and states what does NOT correspond.
 */

const j = (p: Omit<Problem, 'language'>): Problem => ({ language: 'java', ...p });
const ru = (p: Omit<Problem, 'language'>): Problem => ({ language: 'rust', ...p });

export const BRIDGE: Problem[] = [
  j({
    id: 'b-mem1', topic: 'bridge-memory', level: 2, questionType: 'concept',
    prompt: 'GC と所有権の違いとして正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      'Java は到達不能になったオブジェクトを実行時に回収し、Rust はスコープを抜けた時点で確定的に解放する',
      'Rust も GC を使う',
      'Java は明示的に free() を呼ぶ',
      '両者とも解放タイミングは同じ',
    ] },
    answer: 'Java は到達不能になったオブジェクトを実行時に回収し、Rust はスコープを抜けた時点で確定的に解放する', answerKind: 'option',
    expected: { value: 'Java は到達不能になったオブジェクトを実行時に回収し、Rust はスコープを抜けた時点で確定的に解放する', verifiedBy: 'javac 21 / rustc 1.99' },
    explanation: 'GC は「もう誰も参照していないか」を実行時に追跡する。Rust は所有権とライフタイムをコンパイル時に解析する。',
    misconception: '「Rust の方が常に速い」と単純化する。',
    misconceptionClass: 'concept',
    oneLinePatch: 'GC は実行時の追跡、所有権はコンパイル時の決定。対応しない',
    hints: ['解放のタイミングはどちらか。', 'Rust は実行時に走るか。', 'スコープ退出。'],
    transfer: 'js2',
    reviewInterval: 3, execution: 'reading', source: 'The Rust Book ch.4 / JVM GC', version: 1,
  }),
  ru({
    id: 'b-mem2', topic: 'bridge-memory', level: 2, questionType: 'predict-output',
    prompt: '同じ「代入」でも Rust は move、Java は参照の复制。',
    code: `let s = String::from("orbit");
let t = s;
println!("{}", s);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'E0382 になる', 'panic する', '実行時エラー'] },
    answer: 'E0382 になる', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0382', verifiedBy: 'rustc 1.99' },
    explanation: 'Java なら String s = "orbit"; String t = s; は同じ文字列を指すだけで問題ない。Rust は所有権が移るので s は無効になる。',
    misconception: 'Java の代入と Rust の代入は同じと誤解している。',
    misconceptionClass: 'move',
    oneLinePatch: 'Java の代入は参照の复制。Rust は所有権の移動。对应しない',
    hints: ['String は Copy か。', 't が所有権を持ったら s は？', 'E0382。'],
    transfer: 'ro4',
    reviewInterval: 3, execution: 'compile-checked', source: 'rustc E0382', version: 1,
  }),
  j({
    id: 'b-null1', topic: 'bridge-null', level: 2, questionType: 'api-meaning',
    prompt: 'null と Option の違いとして正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      'Rust は「無い」を Option 型で表し、扱い忘れがコンパイルエラーになる',
      'Rust にも null リテラルがある',
      'Java の Optional は Rust の Option と同じ強制力を持つ',
      'Option は実行時にだけ検査される',
    ] },
    answer: 'Rust は「無い」を Option 型で表し、扱い忘れがコンパイルエラーになる', answerKind: 'option',
    expected: { value: 'Rust は「無い」を Option 型で表し、扱い忘れがコンパイルエラーになる', verifiedBy: 'javac 21 / rustc 1.99' },
    explanation: 'Java の Optional<T> は使わなくてもコンパイルできる。Rust の Option<T> は Some/None の分岐を忘れるとコンパイルできない。',
    misconception: 'Java の Optional と Rust の Option は同じと誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'Java の Optional は任意、Rust の Option は必須。検査の強さが違う',
    hints: ['Java で Optional を使わなくてもコンパイルできるか。', 'Rust で None を扱わないと？', 'Rust は必須。'],
    transfer: 'je3',
    reviewInterval: 3, execution: 'reading', source: 'java.util.Optional / std::option::Option', version: 1,
  }),
  ru({
    id: 'b-null2', topic: 'bridge-null', level: 2, questionType: 'compile',
    prompt: 'Java では null を許すコード。Rust で同じことをしようとすると？',
    code: `let s: Option<&str> = None;
println!("{}", s.unwrap());`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時 panic', 'エラーなし'] },
    answer: 'コンパイルできる', answerKind: 'text',
    expected: { compiles: true, runtimeError: 'panic', verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'コンパイルはできるが、None に unwrap すると実行時に panic する。Java なら null への参照からのメソッド呼出で NullPointerException。',
    misconception: 'コンパイルエラーになると誤解している。',
    misconceptionClass: 'compile-vs-runtime',
    oneLinePatch: 'Option の分岐を忘れなければコンパイルできる。中身の有無は実行時',
    hints: ['unwrap の挙動は？', 'None を unwrap すると？', 'コンパイルできる。'],
    transfer: 'rop1',
    reviewInterval: 3, execution: 'rust-verified', source: 'Option::unwrap', version: 1,
  }),
  j({
    id: 'b-iface1', topic: 'bridge-interface', level: 3, questionType: 'api-meaning',
    prompt: 'Java の interface と Rust の trait の違いとして正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      'Java は単一継承、Rust は複数 trait を 1 つの型に実装できる',
      '両者は完全に同じ',
      'Rust の trait は継承できない',
      'Java の interface は実装を持てない',
    ] },
    answer: 'Java は単一継承、Rust は複数 trait を 1 つの型に実装できる', answerKind: 'option',
    expected: { value: 'Java は単一継承、Rust は複数 trait を 1 つの型に実装できる', verifiedBy: 'javac 21 / rustc 1.99' },
    explanation: 'Java のクラスは 1 つしか継承できない（interface は複数可能）。Rust は 1 つの型に複数の trait を実装できる。',
    misconception: 'interface と trait は同じと誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'interface と trait は似ているが、継承の数と実装の场所が違う',
    hints: ['Java のクラスは何個継承できるか。', 'Rust の trait は？', 'Rust は複数実装可。'],
    transfer: 'ji1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'reading', source: 'JLS §8.1.5 / The Rust Book ch.10', version: 1,
  }),
  j({
    id: 'b-exc1', topic: 'bridge-exception', level: 3, questionType: 'concept',
    prompt: 'Java の例外と Rust の Result の違いとして正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      'Exception は隠れた制御フロー、Result は明示的な戻り値の型',
      '両者は同じ。Rust にも try/catch がある',
      'Result は実行時だけ検査される',
      'Exception は値ではない',
    ] },
    answer: 'Exception は隠れた制御フロー、Result は明示的な戻り値の型', answerKind: 'option',
    expected: { value: 'Exception は隠れた制御フロー、Result は明示的な戻り値の型', verifiedBy: 'javac 21 / rustc 1.99' },
    explanation: 'Exception はスタックを伝って投げられる。Result は戻り値の型の一部なので、無視すると unused 警告になる。',
    misconception: 'Rust にも exception があると誤解している。',
    misconceptionClass: 'exception',
    oneLinePatch: 'Exception は隠れた分岐、Result は型の一部。対応しない',
    hints: ['Result を無視するとどうなるか。', 'Exception は何で伝わるか。', 'Result は戻り値。'],
    transfer: 'je1',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'reading', source: 'JLS §11 / The Rust Book ch.9', version: 1,
  }),
  j({
    id: 'b-iter1', topic: 'bridge-iteration', level: 3, questionType: 'concept',
    prompt: 'Java の Stream と Rust の iterator の違いとして正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      'Stream は終端演算で実行される。iterator は 1 段ずつ消費される',
      '両者は同じ',
      'iterator は何度でも巻き戻せる',
      'Stream は元のコレクションを壊す',
    ] },
    answer: 'Stream は終端演算で実行される。iterator は 1 段ずつ消費される', answerKind: 'option',
    expected: { value: 'Stream は終端演算で実行される。iterator は 1 段ずつ消費される', verifiedBy: 'javac 21 / rustc 1.99' },
    explanation: 'Stream は「何を適用するか」を宣言し、終端演算で実行される。Rust の iterator は「次の値をどう作るか」で、消費すると進む。',
    misconception: 'Stream と iterator は同じと誤解している。',
    misconceptionClass: 'iterator',
    oneLinePatch: 'Stream は宣言的なパイプライン、iterator は消費型の列。対応しない',
    hints: ['Stream はいつ実行されるか。', 'iterator は 1 度だけ通るか。', '終端演算。'],
    transfer: 'jf2',
    prerequisite: ['ja1'],
    reviewInterval: 3, execution: 'reading', source: 'java.util.stream / std::iter::Iterator', version: 1,
  }),
  ru({
    id: 'b-iter2', topic: 'bridge-iteration', level: 3, questionType: 'predict-output',
    prompt: 'Rust の iter / into_iter の違いを確かめる。',
    code: `let v = vec![1, 2, 3];
let sum: i32 = v.iter().sum();
println!("{}", sum);
println!("{}", v.len());`,
    prediction: { text: '2 行の出力を予想してください。', options: ['6 と 3', '6 と 0', '6 とエラー', '3 と 3'] },
    answer: '6 と 3', answerKind: 'text',
    expected: { output: ['6', '3'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'iter は借用なので v は使える。合計 6、要素数 3。',
    misconception: 'イテレータはもとのコレクションを消費するとと誤解している。',
    misconceptionClass: 'iterator',
    oneLinePatch: 'iter は借用、into_iter は消費。どっちを使うかで元の使い勝手が決まる',
    hints: ['iter は何をするか。', 'v はまだ使えるか。', '6 と 3。'],
    transfer: 'rcol2',
    prerequisite: ['rb1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'Vec::iter', version: 1,
  }),
];
