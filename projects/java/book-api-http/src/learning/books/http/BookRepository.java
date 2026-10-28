package learning.books.http;

import java.util.Optional;

/** 保存層の境界。実装を差し替えても Controller / Service は変わらない。 */
public interface BookRepository {
    Optional<Book> findById(int id);

    /** 新規登録。既に同じ id があれば IllegalStateException。 */
    Book insert(String title);

    /** version が一致したときだけタイトルを更新し、version を1増やす。成功なら true。 */
    boolean updateTitle(int id, String title, int expectedVersion);
}
