/**
 * Concept Galaxy data. The point is RELATIONSHIP UNDERSTANDING, not decoration:
 * every edge has a labelled relation and a note explaining the (often
 * non-obvious) difference. Java and Rust concepts are deliberately NOT mapped
 * one-to-one; misleading edges are called out with `warning`.
 */
export interface Concept {
  id: string;
  label: string;
  language: 'java' | 'rust' | 'both';
  group: string;
  summary: string;
  /** 入力 → 判断 → 処理 → 結果 */
  input: string;
  decision: string;
  process: string;
  result: string;
  role: string;
  invariant: string;
  boundary: string;
  misconception?: string;
  x: number; // 0..1 layout hint
  y: number;
}

export interface ConceptEdge {
  from: string;
  to: string;
  relation: string;
  note: string;
  warning?: boolean;
}

export const CONCEPTS: Concept[] = [
  {
    id: 'java-primitive', label: 'primitive / 参照', language: 'java', group: 'Java 基礎',
    summary: 'int などの基本型は値そのもの、クラス型はオブジェクトへの参照を保持する。',
    input: '宣言と代入', decision: '型が基本型か参照型か', process: '値をコピーするか参照をコピーするか', result: '== の意味が変わる',
    role: 'メモリ上の「何を持っているか」を決める', invariant: '基本型は演算で新しい値になる', boundary: 'String は参照型。== は中身ではなく同一性',
    misconception: 'String の == で中身を比べられると思う', x: 0.10, y: 0.18,
  },
  {
    id: 'java-division', label: 'int / int', language: 'java', group: 'Java 基礎',
    summary: '整数同士の除算は小数点以下を切り捨てる。片方が double なら浮動小数点除算。',
    input: '7 / 2', decision: '両オペランドが整数型か', process: '整数除算 or 浮動小数除算', result: '3 または 3.5',
    role: '数値の精度を決める最初の分岐', invariant: '代入先の型は演算結果の型を変えない', boundary: 'double d = 7/2; は 3.0 になる（ widening は後）',
    misconception: '代入先が double なら 7/2 は 3.5 になる', x: 0.22, y: 0.10,
  },
  {
    id: 'java-array', label: '配列 .length', language: 'java', group: 'Java 基礎',
    summary: 'length は最大インデックスではなく要素数。最後の要素は a[a.length - 1]。',
    input: '配列 a', decision: 'アクセスしたい位置', process: '0..length-1 の範囲で添字を計算', result: '要素または ArrayIndexOutOfBoundsException',
    role: '境界を明示する不変条件', invariant: '有効な添字は常に 0 <= i < a.length', boundary: 'a.length は読み取り専用で () は要らない',
    misconception: 'a[a.length] が最後の要素だと思う', x: 0.34, y: 0.16,
  },
  {
    id: 'java-class', label: 'class / object', language: 'java', group: 'Java OOP',
    summary: 'class は設計図、object は実体。フィールドが状態、メソッドが振る舞い。',
    input: 'new Planet(...)', decision: 'どのコンストラクタを呼ぶか', process: '領域確保 → フィールド初期化 → コンストラクタ', result: 'ヒープ上のインスタンスへの参照',
    role: '状態と振る舞いをまとめる最小単位', invariant: 'インスタンスごとに独立したフィールドを持つ', boundary: 'static はインスタンスではなくクラスに属する',
    x: 0.46, y: 0.12,
  },
  {
    id: 'java-inheritance', label: '継承 / interface', language: 'java', group: 'Java OOP',
    summary: 'is-a 関係を作る。interface は能力の契約、abstract は共通実装＋未実装の穴。',
    input: 'class Planet extends CelestialBody', decision: '共通の性質か能力か', process: 'スーパークラスの状態とメソッドを引き継ぐ', result: '型としての互換性',
    role: '分類と契約の階層', invariant: 'サブクラスはスーパークラス型として扱える', boundary: 'Java のクラス継承は単一。interface は複数実装可',
    x: 0.58, y: 0.18,
  },
  {
    id: 'java-polymorphism', label: 'override / 動的ディスパッチ', language: 'java', group: 'Java OOP',
    summary: '呼ばれる instance method は変数の宣言型ではなく、実体のクラスで決まる。',
    input: 'Body b = new Planet(); b.describe()', decision: '実行時の実体クラス', process: 'メソッド表を実体側から探索', result: 'Planet.describe() が実行される',
    role: '同じ呼び出しで違う振る舞いを実現', invariant: 'シグネチャが一致するときだけ override', boundary: 'static method / field は隠蔽（hiding）で、多態しない',
    misconception: '変数の型 Side のメソッドが呼ばれると思う', x: 0.70, y: 0.11,
  },
  {
    id: 'java-collections', label: 'List / Map / 泛型', language: 'java', group: 'Java 実務',
    summary: '可変長のコレクションと型パラメータ。Stream は「パイプライン」であって「ループの糖衣」ではない。',
    input: 'List<Planet>', decision: '要素の型と順序の有無', process: '追加・検索・変換を宣言的に合成', result: 'コレクションまたは集約値',
    role: 'データのまとまりを型安全に扱う', invariant: 'generics はコンパイル時の型制約（型消去）', boundary: 'この教材ランタイムは Stream/lambda を実行しない。等価な for で構造を追う',
    x: 0.82, y: 0.19,
  },
  {
    id: 'java-exception', label: '例外 / 境界', language: 'java', group: 'Java 実務',
    summary: '不正な入力や範囲外アクセスは例外として処理を中断し、呼び出し側へ伝わる。',
    input: 'a[a.length] や 1/0', decision: '処理を続けられるか', process: '例外オブジェクトを生成してスタックを巻き戻す', result: 'catch が捕まえるか、プログラムが終了',
    role: '「正常系」と「異常系」の境界を明示する', invariant: '例外が投げられた行以降は実行されない', boundary: 'この教材ランタイムは try/catch 構文を実行しない。エラー表示で境界を学ぶ',
    x: 0.88, y: 0.34,
  },
  {
    id: 'rust-ownership', label: '所有権 / move', language: 'rust', group: 'Rust 所有権',
    summary: '値にはただ一つの所有者。所有権が移ると元の変数は使えなくなる（原則）。',
    input: 'let t = s;', decision: '型が Copy かどうか', process: 'Copy ならビットコピー、非 Copy なら所有権を移動', result: 's は未初期化として扱われる',
    role: '解放タイミングをコンパイル時に決定する', invariant: '同じ値に二人の所有者はいない', boundary: 'i32 など Copy 型は move ではなくコピー',
    misconception: 'Java の参照代入と同じだと思う', x: 0.14, y: 0.52,
  },
  {
    id: 'rust-borrow', label: '借用 / &mut', language: 'rust', group: 'Rust 所有権',
    summary: '参照は所有権を移さずに値を読む／書く。可変参照は同時に一つだけ。',
    input: '&x / &mut x', decision: '読み取りか書き換えか', process: '借用チェッカーが生存区間を検査', result: 'コンパイル可能 or E0499/E0502',
    role: '所有権を動かさずにアクセスを共有する', invariant: '可変借用中は元の値に直接アクセスできない', boundary: 'この教材の借用チェックは教育用サブセット（rustc の完全版ではない）',
    x: 0.27, y: 0.62,
  },
  {
    id: 'rust-lifetime', label: 'ライフタイム（導入）', language: 'rust', group: 'Rust 所有権',
    summary: '参照が有効な期間。戻り値の参照がどの入力に紐づくかを明示する。',
    input: "fn longest<'a>(a: &'a str, b: &'a str) -> &'a str", decision: '参照がどの値を指すか', process: 'コンパイラが生存区間の包含関係を検査', result: 'ダングリング参照がコンパイル時に排除される',
    role: '参照の有効期限を型で表現する', invariant: '参照は参照先より長く生きられない', boundary: 'この教材ランタイムはライフタイムを検査しない。読解と予測で扱う',
    x: 0.40, y: 0.70,
  },
  {
    id: 'rust-option', label: 'Option / Result', language: 'rust', group: 'Rust 型',
    summary: '「値があるかもしれない」「失敗するかもしれない」を型で表し、忘れをコンパイルエラーにする。',
    input: 'find(...) -> Option<Planet>', decision: 'Some / None, Ok / Err', process: 'match や ? で分岐', result: '全ケースを扱った値',
    role: 'null と例外の代替を型に载せる', invariant: 'unwrap() は None/Err で panic する', boundary: 'Java の Optional / 例外と目的は近いが、コンパイル時の強制力が違う',
    x: 0.54, y: 0.58,
  },
  {
    id: 'rust-enum-match', label: 'enum / match', language: 'rust', group: 'Rust 型',
    summary: 'enum は「どれか一つ」の値。match は全パターンの網羅をコンパイラが検査する。',
    input: 'enum Body { Star, Planet }', decision: 'どのバリアントか', process: 'パターンで分解して値を取り出す', result: '網羅された分岐の値',
    role: '状態をデータとして表現する', invariant: '網羅されていない match はコンパイルできない', boundary: 'Java の enum も便利だが、データを保持する直和型としての表現力は違う',
    x: 0.68, y: 0.66,
  },
  {
    id: 'rust-vec-iter', label: 'Vec / iterator', language: 'rust', group: 'Rust コレクション',
    summary: 'Vec は連続した可変長配列。iterator は「次の値をどう作るか」を表す遅延的な列。',
    input: 'vec![1,2,3].iter().map(...)', decision: '消費するか借用するか', process: 'into_iter / iter / iter_mut を選ぶ', result: '変換された列またはコレクション',
    role: 'データ変換を合成可能にする', invariant: 'iterator は消費されると再利用できない', boundary: 'この教材ランタイムは vec! と for..in を実行する。map/filter は for に展開して読む',
    x: 0.81, y: 0.56,
  },
  {
    id: 'bridge-null', label: 'null と Option', language: 'both', group: '比較',
    summary: 'Java の null はどの参照型にも入りうる。Rust は Option で「無い」を明示的に型に载せる。',
    input: 'String s = null / let s: Option<String> = None', decision: '「無い」を型で強制するか', process: '実行時チェック or コンパイル時チェック', result: 'NullPointerException or 網羅的な match',
    role: '失敗モードをいつ検出するかの違い', invariant: 'Rust の安全なコードに null 参照は存在しない', boundary: 'Optional<T> は Java では「使わないと忘れられる」。Rust の Option は忘れるとコンパイルできない',
    x: 0.30, y: 0.86,
  },
  {
    id: 'bridge-memory', label: 'GC と所有権', language: 'both', group: '比較',
    summary: 'Java は GC が到達不能なオブジェクトを回収する。Rust はスコープを抜けた時点で確定的に解放する。',
    input: 'new Planet() / let p = Planet{}', decision: '誰がいつ解放するか', process: '実行時の追跡 or コンパイル時の所有権解析', result: '同じ安全性を違うタイミングで達成',
    role: 'メモリ安全の実現方式の違い', invariant: 'どちらも安全なコードでダングリング参照を作らない', boundary: '「Rust の方が速い」は言い切れない。GC の停止時間と予測可能性のトレードオフ',
    x: 0.48, y: 0.88,
  },
  {
    id: 'sim-model', label: '宇宙モデル / 境界', language: 'both', group: 'Simulation',
    summary: 'この宇宙は教育用の簡略重力モデル。実観測でも一般相対論シミュレーションでもない。',
    input: '質量・位置・速度', decision: 'どの天体を引力源とするか', process: 'ソフトニング付き中心引力で 1 ステップ積分', result: '決定的に再現可能な軌跡',
    role: 'コード変更を可視化する教材', invariant: '同じ seed と同じステップ数なら同じ結果', boundary: 'WASM は f32、TS 参照実装は f64。微小な差は許容',
    x: 0.70, y: 0.86,
  },
];

export const EDGES: ConceptEdge[] = [
  { from: 'java-primitive', to: 'java-division', relation: '型が演算を決める', note: '両オペランドが整数型のときだけ整数除算になる。' },
  { from: 'java-array', to: 'java-exception', relation: '境界違反が例外に', note: 'a[a.length] は ArrayIndexOutOfBoundsException。' },
  { from: 'java-class', to: 'java-inheritance', relation: '分類を階層化', note: '共通状態をスーパークラスへ引き上げる。' },
  { from: 'java-inheritance', to: 'java-polymorphism', relation: 'override の前提', note: '継承があるから実体側のメソッドが選ばれる。' },
  { from: 'java-polymorphism', to: 'rust-enum-match', relation: '似て非なる分岐', note: 'Java は実体のメソッド表、Rust は値のバリアントで分岐する。', warning: true },
  { from: 'java-collections', to: 'rust-vec-iter', relation: 'どちらも列を扱う', note: 'Java Stream と Rust Iterator は遅延性が似るが、所有権の扱いが違う。', warning: true },
  { from: 'rust-ownership', to: 'rust-borrow', relation: '所有権を移さないアクセス', note: '借用は所有権の代替手段。' },
  { from: 'rust-borrow', to: 'rust-lifetime', relation: '借用の有効期間', note: 'ライフタイムは借用が「いつまで」かを表す。' },
  { from: 'rust-option', to: 'rust-enum-match', relation: 'Option は enum', note: 'Some/None は enum のバリアント。' },
  { from: 'rust-option', to: 'java-exception', relation: '失敗の表し方', note: 'Result は失敗を値にし、例外は制御フローを飛ばす。', warning: true },
  { from: 'bridge-null', to: 'rust-option', relation: '「無い」の表現', note: 'null を型で包むと忘れがコンパイルエラーになる。' },
  { from: 'bridge-null', to: 'java-primitive', relation: '参照型にだけ null', note: '基本型には null を入れられない。' },
  { from: 'bridge-memory', to: 'rust-ownership', relation: '解放の責任', note: 'GC か所有権かで「いつ解放されるか」が決まる。' },
  { from: 'bridge-memory', to: 'java-class', relation: '実体の寿命', note: 'Java のオブジェクト寿命は参照グラフで決まる。' },
  { from: 'sim-model', to: 'rust-vec-iter', relation: '座標列を生成', note: 'WASM/hash で決定的に星群を生成する。' },
  { from: 'sim-model', to: 'java-array', relation: '天体配列', note: '配列の各要素が天体の状態に対応する。' },
];

export function getConcept(id: string): Concept | undefined {
  return CONCEPTS.find((c) => c.id === id);
}

export function relatedConcepts(id: string): Array<{ edge: ConceptEdge; concept: Concept }> {
  return EDGES.filter((e) => e.from === id || e.to === id)
    .map((edge) => ({ edge, concept: getConcept(edge.from === id ? edge.to : edge.from)! }))
    .filter((x) => Boolean(x.concept));
}
