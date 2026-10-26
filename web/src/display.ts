export const DISPLAY_KEY = "0.display.v1";
export type Theme = "light" | "dark";
export function parseTheme(raw: string | null): Theme {
  try {
    const value: unknown = raw && raw.length < 128 ? JSON.parse(raw) : null;
    return value &&
      typeof value === "object" &&
      "schema" in value &&
      value.schema === 1 &&
      "theme" in value &&
      value.theme === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}
export function loadTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(DISPLAY_KEY));
  } catch {
    return "light";
  }
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#f5f7fb" : "#04050b");
}
