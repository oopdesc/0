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
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="page-shell">
        <h1>画面を開けませんでした。</h1>
        <p>保存データは消していません。ページを再読込みしてください。</p>
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
