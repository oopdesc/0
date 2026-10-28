# 小課題集 — book-api-http（Rust）

同梱のコードは「模範状態」です。各課題は、まず手順どおりに一部を戻して**開始状態**を作り、
失敗するテストで困りごとを観察してから、模範状態へ直す練習です。
戻した差分そのものが、あなたが書くべき変更です（答えを先に全部読まず、ヒント順に進めてください）。

前提: このフォルダでビルドとテストが通ること。

```sh
cargo test                                        # 4 tests が目安
cargo run -- --memory 18082                       # サーバ（別ターミナルで curl）
cargo run -- --sqlite /tmp/books.db 18082         # SQLite 保存版
```

エディタは rust-analyzer 対応のもの（VS Code 等）で開きます。デバッグは
`service::BookService::get` と `main::handle` にブレークポイントを置くのが対応箇所です
（Eclipse はこのプロジェクトの対象外です。README 参照）。

---

## 課題1: 1つの requestId でリクエスト全体を追跡する

- **要件**: すべての応答に `X-Request-Id` ヘッダが付き、エラー応答の本文にも同じ `requestId` が入る。
  サーバ側ログには `requestId=2 -> 400` の形で結果が残り、保存層の失敗ログも同じ ID で引けること。
- **開始状態**: `main::handle` で ID を発行せず、`service.get(&raw_id)` のように
  ID なしで呼び、応答は `json::error(msg)` に戻す（Service 側が失敗時に勝手な番号を振る形も観察する）。
- **編集する場所**: `main::handle / respond`、`service::BookService::get / rename / failure`、
  `json::error_with_id`。
- **失敗するテスト**: サーバを起動して確認する（開始状態では requestId が応答に出ない）。

  ```sh
  curl -sS -i http://127.0.0.1:18082/api/books/abc
  # 期待: HTTP 400、本文 {"error":"...","requestId":2}、ヘッダ X-Request-Id: 2 が一致
  ```

  単体では `cargo test` の `request_id_traces_to_storage_failure`
  （渡した ID がそのまま `GetResult::Failure(42)` になること）が対象。
- **ヒント**: ① ID は入口（`handle`）で1つ発行し、引数で運ぶ。途中で作り直すと一致が切れる。
  ② 応答の組み立てとログ出力を `respond` の1か所に寄せると付け漏れがなくなる。
  ③ 連番（AtomicU64）でも UUID でもよいが、「1リクエストに1つ」を守ること。
- **模範の考え方**: `handle` が `NEXT_REQUEST_ID` から発行し、Service へ `request_id: u64` として渡す。
  Service は失敗時にその ID で `stage=storage` のログを出し、`Failure(request_id)` を返す。
- **ねらい**: 層をまたぐ値は「誰が発行し、誰が運ぶか」を決める。ID を途中で作り直すと追跡が切れる。

## 課題2: 不正な入力は 400、存在しない本は 404。不正入力は DB へ進ませない

- **要件**: `GET /api/books/abc` は 400、`GET /api/books/99` は 404。
  形式が不正な ID では Repository が一切呼ばれないこと。
- **開始状態**: `service::parse_id` の検証を取り除き、`raw_id.parse::<i64>()` の成否だけで進める
  （`0` や負数、大きすぎる数が保存層まで届く形を観察する）。
- **編集する場所**: `service::parse_id / get`、`main::handle` の結果分岐。
- **失敗するテスト**:

  ```sh
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18082/api/books/abc   # 期待: 400
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18082/api/books/99    # 期待: 404
  ```

  単体では `cargo test` の `service_validates_before_repository`
  （`GetResult::BadInput` が返ること。必ず失敗する Repository でも BadInput なら保存層へ進んでいない）。
- **ヒント**: ① 400 と 404 の違いは「形式が間違い」か「形式は正しいが無い」か。
  ② 検証は Service の入口で済ませ、内部では `i64` の正しい値だけを扱う。
  ③ パース失敗を保存層や HTTP 層まで漏らすと、利用者の誤りがサーバの故障に見える。
- **模範の考え方**: `parse_id` が `Option<i64>`（先頭 0 でない 1〜6 桁）を返し、
  `None` なら `BadInput` として即返す。handler は結果の enum をステータスへ変換するだけ。
- **ねらい**: ステータスコードは「誰の・どんな失敗か」を伝える契約。検証の位置がそのまま防御範囲になる。

## 課題3: SQL はパラメータで組み立てる（文字列結合にしない）

- **要件**: タイトルに `'` や `"; DROP TABLE books; --` を含む文字列を PUT しても、
  SQL エラーや表の破壊が起きず、その文字列がそのまま保存されること。
- **開始状態**: `repository::SqliteBookRepository::update_title` の `params!` をやめ、
  `format!("UPDATE books SET title = '{}' ...", title)` の文字列結合に書き換える。
- **編集する場所**: `repository::SqliteBookRepository`（`find_by_id / insert / seed / update_title`）。
- **失敗するテスト**:

  ```sh
  cargo run -- --sqlite /tmp/books.db 18082
  curl -sS -X PUT -d "title=a'b&version=1" http://127.0.0.1:18082/api/books/1
  # 開始状態: 500（SQL 構文エラー）/ 期待: 200 で a'b が保存される
  ```

  単体では `sqlite_repository_behaves` が同じ契約（更新と version）を SQLite 実装にも要求している。
- **ヒント**: ① 壊れるのは「引用符が SQL の文法として解釈される」から。
  ② `params!` は値を「データ」として分離して渡す。③ 自前のエスケープは漏れると常に注入の余地が残る。
- **模範の考え方**: SQL の骨格は固定文字列、値は `params![...]` でバインドする（模範状態）。
  rusqlite の `Connection` は `Mutex` で守られ、handler は実装の違いを知らない。
- **ねらい**: 「動く」と「安全」は別物。境界（SQL）を越える値の扱いを型と API で決める。

## 課題4: 部分的に失敗したら、途中まで進んだ状態を残さない

- **要件**: バージョン確認と更新が分かれていると、確認の後に失敗（または競合）が起きたとき
  中途半端な状態が残り得る。確認と更新を1つの原子的な操作にまとめること。
- **開始状態**: `SqliteBookRepository::update_title` を2文に分ける —
  `SELECT version` で確認してから、version 条件なしの `UPDATE books SET title=?2 WHERE id=?1` を実行する。
  （インメモリ実装も「取り出して比較し、後で書き戻す」形に分けて観察してもよい。）
- **編集する場所**: `repository::SqliteBookRepository::update_title`、`InMemoryBookRepository::update_title`。
- **失敗するテスト**: `cargo test` の `check_repository`（`stale version must be rejected` と
  version が 2 になること）、さらにサーバで同じ version の PUT を2回送る。

  ```sh
  curl -sS -X PUT -d "title=先勝ち&version=1" http://127.0.0.1:18082/api/books/1  # 200
  curl -sS -X PUT -d "title=後勝ち&version=1" http://127.0.0.1:18082/api/books/1  # 開始状態: 200（上書き）/ 期待: 409
  ```

- **ヒント**: ① 「確認してから書く」の間には、他の実行や失敗が入り込む余地がある。
  ② DB では `UPDATE ... WHERE id=? AND version=?` の1文が比較と更新を原子的に行い、
  更新件数 1/0 が成功/競合を表す。③ メモリ実装では `Mutex` のロックを保持したまま
  比較と書き換えを行う。複数文にまたがる処理では `conn.transaction()` で
  commit/rollback の境界を引くのが同じ役割になる。
- **模範の考え方**: 模範状態の `update_title` は version 条件付きの1文。
  インメモリ実装はロック保持中に `version` を比較して書き換える。
- **ねらい**: 原子性は「速さ」ではなく「途中で止まっても壊れない」ための設計。境界は操作の単位で引く。

## 課題5: 二重更新は後勝ちにせず 409 で知らせる

- **要件**: 同じ version を持つ2つの更新が来たら、1つ目だけが成功し、2つ目は 409 になること。
  黙って上書きしない。更新のたびに version が1増えること。
- **開始状態**: `service::BookService::rename` の競合判定を外す（`update_title` の `Ok(false)` を
  Updated 扱いにする）、さらに SQL から `AND version = ?` を外して開始状態の幅を観察する。
- **編集する場所**: `service::BookService::rename`、`SqliteBookRepository::update_title`、`main::handle` の PUT 分岐。
- **失敗するテスト**: 課題4の curl 手順（2回目の PUT が 200 になってしまう）。単体では
  `service_validates_before_repository` の `UpdateResult::Conflict(1)` の確認。
- **ヒント**: ① 409 が必要なのは「あなたの見ていた版はもう古い」という情報そのものに価値があるから。
  ② version は利用者にも見える値（GET の応答に含まれる）で、更新の合言葉として往復する。
  ③ handler は Service の結果 enum をそのままステータスへ写すだけにする。
- **模範の考え方**: Service は更新件数 0 を `UpdateResult::Conflict` として返し（模範状態）、
  handler が 409 + 「他のリクエストで更新されています」へ変換する。
- **ねらい**: 同時更新の制御は、ロックで止める方法と version で検出する方法がある。
  ここでは検出して相手に再読込を促す楽観ロックを採っている。

## 課題6: DB の内部情報は応答に漏らさず、それでも診断できるようにする

- **要件**: 保存層が失敗したとき、HTTP 応答は汎用メッセージ + requestId のみ。
  SQL 文・ファイルパス・エラー文字列などは応答に出ない。一方でサーバ側ログには
  同じ requestId で詳細（どの操作がどう失敗したか）が残ること。
- **開始状態**: `service::failure` で例外文字列を保持し、handler の 500 応答に
  その詳細を含める（よくある「親切なエラー表示」の再現）。
- **編集する場所**: `service::BookService::failure`、`main::handle` の 500 分岐、`json::error_with_id`。
- **失敗するテスト**: SQLite の DB ファイルを消す/開けないパスへ向ける等で保存を失敗させ、

  ```sh
  curl -sS http://127.0.0.1:18082/api/books/1
  # 開始状態: 応答に SQL やパスが含まれる / 期待: {"error":"内部エラーが発生しました","requestId":N} のみ
  # サーバの標準エラーには requestId=N stage=storage result=failure detail=... が残ることを確認
  ```

  単体では `request_id_traces_to_storage_failure` の
  `error response never leaks storage internals`。
- **ヒント**: ① 応答の読者は利用者、ログの読者は運用者。同じ失敗でも渡す情報は分ける。
  ② 「何も出さない」と黙るのではなく、requestId という照合の鍵だけを応答に残す。
  ③ 詳細を残す場所（サーバ側ログ）にも同じ ID を必ず含める。
- **模範の考え方**: Service は詳細を標準エラーへ1行出し、handler は汎用文 + requestId だけを返す（模範状態）。
- **ねらい**: 情報漏えい対策と診断可能性は両立できる。鍵は「詳細そのもの」ではなく「詳細へたどる ID」を渡すこと。
