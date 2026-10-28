package learning.books.http;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Optional;

/**
 * JDBC + SQLite の実装。コンパイルに外部 jar は不要（java.sql は JDK 同梱）。
 * 実行時だけ SQLite JDBC ドライバ（org.xerial:sqlite-jdbc）をクラスパスへ置く。
 * SQL は PreparedStatement の ? へ値をバインドし、文字列結合で組み立てない。
 */
public final class JdbcBookRepository implements BookRepository {
    private final String jdbcUrl;

    public JdbcBookRepository(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
        try (Connection con = open(); Statement st = con.createStatement()) {
            st.executeUpdate("CREATE TABLE IF NOT EXISTS books ("
                    + "id INTEGER PRIMARY KEY, title TEXT NOT NULL, version INTEGER NOT NULL)");
        } catch (SQLException e) {
            throw new RepositoryException("schema initialization failed", e);
        }
    }

    private Connection open() throws SQLException {
        return DriverManager.getConnection(jdbcUrl);
    }

    @Override
    public Optional<Book> findById(int id) {
        String sql = "SELECT id, title, version FROM books WHERE id = ?";
        try (Connection con = open(); PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return Optional.empty();
                return Optional.of(new Book(rs.getInt("id"), rs.getString("title"), rs.getInt("version")));
            }
        } catch (SQLException e) {
            throw new RepositoryException("findById failed", e);
        }
    }

    @Override
    public Book insert(String title) {
        String sql = "INSERT INTO books (title, version) VALUES (?, 1)";
        try (Connection con = open();
             PreparedStatement ps = con.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, title);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) throw new RepositoryException("no generated key", null);
                int id = keys.getInt(1);
                return new Book(id, title, 1);
            }
        } catch (SQLException e) {
            throw new RepositoryException("insert failed", e);
        }
    }

    /** 明示 id での初期データ投入用（存在すれば何もしない）。 */
    public void seed(int id, String title) {
        String sql = "INSERT OR IGNORE INTO books (id, title, version) VALUES (?, ?, 1)";
        try (Connection con = open(); PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setInt(1, id);
            ps.setString(2, title);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RepositoryException("seed failed", e);
        }
    }

    @Override
    public boolean updateTitle(int id, String title, int expectedVersion) {
        // WHERE 句の version 条件が楽観ロック。更新件数 0 は「古い version への同時更新」を表す。
        String sql = "UPDATE books SET title = ?, version = version + 1 WHERE id = ? AND version = ?";
        try (Connection con = open(); PreparedStatement ps = con.prepareStatement(sql)) {
            ps.setString(1, title);
            ps.setInt(2, id);
            ps.setInt(3, expectedVersion);
            return ps.executeUpdate() == 1;
        } catch (SQLException e) {
            throw new RepositoryException("updateTitle failed", e);
        }
    }
}
