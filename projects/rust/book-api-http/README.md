# book-api-http（Rust）— ブラウザ教材の先にある「本物」をローカルで動かす

サイト内の「処理の全体像」は、HTTP → handler → validation → service → repository → SQLite の流れを
**ブラウザの中で再現する練習モデル**です。実際の通信も DB 接続も起きていません。

このプロジェクトは同じ題材を、自分の PC の中で実際に動かすためのものです。

- HTTP は標準ライブラリ `std::net::TcpListener` で受付（教材のため接続は1つずつ順に処理します。同時接続の扱いは題材の範囲外です）
- `--sqlite` を付けると rusqlite 経由で SQLite ファイルへ保存します（値は `params!` で分離し、文字列結合で SQL を組み立てません）
- 更新は `version` の楽観ロック付き。同時更新は 409 で返し、後勝ちで黙って上書きしません
- 127.0.0.1 にだけバインドします。**教材用サーバです。公開サーバとして使わないでください**（認証も利用制限もありません）

## 動かし方

前提: Rust（cargo）。初回ビルドでは crates.io から `rusqlite` を取得し、
同梱の SQLite を C コンパイラでビルドします（bundled 機能）。ネットワークと C コンパイラが必要です。

```sh
cd projects/rust/book-api-http
cargo run --release -- --memory 18082        # インメモリ
cargo run --release -- --sqlite books.db 18082  # SQLite ファイルへ保存

# 別ターミナルで:
curl -i http://127.0.0.1:18082/api/books/1
curl -i http://127.0.0.1:18082/api/books/abc   # 400（検証で停止）
curl -i http://127.0.0.1:18082/api/books/99    # 404
curl -i -X PUT -d "title=改訂タイトル&version=1" http://127.0.0.1:18082/api/books/1
```

## 小課題集

手を動かして直す練習は [TASKS.md](./TASKS.md) にあります（requestId の追跡、400/404、SQL バインド、
原子的更新と 409、内部情報を漏らさない 500 まで6課題）。同梱コードは模範状態で、
開始状態は各課題の手順で一部を戻して作ります。

## テスト

```sh
cargo test
```

インメモリ実装と SQLite（:memory:）実装の両方で、取得・未存在・楽観ロック（古い version の拒否）を検証します。

## 層の対応（サイト教材との対応）

Rust では JDBC という言葉は使いません。

| サイトの図 | このプロジェクト |
| --- | --- |
| ブラウザ / HTTP | `curl` と `main.rs` の受付処理（127.0.0.1 のみ、順次処理） |
| handler | `handle`（HTTP⇄Rust の変換だけ） |
| validation / service | `service.rs`（入力検証と結果の種類、HTTP の言葉は持たない） |
| repository | `repository.rs` の `BookRepository` トレイト |
| SQLite / DB | `SqliteBookRepository` / 比較用 `InMemoryBookRepository` |

Eclipse 系のエディタではなく、通常は rust-analyzer 対応エディタ（VS Code 等）で開きます。
デバッグでは handler、service の分岐、repository の `params!` に breakpoint を置き、
`id` と `version` がどう変わるかを追ってください。
