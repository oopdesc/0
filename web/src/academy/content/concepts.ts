import type { Concept } from './types';

/**
 * 概念カタログ。問題はここに載っている概念にのみ紐づく（index.ts が検査する）。
 * prereqs は「先に知っていると理解が早い」順序で、復習の重み付けに使う。
 */
function c(
  id: string,
  lang: 'java' | 'rust',
  name: string,
  family: string,
  prereqs: string[],
  rule: string,
  summary: string,
  contrast?: string,
): Concept {
  return { id, lang, name, family, prereqs, rule, summary, ...(contrast ? { contrast } : {}) };
}

export const CONCEPTS: Concept[] = [
  /* ── Java / core ───────────────────────────── */
  c('j-primitive', 'java', 'プリミティブ型', 'core', [], 'プリミティブは値そのものをコピーする', 'int・long・double・char・boolean など 8 種類。代入も引数渡しも値のコピーで、参照は存在しない。', 'Rust の u8/i32 も Copy。ただしビット幅が型名に固定されている。'),
  c('j-type', 'java', '型と変換', 'core', ['j-primitive'], 'widening は自動、narrowing は明示キャスト', 'int → long → double は安全に広がるので自動。逆は情報が落ちるのでキャストを書かせる。', 'Rust は暗黙変換を一切しない。as で明示する。'),
  c('j-division', 'java', '整数除算', 'core', ['j-primitive'], 'int / int は int。切り捨て', '7 / 2 は 3。小数が必要なら 7.0 / 2 か (double) 7 / 2。', 'Rust も同じ。ただし 7 / 2.0 は型エラー。'),
  c('j-overflow', 'java', '整数オーバーフロー', 'core', ['j-type'], 'int は 32bit を超えると静かに巡回する', 'Integer.MAX_VALUE + 1 は Integer.MIN_VALUE。Java は例外にしない。', 'Rust は debug で panic、release で wrap（ビルド設定で変わる）。'),
  c('j-long', 'java', 'long と int リテラル', 'core', ['j-type'], '整数リテラルの既定は int。long には L を付ける', 'int 同士の掛け算は int で計算してから代入される。1L * n で初めて long 演算。'),
  c('j-double', 'java', '浮動小数点', 'core', ['j-primitive'], '0.1 + 0.2 は 0.3 にならない', '二進小数で表せない値は近似される。比較は誤差の許容幅で。', 'Rust の f64 も同じ IEEE 754。'),
  c('j-equality', 'java', '== と equals', 'core', ['j-reference'], 'プリミティブは ==、参照型の中身は equals', '== は値または同一性。String の中身比較に == を使うと、インターンされない場合に false。'),
  c('j-char', 'java', 'char は数値', 'core', ['j-primitive'], 'char は 16bit の整数値を持つ', "'A' + 1 は char ではなく int の 66。文字列連結では文字として扱われる。"),
  c('j-promotion', 'java', '型昇格', 'core', ['j-type'], 'byte/short/char は演算時に int へ昇格する', '小さい型同士の演算結果は int。byte b = b + 1 が通らないのはこのため。'),
  c('j-increment', 'java', '前置と後置の ++', 'core', ['j-primitive'], '前置は増やしてから返す、後置は返してから増やす', 'i = 1; a = i++ → a=1, i=2。a = ++i → a=2, i=2。'),
  c('j-order-of-operations', 'java', '評価順と優先順位', 'core', ['j-primitive'], '優先順位は演算子の結び付き、評価順は左から', '&& と || は短絡する。メソッド呼び出しの引数は左から評価される。'),
  c('j-compound-assignment', 'java', '複合代入', 'core', ['j-type'], 'a += b は a = (T)(a + b) と同じ', '暗黙のキャストが入るので、byte でもコンパイルできる。i = i + b とは挙動が違う。', 'Rust の += は型を変えない。'),
  c('j-array', 'java', '配列', 'core', ['j-primitive'], '配列の length はフィールド。添字は 0 始まり', 'int[] a = new int[3] の有効な添字は 0..2。length はサイズであって最後の添字ではない。', 'Rust の配列は [T; N]、Vec は可変長。どちらも len()。'),
  c('j-boundary', 'java', '境界値', 'core', ['j-array'], '有効範囲は 0 以上 length 未満', '境界は「以下」ではなく「未満」。<= と < の取り違えが最頻出のバグ。'),
  c('j-string', 'java', 'String の不変性', 'core', ['j-equality'], 'String は不変。+= は新しい文字列を作る', '中身の比較は equals。ループ内の += は都度新しいオブジェクトを作るので StringBuilder。', 'Rust の String も可変だが、&str との区別がある。'),
  c('j-immutability', 'java', '不変オブジェクト', 'core', ['j-string'], '不変な型は、変更したように見える操作でも別オブジェクトを返す', 'String、record、List.of など。共有しても安全だが、変更には作り直しが必要。'),
  c('j-loop', 'java', 'ループ', 'core', ['j-boundary'], 'for (int i = 0; i < n; i++) は 0..n-1 を回る', '開始値・継続条件・更新を 1 行で読む。n 回回したいなら i < n。i <= n にすると n+1 回。', 'Rust は for x in 0..n。境界の書き方が違う。'),
  c('j-switch', 'java', 'switch の分岐', 'core', ['j-order-of-operations'], 'break を忘れると次の case へ落ちる（フォールスルー）', 'Java 14 以降は -> 形式でフォールスルーしない。式として値を返せる。'),
  c('j-short-circuit', 'java', '短絡評価', 'core', ['j-order-of-operations'], 'false && x は x を評価しない', '左辺で結果が決まれば右辺は実行されない。副作用のある式を置くと実行されないことがある。', 'Rust の && / || も短絡する。'),

  /* ── Java / oop ───────────────────────────── */
  c('j-reference', 'java', '参照', 'oop', ['j-primitive'], '参照型の変数はオブジェクトへの参照を持つ（null も可）', '変数のコピーは参照のコピー。同じオブジェクトを指す。'),
  c('j-value-vs-reference', 'java', '値渡しの誤解', 'oop', ['j-reference'], 'Java は常に値渡し（参照型は参照の値）', 'メソッド内で引数に再代入しても呼び出し元は変わらないが、参照の先を変更すると見える。'),
  c('j-constructor', 'java', 'コンストラクタ', 'oop', [], 'new で呼ばれ、フィールドを初期化する', 'this(...) や super(...) は先頭にしか書けない。既定コンストラクタは明示時には生まれない。'),
  c('j-static', 'java', 'static', 'oop', ['j-constructor'], 'static はクラスに属する。インスタンスなしで使える', 'static メソッドからインスタンスフィールドは触れない。カウンタや定数に使う。', 'Rust に static はあるが、定数は const。関連関数に self を取らない設計が近い。'),
  c('j-overload', 'java', 'オーバーロード', 'oop', ['j-constructor'], '引数の型と個数で選ぶ。戻り値だけでは区別しない', 'コンパイル時に決まる（静的解決）。'),
  c('j-override', 'java', 'オーバーライド', 'oop', ['j-reference'], '実行時の型でメソッドが決まる', '@Override を付けると取りこぼしをコンパイラが検出する。', 'Rust は trait 実装で同じことをする。'),
  c('j-polymorphism', 'java', 'ポリモーフィズム', 'oop', ['j-override'], '親型で受け取り、実行時の型の実装が呼ばれる', '呼び出し側が具象型を知らなくてもよい。'),
  c('j-field-hiding', 'java', 'フィールド隠蔽', 'oop', ['j-override'], 'フィールドは型で決まる。メソッドと違う', '親型の変数から親のフィールドが見える。実行時の型は影響しない。'),
  c('j-super', 'java', 'super', 'oop', ['j-constructor'], 'super は親のメソッド・コンストラクタを指す', 'super.m() は親の実装を呼ぶ。super() はコンストラクタの先頭。'),
  c('j-abstract', 'java', 'abstract クラス', 'oop', ['j-override'], '抽象クラスはインスタンス化できない', '抽象メソッドは実装を持たず、具象サブクラスが実装する。'),
  c('j-interface', 'java', 'interface', 'oop', ['j-abstract'], 'interface は契約。複数実装できる', '型の多重継承に近いことができる。'),
  c('j-default-method', 'java', 'default メソッド', 'oop', ['j-interface'], 'interface に既定実装を持てる（Java 8+）', '実装クラスは上書きできる。既存 interface への追加を壊さずに済む。'),
  c('j-encapsulation', 'java', 'カプセル化', 'oop', ['j-reference'], 'フィールドは private、操作だけ public なメソッドで出す', '外から直接触れないようにすると、不正な状態を作れなくなる。setter は検証の場所。', 'Rust はフィールドを pub にしない限りモジュール外から触れない（既定が private）。'),
  c('j-final', 'java', 'final', 'oop', ['j-override'], 'final はクラス・メソッド・変数の変更を禁止する', 'クラスなら継承禁止、メソッドなら override 禁止、変数なら再代入禁止。', 'Rust の let は既定で再代入不可。同じ発想。'),
  c('j-sealed', 'java', 'sealed', 'oop', ['j-abstract'], 'sealed は継承・実装できる型を permits で限定する', 'Java 17 で正式化。switch の網羅性と組み合わせて使う。'),
  c('j-method', 'java', 'メソッド', 'core', ['j-type'], '戻り値の型・名前・引数・本体の 4 つで決まる', 'void は値を返さない。return で戻り値を返し、途中で抜ける。'),
  c('r-tuple', 'rust', 'タプル', 'rust-core', ['r-type'], 'タプルは固定個の異なる型の組（T1, T2, ...）', '(3, "sato") は (i32, &str)。.0 でアクセスし、let (a, b) で分解する。'),
  c('r-array', 'rust', '配列', 'rust-core', ['r-tuple'], '配列 [T; N] は長さが型に含まれる', 'スタックに置かれ、長さを変えられない。可変長は Vec。', 'Java の配列は長さは実行時のフィールド。型には含まれない。'),
  c('j-equals', 'java', 'equals と hashCode', 'oop', ['j-reference'], 'equals が true なら hashCode は等しくなければならない', 'Map/Set は hashCode で探し、equals で確定する。片方だけの実装は取り出せないバグになる。'),
  c('j-tostring', 'java', 'toString', 'oop', ['j-override'], 'println と文字列連結は toString を呼ぶ', '既定は クラス名@ハッシュ。デバッグ用に意味のある文字列を返す。'),
  c('j-record', 'java', 'record', 'oop', ['j-immutability'], 'record は不変データの宣言。equals/hashCode/toString が自動', 'Java 16+。フィールドは private final、アクセサは name()。'),
  c('j-scope', 'java', 'スコープ', 'oop', ['j-reference'], '変数は宣言されたブロック内でのみ見える', 'ラムダが捕獲できるのは実質 final のローカル変数だけ。'),
  c('j-private', 'java', 'private と可視性', 'oop', ['j-encapsulation'], 'private は宣言したクラスの外から触れない（コンパイルエラー）', 'フィールド・メソッド・コンストラクタに付けられる。外に出す入口を public メソッドとして明示する。', 'Rust は「モジュール境界」で決まり、既定が private。Java はクラス単位。'),

  /* ── Java / collections ────────────────────── */
  c('j-list', 'java', 'List', 'collections', ['j-generics'], 'List は順序あり・重複可', 'get(i) で位置を指定。ArrayList は末尾追加が速い。', 'Rust の Vec に近い。'),
  c('j-set', 'java', 'Set', 'collections', ['j-equals'], 'Set は重複なし。重複判定は equals/hashCode', 'HashSet は順序を保証しない。equals/hashCode を実装しない型を入れると重複する。', 'Rust の HashSet も同じ契約。'),
  c('j-map', 'java', 'Map', 'collections', ['j-equals'], 'Map はキー→値。無いキーの get は null', 'computeIfAbsent で「無ければ作る」を 1 回で書ける。', 'Rust の HashMap entry API が対応する。'),
  c('j-generics', 'java', 'ジェネリクス', 'collections', ['j-reference'], '型パラメータで要素の型を固定する', 'List<String> に Integer を入れるとコンパイルエラー。実行時は型消去される。', 'Rust のジェネリクスは単相化され、実行時にも型が残る。'),
  c('j-autoboxing', 'java', 'ボクシング', 'collections', ['j-primitive'], 'int ⇄ Integer は自動変換。キャッシュは -128..127', '== で Integer を比べると範囲外で false になりうる。equals を使う。'),
  c('j-iterator', 'java', 'イテレータ', 'collections', ['j-list'], '反復中に構造を変更すると ConcurrentModificationException', '削除は iterator.remove() を使う。'),
  c('j-cast', 'java', '参照のキャスト', 'collections', ['j-polymorphism'], 'ダウンキャストは実行時に検査される', '合わなければ ClassCastException。instanceof で確認する。'),
  c('j-enum', 'java', 'enum', 'collections', ['j-constructor'], 'enum は固定された定数の集合', 'values() で全定数、valueOf(name) で名前から取得。ordinal() は順序番号。', 'Rust の enum はデータを持てる点が異なる。'),
  c('j-api', 'java', 'API の意味を読む', 'collections', ['j-map'], 'メソッド名と戻り値の型から「無い場合」を読む', 'get は null、getOrDefault は既定値、orElseThrow は例外。'),

  /* ── Java / functional ─────────────────────── */
  c('j-lambda', 'java', 'ラムダ式', 'functional', ['j-scope'], '関数型インターフェースの唯一の抽象メソッドを実装する', '引数 -> 本体。外側のローカル変数は実質 final のみ捕獲できる。'),
  c('j-methodref', 'java', 'メソッド参照', 'functional', ['j-lambda'], 'Class::method / obj::method / Class::new', 'ラムダの省略形。文脈から型が決まるときだけ使える。'),
  c('j-stream', 'java', 'Stream', 'functional', ['j-lambda'], '中間操作は遅延、終端操作で初めて実行される', 'map/filter は終端操作まで動かない。1 つの Stream は 1 回しか消費できない。', 'Rust の Iterator アダプタと同じ遅延評価。'),
  c('j-optional', 'java', 'Optional', 'functional', ['j-lambda'], 'Optional は「値があるかないか」を型で表す', 'get() は空なら例外。orElse/map/ifPresent を使う。戻り値にだけ使うのが原則。', 'Rust の Option<T> が対応する。'),
  c('j-option-result', 'java', 'Optional の考え方', 'functional', ['j-optional'], '「無い」を null ではなく型で表す', 'null は「無い」と「未設定」と「失敗」が混ざる。型で分けると取り違えが減る。', 'Rust は Option と Result で「無い」と「失敗」を分ける。'),
  c('j-collectors', 'java', 'Collectors', 'functional', ['j-stream'], '終端操作で Stream をコレクションへ集める', 'toList/toSet/toMap/groupingBy。toMap はキー重複で例外になる。', 'Rust は collect() で型を指定する。'),

  /* ── Java / errors ─────────────────────────── */
  c('j-exception', 'java', '例外', 'errors', [], '例外は「起きたこと」を表すオブジェクト', 'throw で投げ、catch で受け取る。握りつぶすと原因が消える。'),
  c('j-checked-exception', 'java', 'checked 例外', 'errors', ['j-exception'], '検査例外は catch か throws を強制する', 'IOException など。呼び出し側に処理を強制する仕組み。', 'Rust に checked 例外は無い。Result で同じ意図を表す。'),
  c('j-throws', 'java', 'throws', 'errors', ['j-checked-exception'], 'throws は処理を呼び出し元へ移す', '投げる可能性をシグネチャに書く。main まで来ると JVM が落ちる。'),
  c('j-finally', 'java', 'finally', 'errors', ['j-exception'], 'finally は例外の有無にかかわらず実行される', '後始末（close）に使う。try-with-resources が現在は推奨。'),
  c('j-return', 'java', 'return と finally', 'errors', ['j-finally'], 'finally 内の return は元の return を上書きする', '戻り値が消えるので書かない。finally は「戻る直前に必ず通る」。'),
  c('j-catch-order', 'java', 'catch の順序', 'errors', ['j-exception'], 'サブクラスを先に、親を後に', '親を先に書くとサブクラス側に到達不能でコンパイルエラー。'),
  c('j-stacktrace', 'java', 'スタックトレース', 'errors', ['j-exception'], '上から読む。最初の自分のコードが発生源', 'Exception in thread "main" の次行が型とメッセージ、その次が throw 地点。'),
  c('j-null', 'java', 'null', 'errors', ['j-reference'], 'null へのメソッド呼び出しは NullPointerException', 'null チェックか Optional、あるいは「無い」を型で表す。'),
  c('j-arithmetic', 'java', '算術例外', 'errors', ['j-division'], '整数の / 0 は ArithmeticException、double は Infinity', '例外になるか値になるかは型で決まる。'),

  /* ── Java / practical ──────────────────────── */
  c('j-json', 'java', 'JSON', 'practical', ['j-string'], 'JSON はテキスト。実務ではライブラリで変換する', '手書きの文字列切り出しはカンマやエスケープで壊れる。境界ではパーサを使う。'),
  c('j-http', 'java', 'HTTP', 'practical', ['j-string'], 'リクエストはメソッド + パス + ヘッダ + ボディ、応答はステータス + ボディ', '4xx はクライアント側、5xx はサーバ側。'),
  c('j-validation', 'java', '入力検証', 'practical', ['j-boundary'], '検証は境界（入力の入口）で 1 回だけ行う', '型・必須・範囲・形式。内側で何度も検証すると漏れる。'),
  c('j-request-flow', 'java', 'リクエストの流れ', 'practical', ['j-http'], 'Browser → HTTP → Controller → Service → Repository → DB → 戻り', '各層の責務を分ける。Controller は変換、Service はルール、Repository は永続化。'),
  c('j-jdbc', 'java', 'JDBC', 'practical', ['j-request-flow'], 'Connection → PreparedStatement → ResultSet の順', '値はプレースホルダ ? で渡す。文字列連結は SQL インジェクションになる。'),
  c('j-testing', 'java', 'テスト', 'practical', ['j-boundary'], '境界値と代表値で確かめる。期待値は実行して確認する', '読みやすいテストは「入力・操作・期待」が分かれている。'),
  c('j-debugging', 'java', 'デバッグ', 'practical', ['j-stacktrace'], '仮説 → 観測 → 修正の順で進める', 'まず再現。次にどの行で値が違うかを観測する。推測で直さない。'),

  /* ── Rust / core ───────────────────────────── */
  c('r-let', 'rust', 'let 束縛', 'rust-core', [], 'let は不変束縛。型は推論される', '再代入するなら let mut。同じ名前で let し直すのをシャドーイングという。', 'Java のローカル変数は再代入自由だが型は固定。'),
  c('r-mut', 'rust', 'mut', 'rust-core', ['r-let'], '変更する束縛には mut を明示する', 'mut は「この変数を書き換える」という宣言。参照の &mut とは別。'),
  c('r-type', 'rust', '型', 'rust-core', ['r-let'], '整数型はビット幅が型名に固定され、暗黙変換しない', 'u8/i32/u64/usize。混ぜると型エラー。as で明示変換する。', 'Java は widening を自動で行う。'),
  c('r-expression', 'rust', '式と文', 'rust-core', ['r-let'], 'ブロックの最後の式が値。セミコロンを付けると文になる', 'if も match も loop も式。末尾の ; の有無で型が変わる。'),
  c('r-function', 'rust', '関数', 'rust-core', ['r-expression'], '引数と戻り値の型を書く。最後の式が戻り値', 'return は早く抜けるときだけ。'),
  c('r-format', 'rust', 'フォーマット', 'rust-core', ['r-format'], '{} は Display、{:?} は Debug', 'Display を実装していない型は {:?} を使う。println! はマクロ。'),
  c('r-overflow', 'rust', 'オーバーフロー', 'rust-core', ['r-type'], 'debug は panic、release は wrap（既定）', 'ビルド設定で変わるので、意図するなら checked_add / wrapping_add を明示する。', 'Java は常に wrap（例外にしない）。'),
  c('r-loop', 'rust', 'loop / while / for', 'rust-core', ['r-expression'], 'loop は break で値を返せる式', 'for はイテレータを回す。1..=4 は両端を含む。'),
  c('r-iterator', 'rust', 'イテレータ', 'rust-core', ['r-loop'], 'next() で 1 つずつ進む。遅延して動く', 'map/filter はアダプタ。collect や for で消費される。', 'Java の Stream に近い。'),
  c('r-string-vs-str', 'rust', 'String と &str', 'rust-core', ['r-borrow'], 'String は所有、&str は借用のビュー', 'len() は UTF-8 のバイト数。文字数は chars().count()。', 'Java の String は不変で、所有/借用の区別が無い。'),
  c('r-slice', 'rust', 'スライス', 'rust-core', ['r-string-vs-str'], 'スライスは連続領域への参照（&[T] / &str）', '&s[0..2] で範囲を借りる。境界はバイト位置。'),

  /* ── Rust / ownership ──────────────────────── */
  c('r-ownership', 'rust', '所有権', 'ownership', ['r-let'], '値の所有者は常に 1 つだけ', '所有者がスコープを抜けると値は破棄される。'),
  c('r-move', 'rust', 'move', 'ownership', ['r-ownership'], '代入・引数渡しで所有権が移り、元は使えない', '使うと E0382（use of moved value）。', 'Java は参照をコピーするだけで、元も使える。'),
  c('r-copy', 'rust', 'Copy', 'ownership', ['r-move'], 'Copy な型はコピーされ、元も使える', 'i32 や bool などスタックに収まる単純な型。String は Copy ではない。'),
  c('r-clone', 'rust', 'clone', 'ownership', ['r-move'], 'clone は明示的な複製。コストがある', '暗黙のコピーはせず、必要なら書かせるのが Rust の設計。'),
  c('r-borrow', 'rust', '借用', 'ownership', ['r-ownership'], '& で借りると所有権は移らない', '借用中は所有者を破棄できない（E0597）。'),
  c('r-reference', 'rust', '参照', 'ownership', ['r-borrow'], '&T は読み取り専用の参照', '複数の &T は同時に持てる。'),
  c('r-mut-borrow', 'rust', '&mut', 'ownership', ['r-reference'], '&mut は同時に 1 つだけ、他は存在できない', '読み取り借用と書き込み借用の共存は E0502。'),
  c('r-drop', 'rust', 'Drop', 'ownership', ['r-scope'], 'スコープを抜けると自動で drop される', 'デストラクタ。明示的に早めたいときは drop(x)。', 'Java は GC。ファイナライザに相当するものはあるが推奨されない。'),
  c('r-scope', 'rust', 'スコープ', 'ownership', ['r-drop'], 'ブロックの終わりで借用が返り、所有値が破棄される', '借用の寿命が所有者を超えると E0597。'),

  /* ── Rust / data ───────────────────────────── */
  c('r-struct', 'rust', 'struct', 'data', ['r-let'], '名前付きフィールドの構造体', 'フィールドを 1 つだけ move すると、残りは部分 move として使える（そのフィールドは使えない）。', 'Java の record に近いが可変にもできる。'),
  c('r-impl', 'rust', 'impl', 'data', ['r-struct'], 'メソッドは impl ブロックに書く', '&self は読み取り、&mut self は書き換え、self は消費。', 'Java のメソッドはクラス定義に直接書く。'),
  c('r-enum', 'rust', 'enum', 'data', ['r-struct'], 'enum は取りうる形の集合。各形がデータを持てる', 'Option/Result も enum。', 'Java の enum は定数だけで、データは持てても形の違いは表せない。'),
  c('r-match', 'rust', 'match', 'data', ['r-enum'], 'match は網羅的でなければならない', '全パターンを書くか _ を置く。漏れると E0004。', 'Java の switch は default が無くても通る。'),
  c('r-option-result', 'rust', 'Option', 'data', ['r-enum'], 'Option<T> は Some(T) か None', 'null の代わり。「無い」ことが型に出るので、取り出しに match か unwrap が要る。'),
  c('r-result', 'rust', 'Result', 'data', ['r-enum'], 'Result<T, E> は Ok(T) か Err(E)', '失敗を型で表す。「無い」と「失敗」を分けられる。', 'Java の検査例外に近い意図を、値として返す。'),
  c('r-unwrap', 'rust', 'unwrap', 'data', ['r-option-result'], 'unwrap は None/Err のとき panic する', 'テストや「絶対にある」場面だけ。本番では expect か ? を使う。'),
  c('r-error-propagation', 'rust', '? 演算子', 'advanced', ['r-result'], '? は Err を呼び出し元へ返す', '戻り値の型と Err の型が一致している必要がある。'),
  c('r-vec', 'rust', 'Vec', 'data', ['r-borrow'], 'Vec は可変長配列。len は要素数、capacity は確保済みの枠', '添字は panic、get は Option。', 'Java の ArrayList に近い。'),
  c('r-hashmap', 'rust', 'HashMap', 'data', ['r-vec'], 'キー→値。entry で「無ければ入れる」を 1 回で書ける', 'get は Option を返す。', 'Java の computeIfAbsent に対応する。'),
  c('r-boundary', 'rust', '境界', 'data', ['r-vec'], 'v[i] は範囲外で panic、v.get(i) は None', '落としたくない場所では get を使う。'),

  /* ── Rust / abstraction ────────────────────── */
  c('r-trait', 'rust', 'trait', 'abstraction', ['r-impl'], 'trait は共通の振る舞いの契約', 'impl Trait for Type で実装。dyn Trait で実行時ディスパッチ。', 'Java の interface に対応する。'),
  c('r-generics', 'rust', 'ジェネリクス', 'abstraction', ['r-trait'], '型を抽象化する。演算を使うには境界が必要', 'T: PartialOrd のように trait 境界を書く。無いと E0369。', 'Java の型パラメータに近いが、Rust は単相化する。'),
  c('r-lazy', 'rust', '遅延評価', 'abstraction', ['r-iterator'], 'アダプタは終端操作まで何もしない', 'map/filter の順序を入れ替えると、呼ばれる回数が変わる。'),
  c('r-closure', 'rust', 'クロージャ', 'abstraction', ['r-borrow'], '環境を捕獲する無名関数。move で所有権ごと捕獲', '&mut を捕獲中に外から触ると E0503。'),

  /* ── Rust / advanced ───────────────────────── */
  c('r-lifetime', 'rust', 'lifetime', 'advanced', ['r-borrow'], '参照の有効期間を型に書く。実行時には影響しない', '引数の参照が複数あるとき、戻り値がどれに結び付くかを明示する。', 'Java には無い概念（GC が寿命を管理する）。'),
  c('r-module', 'rust', 'mod', 'advanced', ['r-function'], 'モジュールはコードの木構造。use で取り込む', 'mod で宣言し、パスは crate::a::b。'),
  c('r-visibility', 'rust', 'pub', 'advanced', ['r-module'], 'Rust の可視性の既定は private', '外に見せるものだけ pub を付ける。', 'Java の既定（package-private）より厳しい。'),
  c('r-testing', 'rust', 'テスト', 'advanced', ['r-result'], '#[test] を付けた関数がテスト。assert_eq! は偽なら panic', 'left が実際の値、right が期待値。'),
  c('r-debugging', 'rust', 'デバッグ', 'advanced', ['r-testing'], 'エラーコードとメッセージを読んでから直す', 'E0382 は move、E0499 は二重 &mut、E0502 は借用の衝突。'),
  c('r-panic', 'rust', 'panic', 'advanced', ['r-debugging'], 'panic は回復不能なエラー。既定では巻き戻す', 'unwrap・境界外・assert 失敗で起きる。'),

  /* ── Rust / interop ────────────────────────── */
  c('r-wasm-boundary', 'rust', 'WASM 境界', 'interop', ['r-type'], '境界を越えられるのは数値だけ', '文字列や構造体は線形メモリ上の配置に分解して渡す。', 'Java には無い（JVM がオブジェクトを管理する）。'),
  c('r-pointer-length', 'rust', 'ポインタと長さ', 'interop', ['r-wasm-boundary', 'r-slice'], '領域は「開始位置 + 長さ（バイト数）」で表す', '長さが無いとどこまで読むか分からない。'),
  c('r-memory', 'rust', '線形メモリ', 'interop', ['r-wasm-boundary'], 'WASM のメモリは 1 本のバイト配列', '確保した領域の所有者を決め、解放関数を対で用意する。'),
  c('r-determinism', 'rust', '決定性', 'interop', ['r-memory'], '同じ入力から同じ結果を作るには乱数と時刻を使わない', 'seed とビット演算だけで作れば再現できる。'),
];
