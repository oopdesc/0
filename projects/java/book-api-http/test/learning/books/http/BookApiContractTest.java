package learning.books.http;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BookApiContractTest {
    @TempDir Path directory;

    @Test void memoryAndRealJdbcContracts() throws Exception {
        String previous = System.getProperty("arena.jdbc.url");
        try {
            System.setProperty("arena.jdbc.url", "jdbc:sqlite:" + directory.resolve("books.db"));
            BookApiHttpTest.main(new String[0]);
            org.junit.jupiter.api.Assertions.assertTrue(Files.size(directory.resolve("books.db")) > 0);
        } finally {
            if (previous == null) System.clearProperty("arena.jdbc.url");
            else System.setProperty("arena.jdbc.url", previous);
        }
    }
}
