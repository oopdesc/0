package learning.books.http;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/** 依存ゼロで動く実装。プロセスを止めると内容は消える（教材の比較用）。 */
public final class InMemoryBookRepository implements BookRepository {
    private final ConcurrentHashMap<Integer, Book> books = new ConcurrentHashMap<>();
    private final AtomicInteger sequence = new AtomicInteger(0);

    @Override
    public Optional<Book> findById(int id) {
        return Optional.ofNullable(books.get(id));
    }

    @Override
    public Book insert(String title) {
        int id = sequence.incrementAndGet();
        Book book = new Book(id, title, 1);
        books.put(id, book);
        return book;
    }

    /** 明示 id での初期データ投入用。 */
    public Book putSeed(int id, String title) {
        Book book = new Book(id, title, 1);
        books.put(id, book);
        sequence.accumulateAndGet(id, Math::max);
        return book;
    }

    @Override
    public boolean updateTitle(int id, String title, int expectedVersion) {
        boolean[] updated = { false };
        books.computeIfPresent(id, (key, current) -> {
            if (current.version() != expectedVersion) return current;
            updated[0] = true;
            return new Book(id, title, current.version() + 1);
        });
        return updated[0];
    }
}
