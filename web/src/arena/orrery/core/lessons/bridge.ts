import type { Challenge, Lesson } from './schema';

type Seed = Omit<Challenge, 'dialect'> & { dialect?: Challenge['dialect'] };
const bc = (c: Seed): Challenge => ({ dialect: c.dialect ?? 'java', ...c });

const comparison: Lesson = {
  id: 'bridge-thinking',
  track: 'bridge',
  kicker: '05 / 比較して誤解をほどく',
  title: 'Java と Rust は、一対一対応させない',
  summary: '似ている構文が違う意味を持つ場所だけを狙って比較する。表面的な対応表ではなく、判断の分岐を理解する。',
  concepts: ['bridge-null', 'bridge-memory', 'java-primitive', 'rust-ownership'],
  minutes: 9,
  challenges: [
    bc({
      id: 'b-cmp-1', kind: 'explain', concept: 'bridge-null',
      prompt: 'まず読む。null と Option は「無い」をどう扱うかの方針が違う。',
      options: ['Rust は「無い」を型で表し、分岐の忘れがコンパイルエラーになる', 'Java も null を型で検査する', '両者は同じ仕組み', 'Option は実行時の null の別名'],
      answer: 'Rust は「無い」を型で表し、分岐の忘れがコンパイルエラーになる',
      reading: 'Java の参照型はすべて null を取りうる。Rust の安全なコードには null 参照がなく、「無い」は Option<T>::None として明示される。Java の Optional<T> は便利だが、使わなくてもコンパイルは通る。',
      explanation: '「似ているから同じ」と覚えると転移に失敗する。検出タイミング（実行時かコンパイル時か）で分ける。',
      patch: '比較は構文ではなく「いつ・誰が検査するか」で行う',
    }),
    bc({
      id: 'b-cmp-2', kind: 'read', concept: 'java-primitive',
      prompt: '読解。Java で String の中身を比べる正しい方法は？',
      options: ['equals() を使う', '== を使う', '=== を使う', 'compare() は存在しない'],
      answer: 'equals() を使う',
      reading: 'Java の == は参照型では「同じインスタンスか」を判定する。中身の文字列を比べるには equals()。基本型の == は値そのものを比べるので意味が変わる。',
      explanation: '同じ演算子が、型によって別の問いをしている。ここが primitive / reference の境界。',
      patch: 'Java の == は基本型では値、参照型では同一性',
    }),
    bc({
      id: 'b-cmp-3', kind: 'predict', concept: 'rust-ownership',
      prompt: '予測してから実行。Copy 型 i32 の代入は元の変数を無効にするか？',
      dialect: 'rust',
      code: 'let a = 3;\nlet b = a;\nprintln!("{}", a);',
      solution: 'let a = 3;\nlet b = a;\nprintln!("{}", a);',
      options: ['3 と表示される（Copy なので元も有効）', 'E0382 になる', 'panic する', '0 と表示される'], answer: '3 と表示される（Copy なので元も有効）',
      expectedOutput: ['3'],
      explanation: 'i32 は Copy。String なら move になって E0382。型を見ないと判断できない。',
      patch: 'move か Copy かは値ではなく型で決まる',
    }),
    bc({
      id: 'b-cmp-4', kind: 'predict', concept: 'java-polymorphism',
      prompt: '予測してから実行。Java で変数の宣言型より実体型が優先されるのはどんな呼び出し？',
      code: 'class Body { String kind() { return "body"; } }\nclass Planet extends Body { String kind() { return "planet"; } }\nBody b = new Planet();\nprintln(b.kind());',
      solution: 'class Body { String kind() { return "body"; } }\nclass Planet extends Body { String kind() { return "planet"; } }\nBody b = new Planet();\nprintln(b.kind());',
      options: ['instance method の呼び出し', 'static method の呼び出し', 'field の参照', '配列の length'], answer: 'instance method の呼び出し',
      expectedOutput: ['planet'],
      explanation: 'instance method だけが動的ディスパッチされる。static method と field は宣言型で決まる（hiding）。',
      patch: '多態するのは instance method だけ',
    }),
    bc({
      id: 'b-cmp-7', kind: 'build', concept: 'sim-model',
      prompt: '自力で書く。Java で読んだ「初期化 → 生成 → 観測」を、Rust 側の API 名で同じ構造として書き直す。',
      dialect: 'rust',
      starter: '',
      solution: 'clear();\nstar(0, 0, 2600);\nmake_orbit(0, 0, 100, 6, 0.6);\nprintln!("{}", body_count());',
      expectedOutput: ['7'], expectedBodies: 7,
      explanation: '関数名は snake_case でも、操作している WorldState は同じ。構文の違いと構造の同一性を分けて考える。',
      patch: '言語が違っても「入力 → 判断 → 処理 → 結果」の構造は共有できる',
      hints: ['Rust 側の別名: make_orbit / body_count。'],
    }),
    bc({
      id: 'b-cmp-5', kind: 'transfer', concept: 'bridge-memory',
      prompt: '初見類題。この宇宙シミュレーションの科学的な位置づけとして正しいものは？',
      options: [
        '教育用の簡略重力モデルで、実観測でも一般相対論シミュレーションでもない',
        'NASA の実観測データをそのまま表示している',
        '一般相対論を完全に解いている',
        'WASM が物理法則を生成している',
      ],
      answer: '教育用の簡略重力モデルで、実観測でも一般相対論シミュレーションでもない',
      reading: 'この宇宙はソフトニング付き中心引力による決定的な教育用モデル。渦巻銀河や降着円盤は可視化であり、観測データではない。WASM は計算を高速化するだけで、物理法則を作っているわけではない。',
      explanation: '科学モデル・教育用簡略モデル・可視化・アートを区別して表示することは、教材の誠実性の一部。',
      patch: '見た目がリアルでも、モデルの仮定を必ず明示する',
    }),
    bc({
      id: 'b-cmp-6', kind: 'retrieve', concept: 'sim-model',
      prompt: '思い出す。答えを見ずに「WASM と TypeScript 参照実装の数値が完全一致しない理由」を 1 行で書いてから確かめる。',
      dialect: 'rust',
      starter: '',
      solution: 'clear();\nstar(0, 0, 2600);\nplanet(100, 0, 4);\nprintln!("{}", body_count());',
      expectedOutput: ['2'], expectedBodies: 2,
      explanation: 'WASM/Rust は f32、TypeScript 参照実装は f64。同じアルゴリズムでも丸めが違うため微小な差が出る。テストは許容誤差で一致を検証している。',
      patch: 'f32 と f64 は同じ式でも最後の桁が違う',
    }),
  ],
};

export const BRIDGE_LESSONS: Lesson[] = [comparison];
