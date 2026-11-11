import { lazy, Suspense, useEffect, useState } from "react";
import bankUrl from "./academy/content/published.json?url";
import { initializeProblems } from "./academy/content";
const AcademyContent = lazy(() => import("./AcademyContent"));

export default function Academy({ questionId }: { questionId?: string }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    (async () => {
      const response = await fetch(bankUrl, { signal: controller.signal });
      if (!response.ok) throw Error("補充教材を取得できません。");
      const text = await response.text();
      if (text.length > 3000000)
        throw Error("補充教材の容量を確認できません。");
      initializeProblems(JSON.parse(text));
      if (!controller.signal.aborted) setReady(true);
    })().catch((e) => {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "教材を読み取れません。");
    });
    return () => controller.abort();
  }, [retry]);
  if (error)
    return (
      <main className="hub-content">
        <p role="alert">{error}</p>
        <button onClick={() => setRetry((n) => n + 1)}>読み直す</button>
      </main>
    );
  return ready ? (
    <Suspense fallback={<p role="status">補充問題集を準備しています…</p>}>
      <AcademyContent questionId={questionId} />
    </Suspense>
  ) : (
    <p role="status">補充教材を読み込んでいます…</p>
  );
}
