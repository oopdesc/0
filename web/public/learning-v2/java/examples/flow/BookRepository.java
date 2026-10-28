package zero.learning;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Optional;

/** Each operation owns a JDBC connection. The demo URL is an isolated H2 in-memory DB. */
public final class BookRepository {
    private final String jdbcUrl;

    public BookRepository(String jdbcUrl) { this.jdbcUrl = jdbcUrl; }
    private Connection open() throws SQLException { return DriverManager.getConnection(jdbcUrl, "sa", ""); }

    public void initialise() throws SQLException {
        try (Connection c = open(); Statement st = c.createStatement()) {
            st.execute("CREATE TABLE IF NOT EXISTS books (id BIGINT PRIMARY KEY, title VARCHAR(80) NOT NULL)");
            // H2-specific seed syntax; the fixture is not an existing business DB.
            st.execute("MERGE INTO books KEY(id) VALUES (1, 'Java入門'), (2, 'Rust入門')");
        }
    }

    public Optional<Book> findById(long id) throws SQLException {
        String sql = "SELECT id, title FROM books WHERE id = ?";
        try (Connection c = open(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, id); // SQL and the input value are kept separate.
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(new Book(rs.getLong("id"), rs.getString("title"))) : Optional.empty();
            }
        }
    }

    /** Return false for a duplicate ID; all other database failures propagate. */
    public boolean insert(long id, String title) throws SQLException {
        try (Connection c = open(); PreparedStatement ps = c.prepareStatement("INSERT INTO books (id, title) VALUES (?, ?)")) {
            ps.setLong(1, id);
            ps.setString(2, title);
            return ps.executeUpdate() == 1;
        } catch (SQLException e) {
            // The bundled H2 fixture reports primary-key conflicts with SQLState 23505.
            if ("23505".equals(e.getSQLState())) return false;
            throw e;
        }
    }

    public boolean delete(long id) throws SQLException {
        try (Connection c = open(); PreparedStatement ps = c.prepareStatement("DELETE FROM books WHERE id = ?")) {
            ps.setLong(1, id);
            return ps.executeUpdate() == 1;
        }
    }

    public boolean updateTitle(long id, String title) throws SQLException {
        return updateTitleForTest(id, title, false);
    }

    // Failure injection is package-private and used only by the local test fixture.
    boolean updateTitleForTest(long id, String title, boolean failAfterUpdate) throws SQLException {
        try (Connection c = open()) {
            c.setAutoCommit(false);
            try (PreparedStatement ps = c.prepareStatement("UPDATE books SET title = ? WHERE id = ?")) {
                ps.setString(1, title);
                ps.setLong(2, id);
                int changed = ps.executeUpdate();
                if (failAfterUpdate) throw new SQLException("fixture failure after update");
                c.commit();
                return changed == 1;
            } catch (SQLException e) {
                try { c.rollback(); } catch (SQLException rollback) { e.addSuppressed(rollback); }
                throw e;
            }
        }
    }
}
