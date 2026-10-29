import { createContext } from "react";
import type { SkyId, SkyState } from "./sky-state";
export type SkyControl = {
  state: SkyState;
  active: SkyId | null;
  full: SkyId | null;
  settings: boolean;
  notice: string;
  foregroundActive: boolean;
  setForegroundActive: (v: boolean) => void;
  choose: (id: SkyId, scope: "all" | "page") => void;
  show: (id: SkyId) => void;
  close: () => void;
  openSettings: () => void;
  hideSettings: () => void;
  change: (fn: (s: SkyState) => SkyState) => void;
  toggleMotion: () => void;
};
export const SkyContext = createContext<SkyControl | null>(null);
