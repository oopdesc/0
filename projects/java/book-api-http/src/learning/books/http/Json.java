package learning.books.http;

/** 教材用の最小 JSON 生成。外部ライブラリは使わない。 */
public final class Json {
    private Json() {
    }

    public static String book(Book b) {
        return "{\"id\":" + b.id() + ",\"title\":\"" + escape(b.title()) + "\",\"version\":" + b.version() + "}";
    }

    public static String error(String message) {
        return "{\"error\":\"" + escape(message) + "\"}";
    }

    /** エラー応答には requestId を含め、利用者がサーバ側ログと照合できるようにする（内部詳細は含めない）。 */
    public static String error(String message, String requestId) {
        return "{\"error\":\"" + escape(message) + "\",\"requestId\":\"" + escape(requestId) + "\"}";
    }

    public static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r");
    }
}
