# THIRD PARTY NOTICES

このリポジトリは、次のソフトウェアと作品の上に成り立っています。ライセンス本文は配布物に含めています（`node_modules` は ZIP に含めていませんが、依存はすべて MIT / ISC / Apache-2.0 です）。

---

## 1. 宇宙ページの着想元

**ULuIQ12 / webgpu-tsl-linkedparticles**
<https://github.com/ULuIQ12/webgpu-tsl-linkedparticles>

```
MIT License

Copyright (c) 2024 Christophe Choffel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### このリポジトリでの扱い

- **着想**: 「カーソルの近くに粒子が生まれ、近い粒子どうしが細い線で結ばれる」という構図は、この作品から受けています
- **実装**: 当リポジトリの `src/space/webgpu.ts` / `webgl2.ts` / `engine.ts` / `quality.ts`、`wasm/space-core/src/lib.rs` は、Three.js も TSL も使わず、**WGSL / GLSL / Rust で新しく書いたもの**です。コードのコピーはありません（Three.js のノード API に依存しないため、構造も異なります）
- それでも、着想と構図へのクレジットとして、上記の MIT 表示を保持します。各ファイルの冒頭にも同じクレジットを書いています
- 元作品が「linked particles」として公開している以上、この実装も同じ系譜にあると明示するのが誠実だと判断しました

該当ファイル冒頭のコメント:

```
 * リンク粒子の着想: ULuIQ12/webgpu-tsl-linkedparticles
 *   MIT License, Copyright (c) 2024 Christophe Choffel
 *   コードは TSL を使わず WGSL / GLSL / Rust で書き直している。
```

---

## 2. 実行時の依存

| パッケージ | 版 | ライセンス | 用途 |
| --- | --- | --- | --- |
| react | 19.3.1 | MIT | UI |
| react-dom | 19.3.1 | MIT | 描画 |

この 2 つ以外に、ブラウザで動くコードはありません。ルーター、差分（LCS）、シンタックスハイライト、SRS、Java エンジン、宇宙の描画はすべて当リポジトリ内の実装です。

## 3. ビルド時の依存（配布物には含まれない）

| パッケージ | 版 | ライセンス |
| --- | --- | --- |
| vite | 8.3.5 | MIT |
| @vitejs/plugin-react | 6.1.2 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| tsx | 4.20.6 | MIT |
| jsdom（テスト） | 26.1.0 | MIT |
| @webgpu/types（型のみ） | 0.1.66 | BSD-3-Clause |
| @types/node, @types/react, @types/react-dom, @types/jsdom | — | MIT |

## 4. 処理系（教材の検証に使用。再配布はしない）

- **OpenJDK 21.0.13**（Adoptium / Eclipse Temurin）: GPLv2 + Classpath Exception。教材の出力・例外・コンパイルエラーの検証に使用
- **rustc 1.99.1**: MIT / Apache-2.0 デュアル。Rust 教材のコンパイル判定と実行結果の検証、WASM のビルドに使用

どちらも ZIP には含めていません。`verify:java` / `verify:rust` は、利用者の環境にある処理系を呼び出します。

## 5. 教材の内容について

- Java / Rust の言語仕様に関する記述は、OpenJDK 21 と rustc 1.99.1 の実際の挙動に基づいています。**版に依存する挙動は `langVersion` に版を明示**しています
- 特定の書籍・講座の文章を写した箇所はありません
- 著者の本（`https://github.com/oopdesc/all-beings-flourishing`、CC BY-SA 4.0）は `/about` からリンクしているだけで、本文・図・問題を教材に取り込んでいません。CC BY-SA の継承が及ぶ範囲を、このリポジトリの MIT 部分に広げないための分離です

## 6. 画像・フォント・音声

外部から取得した素材はありません。詳細は `MEDIA_CREDITS.md`。
