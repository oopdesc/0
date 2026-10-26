import { validateSavedState, type SavedState } from "./state";

const MAX_PROGRESS_CHARACTERS = 12000;

/** 記録のIDと日付だけを書き出す。演習への入力や回答本文はこの型に含めない。 */
export function exportProgress(state: SavedState): string {
  return JSON.stringify(
    {
      application: "0-learning-progress",
      version: 1,
      data: validateSavedState(state),
    },
    null,
    2,
  );
}

/** 不正なファイルを「空の記録」として扱わず、利用者へエラーを返す。 */
export function importProgress(raw: string): SavedState {
  if (raw.length > MAX_PROGRESS_CHARACTERS)
    throw Error("記録ファイルが大きすぎます。");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Error("JSONの記録ファイルを選んでください。");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("application" in parsed) ||
    parsed.application !== "0-learning-progress" ||
    !("version" in parsed) ||
    parsed.version !== 1 ||
    !("data" in parsed) ||
    !parsed.data ||
    typeof parsed.data !== "object" ||
    !("schema" in parsed.data) ||
    parsed.data.schema !== 1
  ) {
    throw Error("このサイトから書き出した学習記録を選んでください。");
  }
  return validateSavedState(parsed.data);
}

/** 既存の完了・お気に入りを保持し、復習は新しい記録を採用する。動きの設定は変えない。 */
export function mergeProgress(
  current: SavedState,
  incoming: SavedState,
): SavedState {
  const a = validateSavedState(current),
    b = validateSavedState(incoming);
  const reviews = { ...a.reviews };
  for (const [id, item] of Object.entries(b.reviews)) {
    if (!reviews[id] || item.last > reviews[id].last) reviews[id] = item;
  }
  return validateSavedState({
    ...a,
    completed: [...new Set([...a.completed, ...b.completed])],
    favorites: [...new Set([...a.favorites, ...b.favorites])],
    reviews,
  });
}
