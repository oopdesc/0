import type { SpaceHandle } from "../nebula/scene";
export type NurseryStats = {
  fpsCap: number;
  volumePixels: number;
  drawingPixels: number;
  reduced: boolean;
  drawnFrames: number;
  gpuMs: number | null;
  lowPower: boolean;
};
export type NurseryHandle = {
  pause(on: boolean): void;
  view(action: "left" | "right" | "up" | "down" | "in" | "out" | "reset"): void;
  image(): string;
  dispose(): void;
};
/** Shares the established nebula sphere; a quieter, wider cursor constellation for the entrance. */
export function createNursery(
  canvas: HTMLCanvasElement,
  options: {
    paused: boolean;
    background?: boolean;
    pointerSurface?: EventTarget;
    onVisibility?: (active: boolean) => void;
    onFailure: () => void;
    onStats?: (s: NurseryStats) => void;
  },
): NurseryHandle {
  let handle: SpaceHandle | null = null,
    disposed = false,
    paused = options.paused;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const motion = () => handle?.setReducedMotion(paused || media.matches);
  media.addEventListener("change", motion);
  import("../nebula/scene")
    .then(({ createSpaceScene }) => {
      if (disposed) return;
      return createSpaceScene(canvas, {
        quality: "balanced",
        homeVariant: true,
        maxFps: options.background ? 15 : 24,
        maxPixels: options.background ? 500000 : 700000,
        pointerSurface: options.pointerSurface,
        reducedMotion: paused || media.matches,
        onActivity: options.onVisibility,
        onStats: (s) => {
          if (disposed) return;
          options.onStats?.({
            fpsCap: options.background ? 15 : 24,
            volumePixels: 0,
            drawingPixels: canvas.width * canvas.height,
            reduced: media.matches,
            drawnFrames: Number(canvas.dataset.drawnFrames || 0),
            gpuMs: null,
            lowPower: false,
          });
          if (s.engine === "minimal") options.onFailure();
        },
      });
    })
    .then((h) => {
      if (!h) return;
      if (disposed) h.dispose();
      else {
        handle = h;
        motion();
      }
    })
    .catch(() => {
      if (!disposed) options.onFailure();
    });
  return {
    pause(on) {
      paused = on;
      motion();
    },
    view(action) {
      handle?.view?.(action);
    },
    image() {
      if (!handle?.image) throw Error("描画の準備ができていません。");
      return handle.image();
    },
    dispose() {
      disposed = true;
      handle?.dispose();
      handle = null;
      options.onVisibility?.(false);
      canvas.dataset.animationStopped = "true";
      media.removeEventListener("change", motion);
    },
  };
}
