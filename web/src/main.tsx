import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DisplayProvider } from "./DisplayPreferences";
import { applyTheme, loadTheme } from "./display";
import "./style.css";
import "./observatory.css";
import "./display.css";
applyTheme(loadTheme());
class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; moduleLoad: boolean }
> {
  state = { failed: false, moduleLoad: false };
  static getDerivedStateFromError(error: unknown) {
    return {
      failed: true,
      moduleLoad:
        error instanceof Error &&
        /dynamically imported module|Importing a module script|Loading chunk|load module/i.test(
          error.message,
        ),
    };
  }
  render() {
    return this.state.failed ? (
      <main className="page-shell">
        <h1>
          {this.state.moduleLoad
            ? "教材を読み込み直してください。"
            : "画面を開けませんでした。"}
        </h1>
        <p>
          {this.state.moduleLoad
            ? "通信やサイトの更新により、必要な画面を取得できませんでした。"
            : "表示処理でエラーが起きました。"}{" "}
          保存済みの学習記録は消していません。通信を確認して再読込みしてください。
        </p>
        <button className="primary" onClick={() => location.reload()}>
          再読込み
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PageBoundary>
      <DisplayProvider>
        <App />
      </DisplayProvider>
    </PageBoundary>
  </StrictMode>,
);
