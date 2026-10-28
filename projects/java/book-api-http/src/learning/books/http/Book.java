package learning.books.http;

/** 書籍1件。version は楽観ロック（同時更新の検出）に使う。 */
public record Book(int id, String title, int version) {
    public Book {
        if (id <= 0) throw new IllegalArgumentException("id must be positive");
        if (title == null || title.isBlank()) throw new IllegalArgumentException("title is required");
        if (version < 0) throw new IllegalArgumentException("version must be >= 0");
        title = title.trim();
    }
}
