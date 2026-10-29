# HTTPと保存の境界を実装する

Java 14問、Rust 12問。ブラウザから届いた値が、処理と保存を経て応答へ戻るまでの部品を、小さく分けて実装します。

1. パスとクエリを分ける。欠損・空文字列・重複を区別する。
2. IDと件数を検証し、フォームの値をUTF-8へ戻す。
3. JSONの文字列、本文のバイト数、GETとHEADの違いを確かめる。
4. 欠損を型で表し、ページのコピーと更新時の版を扱う。
5. Javaでは、PreparedStatementへの値の束縛とトランザクションの後始末へ進む。

問題の入口は `/learn?section=drill&lang=java&q=java%3Aq43001` と `/learn?section=drill&lang=rust&q=rust%3Aq42001` です。問題一覧・コード演習・今日の学習からも選べます。途中の課題を自由に開けます。

## 手元での確認

```sh
./tools/portfolio.sh test-backend-contracts
```

JDKとRustの実コンパイラで参照解答を実行し、152の固定ケースを照合します。さらに、入力検証の省略、UTF-8の文字数との混同、元リストへの参照の返却、版を無視する更新など、意図的に誤った実装26件を検出できるか確認します。実行は逐次です。結果は `.local/verification/backend-contracts.json` に保存します。

`web/tests/fixtures/backend-semantic-mutants.json` は誤実装の検査用データです。模範解答として使わないでください。公開画面で配信する解答は、各言語の `backend-writing.json` にあります。ソースと固定テストのハッシュが検証時と一致することもWebテストで確かめます。

固定ケースを通過しても、全入力の正しさや性能を証明したことにはなりません。JDBCの固定テストは呼出順・引数・例外を記録する代役を使います。実HTTPとSQLiteへ進むときは、`projects/java/book-api-http` と `projects/rust/book-api-http` の独立したプロジェクトを使ってください。

## 後始末で確かめること

ロールバックに失敗した接続を、安易に自動コミットへ戻しません。JDBCの仕様では、トランザクション中の自動コミットへの切り替えで変更が確定し得ます。教材の最終課題では元の例外を保ち、ロールバック失敗を追加して呼出元へ伝えます。不確かな接続は、利用するドライバ・接続プールの方法で無効化し、使い回さない設計が必要です。

仕様の参照先：

- [HTTP Semantics（RFC 9110）](https://www.rfc-editor.org/rfc/rfc9110.html)
- [Java 17 URLDecoder](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/net/URLDecoder.html)
- [Java 17 Connection](https://docs.oracle.com/en/java/javase/17/docs/api/java.sql/java/sql/Connection.html)
- [Rust str](https://doc.rust-lang.org/std/primitive.str.html)
