# このサイトで学ぶ言語と順番

Javaの処理を実際に動かし、変数と分岐を追うことを入口にしています。言語の将来の順位を予測するための構成ではありません。

| 順番 | 言語・役割 | 最初の変更例 |
|---:|---|---|
| 1 | Java 21 / 表示設定・演習・localhost API | 入力の上限を変え、テストを足し、ブラウザで結果を確かめる |
| 2 | Rust / 座標生成・WebAssembly | seedと点の分布を変更し、境界と再現性をテストする |
| 3 | HTML・CSS / 構造と見た目 | ラベル、余白、キーボード操作、狭い画面の配置を調整する |
| 4 | TypeScript / 画面の接続部分 | Javaの戻り値を表示し、保存データを実行時にも検証する |
| 応用 | GLSL / GPUの描画 | Rustが生成した点の回転と色を変える |

Javaは[TeaVM](https://teavm.org/docs/intro/overview.html)でブラウザ用JavaScriptへ変換します。閲覧者のMacやスマートフォンにJDKは不要です。既存のReact/TypeScriptは画面の部品とブラウザAPIをつなぐために残し、演習や表示設定の判定をJavaへ寄せています。

ブラウザはHTML/CSS/JavaScriptを実行するため、Javaを書けばWebの基礎が不要になるわけではありません。Rustを使うだけで描画が必ず速くなるわけでもありません。このサイトでは、座標をまとめて生成する処理をRust、画面の状態とDOMをTypeScript、演習と入力の判定をJavaに分けます。

公開版は静的配信です。JavaとRustのlocalhost APIはHTTPやデバッグを学ぶときに手元で起動します。JavaのJVMをVercelの標準Functionsへ載せる構成にはしていません。

## 公式の確認先

- [TeaVMの概要](https://teavm.org/docs/intro/overview.html)
- [TeaVMのMaven設定](https://teavm.org/docs/tooling/maven.html)
- [Rustのwasm32 target](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html)
- [Vite](https://vite.dev/guide/)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)

コードの責任範囲は `ARCHITECTURE.md`、Eclipseからの編集・公開手順は `ECLIPSE_GITHUB.md` にあります。
