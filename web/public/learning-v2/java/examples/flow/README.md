# ローカルのHTTPとJDBCの例

この静的な画面はサーバーを起動せず、localhostへ自動接続しません。別途、配布ソースの backend/java-learning-v2 で Maven と JDK 17以上を使います。

- mvn test: 隔離されたH2メモリDBとloopback HTTPでテスト
- mvn compile exec:java: 127.0.0.1:18423 で本人が明示的に起動
- GET /api/books/1: 200、ID abc: 400、ID 99: 404
- POST /api/books/3、PUT /api/books/1: Content-Type text/plain、本文はタイトル。POSTは重複IDで409
- DELETE /api/books/3: 存在すれば200、無ければ404
- DBテストはサンプル用。実データ、社内DB、認証情報には接続しません。
