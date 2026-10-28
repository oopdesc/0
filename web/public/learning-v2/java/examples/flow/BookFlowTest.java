package zero.learning;

import static org.junit.jupiter.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class BookFlowTest {
    private String url;
    private BookRepository repository;
    private HttpServer server;
    private ExecutorService executor;
    private HttpClient client;
    private String origin;

    @BeforeEach void start() throws Exception {
        url = "jdbc:h2:mem:test_" + UUID.randomUUID().toString().replace("-", "") + ";DB_CLOSE_DELAY=-1";
        repository = new BookRepository(url); repository.initialise();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/books/", new BookController(new BookService(repository)));
        executor = Executors.newFixedThreadPool(2); server.setExecutor(executor); server.start();
        client = HttpClient.newHttpClient(); origin = "http://127.0.0.1:" + server.getAddress().getPort();
    }
    @AfterEach void stop() { server.stop(0); executor.shutdownNow(); }
    private HttpResponse<String> get(String id) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(origin + "/api/books/" + id)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }
    private HttpResponse<String> put(String id, String title) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(origin + "/api/books/" + id)).header("Content-Type", "text/plain; charset=utf-8").PUT(HttpRequest.BodyPublishers.ofString(title)).build(), HttpResponse.BodyHandlers.ofString());
    }
    private HttpResponse<String> post(String id, String title) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(origin + "/api/books/" + id)).header("Content-Type", "text/plain; charset=utf-8").POST(HttpRequest.BodyPublishers.ofString(title)).build(), HttpResponse.BodyHandlers.ofString());
    }
    private HttpResponse<String> delete(String id) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(origin + "/api/books/" + id)).DELETE().build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test void normalRequestUsesHttpJdbcAndJson() throws Exception {
        var r = get("1"); assertEquals(200, r.statusCode()); assertEquals("{\"id\":1,\"title\":\"Java入門\"}", r.body());
        assertTrue(r.headers().firstValue("Content-Type").orElseThrow().startsWith("application/json"));
    }
    @Test void validateIds() {
        assertEquals(1L, BookService.validId("1"));
        assertEquals(999999999L, BookService.validId("999999999"));
        for (String bad : new String[]{"0", "abc", "", "1000000000", "-1"}) {
            assertThrows(IllegalArgumentException.class, () -> BookService.validId(bad));
        }
        assertThrows(IllegalArgumentException.class, () -> BookService.validId(null));
    }
    @Test void invalidInputAndMissingAreDifferent() throws Exception {
        assertEquals(400, get("abc").statusCode()); assertEquals(400, get("0").statusCode()); assertEquals(404, get("99").statusCode());
        assertEquals(400, put("1", " ").statusCode());
    }
    @Test void databaseFailureIs503WithoutLeakingSql() throws Exception {
        try (var c = DriverManager.getConnection(url, "sa", ""); var st = c.createStatement()) { st.execute("DROP TABLE books"); }
        var r = get("1"); assertEquals(503, r.statusCode()); assertEquals("{\"error\":\"storage_unavailable\"}", r.body());
    }
    @Test void updateCommitsAndForcedFailureRollsBack() throws Exception {
        var r = put("1", "Java 17"); assertEquals(200, r.statusCode()); assertEquals("Java 17", repository.findById(1).orElseThrow().title());
        assertThrows(SQLException.class, () -> repository.updateTitleForTest(1, "must roll back", true));
        assertEquals("Java 17", repository.findById(1).orElseThrow().title());
        assertEquals(404, put("99", "absent").statusCode());
    }
    @Test void twoRequestsAreIndependent() throws Exception {
        var a = HttpRequest.newBuilder(URI.create(origin + "/api/books/1")).GET().build();
        var b = HttpRequest.newBuilder(URI.create(origin + "/api/books/2")).GET().build();
        CompletableFuture<HttpResponse<String>> one = client.sendAsync(a, HttpResponse.BodyHandlers.ofString());
        CompletableFuture<HttpResponse<String>> two = client.sendAsync(b, HttpResponse.BodyHandlers.ofString());
        assertTrue(one.join().body().contains("Java入門")); assertTrue(two.join().body().contains("Rust入門"));
        assertEquals(200, one.join().statusCode()); assertEquals(200, two.join().statusCode());
    }
    @Test void requestBodyLimitsAndContentTypeAreExplicit() throws Exception {
        var wrongType = HttpRequest.newBuilder(URI.create(origin + "/api/books/1"))
                .header("Content-Type", "application/json").PUT(HttpRequest.BodyPublishers.ofString("{}")) .build();
        assertEquals(415, client.send(wrongType, HttpResponse.BodyHandlers.ofString()).statusCode());
        assertEquals(413, put("1", "a".repeat(4097)).statusCode());
        assertEquals(400, put("1", "a".repeat(81)).statusCode());
    }
    @Test void createReadUpdateDeleteAndDuplicateIdAreDistinct() throws Exception {
        assertEquals(404, get("3").statusCode());
        var created = post("3", "Java ' OR 1=1 --");
        assertEquals(201, created.statusCode());
        assertEquals("Java ' OR 1=1 --", repository.findById(3).orElseThrow().title());
        assertEquals(200, get("3").statusCode());
        assertEquals(409, post("3", "must not overwrite").statusCode());
        assertEquals("Java ' OR 1=1 --", repository.findById(3).orElseThrow().title());
        assertEquals(200, put("3", "updated").statusCode());
        assertEquals("updated", repository.findById(3).orElseThrow().title());
        var deleted = delete("3");
        assertEquals(200, deleted.statusCode()); assertEquals("{\"deleted\":true}", deleted.body());
        assertEquals(404, get("3").statusCode()); assertEquals(404, delete("3").statusCode());
        assertEquals(400, post("abc", "title").statusCode()); assertEquals(400, post("4", " ").statusCode());
        assertEquals(400, delete("0").statusCode()); assertEquals(413, post("4", "a".repeat(4097)).statusCode());
        assertTrue(repository.findById(1).isPresent());
    }
    @Test void createAndRenameValidateTitlesBeforeDatabase() throws Exception {
        var service = new BookService(repository);
        assertThrows(IllegalArgumentException.class, () -> service.create("4", null));
        assertThrows(IllegalArgumentException.class, () -> service.create("4", "a".repeat(81)));
        assertTrue(service.create("4", "a".repeat(80)).isPresent());
        assertThrows(IllegalArgumentException.class, () -> service.rename("4", "\t\n"));
        assertEquals("a".repeat(80), repository.findById(4).orElseThrow().title());
    }
    @Test void titleIsEscapedAsJsonAndIdIsValidatedBeforeSql() throws Exception {
        var r = put("1", "A\"B\\C\nD"); assertEquals(200, r.statusCode()); assertEquals("{\"id\":1,\"title\":\"A\\\"B\\\\C\\nD\"}", r.body());
        assertThrows(IllegalArgumentException.class, () -> new BookService(repository).find("1 OR 1=1"));
    }
}
