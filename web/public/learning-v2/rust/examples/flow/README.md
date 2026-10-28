RustのHTTP・SQLite教材

この画面は処理の説明です。実際に動かすには、ソース一式の projects/rust/book-api-http で cargo test -j2 を実行します。
API起動は cargo run -j2 -- --sqlite books.db 18082。http://127.0.0.1:18082/api/books/1 を開きます。
ローカル専用の教材であり、公開サーバとしての認証やHTTP仕様全体は実装していません。
