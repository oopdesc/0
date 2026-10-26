import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DISPLAY_KEY, applyTheme, loadTheme, type Theme } from "./display";
const Context = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});
export function DisplayProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(loadTheme);
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(DISPLAY_KEY, JSON.stringify({ schema: 1, theme }));
    } catch {
      /* 表示は保存できなくても変更できる。 */
    }
  }, [theme]);
  return (
    <Context.Provider
      value={{
        theme,
        toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDisplay() {
  return useContext(Context);
}
export function ThemeButton() {
  const { theme, toggle } = useDisplay();
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={
        theme === "light"
          ? "ダークモードに切り替える"
          : "ライトモードに切り替える"
      }
      aria-pressed={theme === "dark"}
    >
      {theme === "light" ? "☾ ダーク" : "☀ ライト"}
    </button>
  );
}
