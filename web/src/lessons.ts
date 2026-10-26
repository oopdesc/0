export type Track = "Java" | "Rust" | "TypeScript";
export type Lesson = {
  id: string;
  track: Track;
  title: string;
  minutes: number;
  question: string;
  answer: string;
  exercise: string;
  file: string;
  code: string;
};
export const lessons: Lesson[] = [
  {
    id: "java-browser",
    track: "Java",
    title: "Javaをブラウザで実行する",
    minutes: 20,
    question: "ブラウザで動いているJavaの処理は、サーバーのJVMへ送られている？",
    answer:
      "この演習はTeaVMでJavaからJavaScriptへ事前変換しています。実行はブラウザ内で完結し、入力をサーバーへ送りません。JVMで動くHTTP APIとは別の実行環境です。",
    exercise:
      "PracticeEngine.clampの上限を100から10へ変更し、Javaブラウザを再ビルドして、11の結果を確かめてください。",
    file: "frontend/java/src/main/java/cosmic/browser/PracticeEngine.java",
    code: "// 十進数字を半角へ揃え、Integer.parseIntで変換する。\nint value = parseInteger(input);\nint result = Math.max(0, Math.min(100, value));",
  },
  {
    id: "java-copy",
    track: "Java",
    title: "コピーと参照を区別する",
    minutes: 20,
    question: "sorted = originalと、Arrays.copyOfは何が違う？",
    answer:
      "代入は同じ配列への参照を渡します。copyOfは新しい配列を作ります。新しいint配列の要素は値なので、片方を並べ替えても元の配列は変わりません。オブジェクト配列では要素の参照まで複製する深いコピーとは区別します。",
    exercise:
      "上のブラウザ演習で3,1,2を試します。次にEclipseでcopyOfを参照の代入へ変え、元の配列がどう変わるか確認してから戻してください。",
    file: "frontend/java/src/main/java/cosmic/browser/PracticeEngine.java",
    code: "int[] sorted = Arrays.copyOf(original, original.length);\nArrays.sort(sorted);",
  },
  {
    id: "java-json",
    track: "Java",
    title: "文字列をJSONへ書き出す",
    minutes: 20,
    question: "入力を二重引用符で囲むだけで、正しいJSONになる？",
    answer:
      "入力に引用符・バックスラッシュ・制御文字が含まれる場合はエスケープが必要です。この演習では境界を理解するため小さな実装を使っています。実務では用途に合うJSONライブラリを使い、独自実装の範囲を広げすぎないようにします。",
    exercise:
      "引用符と改行を含む入力を試し、結果の文字列とJSONの表現を区別して説明してください。",
    file: "frontend/java/src/main/java/cosmic/browser/PracticeEngine.java",
    code: "// 文字列の値と、データ形式としての表現を分ける。\nString jsonValue = quote(input);",
  },
  {
    id: "java-debug",
    track: "Java",
    title: "ブレークポイントで値を追う",
    minutes: 25,
    question: "エラーが出なければ、想定した分岐を通ったと言える？",
    answer:
      "出力が同じでも処理の経路が違う場合があります。入力を絞り、ブレークポイントで止め、変数を見て1行ずつ進めると、どこで予想とずれたかを確かめられます。",
    exercise:
      "GalleryRulesTestをEclipseのDebugで起動し、finiteClampの行へブレークポイントを置きます。NaN入力と通常入力の分岐を比べてください。ブラウザ用に変換したコードのデバッグは別の入口です。",
    file: "frontend/java/src/main/java/cosmic/browser/GalleryRules.java",
    code: "if (!Double.isFinite(value)) return fallback;\nreturn Math.max(min, Math.min(max, value));",
  },
  {
    id: "java-http",
    track: "Java",
    title: "HTTPと入力検証",
    minutes: 15,
    question: "入力が長すぎるとき、なぜ500ではなく400を返す？",
    answer:
      "利用者が修正できる入力の問題と、サーバー内部の失敗を区別するためです。画面だけでなくサーバー側でも境界を検証します。",
    exercise: "qが80文字と81文字のときの結果を、実行する前に予想してください。",
    file: "backend/java/src/cosmic/learning/LearningServer.java",
    code: 'if (query == null || query.length() > 80) {\n    throw new IllegalArgumentException("invalid query");\n}\nreturn LESSONS.stream()\n    .filter(x -> normalized(x.title() + " " + x.language())\n        .contains(normalized(query)))\n    .toList();',
  },
  {
    id: "java-record",
    track: "Java",
    title: "recordと不変データ",
    minutes: 15,
    question: "recordに可変なListを渡したら、中身まで不変になる？",
    answer:
      "なりません。recordのフィールド参照はfinalでも、参照先が可変なら変更できます。この教材はList.ofで外部からの変更も拒否しています。",
    exercise:
      "LearningServerTestで、clearが拒否されても9件が残ることを確認します。",
    file: "backend/java/src/cosmic/learning/LearningServer.java",
    code: 'public record Lesson(\n    String id, String language, String title, int minutes\n) {}\n\npublic static final List<Lesson> LESSONS = List.of(\n    new Lesson("java-http", "Java", "HTTPと入力検証", 15)\n);',
  },
  {
    id: "java-test",
    track: "Java",
    title: "境界値を先に考える",
    minutes: 20,
    question: "成功したテストを1件見れば、正しく直せたと言える？",
    answer:
      "それだけでは十分ではありません。修正前の問題を検出できるか、境界や失敗時の状態も確認します。カバレッジと仕様の正しさは別の観点です。",
    exercise: "空文字・全角ＪＡＶＡ・80文字・81文字の期待結果を紙に書きます。",
    file: "backend/java/test/cosmic/learning/LearningServerTest.java",
    code: 'check(search("").size() == 9);\ncheck(search("ＪＡＶＡ").size() == 3);\ncheck(search("x".repeat(80)).isEmpty());\n// 81文字は、検索を実行する前に拒否する。',
  },
  {
    id: "rust-own",
    track: "Rust",
    title: "Vecの所有者は誰？",
    minutes: 20,
    question: "galaxyが返したVecは、関数を抜けると消えてしまう？",
    answer:
      "返すときに所有権が呼び出し元へ移ります。参照を返すこととは区別します。WasmではRustが元の配列を保持します。この画面は短時間だけviewで読み、sliceでJavaScript側へ複製します。",
    exercise: "galaxy→BUFFER→Float32Arrayの所有と利用を、矢印で描きます。",
    file: "backend/rust/cosmic-core/src/lib.rs",
    code: "pub fn galaxy(count: usize, seed: u32) -> Vec<f32> {\n    let count = count.min(MAX_PARTICLES);\n    let mut out = Vec::with_capacity(count * STRIDE);\n    // 点の座標を、ひとつの連続した配列へ格納する。\n    // ...\n    out\n}",
  },
  {
    id: "rust-wasm",
    track: "Rust",
    title: "Wasmとメモリの境界",
    minutes: 20,
    question: "RustのVecを再生成した後、古いFloat32Arrayを使い続けてよい？",
    answer:
      "Wasm memoryを直接見るviewなら、よくありません。再確保やmemory増加で参照すべき場所が変わります。generate後にpointerとlengthを再取得します。この画面ではさらにsliceで複製し、描画用データをJavaScript側で所有します。",
    exercise:
      "universe3d.tsのrebuildで、再生成後にviewを作り直し、コピーしてからGPUへ渡す順番を追ってください。",
    file: "web/src/art/universe3d.ts",
    code: "wasm.cosmic_generate(options.mode, 22000, options.seed);\nconst data = new Float32Array(\n  wasm.memory.buffer,\n  wasm.galaxy_ptr(),\n  wasm.galaxy_len(),\n).slice();\nsystem.add(points(data, options.mode));",
  },
  {
    id: "rust-test",
    track: "Rust",
    title: "同じseedと再現性",
    minutes: 15,
    question: "乱数を使う描画でも、形を再現して検査できる？",
    answer:
      "同じseedとアルゴリズムを使うと再現できます。この教材では同一入力の一致、異なるseedの差、有限値と範囲、件数の上限を検査します。",
    exercise:
      "宇宙の三次元モデルを開き、渦巻銀河で乱数の種42と43の形を比べます。その後、対応するRustのテストを読みます。",
    file: "backend/rust/cosmic-core/src/lib.rs",
    code: "#[test]\nfn same_seed_is_reproducible() {\n    assert_eq!(galaxy(100, 42), galaxy(100, 42));\n}\n#[test]\nfn large_request_is_clamped() {\n    assert_eq!(galaxy(usize::MAX, 1).len(), MAX_PARTICLES * 4);\n}",
  },
  {
    id: "ts-state",
    track: "TypeScript",
    title: "型と状態遷移",
    minutes: 15,
    question: "localStorageの値に型を付けたら、壊れたJSONも安全になる？",
    answer:
      "なりません。外部の値は実行時にも検証します。教材ではschema、配列の型、既知のID、件数を検査し、壊れていれば初期値を使います。",
    exercise:
      "state.test.tsで、不正JSONと未知のIDが状態へ混ざらないことを確認します。",
    file: "web/src/state.ts",
    code: "const parsed: unknown = JSON.parse(raw);\n// TypeScriptの型は、保存済みデータを検証しない。\n// schemaと値の形を実行時にも確かめる。\nreturn validateSavedState(parsed);",
  },
  {
    id: "ts-ui",
    track: "TypeScript",
    title: "キーボードで使える画面",
    minutes: 15,
    question: "見た目がボタンなら、divにクリックを付けるだけで十分？",
    answer:
      "十分ではありません。buttonを使うと、キーボード操作やroleなどの標準動作が得られます。押下状態、フォーカス表示、ダイアログの閉じ方も確認します。",
    exercise:
      "Tabでお気に入りへ進み、Spaceで切り替え、状態が伝わることを確認します。",
    file: "web/src/App.tsx",
    code: "<button\n  aria-pressed={isFavorite}\n  aria-label={`${title}をお気に入りに追加`}\n  onClick={toggleFavorite}\n>\n  ☆\n</button>",
  },
  {
    id: "ts-budget",
    track: "TypeScript",
    title: "軽さを予算で守る",
    minutes: 15,
    question: "配信ファイルが小さければ、月の転送量も必ず無料枠内？",
    answer:
      "必ずではありません。閲覧回数やキャッシュ、他のプロジェクトの使用量にも依存します。成果物の容量は自動検査し、月次使用量はVercelで別に確認します。",
    exercise:
      "npm run buildの容量レポートと、実際のVercel Usageを区別して説明します。",
    file: "tools/check-release.mjs",
    code: "assert(total <= 30 * 1024 * 1024);\nassert(jsGzip <= 512 * 1024);\n// これは成果物の上限。月間の閲覧回数は制限しない。",
  },
];
