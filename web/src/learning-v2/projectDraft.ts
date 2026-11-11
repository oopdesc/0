import { loadProgress, saveDraft, saveProgress } from "./progress";

/** Compare one file, preserving unrelated progress and refusing a stale editor. */
export function persistProjectDraft(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  content: string,
  expected: string | undefined,
): { ok: true; content: string } | { ok: false; error: string } {
  const current = loadProgress(storage);
  if (!current.writable)
    return {
      ok: false,
      error: current.error || "既存の記録を読み取れません。",
    };
  if (current.state.drafts[key]?.content !== expected)
    return {
      ok: false,
      error:
        "別の画面でこのファイルが更新されました。上書きせず、編集中の内容を画面に残しています。『編集ファイルを保存』で保管してから読み直してください。",
    };
  const next = saveDraft(current.state, key, content);
  if (next === current.state)
    return {
      ok: false,
      error:
        "この下書きは64KiBを超えたため保存していません。『編集ファイルを保存』か作業用ZIPで保管してください。",
    };
  const result = saveProgress(storage, next);
  return result.ok
    ? { ok: true, content }
    : { ok: false, error: result.error || "下書きを保存できません。" };
}
