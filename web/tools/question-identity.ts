/** Build-time identity rules. A concept shared by two exercises is not a duplicate. */
export type CountedQuestion = {
  key: string;
  language: string;
  source: "normal" | "supplemental" | "exam" | "legacy";
  prompt: string;
  code: string;
  answer: string;
  mode: string;
  writing: boolean;
  aliases: string[];
  options?: string[];
  predictive?: boolean;
  title?: string;
  topics?: string[];
  level?: "beginner" | "intermediate" | "advanced";
};

export function textIdentity(text: string) {
  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\s\u3000]+/gu, " ")
    .trim();
}

/** Remove formatting/comments without changing the contents of quoted literals. */
export function codeIdentity(code: string, language = "java") {
  const parts: string[] = [];
  let i = 0;
  while (i < code.length) {
    if (/\s/u.test(code[i])) {
      i++;
      continue;
    }
    if (code.startsWith("//", i)) {
      const end = code.indexOf("\n", i);
      i = end < 0 ? code.length : end + 1;
      continue;
    }
    if (code.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < code.length && depth) {
        if (language === "rust" && code.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (code.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      continue;
    }
    const raw =
      language === "rust" ? /^(?:br|r)(#{0,16})"/.exec(code.slice(i)) : null;
    if (raw) {
      const end = code.indexOf('"' + raw[1], i + raw[0].length);
      const finish = end < 0 ? code.length : end + raw[1].length + 1;
      parts.push(code.slice(i, finish));
      i = finish;
      continue;
    }
    if (code.startsWith('"""', i)) {
      const end = code.indexOf('"""', i + 3),
        finish = end < 0 ? code.length : end + 3;
      parts.push(code.slice(i, finish));
      i = finish;
      continue;
    }
    if (
      code[i] === '"' ||
      (code[i] === "'" && /^'(?:\\.|[^'\\])'/u.test(code.slice(i)))
    ) {
      const start = i,
        quote = code[i++];
      while (i < code.length) {
        if (code[i] === "\\") {
          i += 2;
          continue;
        }
        if (code[i++] === quote) break;
      }
      parts.push(code.slice(start, i));
      continue;
    }
    const number =
      /^(?:0[xX][0-9a-fA-F_]+(?:\.(?!\.)[0-9a-fA-F_]*)?(?:[pP][+-]?[0-9_]+)?[a-zA-Z0-9_]*|0[bBoO][0-9_]+|(?:[0-9][0-9_]*(?:\.(?!\.)[0-9_]*)?|\.[0-9][0-9_]*)(?:[eE][+-]?[0-9_]+)?[a-zA-Z0-9_]*)/u.exec(
        code.slice(i),
      );
    if (number) {
      parts.push(number[0]);
      i += number[0].length;
      continue;
    }
    const token =
      /^(?:[\p{L}\p{N}_$]+|>>>=|>>>|>>=|<<=|>>|<<|::|->|=>|%=|\*=|\/=|&=|\|=|\^=|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\.\.=|\.\.)/u.exec(
        code.slice(i),
      );
    parts.push(token ? token[0] : code[i]);
    i += token ? token[0].length : 1;
  }
  const joined = parts.join(" ");
  // A body and the conventional one-method executable wrapper are the same example.
  const java =
    /^public class Main \{ public static void main \( String \[ \] [\w$]+ \) \{ (.*) \} \}$/s.exec(
      joined,
    );
  const rust = /^fn main \( \) \{ (.*) \}$/s.exec(joined);
  return java?.[1] ?? rust?.[1] ?? joined;
}

export function groupQuestions(records: CountedQuestion[]) {
  const parent = records.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const join = (a: number, b: number) => {
    const x = find(a),
      y = find(b);
    if (x !== y) parent[y] = x;
  };
  const keys = new Map<string, number>(),
    origins = new Map<string, number>(),
    stems = new Map<string, number>(),
    codeAnswers = new Map<string, number>();
  records.forEach((q, i) => {
    if (keys.has(q.key)) throw Error("Duplicate inventory key: " + q.key);
    keys.set(q.key, i);
  });
  records.forEach((q, i) => {
    for (const alias of [q.key, ...q.aliases]) {
      const own = keys.get(alias);
      if (own !== undefined && records[own].language === q.language)
        join(i, own);
      const prior = origins.get(q.language + "\0" + alias);
      if (prior !== undefined) join(i, prior);
      else origins.set(q.language + "\0" + alias, i);
    }
    const code = codeIdentity(q.code, q.language),
      prefix = q.language + "\0" + q.mode + "\0";
    const stem =
      prefix +
      textIdentity(q.prompt) +
      "\0" +
      code +
      "\0" +
      JSON.stringify((q.options ?? []).map(textIdentity).sort()) +
      (q.writing ? "\0" + q.answer : "");
    // Conflicting answers to an otherwise identical question must not inflate its count.
    const old = stems.get(stem);
    if (old !== undefined) join(i, old);
    else stems.set(stem, i);
    if (code && !q.writing && q.answer && q.predictive) {
      const key = prefix + code + "\0" + q.answer;
      const prior = codeAnswers.get(key);
      if (prior !== undefined) join(i, prior);
      else codeAnswers.set(key, i);
    }
  });
  const groups = new Map<number, CountedQuestion[]>();
  records.forEach((q, i) => {
    const k = find(i);
    const a = groups.get(k) ?? [];
    a.push(q);
    groups.set(k, a);
  });
  return [...groups.values()];
}
