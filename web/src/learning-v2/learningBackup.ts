import { EXAM_STORAGE_KEY, importExamState, loadExamState, parseExamState } from "./examState";
import type { ExamState } from "./examState";
import { JOURNEY_KEY, mergeJourney, readJourney, serializeJourney, validateJourney } from "./journey-state";
import type { JourneyProgress } from "./journey-state";
import { emptyProgress, importProgress, loadProgress, mergeProgress, saveProgress, STORAGE_KEY } from "./progress";
import type { Progress } from "./progress";
import { parseStudyRound, STUDY_ROUND_KEY } from "./studyRound";
import type { StudyRound } from "./studyRound";

export const learningBackupLimit = 3_400_000;
const keys = [STORAGE_KEY, EXAM_STORAGE_KEY, JOURNEY_KEY, STUDY_ROUND_KEY] as const;
type Key = typeof keys[number];
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type LearningBackup = {
  schema: "zero-learning-backup/1";
  createdAt: number;
  practice: Progress;
  exams: ExamState;
  journey: JourneyProgress;
  round: StudyRound | null;
};

function snapshot(storage: Pick<Storage, "getItem">) {
  return new Map(keys.map(key => [key, storage.getItem(key)]));
}

function readSnapshot(raw: Map<Key, string | null>, createdAt: number): LearningBackup {
  const source = { getItem: (key: string) => raw.get(key as Key) ?? null };
  const practice = loadProgress(source);
  const exams = loadExamState(source);
  const journey = readJourney(source);
  if (!practice.writable || !exams.writable || !journey.writable)
    throw Error(practice.error || exams.error || journey.error || "既存の記録を読み取れません。");
  return {
    schema: "zero-learning-backup/1", createdAt,
    practice: practice.state, exams: exams.state, journey: journey.state,
    round: parseStudyRound(source.getItem(STUDY_ROUND_KEY)),
  };
}

export function backupCounts(backup: LearningBackup) {
  return {
    practice: Object.keys(backup.practice.records).length,
    drafts: Object.values(backup.practice.drafts).filter(draft => draft.content !== "").length,
    exams: backup.exams.attempts.length,
    journey: Object.keys(backup.journey.records).length,
    remaining: backup.round ? backup.round.ids.length - backup.round.outcomes.length : 0,
  };
}

export function readLearningBackup(storage: Pick<Storage, "getItem">) {
  return readSnapshot(snapshot(storage), Date.now());
}

export function exportLearningBackup(storage: Pick<Storage, "getItem">) {
  const raw = JSON.stringify(readLearningBackup(storage));
  if (new TextEncoder().encode(raw).byteLength > learningBackupLimit)
    throw Error("一括バックアップの上限を超えました。各学習画面から個別に書き出せます。");
  return raw;
}

export function parseLearningBackup(raw: string): LearningBackup {
  if (new TextEncoder().encode(raw).byteLength > learningBackupLimit)
    throw Error("一括バックアップのサイズが上限を超えています。");
  const value = JSON.parse(raw);
  if (value?.schema !== "zero-learning-backup/1" ||
      !Number.isSafeInteger(value.createdAt) || value.createdAt <= 0 ||
      value.createdAt > Date.now() + 86_400_000 ||
      value.practice?.schema !== "zero-learning-progress/1" || value.round === undefined)
    throw Error("一括バックアップの形式が違います。個別の記録ファイルは元の画面で取り込めます。");
  const practice = importProgress(JSON.stringify(value.practice), emptyProgress());
  if (!practice.ok) throw Error(practice.error);
  return {
    schema: "zero-learning-backup/1",
    createdAt: value.createdAt,
    practice: practice.state,
    exams: parseExamState(JSON.stringify(value.exams)),
    journey: validateJourney(value.journey),
    round: parseStudyRound(value.round === null ? null : JSON.stringify(value.round)),
  };
}

function mergeRound(current: StudyRound | null, incoming: StudyRound | null) {
  if (!current) return incoming;
  if (!incoming) return current;
  if (current.token === incoming.token) {
    const sameQuestions = current.ids.join(",") === incoming.ids.join(",");
    const sameProgress = current.outcomes.every((outcome, index) => outcome === incoming.outcomes[index]);
    return sameQuestions && sameProgress && incoming.outcomes.length > current.outcomes.length ? incoming : current;
  }
  const currentActive = current.outcomes.length < current.ids.length;
  const incomingActive = incoming.outcomes.length < incoming.ids.length;
  if (currentActive) return current;
  return incomingActive || incoming.startedAt > current.startedAt ? incoming : current;
}

export function restoreLearningBackup(storage: Store, raw: string) {
  const incoming = parseLearningBackup(raw);
  const before = snapshot(storage);
  const current = readSnapshot(before, Date.now());
  const practice = mergeProgress(current.practice, incoming.practice);
  const exams = importExamState(JSON.stringify(incoming.exams), current.exams);
  if (!exams.ok) throw Error(exams.error);
  const journey = mergeJourney(current.journey, incoming.journey);
  const round = mergeRound(current.round, incoming.round);

  // Validate the merged data before changing any of the four storage entries.
  const staged = new Map<Key, string>();
  const result = saveProgress({ setItem: (_, data) => staged.set(STORAGE_KEY, data) }, practice);
  if (!result.ok) throw Error(result.error ?? "練習の記録を統合できません。");
  staged.set(EXAM_STORAGE_KEY, JSON.stringify(exams.state));
  staged.set(JOURNEY_KEY, serializeJourney(journey));
  if (round) staged.set(STUDY_ROUND_KEY, JSON.stringify(round));
  const changed = [...staged].filter(([key, data]) => data !== before.get(key));
  const written: [Key, string][] = [];
  try {
    for (const [key, data] of changed) {
      if (storage.getItem(key) !== before.get(key)) throw Error("別の画面で記録が更新されました。");
      storage.setItem(key, data);
      written.push([key, data]);
    }
  } catch {
    let restored = true;
    for (const [key, data] of written.reverse()) {
      try {
        if (storage.getItem(key) !== data) { restored = false; continue; }
        const old = before.get(key);
        if (old == null) storage.removeItem(key);
        else storage.setItem(key, old);
      } catch { restored = false; }
    }
    throw Error(restored
      ? "保存に失敗したため、取り込みによる変更を取り消しました。空き容量や別のタブを確認して、もう一度試してください。"
      : "取り込みが途中で止まりました。別のタブを閉じ、保管したファイルと現在の件数を確認してください。");
  }
  return {
    counts: backupCounts({ ...current, practice, exams: exams.state, journey, round }),
    keptRound: !!incoming.round && !!current.round && round === current.round && incoming.round.token !== current.round.token,
  };
}
