export function LicensesPage() {
  return (
    <div className="page page--read">
      <h1>ライセンス</h1>

      <section>
        <h2>このサイト</h2>
        <p>MIT License. 教材データ・実行エンジン・宇宙ページのコードを含みます。</p>
        <pre className="license">
{`MIT License

Copyright (c) 2026 0 learning space

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
SOFTWARE.`}
        </pre>
      </section>

      <section>
        <h2>着想と参考</h2>
        <p>
          宇宙ページの「近傍粒子を線で結ぶ」という着想は、ULuIQ12/webgpu-tsl-linkedparticles（MIT, Copyright (c) 2024
          Christophe Choffel）に触発されたものです。このサイトの実装は独自に書き起こしていますが、
          着想元への謝辞をここに記します。詳細は同梱の THIRD_PARTY_NOTICES.md にあります。
        </p>
      </section>

      <section>
        <h2>本</h2>
        <p>
          著者の本は CC BY-SA 4.0 で公開されています。このサイトでは教材に混ぜず、
          <a href="https://github.com/oopdesc/all-beings-flourishing" target="_blank" rel="noopener noreferrer">
            作品としてリンク
          </a>
          しています。
        </p>
      </section>

      <section>
        <h2>外部からの読み込み</h2>
        <p>フォント・画像・動画・解析タグは読み込んでいません。文字は OS のフォントで表示しています。</p>
      </section>
    </div>
  );
}
