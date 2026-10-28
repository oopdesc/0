package learning.books.http;

/** 保存層の失敗。内部詳細（SQLや接続文字列）は HTTP 応答へ出さず、cause として保持する。 */
public final class RepositoryException extends RuntimeException {
    public RepositoryException(String message, Throwable cause) {
        super(message, cause);
    }
}
