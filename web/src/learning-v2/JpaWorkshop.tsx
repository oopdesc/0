import { useState } from "react";

const goals = [
  {
    title: "バージョンと楽観ロック",
    file: "Book.java",
    test: "staleVersionCannotSilentlyOverwrite",
    symptom: "2人が同じ本を読み、Aのcommit後にBが古い版で上書きできてしまう。",
    hint: "versionというフィールド名だけでは、JPAのバージョン属性になりません。JPA標準のマッピングと更新時の照合を調べてください。既定の初期値は0です。",
  },
  {
    title: "一覧取得とN+1",
    file: "BookQueries.listBooks",
    test: "authorsAreFetchedWithoutNPlusOne",
    symptom: "3冊と3人の著者を表示するだけなのに、SQLが4回実行される。",
    hint: "LAZYは必要時に別の問い合わせが発生する可能性があります。この一覧で必要な著者を先に取得する方法を考え、authorName参照まで含むSQL回数で比較します。すべての関連をEAGERに変えるのが一般解ではありません。",
  },
  {
    title: "JPQLのパラメータ化",
    file: "BookQueries.findByTitle",
    test: "queryParameterIsLiteralData",
    symptom: "入力した引用符やORが検索条件の構造を変えてしまう。",
    hint: "入力をクエリ式へ連結せず、名前付きパラメータとして渡します。手作業で引用符を置き換える方式にせず、式と値を分けることを確認します。",
  },
  {
    title: "失敗とロールバック",
    file: "BookQueries.renameThenFailForExercise",
    test: "failureBeforeCommitRollsBackTheChange",
    symptom: "例外が発生したのに、タイトルの変更が保存先に残る。",
    hint: "commit済みの処理を、その後のrollbackで巻き戻すことはできません。意図的な失敗をcommit前に起こし、activeなtransactionをrollbackする経路を確認します。",
  },
];
export default function JpaWorkshop() {
  const [goal, setGoal] = useState(0),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function download() {
    setBusy(true);
    try {
      const { fetchJpaArchive } = await import("./jpaArchive");
      const data = await fetchJpaArchive();
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(data).buffer], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "hibernate-jpa-workshop.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        "JPAの開始コード・8件のテスト・回答例を保存しました。最初は4件の失敗を確認し、自分で直して再実行します。",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "教材を保存できません。");
    } finally {
      setBusy(false);
    }
  }
  const current = goals[goal];
  return (
    <section aria-labelledby="jpa-title">
      <h3 id="jpa-title">Hibernate/JPAを実装して学ぶ</h3>
      <p>
        本物のORMとH2メモリDBで、4つの不具合を一つずつ直す課題です。手元のJava
        17以上とMavenを使い、サイト上ではサーバーやDBを起動しません。
      </p>
      <label className="workflow-stage-picker">
        取り組む観点
        <select value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
          {goals.map((g, i) => (
            <option key={g.title} value={i}>
              {i + 1}. {g.title}
            </option>
          ))}
        </select>
      </label>
      <div className="lab-result">
        <h4>{current.title}</h4>
        <p>{current.symptom}</p>
        <p>
          編集箇所：<code>{current.file}</code>
          <br />
          確認するテスト：<code>{current.test}</code>
        </p>
        <details key={current.title}>
          <summary>考える手がかり</summary>
          <p>{current.hint}</p>
        </details>
      </div>
      <div className="workflow-actions">
        <button disabled={busy} onClick={() => void download()}>
          {busy
            ? "課題を準備しています…"
            : "Hibernate/JPAの開始コードとテストをZIP保存 ↓"}
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      <details className="workflow-example">
        <summary>実行手順と、何が検証されるか</summary>
        <p>
          ZIPを新しい学習用フォルダに展開し、そこで <code>mvn -T 2 test</code>{" "}
          を実行します。最初は8件中4件が失敗し、4つの修正後は8件の成功を目指します。初回はMavenが依存ライブラリを取得します。無料の公開ライブラリで、JARはサイトから配信しません。
        </p>
        <p>
          管理対象とdetached、同一EntityManager内の同一性、commit済み変更も制御テストで確かめます。テストごとに隔離したメモリDBを作成・破棄します。HTTP・実運用DB・Springはこの課題に含みません。
        </p>
      </details>
      <details className="workflow-example">
        <summary>バージョン・公式の根拠・次の工程</summary>
        <p>
          2026-11-11確認。Hibernate ORM 7.4.15.Final、H2 2.3.232、JUnit
          5.11.4を固定しています。JPAのversionはこの課題では初期値0。手書きモデルの初期値1との違いを設計に記載してください。
        </p>
        <p>
          <a
            href="https://hibernate.org/orm/releases/7.4/"
            target="_blank"
            rel="noreferrer"
          >
            公式のリリースと互換性 ↗
          </a>
          　
          <a
            href="https://docs.hibernate.org/orm/7.4/introduction/html_single/"
            target="_blank"
            rel="noreferrer"
          >
            公式ガイド ↗
          </a>
        </p>
        <p>
          <a href="/learn?section=workflow&stage=detail">
            詳細設計に判断を残す →
          </a>
          　
          <a href="/learn?section=workflow&stage=integration">
            結合試験に実測を残す →
          </a>
        </p>
      </details>
    </section>
  );
}
