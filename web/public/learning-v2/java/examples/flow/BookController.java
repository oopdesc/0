package zero.learning;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.Optional;

/** Loopback-only learning example, not an internet-facing production server. */
public final class BookController implements HttpHandler {
    private final BookService service;
    public BookController(BookService service) { this.service = service; }

    @Override public void handle(HttpExchange ex) throws IOException {
        int status;
        String json;
        try {
            String prefix = "/api/books/";
            String path = ex.getRequestURI().getPath();
            if (!path.startsWith(prefix)) {
                status = 404; json = "{\"error\":\"not_found\"}";
            } else if ("GET".equals(ex.getRequestMethod())) {
                Optional<Book> found = service.find(path.substring(prefix.length()));
                status = found.isPresent() ? 200 : 404;
                json = found.map(BookController::bookJson).orElse("{\"error\":\"not_found\"}");
            } else if ("PUT".equals(ex.getRequestMethod()) || "POST".equals(ex.getRequestMethod())) {
                String contentType = ex.getRequestHeaders().getFirst("Content-Type");
                if (contentType == null || !contentType.split(";", 2)[0].trim().equalsIgnoreCase("text/plain")) {
                    status = 415; json = "{\"error\":\"text_plain_required\"}";
                } else {
                    byte[] bytes = ex.getRequestBody().readNBytes(4097);
                    if (bytes.length > 4096) {
                        status = 413; json = "{\"error\":\"body_too_large\"}";
                    } else {
                        String title = new String(bytes, StandardCharsets.UTF_8);
                        if ("POST".equals(ex.getRequestMethod())) {
                            Optional<Book> created = service.create(path.substring(prefix.length()), title);
                            status = created.isPresent() ? 201 : 409;
                            json = created.map(BookController::bookJson).orElse("{\"error\":\"already_exists\"}");
                        } else {
                            Optional<Book> changed = service.rename(path.substring(prefix.length()), title);
                            status = changed.isPresent() ? 200 : 404;
                            json = changed.map(BookController::bookJson).orElse("{\"error\":\"not_found\"}");
                        }
                    }
                }
            } else if ("DELETE".equals(ex.getRequestMethod())) {
                boolean deleted = service.delete(path.substring(prefix.length()));
                status = deleted ? 200 : 404;
                json = deleted ? "{\"deleted\":true}" : "{\"error\":\"not_found\"}";
            } else {
                status = 405; json = "{\"error\":\"method_not_allowed\"}";
            }
        } catch (IllegalArgumentException e) {
            status = 400; json = "{\"error\":\"invalid_input\"}";
        } catch (SQLException e) {
            // Do not return SQL or connection details to the client.
            status = 503; json = "{\"error\":\"storage_unavailable\"}";
        }
        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(status, body.length);
        try (var stream = ex.getResponseBody()) { stream.write(body); }
    }

    static String bookJson(Book b) { return "{\"id\":" + b.id() + ",\"title\":" + quote(b.title()) + "}"; }
    static String quote(String value) {
        StringBuilder result = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> result.append("\\\"");
                case '\\' -> result.append("\\\\");
                case '\n' -> result.append("\\n");
                case '\r' -> result.append("\\r");
                case '\t' -> result.append("\\t");
                default -> { if (c < 0x20) result.append(String.format("\\u%04x", (int)c)); else result.append(c); }
            }
        }
        return result.append('"').toString();
    }
}
