# 4つの最小修正

## 1. バージョン属性

Book.javaのversionフィールドへJPA標準の `@Version` を付ける。単にversionという名前のフィールドを用意するだけでは、Hibernateは楽観ロックとして扱わない。

## 2. 一覧で必要な著者をまとめて取得

```java
em.createQuery("select b from Book b join fetch b.author order by b.id", Book.class)
```

この題材は一冊に一人の著者というManyToOne。3冊を異なる著者にして、取得後のauthorName参照まで含めてSQL1回を確認する。関連をすべてEAGERに変更するのは一般解ではない。

## 3. パラメータとして渡す

```java
return em.createQuery("select b from Book b where b.title = :title", Book.class)
    .setParameter("title", title).getResultList();
```

入力はクエリ式の一部ではなく、値として束縛する。手作業で引用符を置き換える方式へ変えない。

## 4. commit前の失敗をrollback

renameThenFailForExercise内の、意図的に置かれた `tx.commit();` の行を外す。変更後に発生させる演習用例外をcatchし、activeなtransactionをrollbackする。これで失敗した変更を保存しない。通常の成功処理では、すべての必要な処理が成功した後にcommitする。この課題は失敗経路を再現するための専用メソッド。

修正後は同じ `mvn -T 2 test` を実行し、8件の成功を自分の環境で確認する。SQL1回という目標はこの小さなユースケースに対するもので、すべての一覧処理で常に正解になるわけではない。
