package learning.books.http;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * 処理の判断を行う層。HTTP の言葉（ステータスコード）は持たず、
 * 結果の種類（sealed 型）で Controller へ返す。
 */
public final class BookService {
    public sealed interface GetResult {
        record Found(Book book) implements GetResult { }
        record BadInput(String reason) implements GetResult { }
        record Missing(int id) implements GetResult { }
        record Failure(String requestId) implements GetResult { }
    }

    public sealed interface UpdateResult {
        record Updated(Book book) implements UpdateResult { }
        record BadInput(String reason) implements UpdateResult { }
        record Missing(int id) implements UpdateResult { }
        record Conflict(int id) implements UpdateResult { }
        record Failure(String requestId) implements UpdateResult { }
    }

    private final BookRepository repository;
    private final Supplier<String> requestIds;

    public BookService(BookRepository repository) {
        this(repository, () -> UUID.randomUUID().toString());
    }

    BookService(BookRepository repository, Supplier<String> requestIds) {
        this.repository = repository;
        this.requestIds = requestIds;
    }

    public static Optional<Integer> parseId(String raw) {
        if (raw == null || !raw.matches("[1-9][0-9]{0,5}")) return Optional.empty();
        return Optional.of(Integer.parseInt(raw));
    }

    public GetResult get(String rawId) {
        return get(rawId, requestIds.get());
    }

    /** requestId は HTTP 層で発行されたものをそのまま使う（検証→業務判断→保存→応答を1つの ID で追う）。 */
    public GetResult get(String rawId, String requestId) {
        Optional<Integer> id = parseId(rawId);
        if (id.isEmpty()) return new GetResult.BadInput("IDは1以上の整数にしてください");
        try {
            return repository.findById(id.get())
                    .<GetResult>map(GetResult.Found::new)
                    .orElseGet(() -> new GetResult.Missing(id.get()));
        } catch (RepositoryException e) {
            // 内部の詳細はサーバ側ログだけに残し、応答には含めない（Q: DB失敗シナリオと対応）
            System.err.println("[book-api] requestId=" + requestId + " stage=storage result=failure detail=" + e.getMessage());
            return new GetResult.Failure(requestId);
        }
    }

    public UpdateResult rename(String rawId, String title, String rawVersion) {
        return rename(rawId, title, rawVersion, requestIds.get());
    }

    public UpdateResult rename(String rawId, String title, String rawVersion, String requestId) {
        Optional<Integer> id = parseId(rawId);
        if (id.isEmpty()) return new UpdateResult.BadInput("IDは1以上の整数にしてください");
        if (title == null || title.isBlank()) return new UpdateResult.BadInput("titleは必須です");
        final int version;
        try {
            version = Integer.parseInt(rawVersion == null ? "" : rawVersion.trim());
        } catch (NumberFormatException e) {
            return new UpdateResult.BadInput("versionは整数にしてください");
        }
        try {
            if (repository.findById(id.get()).isEmpty()) return new UpdateResult.Missing(id.get());
            boolean ok = repository.updateTitle(id.get(), title.trim(), version);
            if (!ok) return new UpdateResult.Conflict(id.get());
            return repository.findById(id.get())
                    .<UpdateResult>map(UpdateResult.Updated::new)
                    .orElseGet(() -> new UpdateResult.Failure(requestId));
        } catch (RepositoryException e) {
            System.err.println("[book-api] requestId=" + requestId + " stage=storage result=failure detail=" + e.getMessage());
            return new UpdateResult.Failure(requestId);
        }
    }
}
