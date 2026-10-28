# Javaの処理フローと小プロジェクト（学習用・途中）

JDK 17以上とMavenが必要です。依存するH2とJUnitはMavenが取得します。公開サイトの画面を開くだけでは何も起動せず、localhostにも自動接続しません。サンプルのDBはH2の隔離されたメモリ内DBで、プログラム停止時に消えます。既存DB、社内DB、認証設定を使わないでください。書籍APIはGET/POST/PUT/DELETEを持つ学習用の限定的なCRUD例で、認証・永続化・運用を備えた本番製品ではありません。

## コマンドライン

配布ソースのルートで実行します。

```sh
mvn -f backend/java-learning-v2/pom.xml test
mvn -f backend/java-learning-v2/pom.xml compile exec:java
```

2番目は手元の `127.0.0.1:18423` に学習用APIを起動します。本人が明示して起動したときだけ、手元のブラウザで `http://127.0.0.1:18423/api/books/1` にアクセスして応答を確認できます。終了は起動した端末で Ctrl+C。ポートが使用中なら実行できません。外部へ公開しないでください。

各プロジェクト課題のZIPは1課題ずつ別の開始状態です。ZIPを新しい空ディレクトリに展開し、添付の `README-START.md` にある対象ファイルと固定のテストコマンドを確認してください。テスト前の課題は未完成なので失敗します。ZIPにはソースとテストがあり、ビルド成果物は入っていません。変更したファイルを別の課題に流用する場合、開始状態が変わることに注意します。

## Eclipseに取り込む

1. 自分の学習用コピーを用意し、Eclipseを起動します。既存の業務プロジェクトやSourceTreeは変更しません。
2. **File → Import → Maven → Existing Maven Projects** で、そのコピーにある `backend/java-learning-v2` を選択します。絶対パスを教材に固定しません。Maven/JDK設定でJava 17以上を選びます。
3. Package Explorerで `src/test/java` のテストクラスを右クリックし、**Run As → JUnit Test**。または上記のMavenコマンドを端末で実行します。Maven依存が取得できない場合は未実行として、接続環境を確認します。
4. `zero.learning.App` を **Run As → Java Application** で本人が起動できます。H2の依存がMavenのクラスパスに入っていることを確認してください。停止はConsoleの赤い停止ボタンです。

## Debugと差分

- `BookController` の入力検証や `BookRepository` のSQL付近を開き、行番号左の余白をダブルクリックしてブレークポイントを置きます。
- `App` を **Debug As → Java Application** で起動し、手元で明示的にGETします。Debugパースペクティブで変数を確認し、**Step Into** で呼び出し先、**Step Over** で次の行、**Resume** で再開します。HTTPリクエストを止めたままにせず終了します。
- JUnitテスト自体も **Debug As → JUnit Test** で実行できます。ブラウザにある固定TeaVM教材の実行と、手元JVMのデバッグは別物です。
- Git管理された自分の学習コピーなら、変更前後は `git diff -- backend/java-learning-v2` で確認できます。ZIPで配布されたコピーはGit履歴を含まないため、このコマンドには別途自分のリポジトリ化が必要です。

## 範囲と未完成

書籍API、復習予定、検索の3題材は制作途中です。各題材に8課題があります。実サイトとの統合、永続化、および必要な前提単元の全体は未完成です。1/3/7/14/30日の復習間隔は初期例で、全員に最適と保証しません。テストを通った範囲と、実際の利用環境での安全性は別に考えてください。
