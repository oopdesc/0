import type { Problem } from './schema';

/** Rust advanced problems (struct/enum, Option/Result, collections, traits, lifetimes, practical). */

const r = (p: Omit<Problem, 'language'>): Problem => ({ language: 'rust', ...p });

export const RUST_ADVANCED: Problem[] = [
  // ---------------------------------------------------------------- struct
  r({
    id: 'rst1', topic: 'rust-struct', level: 2, questionType: 'predict-output',
    prompt: 'フィールドにアクセスする。',
    code: `struct P {
  x: i32,
  y: i32,
}
let p = P { x: 1, y: 2 };
println!("{}", p.x + p.y);`,
    prediction: { text: '出力を予想してください。', options: ['1', '2', '3', 'エラー'] },
    answer: '3', answerKind: 'text',
    expected: { output: ['3'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'p.x=1、p.y=2。合計 3。',
    misconception: 'フィールドは位置でアクセスすると誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'フィールドは名前でアクセスする。p.x',
    hints: ['x と y の値。', '足し算の結果。', '3。'],
    transfer: 'rs2',
    reviewInterval: 2, execution: 'rust-verified', source: 'The Rust Book ch.5', version: 1,
  }),
  r({
    id: 'rst2', topic: 'rust-struct', level: 2, questionType: 'compile',
    prompt: 'フィールドを初期化し忘れている。コンパイルできるか。',
    code: `struct P {
  x: i32,
  y: i32,
}
let p = P { x: 1 };
println!("{}", p.x);`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時エラー'] },
    answer: 'コンパイルできない', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0063', verifiedBy: 'rustc 1.99' },
    explanation: ' struct の初期化には全部のフィールドが必要（E0063）。',
    misconception: '省略したフィールドは 0 になると誤解している。',
    misconceptionClass: 'type',
    oneLinePatch: ' struct の初期化は全フィールド必須。省略は許されない',
    hints: ['y を書いているか。', '省略は許されるか。', 'コンパイルできない。'],
    transfer: 'rs1',
    reviewInterval: 2, execution: 'compile-checked', source: 'rustc E0063', version: 1,
  }),
  r({
    id: 'rst3', topic: 'rust-struct', level: 3, questionType: 'predict-output',
    prompt: 'enum と match で値を分解する。',
    code: `enum Dir { Up, Down }
let d = Dir::Up;
let s = match d {
  Dir::Up => "up",
  Dir::Down => "down",
};
println!("{}", s);`,
    prediction: { text: '出力を予想してください。', options: ['up', 'down', 'Dir::Up', 'エラー'] },
    answer: 'up', answerKind: 'text',
    expected: { output: ['up'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'd は Dir::Up。対応する腕が選ばれる。',
    misconception: 'match は条件文と同じと誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'match は値の形で分岐する。網羅的でないとコンパイルできない',
    hints: ['d はどちらか。', '対応する腕は？', 'up。'],
    transfer: 'rb4',
    prerequisite: ['ro1'],
    reviewInterval: 2, execution: 'rust-verified', source: 'The Rust Book ch.6', version: 1,
  }),
  r({
    id: 'rst4', topic: 'rust-struct', level: 3, questionType: 'compile',
    prompt: 'match の分岐を 1 つ書き忘れた。コンパイルできるか。',
    code: `enum Dir { Up, Down }
fn name(d: Dir) -> &'static str {
  match d {
    Dir::Up => "up",
  }
}
println!("{}", name(Dir::Up));`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時エラー'] },
    answer: 'コンパイルできない', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0004', verifiedBy: 'rustc 1.99' },
    explanation: 'match は全バリアントを扱わないとコンパイルできない（非網羅、E0004）。',
    misconception: '分岐を書き忘れても実行時にまで行くと誤解している。',
    misconceptionClass: 'compile-vs-runtime',
    oneLinePatch: 'match は網羅的でないとコンパイルできない',
    hints: ['Down を扱っているか。', 'コンパイラは網羅を検査するか。', 'コンパイルできない。'],
    transfer: 'ro1',
    prerequisite: ['ro1'],
    reviewInterval: 3, execution: 'compile-checked', source: 'rustc E0004', version: 1,
  }),

  // -------------------------------------------------------------- option
  r({
    id: 'rop1', topic: 'rust-option', level: 2, questionType: 'predict-output',
    prompt: 'Some の中身を取り出して 2 倍する。',
    code: `let v = Some(7);
let n = match v {
  Some(x) => x * 2,
  None => 0,
};
println!("{}", n);`,
    prediction: { text: '出力を予想してください。', options: ['7', '14', '0', 'エラー'] },
    answer: '14', answerKind: 'text',
    expected: { output: ['14'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'Some(7) なので x=7。7*2=14。',
    misconception: 'Some(x) の x は Option のままと誤解している。',
    misconceptionClass: 'option-result',
    oneLinePatch: 'Some(x) は中身を x に束縛する。Option そのものではない',
    hints: ['v の中身は？', 'x には何が入るか。', '14。'],
    transfer: 'rop2',
    reviewInterval: 2, execution: 'rust-verified', source: 'The Rust Book ch.6', version: 1,
  }),
  r({
    id: 'rop2', topic: 'rust-option', level: 2, questionType: 'predict-output',
    prompt: 'None に unwrap() するとどうなるか。',
    code: `let v: Option<i32> = None;
println!("{}", v.unwrap());`,
    prediction: { text: '実行結果を予想してください。', options: ['null', '0', 'panic', 'コンパイルできない'] },
    answer: 'panic', answerKind: 'text',
    expected: { runtimeError: 'panic', verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'unwrap は中身があると信じる。None なら panic する。実行前に判定するなら unwrap_or か match。',
    misconception: 'unwrap は空でも安全に動くと誤解している。',
    misconceptionClass: 'option-result',
    oneLinePatch: 'unwrap() は None / Err で panic。信頼できる値にだけ使う',
    hints: ['v は空か。', 'unwrap は空でどうなるか。', 'panic。'],
    transfer: 'rop1',
    reviewInterval: 2, execution: 'rust-verified', source: 'Option::unwrap', version: 1,
  }),
  r({
    id: 'rop3', topic: 'rust-option', level: 3, questionType: 'minimal-fix',
    prompt: 'None に unwrap して落ちるコードを、安全な判定に直す。',
    code: `let v: Option<i32> = None;
println!("{}", v.unwrap());`,
    starter: `let v: Option<i32> = None;
println!("{}", v.unwrap());`,
    solution: `let v: Option<i32> = None;
println!("{}", v.is_none());`,
    prediction: { text: '直し方を予想してください。' },
    answer: 'is_none() を使う', answerKind: 'text',
    expected: { output: ['true'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'is_none() は bool を返す。空であることを正常な状態として扱える。',
    misconception: '空の値は例外的に扱う必要があると誤解している。',
    misconceptionClass: 'option-result',
    oneLinePatch: '失敗を値として扱うなら is_none / unwrap_or / match',
    hints: ['空であるかを調べる方法。', 'bool を返すメソッド。', 'is_none()。'],
    transfer: 'rop1',
    prerequisite: ['rop1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'Option::is_none', version: 1,
  }),
  r({
    id: 'rop4', topic: 'rust-option', level: 3, questionType: 'predict-output',
    prompt: 'Result の Err 側を handling する。',
    code: `let r: Result<i32, &str> = Err("offline");
let n = match r {
  Ok(v) => v,
  Err(e) => 0,
};
println!("{}", n);`,
    prediction: { text: '出力を予想してください。', options: ['0', 'offline', 'エラー', 'panic'] },
    answer: '0', answerKind: 'text',
    expected: { output: ['0'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'r は Err。Err(e) 側が選ばれて 0。e は使わなくてもパターンとして受け取れる。',
    misconception: 'Err 側はエラーになると誤解している。',
    misconceptionClass: 'option-result',
    oneLinePatch: 'Result は Ok と Err の直和型。両方を扱う',
    hints: ['r は Ok か Err か。', 'Err 側の腕は何を返すか。', '0。'],
    transfer: 'rop1',
    prerequisite: ['rop1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.9', version: 1,
  }),

  // -------------------------------------------------------- collections
  r({
    id: 'rcol1', topic: 'rust-collections', level: 3, questionType: 'predict-output',
    prompt: 'Vec の長さと要素の数。',
    code: `let v = vec![1, 2, 3];
println!("{}", v.len());`,
    prediction: { text: '出力を予想してください。', options: ['2', '3', '4', 'エラー'] },
    answer: '3', answerKind: 'text',
    expected: { output: ['3'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'vec![1,2,3] は 3 要素。len() は要素数。',
    misconception: 'len は最後の添字と誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: 'Vec::len は要素数。最後の添字は len() - 1',
    hints: ['要素はいくつあるか。', 'len() は何を返すか。', '3。'],
    transfer: 'rcol2',
    prerequisite: ['rop1'],
    reviewInterval: 2, execution: 'rust-verified', source: 'Vec::len', version: 1,
  }),
  r({
    id: 'rcol2', topic: 'rust-collections', level: 3, questionType: 'predict-output',
    prompt: 'イテレータの collect で集める。',
    code: `let v = vec![1, 2, 3, 4];
let evens: Vec<i32> = v.iter().filter(|x| *x % 2 == 0).cloned().collect();
println!("{}", evens.len());`,
    prediction: { text: '出力を予想してください。', options: ['2', '3', '4', '0'] },
    answer: '2', answerKind: 'text',
    expected: { output: ['2'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '偶数は 2 と 4。要素数は 2。',
    misconception: 'filter はコレクションを壊すと誤解している。',
    misconceptionClass: 'iterator',
    oneLinePatch: 'filter は新しいイテレータを返す。元のコレクションは壊れない',
    hints: ['偶数はどれか。', '残る要素の数。', '2。'],
    transfer: 'rcol4',
    prerequisite: ['rop1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'Iterator::filter', version: 1,
  }),
  r({
    id: 'rcol3', topic: 'rust-collections', level: 3, questionType: 'compile',
    prompt: '同じキーに 2 回代入している。HashMap の挙動は。',
    code: `use std::collections::HashMap;
let mut map = HashMap::new();
map.insert("a", 1);
map.insert("a", 2);
println!("{}", map.get("a").unwrap());`,
    prediction: { text: 'コンパイルできるか、そして出力はどうなるか予想してください。', options: ['コンパイルでき、2', 'コンパイルでき、1', 'コンパイルできない', 'panic'] },
    answer: 'コンパイルでき、2', answerKind: 'text',
    expected: { output: ['2'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '同じキーへの insert は上書き。値は最後の 2。',
    misconception: '同じキーは両方残ると誤解している。',
    misconceptionClass: 'api',
    oneLinePatch: 'HashMap はキーごとに 1 つ。同じキーは上書き',
    hints: ['insert は上書きか追加か。', '最後の値は？', '2。'],
    transfer: 'rcol4',
    prerequisite: ['rop1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'HashMap::insert', version: 1,
  }),
  r({
    id: 'rcol4', topic: 'rust-collections', level: 3, questionType: 'predict-output',
    prompt: 'into_iter は所有権を移动する。',
    code: `let v = vec![1, 2, 3];
let first: i32 = v.into_iter().next().unwrap();
println!("{}", first);
println!("{}", v.len());`,
    prediction: { text: '2 行の出力を予想してください。', options: ['1 と 0', '1 と 3', '1 とエラー', '3 と 3'] },
    answer: '1 とエラー', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0382', verifiedBy: 'rustc 1.99' },
    explanation: 'into_iter は Vec を消费する。その後 v は使えないのでコンパイルエラー（E0382）。',
    misconception: 'iter と into_iter は同じと誤解している。',
    misconceptionClass: 'iterator',
    oneLinePatch: 'iter は借用、into_iter は移動。借りたいなら iter',
    hints: ['into_iter は何を消费するか。', 'v はまだ使えるか。', 'E0382。'],
    transfer: 'rcol2',
    prerequisite: ['rop1'],
    reviewInterval: 3, execution: 'compile-checked', source: 'rustc E0382', version: 1,
  }),

  // ---------------------------------------------------------------- traits
  r({
    id: 'rt1', topic: 'rust-trait', level: 3, questionType: 'predict-output',
    prompt: 'トレイトを実装すると、型に方法が追加される。',
    code: `trait Double {
  fn double(self) -> i32;
}
impl Double for i32 {
  fn double(self) -> i32 { self * 2 }
}
println!("{}", 5.double());`,
    prediction: { text: '出力を予想してください。', options: ['5', '10', '25', 'エラー'] },
    answer: '10', answerKind: 'text',
    expected: { output: ['10'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'i32 に Double を実装したので 5.double() が使える。5*2=10。',
    misconception: 'trait はインターフェースだけで何も変えないと誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'trait は型に能力を追加する。実装すればメソッドが使える',
    hints: ['double は何をするか。', '5 を 2 倍。', '10。'],
    transfer: 'rt4',
    prerequisite: ['rop1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.10', version: 1,
  }),
  r({
    id: 'rt2', topic: 'rust-trait', level: 3, questionType: 'predict-output',
    prompt: 'ジェネリクスの型パラメータは呼び出し側で決まる。',
    code: `fn first<T>(v: Vec<T>) -> Option<T> {
  v.into_iter().next()
}
println!("{:?}", first(vec![1, 2, 3]));`,
    prediction: { text: '出力を予想してください。', options: ['Some(1)', '1', 'None', 'エラー'] },
    answer: 'Some(1)', answerKind: 'text',
    expected: { output: ['Some(1)'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'Vec<i32> を渡すと T = i32。先頭要素は 1。',
    misconception: 'ジェネリクスは実行時に型を決めると誤解している。',
    misconceptionClass: 'type',
    oneLinePatch: 'ジェネリクスはコンパイル時に単型化される',
    hints: ['T は何に決まるか。', '先頭要素は？', 'Some(1)。'],
    transfer: 'rt3',
    prerequisite: ['rop1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.10', version: 1,
  }),
  r({
    id: 'rt3', topic: 'rust-trait', level: 3, questionType: 'predict-output',
    prompt: 'クロージャは型にキャプチャする。',
    code: `let mut count = 0;
let mut add = |n: i32| { count += n; };
add(5);
add(3);
println!("{}", count);`,
    prediction: { text: '出力を予想してください。', options: ['5', '8', '3', 'エラー'] },
    answer: '8', answerKind: 'text',
    expected: { output: ['8'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'クロージャは count を捕获する。5 と 3 を足して 8。',
    misconception: 'クロージャは捕捉した変数の写しを持つと誤解している。',
    misconceptionClass: 'scope',
    oneLinePatch: 'クロージャは捕获した変数を同じ場所に読む。写しではない',
    hints: ['count は何回増えるか。', '合計は？', '8。'],
    transfer: 'rt4',
    prerequisite: ['rop1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.13', version: 1,
  }),
  r({
    id: 'rt4', topic: 'rust-trait', level: 3, questionType: 'compile',
    prompt: '明示的に実装していない型でも、デフォルト実装があれば使える。',
    code: `let s = "orbit";
println!("{}", s.len());`,
    prediction: { text: '出力を予想してください。', options: ['5', '6', '4', 'エラー'] },
    answer: '5', answerKind: 'text',
    expected: { output: ['5'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '&str はデフォルトで Length トレイトを実装している。len() は明示的な impl なしに使える。orbit は 5 文字。',
    misconception: 'trait は明示的に実装しないと使えないと誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'デフォルト実装を持つ trait はそのまま使える。明示不要',
    hints: ['"orbit" は何文字か。', 'len() は何を使うか。', '5。'],
    transfer: 'rt1',
    prerequisite: ['rop1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.10', version: 1,
  }),

  // ------------------------------------------------------------- lifetimes
  r({
    id: 'rlt1', topic: 'rust-lifetime', level: 3, questionType: 'api-meaning',
    prompt: 'ライフタイム注釈が表すものとして正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      '参照が有効な期間（いつまで生きるか）',
      '値の大きさ',
      'スレッド数',
      'ライフタイムは実行時に延命する',
    ] },
    answer: '参照が有効な期間（いつまで生きるか）', answerKind: 'option',
    expected: { value: '参照が有効な期間（いつまで生きるか）', verifiedBy: 'rustc 1.99' },
    explanation: "fn longest<'a>(a: &'a str, b: &'a str) -> &'a str の 'a は「戻り値は入力のどちらかと同じ期間だけ生きる」という宣言。",
    misconception: 'ライフタイムは値を延命させると誤解している。',
    misconceptionClass: 'lifetime',
    oneLinePatch: 'ライフタイムは参照の「いつまで」を表す注釈。延命はしない',
    hints: ['引用の有効範囲か何か。', '値の壽命を変えるか。', '有効期間。'],
    transfer: 'rlt2',
    prerequisite: ['rv1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.10', version: 1,
  }),
  r({
    id: 'rlt2', topic: 'rust-lifetime', level: 3, questionType: 'compile',
    prompt: '戻り値のライフタイムを指定していない。コンパイルできるか。',
    code: `fn longest(a: &str, b: &str) -> &str {
  if a.len() > b.len() { a } else { b }
}
fn main() {
  let a = String::from("abc");
  let r = longest(&a, "xyz");
  a.push('!');
  println!("{}", r);
}`,
    prediction: { text: 'コンパイルできるか予想してください。', options: ['コンパイルできる', 'コンパイルできない', '実行時エラー'] },
    answer: 'コンパイルできない', answerKind: 'text',
    expected: { compiles: false, compileError: 'E0106', verifiedBy: 'rustc 1.99' },
    explanation: '複数の入力の参照を返す場合は、どれと同じ寿命かを注釈で指定する必要がある（E0106）。寿命を指定しても a より長く生きることはできない（E0597）。',
    misconception: 'ライフタイム注釈は書かなくてもいいと誤解している。',
    misconceptionClass: 'lifetime',
    oneLinePatch: '参照の寿命は参照元より長くできない。compile 時に検査される',
    hints: ['戻り値の参照はどれと同じ期間か。', '注釈がないと？', 'コンパイルできない。'],
    transfer: 'rlt1',
    prerequisite: ['rv1'],
    reviewInterval: 3, execution: 'compile-checked', source: 'rustc E0597', version: 1,
  }),
  r({
    id: 'rlt3', topic: 'rust-lifetime', level: 3, questionType: 'api-meaning',
    prompt: 'エラーを伝搬する `?` 演算子の意味として正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      'Err が出たらその関数も Err を返す',
      'Err を無視して继续する',
      'Err を panic に変える',
      'Exception を投げる',
    ] },
    answer: 'Err が出たらその関数も Err を返す', answerKind: 'option',
    expected: { value: 'Err が出たらその関数も Err を返す', verifiedBy: 'rustc 1.99' },
    explanation: '? は Ok なら中身を渡し、Err ならその関数の戻り値として伝搬させる。',
    misconception: '? は例外を投げると誤解している。',
    misconceptionClass: 'exception',
    oneLinePatch: '? は Err を上位に伝搬する。例外ではない',
    hints: ['Err が出たらどうなるか。', 'その関数の戻り値は？', 'Err を返す。'],
    transfer: 'rlt4',
    prerequisite: ['rv1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.9', version: 1,
  }),
  r({
    id: 'rlt4', topic: 'rust-lifetime', level: 3, questionType: 'predict-output',
    prompt: '? で伝搬したときの戻り値。',
    code: `fn parse(s: &str) -> Result<i32, String> {
  s.parse::<i32>().map_err(|_| "bad".to_string())
}
fn double(s: &str) -> Result<i32, String> {
  Ok(parse(s)? * 2)
}
println!("{:?}", double("5"));
println!("{:?}", double("x"));`,
    prediction: { text: '2 行の出力を予想してください。', options: ['Ok(10) と Err', 'Err と Ok(10)', 'Ok(5) と Ok(5)', 'panic'] },
    answer: 'Ok(10) と Err', answerKind: 'text',
    expected: { output: ['Ok(10)', 'Err("bad")'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '"5" は parse できて 5。2 倍で Ok(10)。"x" は parse に失敗して Err が伝搬。',
    misconception: '? は失敗を無視すると誤解している。',
    misconceptionClass: 'exception',
    oneLinePatch: '? は Ok を展開し Err を伝搬する。失敗は残る',
    hints: ['"5" は parse できるか。', '"x" は？', 'Ok(10) と Err。'],
    transfer: 'rlt3',
    prerequisite: ['rv1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'The Rust Book ch.9', version: 1,
  }),

  // ----------------------------------------------------------- practical
  r({
    id: 'rpr1', topic: 'rust-practical', level: 3, questionType: 'boundary',
    prompt: 'i32 の範囲外の値を作る。',
    code: `let a: i32 = 2147483647;
println!("{}", a.wrapping_add(1));`,
    prediction: { text: '出力を予想してください。', options: ['2147483648', '-2147483648', 'panic', 'エラー'] },
    answer: '-2147483648', answerKind: 'text',
    expected: { output: ['-2147483648'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'wrapping_add はオーバーフローを黙ってラップする。i32 の最大値 + 1 は最小値。',
    misconception: 'Rust ではオーバーフローが自動で検知されると誤解している。',
    misconceptionClass: 'boundary',
    oneLinePatch: 'リリースではオーバーフローはラップする。検知したいなら overflowing_add',
    hints: ['i32 の最大値は？', '最大値 + 1。', '-2147483648。'],
    transfer: 'rpr2',
    prerequisite: ['rv1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'i32::wrapping_add', version: 1,
  }),
  r({
    id: 'rpr2', topic: 'rust-practical', level: 3, questionType: 'trace',
    prompt: '決定的な宇宙モデル。同じ入力なら同じ出力。',
    code: `fn star_count(radius: i32) -> i32 {
  radius * 4
}
let a = star_count(10);
let b = star_count(10);
println!("{} {}", a, b);`,
    prediction: { text: '出力を予想してください。', options: ['40 40', '40 41', '10 10', 'エラー'] },
    answer: '40 40', answerKind: 'text',
    expected: { output: ['40 40'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: '同じ入力同じ出力。決定的なモデルの性質。',
    misconception: '関数は毎回違う値を返すと誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: '純粋な関数は同じ入力なら同じ出力。決定性',
    hints: ['radius は何度使われるか。', '10 * 4 は？', '40 40。'],
    transfer: 'rpr4',
    prerequisite: ['rv1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'deterministic simulation', version: 1,
  }),
  r({
    id: 'rpr3', topic: 'rust-practical', level: 3, questionType: 'compile',
    prompt: 'WASM で使う f32 と f64 の違い。',
    code: `fn area(r: f32) -> f32 {
  3.14159 * r * r
}
println!("{}", area(2.0));`,
    prediction: { text: 'コンパイルできるか、そして出力はどうなるか予想してください。', options: ['コンパイルでき、12.56636', 'コンパイルでき、12.566370614359172', 'コンパイルできない', 'panic'] },
    answer: 'コンパイルでき、12.56636', answerKind: 'text',
    expected: { output: ['12.56636'], verifiedBy: 'rustc 1.99 / stable' },
    explanation: 'f32 は 32 ビット。3.14159f32 * 2 * 2 = 12.56636。f64 ならより長い桁になる。',
    misconception: 'f32 と f64 は同じ精度と誤解している。',
    misconceptionClass: 'type',
    oneLinePatch: 'f32 は 32 ビット、f64 は 64 ビット。出力の桁数が違う',
    hints: ['f32 の精度は？', '3.14159 * 4。', '12.56636。'],
    transfer: 'rpr4',
    prerequisite: ['rv1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'f32 / f64', version: 1,
  }),
  r({
    id: 'rpr4', topic: 'rust-practical', level: 3, questionType: 'api-meaning',
    prompt: 'WASM のメモリ模型について正しいものを選ぶ。',
    prediction: { text: '選択肢から選んでください。', options: [
      'Linear memory は 1 本の連続した byte 配列。ポインタと長さで管理する',
      'WASM にはメモリがない',
      'WASM はガベージコレクションを使う',
      'ポインタは 64 ビットに固定される',
    ] },
    answer: 'Linear memory は 1 本の連続した byte 配列。ポインタと長さで管理する', answerKind: 'option',
    expected: { value: 'Linear memory は 1 本の連続した byte 配列。ポインタと長さで管理する', verifiedBy: 'rustc 1.99' },
    explanation: 'WASM のメモリは 1 本の linear memory。JS 側からは Uint8Array として見える。',
    misconception: 'WASM は OS のメモリを使うと誤解している。',
    misconceptionClass: 'concept',
    oneLinePatch: 'WASM memory は 1 本の byte 配列。境界を超えると trap',
    hints: ['メモリは何本あるか。', 'JS からどう見えるか。', '1 本の配列。'],
    transfer: 'rpr2',
    prerequisite: ['rv1'],
    reviewInterval: 3, execution: 'rust-verified', source: 'WebAssembly spec', version: 1,
  }),
];
