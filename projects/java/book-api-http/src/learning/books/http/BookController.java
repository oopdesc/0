package learning.books.http;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * HTTP との変換だけを行う層（Controller）。
 * GET /api/books/{id}            … 取得（200 / 400 / 404 / 500）
 * PUT /api/books/{id}            … タイトル更新。body は title=...&version=... のフォーム形式
 *                                  （200 / 400 / 404 / 409 / 500）
 */
public final class BookController implements HttpHandler {
    private final BookService service;

    public BookController(BookService service) {
        this.service = service;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        // 1 リクエストに 1 つの requestId を発行し、検証→業務判断→保存→応答→表示まで同じ ID で追う
        String requestId = UUID.randomUUID().toString();
        try {
            String path = ex.getRequestURI().getPath();
            String prefix = "/api/books/";
            if (!path.startsWith(prefix)) {
                reply(ex, requestId, 404, Json.error("本が見つかりません", requestId));
                return;
            }
            String rawId = path.substring(prefix.length());
            switch (ex.getRequestMethod()) {
                case "GET" -> handleGet(ex, rawId, requestId);
                case "PUT" -> handlePut(ex, rawId, requestId);
                default -> reply(ex, requestId, 405, Json.error("メソッドが許可されていません", requestId));
            }
        } finally {
            ex.close();
        }
    }

    private void handleGet(HttpExchange ex, String rawId, String requestId) throws IOException {
        BookService.GetResult result = service.get(rawId, requestId);
        if (result instanceof BookService.GetResult.Found found) {
            reply(ex, requestId, 200, Json.book(found.book()));
        } else if (result instanceof BookService.GetResult.BadInput bad) {
            reply(ex, requestId, 400, Json.error(bad.reason(), requestId));
        } else if (result instanceof BookService.GetResult.Missing) {
            reply(ex, requestId, 404, Json.error("本が見つかりません", requestId));
        } else {
            reply(ex, requestId, 500, Json.error("内部エラーが発生しました", requestId));
        }
    }

    private void handlePut(HttpExchange ex, String rawId, String requestId) throws IOException {
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        Map<String, String> form = parseForm(body);
        BookService.UpdateResult result = service.rename(rawId, form.get("title"), form.get("version"), requestId);
        if (result instanceof BookService.UpdateResult.Updated updated) {
            reply(ex, requestId, 200, Json.book(updated.book()));
        } else if (result instanceof BookService.UpdateResult.BadInput bad) {
            reply(ex, requestId, 400, Json.error(bad.reason(), requestId));
        } else if (result instanceof BookService.UpdateResult.Missing) {
            reply(ex, requestId, 404, Json.error("本が見つかりません", requestId));
        } else if (result instanceof BookService.UpdateResult.Conflict) {
            reply(ex, requestId, 409, Json.error("他のリクエストで更新されています", requestId));
        } else {
            reply(ex, requestId, 500, Json.error("内部エラーが発生しました", requestId));
        }
    }

    /** 応答を送り、同じ requestId で結果をサーバ側ログに 1 行残す（内部詳細は Service 側のログにだけある）。 */
    private static void reply(HttpExchange ex, String requestId, int status, String json) throws IOException {
        System.err.println("[book-api] requestId=" + requestId + " " + ex.getRequestMethod() + " " + ex.getRequestURI().getPath() + " -> " + status);
        send(ex, requestId, status, json);
    }

    private static Map<String, String> parseForm(String body) {
        Map<String, String> form = new HashMap<>();
        if (body == null || body.isBlank()) return form;
        for (String pair : body.split("&")) {
            int eq = pair.indexOf('=');
            if (eq < 0) continue;
            String key = URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8);
            String value = URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
            form.put(key, value);
        }
        return form;
    }

    private static void send(HttpExchange ex, String requestId, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.getResponseHeaders().set("X-Request-Id", requestId);
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }
}
