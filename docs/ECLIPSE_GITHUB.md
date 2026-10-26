# EclipseからGitHub・本番へ反映する

対象はこの個人リポジトリだけです。会社のリポジトリやSourceTreeの設定は使いません。

## 最初の確認

- Eclipseに既存のEGitとMavenが入っています。新しいEclipseのコピーは不要です。
- Git Repositoriesビューで、このチェックアウトの .git を追加できます。各projectのTeam → Share Project → Gitからも既存リポジトリを選べます。
- remoteは https://github.com/oopdesc/0.git です。認証情報をURLへ埋め込みません。
- GitHubのブラウザログインと、Git/EGitのPush認証は別です。初めてPushするときは、利用者自身のGitHubアカウントで認証してください。

## 日々の変更

1. EGitで新しい作業ブランチを作ります。例：feature/java-array-practice。
2. Eclipseで編集し、Run/Debugで値を確認します。
3. 実行 → 外部ツール → Portfolio — 全体を検証を実行します。
4. Git Stagingで差分を読み、公開してよいファイルだけをStageしてCommitします。原稿・秘密・.env・個人文書を入れません。
5. Team → Push Branchで作業ブランチをPushします。既存のSSH認証か、公式画面で本人が設定したGitHub認証を使います。パスワードやtokenをソース・チャットへ書きません。
6. GitHubでPull Requestを作り、Vercel Previewの画面と検査結果を確認します。
7. mainへマージすると、既存のVercel連携が本番を更新します。更新後に直URL、画像、演習、旧文書URLの404を確認します。

外部ツールの「0 — 現在のブランチをPush」は、このリポジトリの作業ブランチだけを通常Pushします。main・detached HEAD・別remote・未commit差分がある状態では止まります。自動Commit、force push、全branch一括Pushはしません。認証は別に必要です。

「0 — Pull Requestを開く」は現在の作業ブランチの比較ページを開きます。本番への直接Pushを行う入口ではありません。

## Javaの2つの実行環境

Portfolio_Browser_JavaのGalleryRulesTest / PracticeEngineTestをJVMのDebugで止めて、分岐と変数を確かめます。ブラウザ用に再生成した後は、ページを再読込みして同じ入力を試します。verifyはJVM版とTeaVM版の結果を照合します。

ブラウザ上の実行をJavaのJVM Debugへ自動接続する設定ではありません。ブラウザの描画・ネットワークを調べるときは、そのブラウザの開発者ツールを使います。
