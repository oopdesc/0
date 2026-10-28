package learning.books.http;

import learning.books.http.BookService.GetResult;
import learning.books.http.BookService.UpdateResult;

/**
 * JUnit を使わない簡易テスト（他プロジェクトと同じ方式）。
 * 実行: java learning.books.http.BookApiHttpTest
 * JDBC を使う場合は -Darena.jdbc.url=jdbc:sqlite:<file> を付けると JDBC 実装も検証する。
 */
public final class BookApiHttpTest {
    public static void main(String[] args) {
        InMemoryBookRepository memory = new InMemoryBookRepository();
        memory.putSeed(1, "JavaでHTTPを学ぶ");
        checkRepository(memory, "memory");
        String jdbcUrl = System.getProperty("arena.jdbc.url");
        if (jdbcUrl != null && !jdbcUrl.isBlank()) {
            JdbcBookRepository jdbc = new JdbcBookRepository(jdbcUrl);
            jdbc.seed(1, "JavaでHTTPを学ぶ");
            checkRepository(jdbc, "jdbc");
            System.out.println("BookApiHttpTest: JDBC checks passed");
        } else {
            System.out.println("BookApiHttpTest: JDBC checks skipped (set -Darena.jdbc.url to run them)");
        }
        checkService();
        checkRequestId();
        System.out.println("BookApiHttpTest: all checks passed");
    }

    private static void checkRepository(BookRepository repo, String label) {
        check(repo.findById(1).orElseThrow().title().equals("JavaでHTTPを学ぶ"), label + " find");
        check(repo.findById(99).isEmpty(), label + " missing is Optional.empty");
        // version が古い更新は競合として拒否される（後勝ちで上書きしない）
        check(repo.updateTitle(1, "JavaでHTTPを学ぶ 改訂", 1), label + " update ok");
        check(!repo.updateTitle(1, "上書き", 1), label + " stale version rejected");
        check(repo.findById(1).orElseThrow().version() == 2, label + " version bumped");
    }

    private static void checkService() {
        InMemoryBookRepository repo = new InMemoryBookRepository();
        repo.putSeed(1, "JavaでHTTPを学ぶ");
        BookService service = new BookService(repo, () -> "req-test");
        check(service.get("1") instanceof GetResult.Found, "service found");
        check(service.get("abc") instanceof GetResult.BadInput, "service bad input stops before repository");
        check(service.get("99") instanceof GetResult.Missing, "service missing");
        check(service.rename("1", "新しい題名", "1") instanceof UpdateResult.Updated, "service update");
        check(service.rename("1", "競合", "1") instanceof UpdateResult.Conflict, "service conflict");
        check(service.rename("x", "題名", "1") instanceof UpdateResult.BadInput, "service update bad id");
        check(service.rename("1", " ", "1") instanceof UpdateResult.BadInput, "service update blank title");
    }

    /** requestId が HTTP 層から保存層の失敗まで同じ値で貫通し、エラー応答に含まれることを固定する。 */
    private static void checkRequestId() {
        BookRepository failing = new BookRepository() {
            @Override public java.util.Optional<Book> findById(int id) {
                throw new RepositoryException("findById failed", new RuntimeException("secret-detail"));
            }
            @Override public Book insert(String title) { throw new UnsupportedOperationException(); }
            @Override public boolean updateTitle(int id, String title, int expectedVersion) {
                throw new RepositoryException("updateTitle failed", new RuntimeException("secret-detail"));
            }
        };
        BookService service = new BookService(failing, () -> "generated-id");
        GetResult got = service.get("1", "req-42");
        check(got instanceof GetResult.Failure f && f.requestId().equals("req-42"),
                "requestId from HTTP layer reaches storage failure unchanged");
        UpdateResult upd = service.rename("1", "題名", "1", "req-43");
        check(upd instanceof UpdateResult.Failure f && f.requestId().equals("req-43"),
                "requestId reaches update failure unchanged");
        String body = Json.error("内部エラーが発生しました", "req-42");
        check(body.contains("\"requestId\":\"req-42\""), "error response carries requestId");
        check(!body.contains("secret-detail"), "error response never leaks storage internals");
    }

    private static void check(boolean ok, String label) {
        if (!ok) throw new AssertionError(label);
    }
}
