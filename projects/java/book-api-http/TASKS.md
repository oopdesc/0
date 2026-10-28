# 小課題集 — book-api-http（Java）

同梱のコードは「模範状態」です。各課題は、まず手順どおりに一部を戻して**開始状態**を作り、
失敗するテストで困りごとを観察してから、模範状態へ直す練習です。
戻した差分そのものが、あなたが書くべき変更です（答えを先に全部読まず、ヒント順に進めてください）。

前提: このフォルダでコンパイルとテストが通ること。

```sh
mkdir -p bin
javac --release 17 -d bin $(find src test -name '*.java')
java -cp bin learning.books.http.BookApiHttpTest   # all checks passed が目安
java -cp bin learning.books.http.Main --memory 18080   # サーバ（別ターミナルで curl）
```

Eclipse の場合は README の「Eclipse で開く・Debug する」が対応表です
（Import = このフォルダ、Run/Test = `Main` / `BookApiHttpTest` を Java Application として実行、
Debug = `BookController.handle` と `BookService.get` にブレークポイント）。

---

## 課題1: 1つの requestId でリクエスト全体を追跡する

- **要件**: すべての応答に `X-Request-Id` ヘッダが付き、エラー応答の本文にも同じ `requestId` が入る。
  サーバ側ログには `requestId=... GET /api/books/1 -> 200` の形で結果が1行残り、
  保存層の失敗ログも同じ ID で引けること。
- **開始状態**: `BookController.handle` で requestId を発行せず、`service.get(rawId)` /
  `service.rename(rawId, ...)`（ID なしのオーバーロード）を呼び、応答は `Json.error(msg)` に戻す。
- **編集する場所**: `BookController.handle / handleGet / handlePut / reply / send`、
  `BookService.get(String, String)` と `rename(String, String, String, String)`、`Json.error(String, String)`。
- **失敗するテスト**: サーバを起動して以下を確認する（開始状態では requestId がどこにも出ない）。

  ```sh
  curl -sS -i http://127.0.0.1:18080/api/books/abc
  # 期待: HTTP 400、本文 {"error":"...","requestId":"..."}、ヘッダ X-Request-Id が本文と一致
  ```

  単体では `BookApiHttpTest.checkRequestId`（requestId が保存層の失敗まで同じ値で届くこと）が対象。
- **ヒント**: ① ID は「発行した場所」から引数で渡す（途中の層が勝手に作り直すと一致しない）。
  ② 応答の組み立ては `reply` の1か所に寄せると漏れない。③ ヘッダと本文の両方に付けると curl -i で目視照合できる。
- **模範の考え方**: Controller が入口で1つ発行し、Service へ引数で渡す。Service は失敗時に
  その ID でログを出し、`Failure(requestId)` として返す。応答本文・ヘッダ・ログが同じ ID を指すので、
  利用者の「この requestId で失敗した」という申告からサーバ側の詳細ログへたどれる。
- **ねらい**: 層をまたぐ値は「誰が発行し、誰が運ぶか」を決める。ID を途中で作り直すと追跡が切れる。

## 課題2: 不正な入力は 400、存在しない本は 404。不正入力は DB へ進ませない

- **要件**: `GET /api/books/abc` は 400、`GET /api/books/99` は 404。
  形式が不正な ID では Repository が一切呼ばれないこと。
- **開始状態**: `BookService.get` の `parseId` 判定を取り除き、`Integer.parseInt(rawId)` を直接使う
  （例外は Controller まで漏れて 500 になる）。
- **編集する場所**: `BookService.parseId / get`、`BookController.handleGet` の結果分岐。
- **失敗するテスト**:

  ```sh
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18080/api/books/abc   # 開始状態: 500 / 期待: 400
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:18080/api/books/99    # どちらも 404
  ```

  単体では `BookApiHttpTest` の `service bad input stops before repository` が目印
  （必ず例外で落ちる Repository を渡しても BadInput が返れば、保存層へ進んでいない）。
- **ヒント**: ① 400 と 404 の違いは「形式が間違い」か「形式は正しいが無い」か。
  ② 検証は入口に近い層（Service の入口）で済ませ、内部では正しい型だけを扱う。
  ③ NumberFormatException を HTTP 層まで漏らすと、利用者の誤りがサーバの故障に見える。
- **模範の考え方**: `parseId` が `Optional<Integer>` を返し、空なら `BadInput` として即返す。
  Controller は結果の種類（sealed 型）だけを見て 400/404/500 へ変換する。
- **ねらい**: ステータスコードは「誰の・どんな失敗か」を伝える契約。検証の位置がそのまま防御範囲になる。

## 課題3: SQL はパラメータで組み立てる（文字列結合にしない）

- **要件**: タイトルに `'` や `"; DROP TABLE books; --` を含む文字列を PUT しても、
  SQL エラーや表の破壊が起きず、その文字列がそのまま保存されること。
- **開始状態**: JDBC で試す。`JdbcBookRepository.findById` の SQL を
  `"SELECT ... WHERE id = " + id` のような文字列結合に書き換える（int なので注入は成立しないが、
  まず「値が SQL 文の一部になる」形を観察する）。次に `updateTitle` の title バインドを
  `'...' + title + '...'` の結合に変えると、引用符入りの題名で壊れることを確認する。
- **編集する場所**: `JdbcBookRepository.findById / insert / seed / updateTitle`。
- **失敗するテスト**:

  ```sh
  # JDBC ドライバを lib/sqlite-jdbc.jar に置いた状態で
  java -cp bin:lib/sqlite-jdbc.jar learning.books.http.Main --jdbc /tmp/books.db 18080
  curl -sS -X PUT -d "title=a'b&version=1" http://127.0.0.1:18080/api/books/1
  # 開始状態: 500（SQL 構文エラー）/ 期待: 200 で a'b が保存される
  ```

- **ヒント**: ① エラーになるのは「引用符が SQL の文法として解釈される」から。
  ② `PreparedStatement` の `?` は値を「データ」として分離して渡す。
  ③ エスケープを自前で足す方式は、漏れがあると常に注入の余地が残る。
- **模範の考え方**: SQL の骨格は固定文字列、値は `ps.setString/setInt` でバインドする（模範状態）。
  テストの `BookApiHttpTest` はインメモリ実装と同じ契約を JDBC 実装にも要求している。
- **ねらい**: 「動く」と「安全」は別物。境界（SQL）を越える値の扱いを型と API で決める。

## 課題4: 部分的に失敗したら、途中まで進んだ状態を残さない

- **要件**: バージョン確認と更新が分かれていると、確認の後に失敗（または競合）が起きたとき
  「タイトルだけ変わった」「version だけ上がった」ような中途半端な状態が残り得る。
  確認と更新を1つの原子的な操作にまとめること。
- **開始状態**: `JdbcBookRepository.updateTitle` を2文に分ける —
  `SELECT version` で確認してから、version 条件なしの `UPDATE books SET title=? WHERE id=?` を実行する。
  （インメモリ実装も `books.get` → 比較 → `books.put` の3手順に分けて観察してもよい。）
- **編集する場所**: `JdbcBookRepository.updateTitle`、`InMemoryBookRepository.updateTitle`。
- **失敗するテスト**: `BookApiHttpTest.checkRepository` の
  `stale version rejected` と `version bumped`、さらにサーバで同じ version の PUT を2回送る。

  ```sh
  curl -sS -X PUT -d "title=先勝ち&version=1" http://127.0.0.1:18080/api/books/1  # 200
  curl -sS -X PUT -d "title=後勝ち&version=1" http://127.0.0.1:18080/api/books/1  # 開始状態: 200（上書き）/ 期待: 409
  ```

- **ヒント**: ① 「確認してから書く」の間には、他の実行や失敗が入り込む余地がある。
  ② DB では `UPDATE ... WHERE id=? AND version=?` の1文が比較と更新を原子的に行う。
  ③ メモリ実装では `computeIfPresent` のような「読む・比べる・書く」を1回の操作にする道具を使う。
  複数文にまたがる業務（例: 2行を必ず一緒に更新する）では、1つの Connection で
  `setAutoCommit(false)` → 成功時 `commit()` / 失敗時 `rollback()` が同じ役割になる。
- **模範の考え方**: 模範状態の `updateTitle` は version 条件付きの1文で、更新件数 1/0 が
  成功/競合をそのまま表す。インメモリ実装は `computeIfPresent` の中で比較と置換を行う。
- **ねらい**: 原子性は「速さ」ではなく「途中で止まっても壊れない」ための設計。境界は操作の単位で引く。

## 課題5: 二重更新は後勝ちにせず 409 で知らせる

- **要件**: 同じ version を持つ2つの更新が来たら、1つ目だけが成功し、2つ目は 409 になること。
  黙って上書きしない。更新のたびに version が1増えること。
- **開始状態**: `BookService.rename` の競合判定を外す（`updateTitle` の戻り値を無視して常に Updated を返す）、
  さらに `updateTitle` の SQL から `AND version = ?` を外して開始状態の幅を観察する。
- **編集する場所**: `BookService.rename`、`JdbcBookRepository.updateTitle`、`BookController.handlePut`。
- **失敗するテスト**: 課題4の curl 手順（2回目の PUT が 200 になってしまう）。単体では
  `service conflict`（古い version での再更新が `UpdateResult.Conflict` になること）。
- **ヒント**: ① 409 が必要なのは「あなたの見ていた版はもう古い」という情報そのものに価値があるから。
  ② version は利用者にも見える値（GET の応答に含まれる）で、更新の合言葉として往復する。
  ③ Controller は Service の結果の種類をそのままステータスへ写すだけにする。
- **模範の考え方**: Service は更新件数 0 を `Conflict` として返し（模範状態）、
  Controller が 409 + 「他のリクエストで更新されています」へ変換する。
- **ねらい**: 同時更新の制御は、ロックで止める方法と version で検出する方法がある。
  ここでは検出して相手に再読込を促す楽観ロックを採っている。

## 課題6: DB の内部情報は応答に漏らさず、それでも診断できるようにする

- **要件**: 保存層が失敗したとき、HTTP 応答は汎用メッセージ + requestId のみ。
  SQL 文・ファイルパス・例外クラス名などは応答に出ない。一方でサーバ側ログには
  同じ requestId で詳細（どの操作がどう失敗したか）が残ること。
- **開始状態**: `BookService` の catch で `Failure` に例外メッセージを持たせ、
  `BookController` の 500 応答にその詳細を含める（よくある「親切なエラー表示」の再現）。
- **編集する場所**: `BookService.get / rename` の catch、`BookController` の 500 分岐、`Json.error(String, String)`。
- **失敗するテスト**: JDBC の DB ファイルを消す/読めない場所へ向ける等で保存を失敗させ、

  ```sh
  curl -sS http://127.0.0.1:18080/api/books/1
  # 開始状態: 応答に SQL やパスが含まれる / 期待: {"error":"内部エラーが発生しました","requestId":"..."} のみ
  # サーバの標準エラー出力には requestId=... stage=storage result=failure detail=... が残ることを確認
  ```

  単体では `BookApiHttpTest.checkRequestId` の `error response never leaks storage internals`。
- **ヒント**: ① 応答の読者は利用者、ログの読者は運用者。同じ例外でも渡す情報は分ける。
  ② 「何も出さない」と黙るのではなく、requestId という照合の鍵だけを応答に残す。
  ③ 詳細を残す場所（サーバ側ログ）にも同じ ID を必ず含める。
- **模範の考え方**: Service は詳細を標準エラーへ1行出し、Controller は汎用文 + requestId だけを返す（模範状態）。
- **ねらい**: 情報漏えい対策と診断可能性は両立できる。鍵は「詳細そのもの」ではなく「詳細へたどる ID」を渡すこと。
