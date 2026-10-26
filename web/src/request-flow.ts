export type FlowStep = { name: string; code: string; note: string };
export function requestTrace(raw: string) {
  const valid = /^[1-9]\d{0,5}$/.test(raw);
  const id = valid ? Number(raw) : 0;
  const rows = [
    { id: 1, title: "JavaでHTTPを学ぶ" },
    { id: 2, title: "Rustの所有権を学ぶ" },
  ];
  const row = valid ? rows.find((r) => r.id === id) : undefined;
  const status = !valid ? 400 : row ? 200 : 404;
  const body = !valid
    ? { error: "IDは1以上の整数にしてください" }
    : row || { error: "本が見つかりません" };
  const steps: FlowStep[] = [
    {
      name: "ブラウザから送る",
      code: `fetch("/api/books/${encodeURIComponent(raw)}")`,
      note: "画面の入力をHTTPリクエストへ変えます。この教材では送信の流れをブラウザ内で再現します。",
    },
    {
      name: "HTTPでJavaへ届く",
      code: `GET /api/books/${encodeURIComponent(raw)} HTTP/1.1`,
      note: "URLとHTTPメソッドから、呼び出すControllerを決めます。",
    },
    {
      name: "Controllerで入力を確かめる",
      code: 'if (!idText.matches("[1-9][0-9]{0,5}")) {\n    return badRequest();\n}\nint id = Integer.parseInt(idText);',
      note: valid
        ? "IDの形式が正しいので、処理を続けます。"
        : "入力が不正なので400を返します。Service・DBへは進みません。",
    },
  ];
  if (valid)
    steps.push(
      {
        name: "ServiceからRepositoryへ",
        code: "Optional<Book> book = repository.findById(id);",
        note: "ControllerはHTTP、Serviceは処理の判断、Repositoryはデータ取得を担当します。",
      },
      {
        name: "JDBCでSQLと値を渡す",
        code: 'try (PreparedStatement ps = connection.prepareStatement(\n    "SELECT id, title FROM learning_books WHERE id = ?")) {\n    ps.setInt(1, id);\n    // ResultSetをBookへ変換する\n}',
        note: `SQL本文と値を分けます。? に渡す値は ${id} です。`,
      },
      {
        name: "DBが該当する行を返す",
        code: JSON.stringify(row ? [row] : [], null, 2),
        note: row
          ? "条件に一致する1行が返りました。"
          : "一致する行は0件です。これは通信エラーとは別の状態です。",
      },
      {
        name: "RepositoryがJavaの値に変換する",
        code: row
          ? 'Book book = new Book(rs.getInt("id"), rs.getString("title"));\nreturn Optional.of(book);'
          : "return Optional.empty();",
        note: "DBの行をJavaのオブジェクトへ変換し、呼び出し元へ戻します。",
      },
    );
  steps.push(
    {
      name: "JavaからHTTP応答を返す",
      code: `HTTP/1.1 ${status}\nContent-Type: application/json\n\n${JSON.stringify(body, null, 2)}`,
      note:
        status === 200
          ? "見つかったデータを200で返します。"
          : status === 404
            ? "取得対象がないことを404で返します。"
            : "入力に問題があることを400で返します。",
    },
    {
      name: "ブラウザが応答を画面へ戻す",
      code: "const response = await fetch(url);\nconst data = await response.json();\nif (!response.ok) {\n  message.textContent = data.error;\n} else {\n  title.textContent = data.title;\n}",
      note: "HTTPステータスと本文を確かめてから、結果またはエラーを表示します。",
    },
  );
  return { status, body, dbQueried: valid, steps };
}
