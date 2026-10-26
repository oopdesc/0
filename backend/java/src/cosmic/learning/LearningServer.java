package cosmic.learning;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executors;

/**
 * localhost専用の読取API。フロントの型とJavaのrecord、入力検証、HTTP応答を学びます。
 * ファイル・DB・外部API・認証情報へアクセスしません。本番Vercelでは起動しません。
 */
public final class LearningServer {

  public record Lesson(String id, String language, String title, int minutes) {}

  public static final List<Lesson> LESSONS = List.of(
    new Lesson("java-http", "Java", "HTTPと入力検証", 15),
    new Lesson("java-record", "Java", "recordと不変データ", 15),
    new Lesson("java-test", "Java", "境界値とテスト", 20),
    new Lesson("rust-own", "Rust", "所有権とVec", 20),
    new Lesson("rust-wasm", "Rust", "Wasmとメモリの境界", 20),
    new Lesson("rust-test", "Rust", "同じseedと再現性", 15),
    new Lesson("ts-state", "TypeScript", "型と状態遷移", 15),
    new Lesson("ts-ui", "TypeScript", "アクセシビリティ", 15),
    new Lesson("ts-budget", "TypeScript", "配信サイズの予算", 15)
  );

  private LearningServer() {}

  public static String normalized(String text) {
    return Normalizer.normalize(text, Normalizer.Form.NFKC)
      .toLowerCase(Locale.ROOT)
      .strip();
  }

  public static List<Lesson> search(String query) {
    if (
      query == null || query.length() > 80
    ) throw new IllegalArgumentException("q must be at most 80 characters");
    String q = normalized(query);
    return LESSONS.stream()
      .filter(x -> normalized(x.title() + " " + x.language()).contains(q))
      .toList();
  }

  /** JSONの構文と値を分ける最小例。汎用シリアライザの代用品ではありません。 */
  public static String quote(String text) {
    StringBuilder out = new StringBuilder("\"");
    for (char c : text.toCharArray()) {
      switch (c) {
        case '"' -> out.append("\\\"");
        case '\\' -> out.append("\\\\");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        default -> {
          if (c < 32) out.append(String.format("\\u%04x", (int) c));
          else out.append(c);
        }
      }
    }
    return out.append('"').toString();
  }

  public static String catalog(String query) {
    return search(query)
      .stream()
      .map(
        x ->
          "{\"id\":" +
          quote(x.id()) +
          ",\"language\":" +
          quote(x.language()) +
          ",\"title\":" +
          quote(x.title()) +
          ",\"minutes\":" +
          x.minutes() +
          "}"
      )
      .collect(
        java.util.stream.Collectors.joining(
          ",",
          "{\"language\":\"Java\",\"lessons\":[",
          "]}"
        )
      );
  }

  public static void main(String[] args) throws IOException {
    HttpServer server = HttpServer.create(
      new InetSocketAddress("127.0.0.1", 18421),
      16
    );
    server.setExecutor(Executors.newFixedThreadPool(2));
    server.createContext("/", LearningServer::handle);
    Runtime.getRuntime().addShutdownHook(new Thread(() -> server.stop(0)));
    server.start();
    System.out.println(
      "Java learning API: http://127.0.0.1:18421 (read-only, 2 workers)"
    );
  }

  private static void handle(HttpExchange ex) throws IOException {
    try {
      String host = ex.getRequestHeaders().getFirst("Host");
      String origin = ex.getRequestHeaders().getFirst("Origin");
      if (!("127.0.0.1:18421".equals(host) || "localhost:18421".equals(host))) {
        send(ex, 403, "{\"error\":\"local host required\"}");
        return;
      }
      if (
        origin != null &&
        !(
          origin.equals("http://127.0.0.1:18420") ||
          origin.equals("http://localhost:18420")
        )
      ) {
        send(ex, 403, "{\"error\":\"local origin required\"}");
        return;
      }
      if (!ex.getRequestMethod().equals("GET")) {
        ex.getResponseHeaders().set("Allow", "GET");
        send(ex, 405, "{\"error\":\"GET only\"}");
        return;
      }
      if (ex.getRequestURI().toASCIIString().length() > 1024) {
        send(ex, 414, "{\"error\":\"URI too long\"}");
        return;
      }
      switch (ex.getRequestURI().getPath()) {
        case "/api/health" -> send(
          ex,
          200,
          "{\"language\":\"Java\",\"status\":\"ok\",\"readOnly\":true}"
        );
        case "/api/catalog" -> {
          String raw = ex.getRequestURI().getRawQuery();
          if (
            raw != null && !raw.startsWith("q=")
          ) throw new IllegalArgumentException();
          String q =
            raw == null
              ? ""
              : URLDecoder.decode(raw.substring(2), StandardCharsets.UTF_8);
          send(ex, 200, catalog(q));
        }
        default -> send(ex, 404, "{\"error\":\"not found\"}");
      }
    } catch (IllegalArgumentException e) {
      send(ex, 400, "{\"error\":\"invalid query (maximum 80 characters)\"}");
    } finally {
      ex.close();
    }
  }

  private static void send(HttpExchange ex, int code, String json)
    throws IOException {
    byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
    ex.getResponseHeaders().set(
      "Content-Type",
      "application/json; charset=utf-8"
    );
    ex.getResponseHeaders().set("Cache-Control", "no-store");
    ex.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
    ex.sendResponseHeaders(code, bytes.length);
    ex.getResponseBody().write(bytes);
  }
}
