import type { Lang } from "./types";

export type StudyTopic = {
  id: string;
  language: Lang;
  title: string;
  description: string;
  pattern: RegExp;
};
export const studyTopicGroups: StudyTopic[] = [
  {
    id: "java-basics",
    language: "java",
    title: "入門・変数・分岐・反復",
    description: "一行の表示から、式と制御の流れへ。",
    pattern:
      /^(program|print|order|semicolon|int|double|cast|variable|assignment|copy|update|division|parentheses|precedence|comparison|and|or|not|short-circuit|if|else|condition|switch|case|fallthrough|for|while|do-while|loop|remainder|accumulator|primitive)/,
  },
  {
    id: "java-references",
    language: "java",
    title: "参照型・配列・String",
    description: "値のコピー、同じ参照先、文字列の比較を確かめる。",
    pattern:
      /^(reference|value-vs-reference|object-alias|array|enhanced-for|string|null|final-reference|substring|scanner|char)/,
  },
  {
    id: "java-objects",
    language: "java",
    title: "クラス・継承・ジェネリクス",
    description: "インスタンス、メソッド、型の関係を学ぶ。",
    pattern:
      /^(class|instance|field|method|constructor|this|private|accessor|validated|static|same-class|object-return|inherit|override|dynamic|super|declared|abstract|interface|multiple|generic|wildcard|record|sealed|enum|scope|block|return)/,
  },
  {
    id: "java-collections",
    language: "java",
    title: "List・Set・Map・コレクション",
    description: "要素の追加、重複、順序、反復とビュー。",
    pattern:
      /^(array-list|list($|-)|map($|-(put|contains|default|entry))|set($|-)|iterator|sublist|linked-hash|tree-|collections|collection-|hash-|queue|deque|priority)/,
  },
  {
    id: "java-streams",
    language: "java",
    title: "Stream API・ラムダ",
    description: "filter、map、collect、遅延評価と終端操作。",
    pattern:
      /^(stream|parallel-stream|collector|map-to-int|lambda|methodref|method-reference|functional|predicate|consumer|supplier|function($|-)|optional)/,
  },
  {
    id: "java-errors",
    language: "java",
    title: "例外・リソース・ファイル",
    description: "例外の経路、クローズ、文字とバイトの入出力。",
    pattern:
      /^(exception|checked|unchecked|throw|try|catch|finally|resource|file|path|buffer|byte-|reader|writer|io-|encoding)/,
  },
  {
    id: "java-concurrency",
    language: "java",
    title: "並行処理・スレッド",
    description: "共有状態、同期、タスクと実行順序。",
    pattern:
      /^(thread|synchronized|volatile|atomic|executor|future|concurrent|lock|race|parallel-stream|deadlock)/,
  },
  {
    id: "java-http-db",
    language: "java",
    title: "HTTP・API・DB・SQL",
    description: "入力の検証からHTTP応答、データの保存へ。",
    pattern:
      /^(http|api|jdbc|sql|database|db-|repository|transaction|json|request|response|optimistic|backend|prepared)/,
  },
  {
    id: "rust-basics",
    language: "rust",
    title: "入門・束縛・分岐・反復",
    description: "表示、型、式、関数と制御の流れ。",
    pattern:
      /^(output|let|mut($|-)|format|type|overflow|bool|expression|function|if|loop|tuple|array|shadow|binding|control|pattern)/,
  },
  {
    id: "rust-ownership",
    language: "rust",
    title: "所有権・借用・ライフタイム",
    description: "move、Copy、共有参照と可変参照を区別する。",
    pattern:
      /^(ownership|move|copy|clone|borrow|reference|mut-borrow|scope|drop|lifetime|string-vs-str|slice)/,
  },
  {
    id: "rust-collections",
    language: "rust",
    title: "Vec・HashMap・文字列",
    description: "添字の境界、要素の変更、UTF-8とコレクション。",
    pattern: /^(vec|hashmap|btree|collections|boundary|string($|-)|utf8)/,
  },
  {
    id: "rust-iterators",
    language: "rust",
    title: "イテレータ・クロージャ",
    description: "iter、into_iter、map、collectと環境の捕捉。",
    pattern: /^(iterator|closure|lazy|collect)/,
  },
  {
    id: "rust-types",
    language: "rust",
    title: "struct・enum・trait・ジェネリクス",
    description: "データの形、match、型の契約とメソッド。",
    pattern:
      /^(struct|impl|enum|match|trait|generic|derive|module|visibility|cargo)/,
  },
  {
    id: "rust-errors",
    language: "rust",
    title: "Option・Result・エラー処理",
    description: "値がない場合と失敗、?演算子、panicの境界。",
    pattern:
      /^(option|result|unwrap|error|custom-error|panic|testing|debugging|file-cli)/,
  },
  {
    id: "rust-concurrency",
    language: "rust",
    title: "スマートポインタ・並行処理・async",
    description: "Box、Rc、Arc、Mutex、スレッドとFuture。",
    pattern:
      /^(box|rc|refcell|arc|mutex|rwlock|thread|join|channel|atomic|future|async|smart-pointers|send-sync|ref($|-))/,
  },
  {
    id: "rust-http-db",
    language: "rust",
    title: "HTTP・JSON・SQLite・Wasm",
    description: "ハンドラ、保存先、安全な境界を実装する。",
    pattern:
      /^(http|sqlite|repository|wasm|pointer|memory|determinism|unsafe|ffi)/,
  },
];

export const findStudyTopic = (id: string | undefined | null) =>
  studyTopicGroups.find((topic) => topic.id === id);
export function inStudyTopic(
  topic: StudyTopic,
  item: { language: Lang; concepts: string[] },
) {
  return (
    item.language === topic.language &&
    item.concepts.some((id) =>
      topic.pattern.test(
        id.replace(/^(java|rust):/, "").replace(/^(arena01-[jr]-|c-|r-)/, ""),
      ),
    )
  );
}
