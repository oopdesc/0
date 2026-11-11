# 無料ホスティングの運用判断

確認日：2026-11-11。月額・HTTPS証明書の発行と自動更新が無料のサービスだけを比較した。独自ドメインの購入・更新代は別。料金が一生変わらない保証は、どのサービスについても確認できない。

## 結論

現在のアクセス量ならVercel Hobbyを維持できる。容量を空けるために他のプロジェクトを削除する必要はない。静的配信の長期移転候補はCloudflare Pages Freeを第一候補にする。既存URLを変える作業や新規アカウント作成は実施していない。

サイトは静的ファイルだけを配信する。教材の実行・保存・アートの描画は閲覧者のブラウザで行い、常駐API、課金AI API、有料DB、Pages Functions、Workers有料プランを追加しない。将来の利用者急増や規約変更を含めた「永久・無制限・必ず停止しない」は保証できない。

## 実際の月間使用量

Vercel管理画面のHobby、All Projects、Last 30 Daysを実際に閲覧。画面の期間表示は `Oct 11, 23:00 - Nov 10, 22:00`。暦月11月だけの数字ではなく、アカウント全体の直近30日間。画面表示の丸めを含む概算。

|項目|使用量 / 無料枠|使用率|未使用の割合|
|---|---:|---:|---:|
|Fast Data Transfer|476.75MB / 100GB|約0.477%（0.048割）|約99.523%|
|Fast Origin Transfer|13.94kB / 10GB|約0.000139%|約99.999861%|
|CDN Requests|15,280 / 1,000,000|1.528%（0.153割）|98.472%|
|Build Time|約26分 / 100時間|約0.433%|約99.567%|
|Function Invocations|38 / 1,000,000|0.0038%|99.9962%|

当該サイトだけの表示は転送461.19MB、CDN Requestsは約13K。上表は別プロジェクトも含むため、上表で安全余裕を判断する。このサイトの今回の成果物にFunctionsは0本。アカウント全体の38回をこのサイトの実行回数だとは断定しない。

通信・リクエスト・ビルドの中で最も使っているのはリクエストの1.528%。単純な同一利用パターンなら約65倍で上限に届く計算だが、ボットや動画視聴でパターンが変わるため、利用者数が65倍まで安全という意味ではない。予告なく急増するアクセスまで無条件に保証しない。

Hobbyは通常、使用上限に達すると対象機能の再開を待つ方式。自動的にProへ変更する設定は行っていない。超過しても無制限に配信できるわけではない。[Hobbyの条件](https://vercel.com/docs/plans/hobby)

## 比較：無料枠と無料HTTPS

|順位・位置づけ|サービス|静的配信の無料条件|HTTPS|このサイトでの判断|
|---|---|---|---|---|
|長期移転の第一候補|Cloudflare Pages Free|静的リクエスト・帯域は公式にunlimited。月500ビルド、同時1、20,000ファイル、1ファイル25MiBまで|標準ドメインでSSL付き。独自ドメインも正しく設定すれば無料証明書の発行・更新|大規模な静的学習サイト向き。FunctionsやR2は別枠なので使わない。利用規約・濫用対策は適用される|
|現行を維持|Vercel Hobby|転送100GB、Origin10GB、CDN100万回等。個人・非商用限定|標準ドメインで無料。証明書更新の購入不要|今の実使用は低い。現行URL・既存認証を維持できる|
|小規模な予備候補|GitHub Pages（公開repo）|公開サイト1GB、帯域100GB/月のソフト上限。商取引中心のサイトや商用SaaS用途は禁止|github.ioでHTTPSを標準提供。適切な独自ドメインも対応|将来の帯域拡大策にはならず、SPAルートや応答ヘッダーの調整も必要|
|今回の移転先には選ばない|Netlify Free（新規クレジット制）|月300クレジット。成功した本番デプロイ1回15。転送等も共用し、上限で停止|標準ドメイン無料。管理証明書は無料・自動更新|頻繁な本番改修と利用者増の両立では不利。既存Legacyプランは別条件|

Cloudflareのunlimitedは静的配信の公開プラン条件であり、将来の料金固定、無制限なファイル保存、利用規約免除の意味ではない。無料の `*.pages.dev` を使えば独自ドメインの購入費も不要。

一次資料：

- [Cloudflare Pages製品・無料プラン](https://www.cloudflare.com/products/pages/)
- [Cloudflare Pages制限](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflareの無料証明書と更新](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/)
- [Pages独自ドメイン](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [GitHub Pages制限](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Netlifyクレジット制](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
- [Netlify無料プラン比較](https://www.netlify.com/pricing/personal-vs-free/)
- [Netlify HTTPS](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/)

## 一人でVercelを複数アカウント使えるか

個人用・仕事用などのアカウント切替は[公式CLI教材](https://vercel.com/academy/python-on-vercel/install-vercel-cli)でも説明されている。ただし複数アカウントによるFair Use・使用上限・セキュリティの回避は[Acceptable Use Policy](https://vercel.com/legal/acceptable-use-policy)で禁止されている。無料枠を複数アカウントで積み上げる運用は採用しない。新しいVercelアカウントも作成していない。

## 書籍・商用利用に関する条件

Hobbyは個人・非商用限定で、[Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)は商品の販売広告も商用の例に含める。著作権を保有すること自体と、販売広告として運用することは別。

現サイトは価格やAmazonへの購入CTAを置かず、無料で読めるGitHub本文・書籍一覧へのリンクを表示する。Kindle販売先はGitHub側で確認できる。Vercel上で販売広告を強化する場合、無料枠の使用量が少なくてもHobbyで適法に続けられるとは保証しない。条件に合う別ホスティングへ移すか、Vercelの公式判断を得る必要がある。今回、勝手に有料プランへ変更しない。

## 移転を容易にする準備

`npm run build` 成功後、`node tools/prepare-pages-export.mjs` を実行すると、検査済みの公開ファイルだけを一時ディレクトリに複製する。Cloudflare用の `_redirects`・`_headers`・`404.html` を追加する。Vercelの設定と公開URLは変更しない。アカウント作成・デプロイ・DNS変更・契約は行わない。

移転時は次の順番で行う。

1. 学習記録はorigin別のlocalStorageなので、**旧URLでバックアップJSONを書き出す**。保存済み下書き・ノートも確認する。
2. Cloudflare FreeのPages静的サイトへ、検査済みファイルを公開する。Functions、有料Workers、R2、課金追加は有効にしない。
3. `pages.dev` のHTTPS、/learn・/art・/books・/rightsの直リンク、Wasm、CSP、補充教材JSON、ZIP保存を確認する。
4. **新URLでバックアップJSONを取り込み**、記録・下書き・ノートが読めることを確認する。自動で引き継がれるとは扱わない。
5. その後にリンクを切り替える。旧サイトの削除は復元と確認を済ませた後に限る。現時点では他プロジェクトを削除しない。

## 継続監視の目安

50%で変化の原因を調べ、80%に達する前に配信削減・移転を準備する。これは内部運用の目安で、Vercelの公式閾値ではない。動画の自動読込を増やさず、教材を必要時に読み込む。利用者数と転送量を混同せず、アカウント全体の複数メーターを確認する。
