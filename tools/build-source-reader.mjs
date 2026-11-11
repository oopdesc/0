import { readFileSync, writeFileSync, lstatSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
// Only these public learning files are embedded. No directory discovery or user input is used.
const entries = [
  {
    id: "java-practice",
    language: "java",
    title: "入力を受け取り、Javaで処理する",
    path: "frontend/java/src/main/java/cosmic/browser/PracticeEngine.java",
    description:
      "実際にブラウザ向けへ変換しているJavaです。入力の検証、分岐、配列のコピーを順に追えます。",
    practice: "/learn?section=legacy-practice&mode=basics",
    cues: [
      [
        "public static String run(",
        "入口と分岐",
        "空の入力や長すぎる入力を先に検査し、演習名で処理を選びます。",
      ],
      [
        "private static String copy(",
        "配列をコピーする",
        "Arrays.copyOfを省くと、元の配列も並べ替わる理由を考えてみましょう。",
      ],
      [
        "static int parseInteger(",
        "文字から整数へ",
        "全角数字や符号を処理し、Integer.parseIntへ渡すまでを追います。",
      ],
    ],
  },
  {
    id: "java-service",
    language: "java",
    title: "Javaで入力と業務判断を分ける",
    path: "projects/java/book-api-http/src/learning/books/http/BookService.java",
    description:
      "小プロジェクトの実装です。入力の形式と、保存先にデータがあるかを別の結果で返します。",
    practice: "/learn?section=projects&lang=java",
    cues: [
      [
        "public GetResult get(",
        "本を取得する",
        "不正なIDと、存在しないIDがどこで分かれるかを確認します。",
      ],
      [
        "public UpdateResult rename(",
        "版を確かめて更新する",
        "古い版を渡した場合に、更新が競合として返る経路を追います。",
      ],
    ],
  },
  {
    id: "java-db",
    language: "java",
    title: "JavaとSQLiteをつなぐ",
    path: "projects/java/book-api-http/src/learning/books/http/JdbcBookRepository.java",
    description:
      "JDBCで値を束縛する実装です。接続・SQL・結果の読み取りに注目してください。",
    practice: "/learn?section=projects&lang=java",
    cues: [
      [
        "public Optional<Book> findById(",
        "1行をJavaの値へ",
        "プレースホルダーへIDを設定し、行があるかを確かめます。",
      ],
      [
        "public boolean updateTitle(",
        "更新件数で判定する",
        "IDと版の両方が一致した場合だけ更新する条件を読みます。",
      ],
    ],
  },
  {
    id: "rust-galaxy",
    language: "rust",
    title: "星の座標をRustで生成する",
    path: "backend/rust/cosmic-core/src/lib.rs",
    description:
      "銀河模型のWasmで使う実装です。同じ種から同じ座標を作り、ネイティブのテストでも確かめます。",
    practice: "/learn?section=orbit",
    cues: [
      [
        "pub fn galaxy(",
        "種から座標へ",
        "countの上限、乱数の状態、Vecへ4値ずつ追加する順番を追います。",
      ],
      [
        "pub fn requested_count(",
        "Resultで入力を扱う",
        "数値に変換できない場合と、上限を超えた場合を分けます。",
      ],
      [
        "fn same_seed_is_reproducible(",
        "再現性をテストする",
        "同じ入力に対して何を比較すればよいかを確認します。",
      ],
    ],
  },
  {
    id: "rust-service",
    language: "rust",
    title: "Rustで成功と失敗を表す",
    path: "projects/rust/book-api-http/src/service.rs",
    description:
      "JavaのBookServiceと同じ役割を持つ実装です。enum、Option、借用が判断をどう表すかを比べられます。",
    practice: "/learn?section=projects&lang=rust",
    cues: [
      [
        "pub fn parse_id(",
        "OptionでIDを検証する",
        "受け入れる文字と数値の範囲を読み、Noneになる入力を考えます。",
      ],
      [
        "pub fn get(",
        "結果を分岐する",
        "データがない場合と、保存先の障害を区別する箇所を探します。",
      ],
      [
        "pub fn rename(",
        "更新の条件をそろえる",
        "タイトル・版・IDを検査してから保存する順番を追います。",
      ],
    ],
  },
  {
    id: "rust-db",
    language: "rust",
    title: "RustとSQLiteをつなぐ",
    path: "projects/rust/book-api-http/src/repository.rs",
    description:
      "メモリとSQLiteの保存先を同じtraitで扱います。永続化、値の束縛、更新競合を見比べられます。",
    practice: "/learn?section=projects&lang=rust",
    cues: [
      [
        "pub trait BookRepository",
        "保存先との契約",
        "呼び出す側が保存方法を知らずに使える理由を考えます。",
      ],
      [
        "impl BookRepository for SqliteBookRepository",
        "SQLiteの実装",
        "SQLの値の束縛と、エラーを返す流れを追います。",
      ],
    ],
  },
];
const files = entries.map((entry) => {
  const segments = entry.path.split("/");
  if (segments.some((segment) => segment.startsWith("[") || segment === ".."))
    throw Error("Source path refused");
  for (let end = 1; end <= segments.length; end++)
    if (lstatSync(path.join(root, ...segments.slice(0, end))).isSymbolicLink())
      throw Error("Linked source refused");
  const content = readFileSync(path.join(root, entry.path), "utf8");
  if (Buffer.byteLength(content) > 80000)
    throw Error("Source file exceeds reader budget");
  const lines = content.split("\n");
  const cues = entry.cues.map(([anchor, title, explanation]) => {
    const start = lines.findIndex((line) => line.includes(anchor));
    if (start < 0)
      throw Error(`Reading cue no longer matches ${entry.path}: ${anchor}`);
    return { line: start + 1, title, explanation };
  });
  return {
    ...entry,
    content,
    cues,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
});
writeFileSync(
  path.join(root, "web/src/generated/site-sources.json"),
  JSON.stringify(files) + "\n",
);
console.log(
  `Embedded ${files.length} Java/Rust learning source files from the explicit public list.`,
);
