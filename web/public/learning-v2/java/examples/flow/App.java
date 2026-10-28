package zero.learning;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

/** Explicit local-only entry; the public static site never contacts this service automatically. */
public final class App {
    private App() {}
    public static void main(String[] args) throws Exception {
        BookRepository repository = new BookRepository("jdbc:h2:mem:zero_learning;DB_CLOSE_DELAY=-1");
        repository.initialise();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 18423), 0);
        server.createContext("/api/books/", new BookController(new BookService(repository)));
        var executor = Executors.newFixedThreadPool(2);
        server.setExecutor(executor);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> { server.stop(0); executor.shutdownNow(); }));
        server.start();
        System.out.println("学習用API: http://127.0.0.1:18423/api/books/1 （メモリ内H2、停止時に消える）");
    }
}
