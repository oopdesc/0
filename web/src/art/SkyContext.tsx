import { useContext, useEffect, useRef, useState } from "react";
import {
  SKY_KEY,
  SKY_NAMES,
  SKY_IDS,
  readSky,
  emptySky,
  validateSky,
  activeSky,
  chooseSky,
  type SkyId,
  type SkyState,
} from "./sky-state";
import { SkyContext, type SkyControl } from "./sky-context";
export { SkyContext } from "./sky-context";
export function useSky() {
  const x = useContext(SkyContext);
  if (!x) throw Error("背景設定を利用できません。");
  return x;
}
export function useSkyControl(
  path: string,
  globalPaused: boolean,
  onStartMotion: () => void,
): SkyControl {
  const [initial] = useState(() => {
    try {
      return readSky(localStorage);
    } catch {
      return { state: emptySky(), writable: false };
    }
  });
  const [state, setState] = useState(initial.state),
    [full, setFull] = useState<SkyId | null>(null),
    [settings, setSettings] = useState(false),
    [notice, setNotice] = useState("");
  const [foregroundActive, setForegroundActive] = useState(false);
  const ref = useRef(state);
  ref.current = state;
  function change(fn: (s: SkyState) => SkyState) {
    let base = ref.current,
      writable = initial.writable;
    try {
      const old = readSky(localStorage);
      if (!old.writable) writable = false;
      else base = old.state;
    } catch {
      writable = false;
    }
    let next: SkyState;
    try {
      next = validateSky(fn(base));
    } catch {
      setNotice("このページでは背景を変更できません。設定はそのまま保持しています。");
      return;
    }
    ref.current = next;
    setState(next);
    try {
      if (!writable) throw Error();
      localStorage.setItem(SKY_KEY, JSON.stringify(next));
      setNotice("");
    } catch {
      setNotice(
        "この背景は今回の画面だけに適用しています。設定を保存できませんでした。既存データは上書きしていません。",
      );
    }
  }
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key !== SKY_KEY) return;
      try {
        const next = readSky(localStorage);
        if (next.writable) {
          ref.current = next.state;
          setState(next.state);
        }
      } catch {
        /* keep the current view */
      }
    };
    addEventListener("storage", sync);
    return () => removeEventListener("storage", sync);
  }, []);
  const active = activeSky(state, path);
  useEffect(() => {
    document.documentElement.classList.toggle("has-sky", !!active);
    return () => document.documentElement.classList.remove("has-sky");
  }, [active]);
  return {
    state,
    active,
    full,
    settings,
    notice,
    foregroundActive,
    setForegroundActive,
    change,
    choose: (id, scope) => change((s) => chooseSky(s, path, id, scope)),
    show: (id) => {
      setSettings(false);
      setFull(id);
    },
    close: () => setFull(null),
    openSettings: () => setSettings(true),
    hideSettings: () => setSettings(false),
    toggleMotion: () => {
      if (globalPaused || ref.current.paused) {
        change((s) => ({ ...s, paused: false }));
        onStartMotion();
      } else change((s) => ({ ...s, paused: true }));
    },
  };
}
export function DesignButtons({ id }: { id: SkyId }) {
  const sky = useSky(),
    [scope, setScope] = useState<"all" | "page">("all");
  return (
    <div className="design-buttons" aria-label={SKY_NAMES[id] + "の表示"}>
      <button onClick={() => sky.show(id)}>⛶ 全画面で見る</button>
      <label>
        <span className="design-sr">背景の適用先</span>
        <select
          aria-label={SKY_NAMES[id] + "の背景の適用先"}
          value={scope}
          onChange={(e) => setScope(e.target.value as "all" | "page")}
        >
          <option value="all">全ページ</option>
          <option value="page">このページだけ</option>
        </select>
      </label>
      <button onClick={() => sky.choose(id, scope)}>✧ 背景にする</button>
      {sky.active && (
        <button onClick={sky.openSettings}>背景の薄さ・停止</button>
      )}
    </div>
  );
}
export function SkySettings({ globalPaused }: { globalPaused: boolean }) {
  const sky = useSky(),
    dialog = useRef<HTMLDialogElement>(null),
    [scope, setScope] = useState<"all" | "page">("all");
  useEffect(() => {
    if (sky.settings && !dialog.current?.open) dialog.current?.showModal();
    if (!sky.settings && dialog.current?.open) dialog.current.close();
  }, [sky.settings]);
  return (
    <dialog
      ref={dialog}
      className="sky-settings"
      onCancel={sky.hideSettings}
      aria-labelledby="sky-settings-title"
    >
      <header>
        <h2 id="sky-settings-title">宇宙を、背景に。</h2>
        <button aria-label="背景設定を閉じる" onClick={sky.hideSettings}>
          ×
        </button>
      </header>
      <p>学習画面の文字は読みやすく保ち、背景だけを切り替えます。</p>
      <label>
        適用する場所
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "all" | "page")}
        >
          <option value="all">すべてのページ</option>
          <option value="page">今のページだけ</option>
        </select>
      </label>
      <div className="sky-choices" role="group" aria-label="背景の作品">
        {SKY_IDS.map((id) => (
          <div key={id} className="sky-choice-row">
            <button
              aria-pressed={sky.active === id}
              onClick={() => sky.choose(id, scope)}
            >
              <span className={"sky-chip sky-chip-" + id} aria-hidden="true" />
              <span>{SKY_NAMES[id]}</span>
            </button>
            <button
              aria-label={SKY_NAMES[id] + "を全画面で見る"}
              onClick={() => sky.show(id)}
            >
              ⛶
            </button>
          </div>
        ))}
      </div>
      <label>
        背景の濃さ <output>{sky.state.strength}%</output>
        <input
          type="range"
          min={8}
          max={72}
          step={1}
          value={sky.state.strength}
          aria-label="背景の濃さ"
          onChange={(e) =>
            sky.change((s) => ({ ...s, strength: Number(e.target.value) }))
          }
        />
      </label>
      <div className="design-buttons">
        <button disabled={!sky.active} onClick={sky.toggleMotion}>
          {sky.state.paused || globalPaused
            ? "背景の動きを再開"
            : "背景の動きを止める"}
        </button>
        {sky.active && (
          <button
            onClick={() => {
              if (sky.active) sky.show(sky.active);
            }}
          >
            全画面で眺める
          </button>
        )}
        <button
          onClick={() => sky.change((s) => ({ ...s, global: null, pages: {} }))}
        >
          通常の背景に戻す
        </button>
      </div>
      <p className="sky-small">
        設定はこのブラウザに保存します。「全ページ」を選ぶと、個別の背景設定も選び直せます。動きを減らす端末設定とサイト全体の停止設定を優先します。
      </p>
      {sky.notice && <p role="status">{sky.notice}</p>}
      <button onClick={sky.hideSettings}>設定を閉じる</button>
    </dialog>
  );
}
