# 0

Java・Rustを動かして、結果を自分の言葉で説明するための学習サイトです。誰でも無料で使えます。

公開サイト： https://0-3gaz.vercel.app/

## 使い方

1. 「学習」でJavaかRustの問題を選び、答えを予想します。
2. 入力を変えて実行し、予想と違った理由を説明します。
3. 解答を閉じて説明できたかを記録し、日を空けてもう一度試します。

初期表示は日本語・ライトモードです。右上のボタンでダークモードへ切り替えられ、学習記録とは別に保存します。

通常・補充・試験・旧ブラウザ演習を合わせ、同じ問題の再掲をまとめると**2,098問**です（Java1,386問・Rust712問、2026年10月29日集計）。記述374問はこの内数です。「全問題から探す」で言語・難しさ・記述・教材を絞り、各設問へ進めます。絞り込みとページ位置はURLに残ります。[集計方法](docs/QUESTION_COUNT.md)も公開しています。

通常の問題集にはJava892問・Rust395問を収録しています（2026年10月29日）。コード記述365問はこの内数、Java6本・Rust6本の非公式試験は別集計です。うち10本は通常問題から選んだ復習試験で、初見の資格試験を再現したものではありません。単元はどこからでも選べます。答え・理由・誤答の説明を読み、解答を閉じて再挑戦できます。下書きと学習記録はこのブラウザに保存し、JSONで書き出せます。公開サイトから回答コードを外部の採点サービスへ送ることはありません。

「今日の学習」では、復習時期の問題、直近の誤答、書きかけのコード、未学習の順に候補を選べます。言語・段階・取り組み方を絞れます。順序は固定せず、別の問題へいつでも移れます。試験後は誤答・未回答・解答を見た問題から見直し、試験記録もJSONで書き出し・復元できます。

補充問題集にはJava630問・Rust500問があります。通常の問題集と一部が重なる別の問題集で、上部ナビから直接開けます。概念図ではJava71概念・Rust47概念の前提と次の一歩をたどり、関連する問題を選べます。

学習画面の「記録を書き出す」で学習記録をJSONに書き出し、別の端末へ手動で移せます。取り込みは既存の記録に統合し、学習済み項目とお気に入りを残します。クラウド同期やアカウント登録は使いません。

宇宙のページは、ドラッグやピンチで回転・拡大できる三次元モデルです。渦巻銀河・ブラックホールの円盤を、Javaのカメラ設定とRustの星の配置から描きます。観測資料のタブではM51・M104の観測画像とNASAのブラックホール可視化を比較できます。出典を表示し、観測写真・科学可視化・学習用モデルを区別しています。詳しい出典と利用条件は [MEDIA_CREDITS.md](MEDIA_CREDITS.md) に記載しています。

トップでは「光と塵のあいだ」という立体の星雲を動かせます。回転・拡大・停止・画像保存に対応し、描画できない端末には同じ作品の静止画を表示します。[つくり方と小さな実験](docs/NEBULA_RENDERER.md)を用意しています。太陽系は宇宙ページにまとめ、「流れる星塵」は作品一覧から外しました。

## 宇宙を操作する

- ドラッグで回転、スクロールや二本指のピンチで拡大。キーボードでも使える視点ボタンを用意しています。
- 星の配置の種を変え、同じ種なら同じ配置になることを確かめられます。
- 画面の画像と、同じ視点を開くURLを保存できます。URLはカメラの向き・距離・明るさ・種を記録します。
- 動きは上限24コマ/秒。非表示・画面外・OSの「動きを減らす」では停止します。描画画素数と星の数にも上限があります。

三次元モデルは観測画像を参考にした学習用の表現で、観測データの三次元復元や一般相対論のシミュレーションではありません。星の回転と雲の描画を分けて、ひとつずつ読めるようにしています。

## 手元で起動する

必要なもの：Node.js 24、JDK 21、Rust 1.88以降。Javaからブラウザ用コードを再生成するときはMavenも使います。Docker・APIキー・外部DBは不要です。

```sh
npm --prefix web ci --ignore-scripts
./tools/portfolio.sh web
```

http://127.0.0.1:18420 を開きます。

編集したJava・Rustを手元のコンパイラで採点するときは `./tools/portfolio.sh local-learning` を使います。Eclipseからの起動方法と制限は [手元でコードを実行する](docs/LOCAL_LEARNING.md) をご覧ください。公開版と同じ教材を使用し、固定テスト・境界ケース・編集後の再採点を確認できます。
HTTPの入力と応答、SQLへの値の束縛、版を確認する更新などを実装する26問も用意しています。境界ケースの再検証方法は [HTTPと保存の境界](docs/BACKEND_CONTRACTS.md) にあります。
「小プロジェクト」にはJava3題材とRust1題材があり、課題ごとの開始ZIPを取得できます。Rustの8課題ではHTTPの入力検査、JSON、楽観ロック、SQLiteへの永続化を扱います。ZIPを手元で編集してCargoテストを実行します。
対応する記述問題では「課題と固定テストを保存」から、編集中のコード・固定テスト・模範解答・実行手順をZIPで取得できます。展開先で `node run-tests.mjs` を実行します。JavaはEclipseへ取り込める設定も含みます。模範解答は別フォルダに置き、自分で書いたファイルだけを採点します。
公開版は静的サイトです。Javaをブラウザ用に変換したコードは生成済みなので、閲覧者にJDKのインストールは不要です。

必要なときだけ、別のConsoleでローカルAPIを起動します。

```sh
./tools/portfolio.sh java  # 127.0.0.1:18421
./tools/portfolio.sh rust  # 127.0.0.1:18422
```

`/code` の接続確認は開発版だけに表示されます。これらは公開Vercel上では動かしません。APIの9件の固定データはHTTPの練習用で、探索に並ぶ教材・資料の件数とは別です。

## Eclipseから編集・デバッグする

1. File → Import → General → Existing Projects into Workspaceを開き、このリポジトリを選びます。
2. Portfolio_Web / Portfolio_Java / Portfolio_Rust / Portfolio_Browser_Javaを取り込みます。Copy projects into workspaceとSearch for nested projectsはOFFです。
3. Portfolio_Browser_JavaはMavenプロジェクトです。依存が見つからない場合はMaven → Update Projectを実行します。JavaSE-21のJDKを使用します。
4. `Java_Browser_Model_Tests.launch` と `Java_Practice_Tests.launch` は通常のRun/Debugで動かせます。GalleryRulesやPracticeEngineにブレークポイントを置いて、変数を追います。Java_Browser_Model_TestsはDebug時にmainで一度停止します。F5で関数へ入り、変数を見てF6で進み、F8で最後まで実行できます。通常のRunでは停止しません。
5. 実行 → 外部ツールにはWeb起動、各テスト、Javaブラウザ用コードの再ビルド、Wasmの再ビルドを用意しています。

Eclipseの自動ビルドはJavaのコンパイルを行い、TeaVMへの変換は外部ツールから明示的に実行します。pomのm2e指定は、編集のたびにTeaVM変換を自動実行しないためのものです。

Javaのコードを変更したら、次を実行してページを再読み込みします。

```sh
./tools/portfolio.sh java-browser
```

109問の実行演習にある固定Javaコードを変更した場合は、`./tools/portfolio.sh problem-java-browser` で別のTeaVMモジュールを再生成します。このコマンドは既存のMavenキャッシュを使います。初回は `frontend/java-problems/pom.xml` の依存をMavenで取得してから実行してください。例外の学習に使うため、TeaVMの `strict` を有効にしています。任意の入力コードをコンパイルする機能ではありません。`verify` では、固定Java17件・Rust32件の出力や例外を実際のブラウザ用モジュールと照合します。

ブラウザで動くTeaVMコードと、JVMで動くJavaのデバッグは別の実行環境です。同じ純粋なJava処理を両方で使い、同一入力の結果をテストで照合します。JVMのデバッグでは分岐と変数を、ブラウザの開発者ツールでは描画と通信を確認できます。ブラウザ向けのソースマップはMavenのtarget/javascriptに生成します。

Rustの座標生成を変更したら、`rustup target add wasm32-unknown-unknown` を一度実行した後、`./tools/portfolio.sh wasm` で再生成します。

## 検証と公開

```sh
./tools/portfolio.sh verify
```

Java、Rust、保存データの検証、復習日の更新、JVM/TeaVMの一致、Wasmの境界、型検査、公開ビルドを確認します。生成したJava/Wasmと元ソースのハッシュが合わなければ公開ビルドを止めます。

公開手順は [ECLIPSE_GITHUB.md](docs/ECLIPSE_GITHUB.md) にあります。個人の開発ブランチをPushし、Pull RequestのPreviewを確認してmainへマージすると、Vercelが本番を更新します。新しい有料契約やVercel CLIの認証は不要です。GitのPush認証は利用者自身の既存認証を使います。

容量の確認はVercelのUsageで行います。現行のビルドには静的成果物30MiB、初回JavaScriptのgzip合計128KiB、全JavaScriptのgzip合計1MiB、単一ファイル20MiBという見直し用の上限を設けています。月間転送量は訪問数によって変わります。大きな動画の先読みは行いません。

## 構成

- `frontend/java`：表示設定、入力の判定、4つのJava演習、復習間隔。TeaVMでブラウザ用にも変換します。
- `backend/java`：localhost専用のHTTP API。Java 21のrecord・HTTP・入力検証を学びます。
- `backend/rust`：上限付きの星の座標生成と、localhost専用API。
- `web/src`：画面、保存、操作、GPUの描画。既存のTypeScript/Reactは画面の土台として残しています。
- `web/src/generated`：Javaから生成したコード。直接編集しません。
- `web/public/cosmos`：出典を明記した観測画像と科学可視化。

表示設定と演習を変更するときは、frontend/javaから読み始めてください。画面の部品はweb/src、三次元カメラとシェーダーはweb/src/art/universe3d.tsに分けています。

## 利用条件

この版のソフトウェアはMIT Licenseです。依存ライブラリ・画像・動画にはそれぞれの利用条件が適用されます。[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) も確認してください。
