package learning.books.http;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;

/**
 * 起動: java learning.books.http.Main [--memory | --jdbc <dbファイル>] [ポート]
 * 省略時は --memory（依存ゼロ・再起動で消える）。--jdbc は SQLite JDBC ドライバが
 * 実行時クラスパスに必要（README 参照）。教材用サーバであり、公開運用の想定はない。
 * 127.0.0.1 にだけバインドする。
 */
public final class Main {
    public static void main(String[] args) throws IOException {
        String mode = args.length > 0 ? args[0] : "--memory";
        int port = 18080;
        BookRepository repository;
        if ("--jdbc".equals(mode)) {
            String dbFile = args.length > 1 ? args[1] : "books.db";
            if (args.length > 2) port = Integer.parseInt(args[2]);
            // ドライバ jar が無い場合はここで ClassNotFoundException になり、使い方が明示される
            try {
                Class.forName("org.sqlite.JDBC");
            } catch (ClassNotFoundException e) {
                System.err.println("SQLite JDBC ドライバが見つかりません。README の手順で lib/sqlite-jdbc.jar を置き、"
                        + "java -cp bin:lib/sqlite-jdbc.jar learning.books.http.Main --jdbc books.db のように実行してください。");
                System.exit(2);
                return;
            }
            JdbcBookRepository jdbc = new JdbcBookRepository("jdbc:sqlite:" + dbFile);
            jdbc.seed(1, "JavaでHTTPを学ぶ");
            jdbc.seed(2, "Rustの所有権を学ぶ");
            repository = jdbc;
        } else {
            if (args.length > 1) port = Integer.parseInt(args[1]);
            InMemoryBookRepository memory = new InMemoryBookRepository();
            memory.putSeed(1, "JavaでHTTPを学ぶ");
            memory.putSeed(2, "Rustの所有権を学ぶ");
            repository = memory;
        }
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/api/books", new BookController(new BookService(repository)));
        server.start();
        System.out.println("[book-api] http://127.0.0.1:" + port + "/api/books/1 (" + mode + ")");
    }
}
