package zero.learning;

import java.sql.SQLException;
import java.util.Optional;

/** Input and business rules live here; HTTP and SQL have separate responsibilities. */
public final class BookService {
    private final BookRepository repository;
    public BookService(BookRepository repository) { this.repository = repository; }

    public static long validId(String text) {
        if (text == null || !text.matches("[1-9][0-9]{0,8}")) {
            throw new IllegalArgumentException("id must be a positive decimal integer of at most 9 digits");
        }
        return Long.parseLong(text);
    }
    public Optional<Book> find(String idText) throws SQLException {
        return repository.findById(validId(idText));
    }
    private static String validTitle(String title) {
        if (title == null || title.isBlank() || title.length() > 80) {
            throw new IllegalArgumentException("title must contain 1 to 80 UTF-16 code units");
        }
        return title;
    }
    public Optional<Book> create(String idText, String title) throws SQLException {
        long id = validId(idText);
        String checkedTitle = validTitle(title);
        if (!repository.insert(id, checkedTitle)) return Optional.empty();
        return Optional.of(new Book(id, checkedTitle));
    }
    public Optional<Book> rename(String idText, String title) throws SQLException {
        long id = validId(idText);
        String checkedTitle = validTitle(title);
        if (!repository.updateTitle(id, checkedTitle)) return Optional.empty();
        return Optional.of(new Book(id, checkedTitle));
    }
    public boolean delete(String idText) throws SQLException {
        return repository.delete(validId(idText));
    }
}
