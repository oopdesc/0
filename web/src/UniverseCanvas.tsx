import { useEffect, useRef, useState, type RefObject } from "react";
import type { UniverseHandle, UniverseOptions, View3D } from "./art/universe3d";
export type CameraPosition = { x: number; y: number; z: number };
/** Three.jsはこの境界で遅延読込。Reactの再描画でWebGLを作り直さない。 */
export default function UniverseCanvas({
  options,
  handle,
  view,
  interactive = true,
  onReady,
  onViewChange,
  onError,
}: {
  options: UniverseOptions;
  handle: RefObject<UniverseHandle | null>;
  view?: CameraPosition;
  interactive?: boolean;
  onReady?: () => void;
  onViewChange?: (view: View3D) => void;
  onError?: (message: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef({ options, view, onReady, onError, onViewChange });
  latest.current = { options, view, onReady, onError, onViewChange };
  const [status, setStatus] = useState("三次元の星を準備しています…");
  useEffect(() => {
    let disposed = false;
    void import("./art/universe3d")
      .then(({ createUniverse }) => {
        if (disposed || !canvas.current) return;
        const engine = createUniverse(
          canvas.current,
          latest.current.options,
          () => {
            if (!disposed) {
              setStatus("");
              latest.current.onReady?.();
            }
          },
          (message) => {
            if (!disposed) {
              setStatus(message);
              latest.current.onError?.(message);
            }
          },
          interactive,
          (v) => latest.current.onViewChange?.(v),
        );
        handle.current = engine;
        if (latest.current.view) engine.view(latest.current.view);
      })
      .catch(() => {
        if (!disposed) {
          const message =
            "このブラウザでは三次元表示を開始できません。下の「観測資料」を利用できます。";
          setStatus(message);
          latest.current.onError?.(message);
        }
      });
    return () => {
      disposed = true;
      handle.current?.dispose();
      handle.current = null;
    };
  }, [handle, interactive]);
  useEffect(() => handle.current?.update(options), [options, handle]);
  useEffect(() => {
    if (view) handle.current?.view(view);
  }, [view, handle]);
  return (
    <>
      <canvas
        ref={canvas}
        className="cosmos-canvas"
        role="img"
        aria-label="ドラッグで回転できる三次元の銀河。視点ボタンと拡大スライダーでも操作できます。"
      />
      {status && (
        <p className="cosmos-notice" role="status">
          {status}
        </p>
      )}
    </>
  );
}
