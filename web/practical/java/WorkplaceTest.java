import java.util.Optional;

public final class WorkplaceTest {
    private static int passed, failed;
    private static void check(boolean condition) { if (!condition) throw new AssertionError("expectation mismatch"); }
    private static void rejects(Runnable action) {
        try { action.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("expected IllegalArgumentException");
    }
    private static void test(String name, Runnable body) {
        try { body.run(); passed++; System.out.println("PASS " + name); }
        catch (Throwable error) { failed++; System.out.println("FAIL " + name + ": " + error); }
    }
    public static void main(String[] args) {
        test("valid IDs and leading zeros", () -> {
            check(BookService.validId("1") == 1);
            check(BookService.validId("001") == 1);
            check(BookService.validId("2147483647") == Integer.MAX_VALUE);
        });
        test("strict format and range", () -> {
            for (String raw : new String[]{null,"","0","-1","+1","1abc","１","1.0"," 1","2147483648"}) rejects(() -> BookService.validId(raw));
        });
        test("invalid ID never calls repository", () -> {
            BookService.Repository trap = new BookService.Repository() {
                public Optional<BookService.Book> find(int id) { throw new AssertionError("repository reached"); }
                public BookService.Update compareAndSet(int id, String title, int version) { throw new AssertionError("repository reached"); }
            };
            rejects(() -> new BookService(trap).find("abc"));
            rejects(() -> new BookService(trap).rename("abc", "name", 1));
            rejects(() -> new BookService(trap).rename("1", "", 1));
            rejects(() -> new BookService(trap).rename("1", "name", 0));
        });
        test("found and missing remain distinct", () -> {
            BookService service = new BookService(new BookService.MemoryRepository());
            check(service.find("1").orElseThrow().title().equals("Java"));
            check(service.find("2").isEmpty());
        });
        test("successful rename increments version", () -> {
            BookService service = new BookService(new BookService.MemoryRepository());
            check(service.rename("1", "Java実践", 1) == BookService.Update.UPDATED);
            check(service.find("1").orElseThrow().equals(new BookService.Book(1, "Java実践", 2)));
        });
        test("two readers cannot silently overwrite", () -> {
            BookService service = new BookService(new BookService.MemoryRepository());
            int a = service.find("1").orElseThrow().version();
            int b = service.find("1").orElseThrow().version();
            check(service.rename("1", "Aの変更", a) == BookService.Update.UPDATED);
            check(service.rename("1", "Bの変更", b) == BookService.Update.CONFLICT);
            check(service.find("1").orElseThrow().equals(new BookService.Book(1, "Aの変更", 2)));
        });
        test("missing update changes nothing", () -> {
            BookService service = new BookService(new BookService.MemoryRepository());
            check(service.rename("2", "存在しない本", 1) == BookService.Update.MISSING);
            check(service.find("1").orElseThrow().version() == 1);
        });
        test("invalid title and version change nothing", () -> {
            BookService service = new BookService(new BookService.MemoryRepository());
            for (String title : new String[]{null,""," \t\r\n"}) rejects(() -> service.rename("1", title, 1));
            rejects(() -> service.rename("1", "有効な名前", 0));
            check(service.find("1").orElseThrow().equals(new BookService.Book(1, "Java", 1)));
        });
        System.out.println(passed + " passed, " + failed + " failed");
        if (failed != 0) throw new AssertionError("Complete the TODOs and rerun the tests.");
    }
}
