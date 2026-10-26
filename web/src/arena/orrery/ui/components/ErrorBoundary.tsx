import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Keeps a single bad view from taking down the whole learning world. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry, no network. Local console only, and no personal data.
    console.error('[ORRERY] view error', error.message, info.componentStack?.slice(0, 400));
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main id="main" className="fallback">
          <h1>画面の描画に失敗しました</h1>
          <p>学習データはブラウザ内に保存されています。再読み込みしても消えません。</p>
          <pre>{this.state.error.message}</pre>
          <button type="button" onClick={() => this.setState({ error: null })}>もう一度試す</button>
          <button type="button" onClick={() => { window.location.hash = '#/home'; window.location.reload(); }}>
            ホームに戻る
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
