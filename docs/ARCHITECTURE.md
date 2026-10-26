# 実行場所とコードの分担

```text
公開：Browser → Vercel CDN → HTML / CSS / React
                            ├ Java → TeaVM → JavaScript
                            ├ Rust → WebAssembly（学習モデルを選んだとき）
                            └ NASAの観測画像・科学可視化

開発：Browser → Vite (127.0.0.1:18420)
                    ├ /local/java → Java 21 (127.0.0.1:18421)
                    └ /local/rust → Rust API (127.0.0.1:18422)
```

公開版のJava演習は閲覧者のブラウザ内で実行します。VercelでJVMを起動したり、開発用のMacへ接続したりはしません。Javaの任意コードを実行するサービスでもありません。用意した4つの処理に、長さを制限した入力を渡します。

## Javaを読み始める場所

- `frontend/java/.../GalleryRules.java`：3つの天体資料の一覧、表示設定と入力の範囲。
- `PracticeEngine.java`：整数の範囲、文字列検索、配列コピー、JSONのエスケープ、復習間隔。
- `ArtBridge.java`：ブラウザから呼ぶ関数の入口。
- `backend/java`：HTTPの別教材。localhost専用、外部DB・外部API・ファイルへの書込みなし。

純粋なJava処理をJVMとTeaVMの両方で実行し、固定入力の結果を照合します。Javaの変更後は `./tools/portfolio.sh java-browser` でブラウザ用コードを再生成します。生成物を直接修正しません。

## 画面と保存

- `App.tsx`：ナビゲーション、検索、お気に入り、トップページ。
- `Learning.tsx` / `JavaPractice.tsx`：教材、実行前の予想、Java演習、復習日。
- `state.ts`：localStorageを読み込む際の検証。既知の教材IDと値の範囲だけを受け入れます。
- `ArtStudio.tsx`：観測画像、科学可視化、学習モデルの切替えと表示操作。

演習の入力・予想・自由記述の回答は画面の一時状態だけに置きます。学習済み項目、お気に入り、復習日、再生設定はそのブラウザに保存します。会員登録、アクセス解析、AI APIの呼出しはありません。

## 宇宙の表示

標準表示はM51とM104の観測画像、またはNASAのブラックホール科学可視化です。画像の拡大・位置・明るさは表示の調整で、天体の実際の時間変化ではありません。出典と利用条件は `MEDIA_CREDITS.md` にまとめています。

別タブの学習モデルでは、Rustが最大32,000点の座標を生成し、WebAssemblyのメモリから描画用配列へコピーします。その後の回転はWebGL 2で描きます。厳密な重力計算や観測データの再現ではありません。最大24fps、描画領域240万pixel、画面外・非表示・視差軽減時の停止を設けています。GPUの利用率を保証する負荷制御ではありません。

## 公開前の境界

`tools/check-release.mjs` は静的成果物30MiB、全JavaScriptのgzip合計512KiB、単一asset20MiBを見直し用の上限とします。Java/Wasmの元ソースと生成物、宇宙画像のハッシュを確認し、個人文書・資格情報・リンクファイルの混入を拒否します。月間転送量は訪問数に依存するため、配信サイズの検査だけで無料枠内を保証するものではありません。

公開経路は個人の開発ブランチ → Pull Request → Preview確認 → main → Vercelです。Eclipseからの操作は `ECLIPSE_GITHUB.md` を参照してください。
