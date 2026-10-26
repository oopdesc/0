import { useRef, useState, useSyncExternalStore } from 'react';
import { store } from '../../core/appStore';
import { universe } from '../../core/simulation/controller';
import { ALL_LESSONS, TOTAL_CHALLENGES } from '../../core/lessons';

export function SettingsView() {
  const app = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useSyncExternalStore(universe.subscribe, universe.getSnapshot);
  const prefs = app.progress.preferences;
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadJson() {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orrery-progress.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('進捗をダウンロードしました');
  }

  function doImport() {
    const result = store.importData(importText);
    setMessage(result.ok ? '読み込みました。ページを再読み込みすると設定が反映されます。' : `読み込み失敗: ${result.error}`);
  }

  return (
    <div className="settings-view">
      <header className="view-head">
        <p className="view-head__kicker">設定と保存</p>
        <h1>設定とデータ</h1>
        <p className="view-head__lead">アカウントはありません。すべての設定と進捗はこのブラウザの localStorage に保存されます。</p>
      </header>

      <section className="settings-view__block" aria-labelledby="pref-title">
        <h2 id="pref-title" className="section-label">表示・動作</h2>
        <div className="settings-grid">
          <p>配色はページ上部のライト／ダークで変更できます。</p>
          <label>
            <span>描画品質</span>
            <select value={prefs.quality} onChange={(e) => store.setPreference({ quality: e.target.value as 'auto' | 'high' | 'balanced' | 'battery' })}>
              <option value="auto">自動</option><option value="high">高画質</option>
              <option value="balanced">標準</option><option value="battery">省電力</option>
            </select>
          </label>
          <label>
            <span>既定の言語</span>
            <select value={prefs.dialect} onChange={(e) => store.setPreference({ dialect: e.target.value as 'java' | 'rust' })}>
              <option value="java">Java</option><option value="rust">Rust</option>
            </select>
          </label>
          <label>
            <span>時間倍率 {prefs.timeScale.toFixed(1)}×</span>
            <input type="range" min="0.1" max="4" step="0.1" value={prefs.timeScale}
              onChange={(e) => store.setPreference({ timeScale: Number(e.target.value) })} />
          </label>
        </div>
        <div className="settings-checks">
          <label><input type="checkbox" checked={prefs.reducedMotion}
            onChange={(e) => store.setPreference({ reducedMotion: e.target.checked })} /> 動きを減らす（reduced motion）</label>
          <label><input type="checkbox" checked={prefs.showGrid}
            onChange={(e) => store.setPreference({ showGrid: e.target.checked })} /> グリッドを表示</label>
          <label><input type="checkbox" checked={universe.options.trails}
            onChange={(e) => universe.setTrails(e.target.checked)} /> 軌跡を描画</label>
        </div>
        <p className="settings-note">
          非表示タブ・画面外ではシミュレーションを停止します。端末性能に応じて目標 fps を 24〜60 の範囲で自動調整します。
        </p>
      </section>

      <section className="settings-view__block" aria-labelledby="data-title">
        <h2 id="data-title" className="section-label">進捗データの持ち運び</h2>
        <div className="settings-actions">
          <button type="button" className="primary" onClick={downloadJson}>JSON をダウンロード</button>
          <button type="button" onClick={() => {
            navigator.clipboard?.writeText(store.exportData()).then(
              () => setMessage('クリップボードにコピーしました'),
              () => setMessage('コピーできませんでした。下のテキストエリアを使ってください。'),
            );
          }}>クリップボードにコピー</button>
          <button type="button" onClick={() => fileRef.current?.click()}>ファイルを選ぶ</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only"
            aria-label="進捗データの JSON ファイルを選択"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 256 * 1024) { setMessage('ファイルが大きすぎます'); return; }
              setImportText(await f.text());
            }} />
        </div>
        <label className="settings-import">
          <span>JSON を貼り付けて読み込む（最大 256KB、検証後に反映）</span>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value.slice(0, 256 * 1024))}
            rows={5} spellCheck={false} />
        </label>
        <button type="button" onClick={doImport} disabled={!importText.trim()}>検証して読み込む</button>
        {message && <p className="settings-message" role="status">{message}</p>}
        <button type="button" className="danger" onClick={() => {
          if (window.confirm('進捗・パッチ・復習カードをすべて削除します。よろしいですか？')) store.resetAll();
        }}>すべての進捗をリセット</button>
      </section>

      <section className="settings-view__block" aria-labelledby="about-title">
        <h2 id="about-title" className="section-label">このプロダクトについて</h2>
        <dl className="settings-facts">
          <div><dt>レッスン / 課題</dt><dd>{ALL_LESSONS.length} / {TOTAL_CHALLENGES}</dd></div>
          <div><dt>実行方式</dt><dd>Java / Rust 教育用サブセット・インタプリタ（JVM / rustc ではない）</dd></div>
          <div><dt>Java 検証</dt><dd>代表的な意味論は同梱の javac フィクスチャで実機検証（scripts/verify-java.sh）</dd></div>
          <div><dt>WASM</dt><dd>488 バイトの実モジュール（WAT から生成）+ TypeScript 参照実装へフォールバック</dd></div>
          <div><dt>Rust ソース</dt><dd>rust/src/lib.rs（wasm32-unknown-unknown 向け。この環境に rustc はありません）</dd></div>
          <div><dt>科学モデル</dt><dd>教育用簡略重力モデル。実観測・一般相対論シミュレーションではない</dd></div>
          <div><dt>外部サービス</dt><dd>なし。API key / アカウント / アナリティクス不要</dd></div>
          <div><dt>Deployspace</dt><dd>静的ビルドのみ。サーバー常駐・有料サービス依存なし</dd></div>
        </dl>
        <p className="settings-note">
          未実装・未検証の項目を「完成」と表示しません。Lighthouse 等の実測値はこの環境では取得していないため、達成を主張しません。
        </p>
      </section>
    </div>
  );
}
