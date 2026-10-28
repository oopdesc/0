# book-api-http — ブラウザ教材の先にある「本物」をローカルで動かす

サイト内の「処理の全体像」は、HTTP → Controller → Service → Repository → DB の流れを
**ブラウザの中で再現する練習モデル**です。実際の通信も DB 接続も起きていません。

このプロジェクトは同じ題材を、自分の PC の中で実際に動かすためのものです。

- HTTP サーバは JDK 同梱の `com.sun.net.httpserver`（外部ライブラリなし）
- 既定はインメモリ保存（依存ゼロ）。`--jdbc` を付けると JDBC 経由で SQLite ファイルへ保存します
- SQL は `PreparedStatement` の `?` に値をバインドします（文字列結合で SQL を組み立てません）
- 更新は `version` の楽観ロック付き。同時更新は 409 で返し、後勝ちで黙って上書きしません
- 127.0.0.1 にだけバインドします。**教材用サーバです。公開サーバとして使わないでください**（認証も利用制限もありません）

## 動かし方（ターミナル）

JDK 21とMavenがあれば、`mvn test` でJDBCと実際の一時SQLiteファイルを使ったテストまで実行できます。Eclipseでは「既存のMavenプロジェクト」としてこのフォルダを取り込むと、JDBCドライバも依存関係として解決されます。

前提: JDK 17 以降（このプロジェクトは JavaSE-21 で Eclipse 登録していますが、17 でもコンパイルできます）。

```sh
cd projects/java/book-api-http
mkdir -p bin
javac --release 17 -d bin $(find src test -name '*.java')
```

### 1) インメモリで動かす（依存ゼロ）

```sh
java -cp bin learning.books.http.Main --memory 18080
# 別ターミナルで:
curl -i http://127.0.0.1:18080/api/books/1        # 200
curl -i http://127.0.0.1:18080/api/books/abc      # 400（検証で停止し、DBへ進まない）
curl -i http://127.0.0.1:18080/api/books/99       # 404（形式は正しいが該当行なし）
curl -i -X PUT -d "title=Javaで学ぶHTTP&version=1" http://127.0.0.1:18080/api/books/1   # 200 version=2
curl -i -X PUT -d "title=上書き&version=1" http://127.0.0.1:18080/api/books/1           # 409（古い version）
```

サーバを止めるには Ctrl+C です。再起動すると初期データに戻ります。

### 2) JDBC + SQLite で動かす（ファイルへ保存）

JDBC ドライバは JDK に含まれません。実行時だけ jar が要ります。

1. Maven Central の `org.xerial:sqlite-jdbc`（3.46.x 系など）から jar をダウンロードし、
   このフォルダの `lib/sqlite-jdbc.jar` に置きます（ソースツリーには同梱していません）。
2. 起動します。

```sh
java -cp bin:lib/sqlite-jdbc.jar learning.books.http.Main --jdbc books.db 18080
```

`books.db` に `books` テーブルができ、再起動しても内容が残ります。
Python が使える環境なら `python3 -c "import sqlite3;print(list(sqlite3.connect('books.db').execute('select * from books')))"`
で中身を確認できます。

### 3) テスト

```sh
java -cp bin learning.books.http.BookApiHttpTest
# JDBC 実装も検証する場合（ドライバ jar を置いたあと）:
java -cp bin:lib/sqlite-jdbc.jar -Darena.jdbc.url=jdbc:sqlite:/tmp/check.db learning.books.http.BookApiHttpTest
```

## 小課題集

手を動かして直す練習は [TASKS.md](./TASKS.md) にあります（requestId の追跡、400/404、SQL バインド、
原子的更新と 409、内部情報を漏らさない 500 まで6課題）。同梱コードは模範状態で、
開始状態は各課題の手順で一部を戻して作ります。

## Eclipse で開く・Debug する

1. File → Import → General → Existing Projects into Workspace でこのフォルダを選びます（`.project` 同梱）。
2. `Main` を右クリック → Run As / Debug As → Java Application（引数は Project の Run Configurations で `--memory` などを指定）。
3. サイトの「処理の全体像」と同じ観点で breakpoint を置きます。
   - `BookController.handle` の入口（HTTP が Java の値へ変わる地点）
   - `BookService.get` の分岐（400 / 404 / 200 の分かれ目）
   - `JdbcBookRepository.findById` の `PreparedStatement`（SQL と値が分かれていること）
   - `updateTitle` の戻り（version 不一致で 0 件になること＝409 の発生地点）
4. Eclipse の Debug 画面では変数（id、version、ResultSet）を追えますが、ブラウザの描画・ネットワークそのものは調べられません。両者は別物として扱ってください。

## 層の対応（サイト教材との対応）

| サイトの図 | このプロジェクト |
| --- | --- |
| ブラウザ / HTTP | `curl` と `BookController`（127.0.0.1 のみ） |
| Controller | `BookController`（HTTP⇄Java の変換だけ） |
| Service | `BookService`（入力検証と結果の種類、HTTP の言葉は持たない） |
| Repository | `BookRepository`（境界インターフェース） |
| JDBC / DB | `JdbcBookRepository` + SQLite ファイル / 比較用 `InMemoryBookRepository` |
