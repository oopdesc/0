import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Teaching starter: implement the two TODOs, then run WorkplaceTest. */
public final class BookService {
    public record Book(int id, String title, int version) {}
    public enum Update { UPDATED, MISSING, CONFLICT }
    public interface Repository {
        Optional<Book> find(int id);
        Update compareAndSet(int id, String title, int expectedVersion);
    }
    public static final class MemoryRepository implements Repository {
        private final Map<Integer, Book> books = new HashMap<>();
        public MemoryRepository() { books.put(1, new Book(1, "Java", 1)); }
        public synchronized Optional<Book> find(int id) { return Optional.ofNullable(books.get(id)); }
        public synchronized Update compareAndSet(int id, String title, int expectedVersion) {
            Book old = books.get(id);
            if (old == null) return Update.MISSING;
            if (old.version() != expectedVersion) return Update.CONFLICT;
            books.put(id, new Book(id, title, old.version() + 1));
            return Update.UPDATED;
        }
    }
    private final Repository repository;
    public BookService(Repository repository) { this.repository = repository; }

    public static int validId(String raw) {
        // TODO 1: ASCII digits only; leading zero allowed; 1..2147483647.
        // Reject null/empty/invalid/range error with IllegalArgumentException.
        throw new UnsupportedOperationException("TODO validId");
    }
    public Optional<Book> find(String raw) { return repository.find(validId(raw)); }

    public Update rename(String raw, String title, int expectedVersion) {
        // TODO 2: validate id/title/version, then call the atomic repository operation.
        // Do NOT implement read -> check -> unconditional write in this layer.
        throw new UnsupportedOperationException("TODO rename");
    }
}
