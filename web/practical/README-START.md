# 実務演習室から、Java・Rustの実コードへ

JavaかRustの片方を選んで進めます。両方を一度に解く必要はありません。

## 最初にすること

1. ZIPを新しい学習用ディレクトリへ展開する。会社のリポジトリやDBは使わない。
2. 下のコマンドでテストを実行する。開始状態にはTODOがあり、失敗するのが正常。
3. ID検証とrenameの2関数を実装し、再実行する。テストの期待値を書き換えて通過させない。
4. 自分でも境界・未登録・競合後のデータ不変のテストを追加する。
5. 設計判断、テスト結果、未確認事項をサイトの調査メモへ残す。

この教材はメモリ内のRepositoryを使う単体テストです。HTTPサーバー・実DB・ネットワーク負荷試験ではありません。実HTTPとSQLiteの演習はサイトの「小プロジェクト」へ進みます。ブラウザに出るモデルと、手元のコンパイラの実測を分けてください。

## Java（JDK 17以上・追加ライブラリ不要）

ZIPの展開先で次を順に実行します。

```text
javac -encoding UTF-8 --release 17 -d java-out workplace-java/BookService.java workplace-java/WorkplaceTest.java
java -cp java-out WorkplaceTest
```

終了時の実測が `8 passed, 0 failed` なら同梱テストは成功。テストにない不具合がないという保証ではありません。

## Rust（stable・外部crate依存なし）

```text
cargo test --manifest-path workplace-rust/Cargo.toml --offline -j 2 -- --test-threads=2
```

終了時の実測が `7 passed; 0 failed` なら同梱テストは成功。最初の実行でもcrateをダウンロードしません。Rust本体のインストールは別途必要です。

## 共通仕様

- IDはASCII数字のみ。先頭0は許可。値は1〜2,147,483,647。空・符号・小数・桁超過は拒否。
- Javaのnullも拒否。Rustの&strにはnull値がない。
- タイトルは原文を保持する。空文字と、ASCIIのスペース・タブ・CR・LFだけの文字列は拒否（この練習の明示的なルール）。Javaのnullも拒否。
- 更新元versionは1以上。ID・タイトル・versionが不正ならRepositoryの更新前に失敗。
- 未登録の更新はMissing。更新元versionが古ければConflict。競合時にデータを変えない。
- 成功時だけタイトルを書き換え、versionを1増やす。
- Javaは同期メソッド、Rustは排他的な&mut借用で、このメモリ内モデルの照合と更新をまとめている。別プロセスや実DBの原子性を保証する仕組みではない。
- 実DBに移す場合は、WHERE idとversionの条件を含める等の原子的な操作と更新件数判定を別途実装・試験する。

## 次の成果物

要件定義→基本設計→詳細設計→実装→単体→結合→総合→リリースの8工程はサイトの「実務の流れ」で作成できます。ZIPでまとめて保存し、実行した結果と未解決事項を追加してください。

回答例はSOLUTION.mdにあります。自分で実装してから比較することを勧めます。教材は実務経験・資格・業務サービスのリリース承認を付与するものではありません。
