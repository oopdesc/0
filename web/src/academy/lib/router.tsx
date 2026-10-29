/**
 * 依存なしの小さなルーター。
 * - History API ベース（静的ホスティングで動くよう、未知パスは 404 ではなく index を返す前提）
 * - ルート単位の遅延読み込みができるように、ページは React.lazy で渡す
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode, type MouseEvent } from 'react';

export interface RouterState {
  path: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

const Ctx = createContext<RouterState>({ path: '/', navigate: () => {} });

export function supplementalPath(hash: string): string {
  if (!hash.startsWith('#/')) return '/';
  try {
    const path = decodeURIComponent(hash.slice(1).split('?')[0]).replace(/\/+$/, '');
    return path === '' ? '/' : path;
  } catch { return '/browse'; }
}
function currentPath(): string { return supplementalPath(window.location.hash); }

export function RouterProvider({ children, standalone = false }: { children: ReactNode; standalone?: boolean }) {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);

  const value = useMemo<RouterState>(
    () => ({
      path,
      navigate(to, opts) {
        if(standalone) { window.location.assign("/learn?section=supplemental#"+to); return; }
        if (to === currentPath()) return;
        if (opts?.replace) window.history.replaceState(null, '', '/learn?section=supplemental#' + to);
        else window.history.pushState(null, '', '/learn?section=supplemental#' + to);
        setPath(to);
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      },
    }),
    [path, standalone],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRouter() {
  return useContext(Ctx);
}

export function Link({
  to,
  children,
  className,
  onClick,
  ...rest
}: { to: string; children: ReactNode; className?: string; onClick?: () => void } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'onClick'
>) {
  const { navigate } = useRouter();
  return (
    <a
      href={'/learn?section=supplemental#' + to}
      className={className}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/** `/p/:id` のような 1 セグメントのパラメータを取り出す */
export function match(path: string, pattern: string): Record<string, string> | null {
  const a = path.split('/').filter(Boolean);
  const b = pattern.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < b.length; i++) {
    if (b[i].startsWith(':')) out[b[i].slice(1)] = decodeURIComponent(a[i]);
    else if (b[i] !== a[i]) return null;
  }
  return out;
}
