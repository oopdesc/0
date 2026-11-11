import { strToU8, zipSync } from "fflate";
import { emptyPractice, parsePractice, type ContractCase } from "./practiceLab";
import { siteUseNotice } from "../site-use-notice";

export function makeHttpSuiteArchive(
  cases: ContractCase[],
  runner: string,
): Uint8Array {
  if (
    typeof runner !== "string" ||
    !runner.length ||
    new TextEncoder().encode(runner).byteLength > 30000
  )
    throw Error("実HTTP確認スクリプトを読み取れません。");
  const checked = parsePractice(
    JSON.stringify({ ...emptyPractice(), cases }),
  ).cases;
  const readme = `# 自分で設計した試験を、実HTTPの応答と比べる

Python 3の標準ライブラリだけを使います。外部API・AI・クラウド実行・課金はありません。スクリプトはダウンロードしただけでは実行されません。

1. ZIPを新しい学習用ディレクトリへ展開する。
2. 自分の学習用HTTPサーバを起動する。会社の環境は使わない。
3. 展開先で、明示的に次を実行する（Java/H2小課題の例）。

    python3 check_contract.py http://127.0.0.1:18423

Rust/SQLite教材は18082、別のJava/SQLite参考実装は18080。IPのloopbackだけを受け付け、プロキシやリダイレクト先へは接続しません。

## 期待値が違うとき

この試験項目は実務演習室の共通契約に基づきます。既存の小課題はID範囲・先頭0・version・requestId等の仕様が違います。先に要件と設計を照合し、どちらの契約を実装するか決めてください。失敗を隠すためだけに期待値を変えないでください。

既定のID=1の書名は、共通モデルでは「Java」、Java/H2では「Java入門」、Java/SQLite・Rust/SQLiteでは「JavaでHTTPを学ぶ」です。エラーのrequestIdは共通モデルとJava/SQLiteで文字列、Rust/SQLiteで数値、Java/H2では未実装です。「安全なエラー」のチェックは文字列のrequestIdを検査するため、既存教材で失敗する場合も契約差を調査してください。未改修の既存契約を試すときは、その別の試験項目書を保存し、未検査の項目を合格に読み替えないでください。

成功JSONのversion=1は共通の初期データの契約です。更新済みのDBなら状態をそろえるか、その試験の期待値を設計し直します。モデルはID文字列を直接受け取るため、空文字・スラッシュ等は実HTTPの経路解釈との差も確認します。

## 保存先停止の項目

既定ではrepository=readyだけを実行し、downの項目はスキップします。準備済みの学習用障害環境でだけ、--repository downを指定して別に実行します。このオプションはサーバやDBを停止させません。

    python3 check_contract.py http://127.0.0.1:18082 --repository down

0=実行した項目が一致、1=失敗あり、2=設定不備または対象0件。スキップした項目は合格ではありません。最大12項目を順に実行する契約確認で、負荷試験・完全なセキュリティ監査・リリース承認ではありません。

結果を演習室のメモや工程別の試験項目書に記録してください。
`;
  return zipSync(
    {
      "README.md": strToU8(readme),
      "contract-suite.json": strToU8(
        JSON.stringify(
          { schema: "zero-http-contract/1", cases: checked },
          null,
          2,
        ) + "\n",
      ),
      "check_contract.py": strToU8(runner),
      "COPYRIGHT.txt": strToU8(siteUseNotice),
    },
    { level: 6, mtime: new Date("2026-11-11T00:00:00Z") },
  );
}
