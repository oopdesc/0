export type ContractCase = {
  name: string;
  id: string;
  repository: "ready" | "down";
  status: number;
  title: string;
  safeError: boolean;
  successShape?: boolean;
};
export const MUTANTS = [
  ["prefix", "数字の後ろの文字を無視する"],
  ["range", "IDの上限検査を忘れる"],
  ["missing", "未登録でも200を返す"],
  ["leak", "内部例外を応答へ出す"],
  ["order", "検証の前にDBへ接続する"],
  ["body", "200でもID・versionの内容が誤っている"],
] as const;
type Variant = "reference" | (typeof MUTANTS)[number][0];
export type LabResponse = {
  status: number;
  body: Record<string, unknown>;
  repositoryCalled: boolean;
};
/** Executable teaching model, not an HTTP server or a Java/Rust compiler. */
export function modelLookup(
  raw: string,
  repository: "ready" | "down",
  variant: Variant = "reference",
): LabResponse {
  const error = (
    status: number,
    message: string,
    called = false,
  ): LabResponse => ({
    status,
    body: { error: message, requestId: "practice-001" },
    repositoryCalled: called,
  });
  if (variant === "order" && repository === "down")
    return error(500, "internal error", true);
  const value = variant === "prefix" ? Number.parseInt(raw, 10) : Number(raw);
  const format =
    variant === "prefix" ? Number.isInteger(value) : /^[0-9]+$/.test(raw);
  if (
    !format ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    (variant !== "range" && value > 2147483647)
  )
    return error(400, "invalid id");
  if (repository === "down")
    return error(
      500,
      variant === "leak"
        ? "SQLITE_CANTOPEN: /private/practice/books.db"
        : "internal error",
      true,
    );
  if (value > 2)
    return variant === "missing"
      ? {
          status: 200,
          body: { id: value, title: null, version: 0 },
          repositoryCalled: true,
        }
      : error(404, "not found", true);
  return {
    status: 200,
    body: { id: variant === 'body' ? value + 1 : value, title: value === 1 ? "Java" : "Rust", version: variant === 'body' ? '1' : 1 },
    repositoryCalled: true,
  };
}
export function checkContract(
  test: ContractCase,
  response: LabResponse,
): string[] {
  const errors: string[] = [];
  if (test.status !== response.status)
    errors.push(`状態: 期待${test.status} / 実際${response.status}`);
  if (test.title && test.title !== response.body.title)
    errors.push(
      `書名: 期待${test.title} / 実際${String(response.body.title ?? "なし")}`,
    );
  if (test.successShape && response.status === 200) {
    if (response.body.id !== Number(test.id)) errors.push('成功JSONのidが入力の数値と一致しません');
    if (response.body.version !== 1) errors.push('成功JSONのversionが数値1ではありません');
  }
  if (test.safeError && response.status >= 400) {
    if (typeof response.body.requestId !== "string" || !response.body.requestId)
      errors.push("照合用requestIdがありません");
    if (
      typeof response.body.error !== "string" ||
      /SQLITE_|private\/|Exception|SELECT /i.test(response.body.error)
    )
      errors.push("一般的なエラー説明に限定されていません");
  }
  return errors;
}
export function evaluateSuite(cases: ContractCase[]) {
  const baseline = cases.map((test) => ({
    test,
    response: modelLookup(test.id, test.repository),
    errors: checkContract(test, modelLookup(test.id, test.repository)),
  }));
  const valid =
    cases.length > 0 && baseline.every((row) => row.errors.length === 0);
  return {
    valid,
    baseline,
    mutations: MUTANTS.map(([id, title]) => ({
      id,
      title,
      caughtBy: valid
        ? cases.flatMap((test, index) =>
            checkContract(test, modelLookup(test.id, test.repository, id))
              .length
              ? [index]
              : [],
          )
        : [],
    })),
  };
}
export type RaceAction = {
  client: "A" | "B";
  operation: "read" | "save";
  title: string;
};
export function replayConcurrency(actions: RaceAction[], guarded: boolean) {
  let book = { title: "Java入門", version: 1 };
  const snapshots: Partial<Record<"A" | "B", typeof book>> = {};
  const events = actions.map((action) => {
    if (action.operation === "read") {
      snapshots[action.client] = { ...book };
      return {
        ...action,
        status: 200,
        detail: `GET: ${book.title} / version=${book.version}`,
      };
    }
    const version = snapshots[action.client]?.version;
    if (version === undefined)
      return {
        ...action,
        status: null,
        detail: "送信前に停止: 先にGETして更新元のversionを取得する",
      };
    if (guarded && version !== book.version)
      return {
        ...action,
        status: 409,
        detail: `更新競合: 送信version=${version} / 現在=${book.version}。データは変更しない`,
      };
    book = { title: action.title, version: book.version + 1 };
    snapshots[action.client] = { ...book };
    return {
      ...action,
      status: 200,
      detail: `PUT成功: ${book.title} / version=${book.version}`,
    };
  });
  return { book, snapshots, events };
}
export const INCIDENTS = [
  {
    id: "validation",
    title: "不正なIDなのに500になる",
    symptom: "GET /api/books/abc が、保存先停止中だけ500になる。仕様は400。",
    evidence: [
      "通常時はabcで400。保存先停止時はabcで500。",
      "同じrequestIdのログ: handler → repository.connect → connection refused。validateの記録なし。",
      "正常なID=1も停止時は500。入力abcのときにSQL検索結果は存在しない。",
    ],
    options: [
      "どんな入力でもDB復旧まで500が正しい",
      "入力検証より先に保存先へ接続している",
      "IDの上限を大きくすれば直る",
    ],
    correct: 1,
    explanation:
      "原因は処理の順序。入力検証を先に行い、abcではRepositoryを呼ばず400を返す。正常ID＋保存先停止は500のまま。両方を回帰テストにする。DB復旧だけでは順序の不具合が残る。",
    stages: "detail",
  },
  {
    id: "overwrite",
    title: "保存できたのに変更が消えた",
    symptom:
      "2人が同じ本を編集し、両方の保存が200。先に保存したタイトルが消えた。",
    evidence: [
      "A・Bはどちらもversion=7をGET。Aが保存後、Bが古い画面から保存した。",
      "実行SQLは UPDATE books SET title=?, version=version+1 WHERE id=?。version条件なし。",
      "最終データはBのタイトル、version=9。トランザクションは両方commit済み。",
    ],
    options: [
      "画面のキャッシュを削除すれば必ず直る",
      "SELECT後に待ち時間を追加する",
      "更新元versionの照合がなく、更新消失が起きた",
    ],
    correct: 2,
    explanation:
      "UPDATEのWHEREにidと更新元versionを入れ、更新件数0を競合として扱う。確認と更新は一つの原子的な操作にする。別SELECTで確認するだけでは、その直後に他者が更新できる。競合時は再取得し、差分を確認して再編集する。",
    stages: "integration",
  },
  {
    id: "n-plus-one",
    title: "一覧の件数に比例して遅くなる",
    symptom: "本の一覧は1件なら速いが、20件では応答が遅い。",
    evidence: [
      "計測: 1件でSQL2回、20件でSQL21回。返すJSONは小さい。",
      "トレース: 最初に本の一覧を1回取得。その後、各行の著者を1回ずつ取得。",
      "著者IDのインデックスは存在し、各SQL単独は2ms程度。待ち時間はDBとの往復に集中。",
    ],
    options: [
      "必要な関連データをJOINや一括取得でまとめる",
      "同じインデックスをもう一つ作る",
      "すべての例外を無視する",
    ],
    correct: 0,
    explanation:
      "この記録ではN+1回の問い合わせが主要因。JOINまたはID集合での一括取得を検討し、欠けた関連・順序・重複もテストする。改善前後で同じ件数と条件のSQL回数・応答時間を比較する。別の現場でも必ず同じ原因とは限らない。",
    stages: "system",
  },
  {
    id: "retry",
    title: "通信再試行で登録が2件になった",
    symptom: "登録操作を1回したつもりなのに、同じ内容のデータが2件できた。",
    evidence: [
      "1回目のPOSTはDBでcommitした直後、応答前に接続切断。利用者にはタイムアウト。",
      "クライアントは同じ入力でPOSTを再送。2回目も新規INSERTしてcommitした。",
      "登録要求の重複識別キーも、重複を原子的に排除する制約もない。",
    ],
    options: [
      "タイムアウトしたら最初の登録は必ず失敗している",
      "同じ操作を識別し、原子的に重複実行を防ぐ",
      "再送のたびに新しい重複識別キーを作る",
    ],
    correct: 1,
    explanation:
      "応答の失敗と処理の失敗は別。再試行する同じ操作には同じキーを使い、キー・要求内容・結果の保存を含む原子性や一意制約を設計する。同じキーで内容が違う場合の扱いと保持期限も決める。単に再送を追加してはいけない。",
    stages: "release",
  },
] as const;
export type PracticeDraft = {
  schema: "zero-practice/1";
  cases: ContractCase[];
  notes: string;
  actions: RaceAction[];
  guarded: boolean;
};
export function emptyPractice(): PracticeDraft {
  return {
    schema: "zero-practice/1",
    cases: [
      {
        name: "登録済みの本",
        id: "1",
        repository: "ready",
        status: 200,
        title: "Java",
        safeError: false,
        successShape: true,
      },
    ],
    notes: "",
    actions: [],
    guarded: false,
  };
}
export function parsePractice(raw?: string): PracticeDraft {
  if (!raw) return emptyPractice();
  if (new TextEncoder().encode(raw).byteLength > 48000)
    throw Error("実務演習の記録が上限を超えています。");
  const d = JSON.parse(raw);
  if (
    d?.schema !== "zero-practice/1" ||
    typeof d.notes !== "string" ||
    d.notes.length > 8000 ||
    typeof d.guarded !== "boolean" ||
    !Array.isArray(d.cases) ||
    d.cases.length < 1 ||
    d.cases.length > 12 ||
    !Array.isArray(d.actions) ||
    d.actions.length > 20
  )
    throw Error("実務演習の記録形式を確認できません。");
  for (const c of d.cases)
    if (
      !c ||
      typeof c.name !== "string" ||
      c.name.length > 80 ||
      typeof c.id !== "string" ||
      c.id.length > 80 ||
      !["ready", "down"].includes(c.repository) ||
      ![200, 400, 404, 500].includes(c.status) ||
      typeof c.title !== "string" ||
      c.title.length > 80 ||
      typeof c.safeError !== "boolean"
      || (c.successShape !== undefined && typeof c.successShape !== 'boolean')
    )
      throw Error("試験項目の形式を確認できません。");
  for (const a of d.actions)
    if (
      !a ||
      !["A", "B"].includes(a.client) ||
      !["read", "save"].includes(a.operation) ||
      typeof a.title !== "string" ||
      !a.title.trim() ||
      a.title.length > 80
    )
      throw Error("再現操作の形式を確認できません。");
  return {
    schema: "zero-practice/1",
    cases: d.cases.map((c: ContractCase) => ({
      name: c.name,
      id: c.id,
      repository: c.repository,
      status: c.status,
      title: c.title,
      safeError: c.safeError,
      ...(c.successShape === undefined ? {} : { successShape:c.successShape }),
    })),
    notes: d.notes,
    actions: d.actions.map((a: RaceAction) => ({
      client: a.client,
      operation: a.operation,
      title: a.title,
    })),
    guarded: d.guarded,
  };
}
export function practiceReport(d: PracticeDraft): string {
  const result = evaluateSuite(d.cases),
    race = replayConcurrency(d.actions, d.guarded);
  return [
    "# 実務演習の記録",
    "",
    "ブラウザ内の練習モデル。実HTTP・DB・Java/Rustコードは未実行。実務経験やリリース承認の証明ではありません。",
    "",
    "## API試験項目",
    ...result.baseline.map(
      (r, i) =>
        `${i + 1}. ${r.test.name || "無題"} / ID=${JSON.stringify(r.test.id)} / 保存先=${r.test.repository} / 期待=${r.test.status} / 書名=${r.test.title || "検査なし"} / 成功JSON=${r.test.successShape ? "検査する" : "検査なし"} / エラー安全性=${r.test.safeError ? "検査する" : "検査なし"}\n   モデル: ${r.errors.length ? r.errors.join(" / ") : "期待と一致"}`,
    ),
    "",
    "## 用意した不具合の検出",
    result.valid
      ? `基準モデルとの期待値照合が全件一致。次は用意した${MUTANTS.length}種類の変更だけを確認。`
      : "期待値を見直すまで検出件数を確定しません。",
    ...result.mutations.map(
      (m) =>
        `- ${m.title}: ${!result.valid ? "未判定" : m.caughtBy.length ? "検出 / 項目" + m.caughtBy.map((i) => i + 1).join(",") : "未検出"}`,
    ),
    "",
    "## 同時更新",
    `version照合: ${d.guarded ? "あり" : "なし"}`,
    ...race.events.map((e, i) => `${i + 1}. ${e.client}: ${e.detail}`),
    `最終状態: ${race.book.title} / version=${race.book.version}`,
    "",
    "## 自分の調査メモ・次に実コードで確かめること",
    d.notes || "未記入",
    "",
  ].join("\n");
}
