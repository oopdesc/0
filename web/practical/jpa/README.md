# Hibernate/JPA 実務ワークショップ

4つの不具合を直し、実際のHibernateとH2メモリDBで確かめます。Java 17以上、Mavenが必要。初回は無料のMaven Centralから依存ライブラリを取得します。クラウド・API課金・外部DBは不要です。配布ZIPにJARは含めません。

## 始め方

1. ZIPを新しい学習用フォルダへ展開する。
2. 展開先で `mvn -T 2 test`。開始時は8件中4件が失敗するように作っています。
3. 次の4点を一つずつ直し、同じテストを再実行する。期待値を変更して失敗を隠さない。
4. 自分の設計判断・SQL回数・競合・rollbackの実測をサイトの調査メモに残す。

## 直す場所

|場所|症状|考えること|
|---|---|---|
|Book.version|古い版でも上書きされる|JPA標準のバージョン属性と更新時の照合|
|BookQueries.listBooks|3冊の一覧でSQLが4回|このユースケースで必要な関連を先に取得する|
|BookQueries.findByTitle|入力の引用符がクエリの意味を変える|JPQLとパラメータを分離する|
|BookQueries.renameThenFailForExercise|例外が出たのに変更が残る|commit前の失敗とrollback|

修正後の期待は8件すべて成功。成功しても実サービスの完成・実務経験・リリース承認の証明ではありません。認証、HTTP、実運用DB、コネクションプール、ページング等はこの小課題の範囲外です。

## 重要な違い

- この課題のversion初期値はJPAの既定で0。実務演習室の手書きモデルで使う初期値1と取り違えない。
- JPAはAPIの仕様、Hibernateはその実装の一つ。SpringやSpring Bootはこの課題で使わない。
- 同じEntityManager内の同じIDは同一の管理対象。閉じた後のdetachedオブジェクトを変更しても、自動でDBへ保存されない。
- @ManyToOneをLAZYにしただけではN+1は防げない。必要な関連をユースケースごとに取得する。複数コレクションやページングではjoin fetchの制約・取得行増大も別途検討する。
- 例外の型が何でもよいわけではない。競合テストは原因にOptimisticLockExceptionがあることまで確認する。
- H2はUUID付きの隔離したメモリDBをテストごとに作成・破棄する。会社のDBや既存のローカルDBへ接続しない。設定を本番DBへ向けない。

## 公式資料と固定バージョン

確認日2026-11-11。Hibernate ORM 7.4.15.Final（公式リリース2026-11-06、Java 17対応）、H2 2.3.232、JUnit 5.11.4を教材用に固定しています。将来の最新版を常に自動取得する設定にはしていません。

- https://hibernate.org/orm/releases/7.4/
- https://docs.hibernate.org/orm/7.4/introduction/html_single/#version-attributes
- https://docs.hibernate.org/orm/7.4/introduction/html_single/#join-fetching
- https://docs.hibernate.org/orm/7.4/introduction/html_single/#query-parameters
- https://docs.hibernate.org/orm/7.4/introduction/html_single/#transactions

自作教材の利用条件は同梱COPYRIGHT.txt。依存ライブラリの権利とライセンスは各提供元に帰属します。回答例はSOLUTION.mdで、自分で試してから比較できます。
