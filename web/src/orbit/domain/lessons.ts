import type { Lesson, LessonId, Stage } from './types';

const javaArray = (values: string, op: '<' | '<=') => `int[] orbits = { ${values} };
int count = 0;
for (int i = 0; i ${op} orbits.length; i++) {
    int orbit = orbits[i];
    count++;
}
System.out.println(count);`;
const javaStream = (values: string, op: '>=' | '>', threshold: number) => `List<Integer> radii = List.of(${values});
long count = radii.stream()
    .filter(radius -> radius ${op} ${threshold})
    .count();
System.out.println(count);`;
const rustOwnership = (values: string, expr: '&stars' | 'stars' | 'stars.clone()') => `let stars = vec![${values}];
let view = ${expr};
println!("{}", view.len());
println!("{}", stars.len());`;
const rustOption = (values: string, index: number) => `let orbits = vec![${values}];
let index: usize = ${index};
match orbits.get(index) {
    Some(radius) => println!("{}", radius),
    None => println!("none"),
}`;


const javaPolymorphism = (type: 'Planet' | 'Star') => `interface Body { String kind(); }
class Planet implements Body {
    public String kind() { return "planet"; }
}
class Star implements Body {
    public String kind() { return "star"; }
}
class OrbitLab {
    public static void main(String[] args) {
        Body body = new ${type}();
        System.out.println(body.kind());
    }
}`;
const rustResult = (radius: number, op: '>' | '>=') => `fn make_orbit(radius: i32) -> Result<i32, &'static str> {
    if radius ${op} 0 { Ok(radius) } else { Err("invalid") }
}
fn main() {
    let radius = ${radius};
    match make_orbit(radius) {
        Ok(value) => println!("{}", value),
        Err(message) => println!("{}", message),
    }
}`;

const lessons: Lesson[] = [
  {
    id: 'java-array', number: '01', language: 'Java', tag: 'ARRAYS / 境界', title: '軌道を数える',
    short: '配列の長さと、最後のインデックス。',
    goal: '配列をひとつずつ読み、軌道を宇宙に配置する。範囲の外へ出ない条件を考えよう。',
    editGuide: '編集できる範囲：配列の値（1〜9、最大8個）、開始位置 0 / 1、条件 < / <=。その他は教材の形を保ってください。',
    patch: 'lengthは要素数。最後のindexはlength - 1。',
    explanation: '配列は0から始まる。i が length と等しくなると、存在しない要素を読むため実行時例外になる。',
    comparison: 'Javaの配列アクセスは範囲外で例外。RustのVecには、Optionを返すgetもある。どちらも範囲を確認する必要がある。',
    structure: { input: '軌道の配列', decision: 'i < length ?', process: 'orbits[i]を読み、1を足す', output: '読み終えた数', role: 'iは現在の位置。countは読んだ数。', invariant: 'ループの各本体に入るとき、0 ≤ i < length。', boundary: 'i = lengthは範囲外。最後はlength - 1。' },
    sources: { example: javaArray('1, 2, 3', '<'), experiment: javaArray('1, 2, 3', '<='), recall: '', transfer: javaArray('2, 4, 6, 8', '<=') },
    stagePrompts: { example: '完成例を読んでから、出力を予測して実行。1行ずつ追跡できます。', experiment: '境界にバグがあります。まず結果を予測し、実行してから修正しよう。', recall: '答えを見ずに、半径 1, 2, 3 を走査して3を出力するコードを再現しよう。', transfer: '半径を 2, 4, 6, 8 に変更。境界を直して、4つの軌道を生成しよう。' },
    reviewCode: javaArray('2, 4, 6, 8', '<='), reviewPrompt: 'このコードは何を出力する？ 例外が起きる場合は「エラー」と入力。',
    rebuildPrompt: '半径 1, 2, 3 の配列を正しく走査し、3を出力するコードを再現。'
  },
  {
    id: 'java-stream', number: '02', language: 'Java', tag: 'STREAM / 条件', title: '星を選び出す',
    short: 'filterの条件で、見える星を変える。',
    goal: '半径のリストから条件を満たす星を選ぶ。境界の値が含まれるかを予測しよう。',
    editGuide: '編集できる範囲：List.ofの値（1〜9、最大8個）、比較演算子 >= / > / <= / < / ==、しきい値 0〜10。',
    patch: '>=は境界を含み、>は境界を含まない。',
    explanation: 'filterは各要素に条件を適用し、trueの要素だけを次に渡す。countは残った要素の数。',
    comparison: 'Rustのiteratorにもfilterがある。ただしクロージャが受け取る参照と型はJavaと同一ではない。',
    structure: { input: '半径のList', decision: 'radiusとしきい値を比較', process: 'trueだけを通過させる', output: '通過した要素数', role: 'filterは選別。countは終端操作。', invariant: '元のListはfilterによって変更されない。', boundary: '>= は等しい値を含み、> は含まない。' },
    sources: { example: javaStream('2, 4, 6, 8', '>=', 4), experiment: javaStream('2, 4, 6, 8', '>', 4), recall: '', transfer: javaStream('1, 3, 5, 7, 9', '>', 5) },
    stagePrompts: { example: 'まず完成例を読み、境界の4が通るかを予測。', experiment: '「4以上」を表示したい。条件を予測し、必要なら修正しよう。', recall: '2, 4, 6, 8から4以上の数を選び、3を出力するコードを再現しよう。', transfer: '5以上の軌道を選びたい。新しいリストで試そう。' },
    reviewCode: javaStream('1, 3, 5, 7, 9', '>', 5), reviewPrompt: '5は通過する？ 出力される個数を予測。',
    rebuildPrompt: '2, 4, 6, 8 から4以上を選び、3を出力するコードを再現。'
  },
  {
    id: 'java-polymorphism', number: '03', language: 'Java', tag: 'OOP / 動的ディスパッチ', title: '天体のふるまいを呼ぶ',
    short: 'interfaceと実体、呼ばれるメソッド。',
    goal: 'Body型の変数からkindを呼ぶ。実体がPlanetとStarでは、どちらの実装が動く？',
    editGuide: '編集できる範囲：main内の new Planet() / new Star()。型定義とメソッド名は教材の形を保ってください。',
    patch: 'overrideされたインスタンスメソッドは、実体の実装が選ばれる。',
    explanation: '宣言型Bodyで呼び出せるメソッドが決まり、実行時には実体PlanetまたはStarの実装が選ばれる。',
    comparison: 'Java interfaceとRust traitは共通の振る舞いを表すが、型引数・dispatch・trait objectの制約は同一ではない。',
    structure: { input: 'Body型の参照と実体', decision: '実行時の実体を確認', process: '実体のkind実装を呼ぶ', output: 'planet または star', role: 'Bodyは契約。PlanetとStarは実装。', invariant: 'body.kind()はBodyで宣言されている。', boundary: 'staticメソッドの隠蔽はoverrideと同じではない。' },
    sources: { example: javaPolymorphism('Planet'), experiment: javaPolymorphism('Star'), recall: '', transfer: javaPolymorphism('Star') },
    stagePrompts: { example: '実体がPlanetのとき、どのkindが呼ばれるか予測。', experiment: '「planet」を出したい。実体を予測して必要なら変更しよう。', recall: 'Bodyの実装を定義し、Planetのkindがplanetを返すプログラムを再現。', transfer: '実体をStarに替える。宣言型はBodyのまま、出力を予測しよう。' },
    reviewCode: javaPolymorphism('Star'), reviewPrompt: 'Body型の変数がStarを参照している。出力は？',
    rebuildPrompt: 'Body、Planet、Starを定義し、new Planet()からplanetを出力する完全なコードを再現。'
  },
  {
    id: 'rust-ownership', number: '04', language: 'Rust', tag: 'OWNERSHIP / 所有権', title: '星を借りる',
    short: 'moveとborrowで、値の使い方を読む。',
    goal: '星のVecを別の名前から読む。元の変数も使うには、何が必要だろう？',
    editGuide: '編集できる範囲：vec!の値（1〜9、最大8個）と、代入式 &stars / stars / stars.clone()。',
    patch: 'Vecをmoveした後、元の変数からその値は使えない。',
    explanation: 'VecはCopyではない。starsをそのまま代入すると所有権がmoveし、後のstars.len()はコンパイルエラー。&starsは不変借用。',
    comparison: 'Javaの参照コピーとRustの所有権移動は同じではない。JavaはGCで寿命を管理し、Rustは所有権と借用をコンパイル時に検査する。',
    structure: { input: 'Vecとその所有者stars', decision: 'move / borrow / clone', process: 'viewとstarsを読む', output: '2つの長さ、またはコンパイルエラー', role: 'starsは所有者。&starsは値を借りる参照。', invariant: 'move後に移動元のVecを使わない。', boundary: 'cloneは独立したコピー。借用はコピーではない。' },
    sources: { example: rustOwnership('1, 2, 3', '&stars'), experiment: rustOwnership('1, 2, 3', 'stars'), recall: '', transfer: rustOwnership('2, 4, 6, 8', 'stars') },
    stagePrompts: { example: '借用した場合、2つのprintln!は何を出力する？', experiment: '所有権をmoveすると、後のstarsは使える？ 結果を予測して修正しよう。', recall: '3要素のVecを借用し、長さを2回出力するコードを再現しよう。', transfer: '4要素で同じ問題を調べる。&による借用、またはcloneで直そう。' },
    reviewCode: rustOwnership('2, 4, 6, 8', 'stars'), reviewPrompt: 'このプログラムは出力できる？ コンパイルエラーなら「エラー」。',
    rebuildPrompt: 'vec![1, 2, 3]を&starsで借用し、長さを2回出力するコードを再現。'
  },
  {
    id: 'rust-option', number: '05', language: 'Rust', tag: 'OPTION / 境界', title: '軌道をたずねる',
    short: 'Optionとmatchで、存在しない値を扱う。',
    goal: '存在しない軌道を要求したら？ getとmatchで、結果を安全に分岐しよう。',
    editGuide: '編集できる範囲：vec!の値（1〜9、最大8個）とindex（0〜9）。getとmatchの形は保ってください。',
    patch: 'Vec::getは範囲外でNoneを返し、panicしない。',
    explanation: 'getはOption<&T>を返す。有効なindexならSome、範囲外ならNone。matchは両方を扱う。',
    comparison: 'Javaの配列アクセスは範囲外で例外。Optionと例外は用途も制御の仕組みも異なり、一対一の対応ではない。',
    structure: { input: 'Vecとindex', decision: 'indexが範囲内か', process: 'Some / Noneをmatch', output: '半径、またはnone', role: 'getは存在の有無をOptionで返す。', invariant: 'このgetの範囲外アクセスはpanicしない。', boundary: '最後のindexはlen - 1。lenではNone。' },
    sources: { example: rustOption('1, 2, 3', 1), experiment: rustOption('1, 2, 3', 3), recall: '', transfer: rustOption('2, 4, 6, 8', 4) },
    stagePrompts: { example: 'index 1にある半径を予測。indexは0から数える。', experiment: 'index 3は存在する？ 出力を予測してから確認。', recall: 'vec![1, 2, 3]のindex 1をgetし、2を出力するmatchを再現しよう。', transfer: '4要素のVecに対して、index 4を要求すると何が起きる？' },
    reviewCode: rustOption('2, 4, 6, 8', 4), reviewPrompt: '4要素のVecでindex 4をgetすると、何が出力される？',
    rebuildPrompt: 'vec![1, 2, 3]のindex 1をgetし、2を出力するmatchを再現。'
  },
  {
    id: 'rust-result', number: '06', language: 'Rust', tag: 'RESULT / エラー処理', title: '軌道の条件を守る',
    short: 'Resultとmatchで、失敗を値として扱う。',
    goal: '半径が正ならOk、そうでなければErr。宇宙をつくる前に入力を検査しよう。',
    editGuide: '編集できる範囲：条件の > / >= と、main内radiusの値（-2〜9）。関数とmatchの形は保ってください。',
    patch: 'ResultはOkかErrの値。Errはそれ自体ではpanicしない。',
    explanation: 'radiusの条件がtrueならOk(radius)、falseならErr("invalid")。matchで対応する腕を実行する。',
    comparison: 'Javaの例外は通常の戻り値とは別の制御経路。RustのResultは型で表される戻り値であり、一対一の対応ではない。',
    structure: { input: '半径radius', decision: 'radiusは0より大きいか', process: 'Ok / Errを構築しmatch', output: '半径、またはinvalid', role: 'make_orbitは入力を検査しResultを返す。', invariant: 'どちらのResultもmatchで明示的に扱う。', boundary: '条件 > 0 では0もErr。>= 0では0はOk。' },
    sources: { example: rustResult(3, '>'), experiment: rustResult(-1, '>'), recall: '', transfer: rustResult(0, '>') },
    stagePrompts: { example: '半径3のResultを予測し、出力とモデルを確認。', experiment: '負の半径では何を出力？ 正の値へ修正しよう。', recall: '正の半径3にOkを返し、3を出力するプログラムを再現。', transfer: '境界の0を試す。>と>=でResultがどう変わるか比較。' },
    reviewCode: rustResult(0, '>'), reviewPrompt: '半径0のとき、matchが出力する文字列は？',
    rebuildPrompt: '条件 > 0、半径3のmake_orbitとmatchを再現し、3を出力。'
  },
];
export const LESSONS = lessons;
export function getLesson(id: LessonId): Lesson {
  const lesson = lessons.find((item) => item.id === id);
  if (!lesson) throw new Error(`Unknown lesson: ${id}`);
  return lesson;
}
export const STAGES: { id: Stage; label: string; number: string }[] = [
  { id: 'example', label: '完成例と追跡', number: '01' },
  { id: 'fill', label: '穴埋め', number: '02' },
  { id: 'reorder', label: '並べ替え', number: '03' },
  { id: 'experiment', label: '実験と修正', number: '04' },
  { id: 'partial', label: '部分生成', number: '05' },
  { id: 'recall', label: '自力で再現', number: '06' },
  { id: 'transfer', label: '類題に挑戦', number: '07' },
];
