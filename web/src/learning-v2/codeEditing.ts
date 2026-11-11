/** Indent whole selected lines while retaining the selection and every unselected line. */
export function indentCode(
  code: string,
  start: number,
  end: number,
  outdent = false,
) {
  const from = Math.max(0, Math.min(code.length, Math.trunc(start)));
  const to = Math.max(from, Math.min(code.length, Math.trunc(end)));
  const first = from === 0 ? 0 : code.lastIndexOf("\n", from - 1) + 1;
  const last = to > from && code[to - 1] === "\n" ? to - 1 : to;
  const nextLine = code.indexOf("\n", last);
  const limit = nextLine < 0 ? code.length : nextLine;
  const lines = code.slice(first, limit).split("\n");
  const deltas: number[] = [];
  const replacement = lines
    .map((line) => {
      if (!outdent) {
        deltas.push(4);
        return "    " + line;
      }
      const remove = line.startsWith("\t")
        ? 1
        : line.match(/^ {0,4}/)![0].length;
      deltas.push(-remove);
      return line.slice(remove);
    })
    .join("\n");
  const selectedStart = Math.max(first, from + deltas[0]);
  return {
    code: code.slice(0, first) + replacement + code.slice(limit),
    start: selectedStart,
    end:
      from === to
        ? selectedStart
        : Math.max(
            selectedStart,
            to + deltas.reduce((sum, delta) => sum + delta, 0),
          ),
  };
}
