//! 起動: cargo run -- [--memory | --sqlite <dbファイル>] [ポート]
//! 省略時は --memory（再起動で消える）。127.0.0.1 にだけバインドする教材用サーバ。
//! 公開運用の想定はない（認証も利用制限もない）。
//!
//! ブラウザ教材「処理の全体像」と同じ題材を、実際の TCP/HTTP と SQLite で動かす。

mod json;
mod model;
mod repository;
mod service;

use model::Book;
use repository::{BookRepository, InMemoryBookRepository, SqliteBookRepository};
use service::{BookService, GetResult, UpdateResult};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::Duration;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mode = args.get(1).map(String::as_str).unwrap_or("--memory");
    let mut port: u16 = 18082;

    let service_owner: Box<dyn BookRepository>;
    if mode == "--sqlite" {
        let db = args.get(2).map(String::as_str).unwrap_or("books.db");
        if args.len() > 3 {
            port = args[3].parse().expect("port");
        }
        let repo = SqliteBookRepository::open(db).expect("open sqlite");
        repo.seed(1, "JavaでHTTPを学ぶ").expect("seed");
        repo.seed(2, "Rustの所有権を学ぶ").expect("seed");
        service_owner = Box::new(repo);
    } else {
        if args.len() > 2 {
            port = args[2].parse().expect("port");
        }
        let repo = InMemoryBookRepository::new();
        repo.seed(1, "JavaでHTTPを学ぶ").expect("seed");
        repo.seed(2, "Rustの所有権を学ぶ").expect("seed");
        service_owner = Box::new(repo);
    }
    let service = BookService::new(&*service_owner);

    let listener = TcpListener::bind(("127.0.0.1", port)).expect("bind 127.0.0.1");
    println!("[book-api-rs] http://127.0.0.1:{}/api/books/1 ({})", port, mode);
    // 教材のため接続は1つずつ順に処理する（同時接続の扱いは題材の範囲外と明示する）
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => handle(stream, &service),
            Err(e) => eprintln!("[book-api-rs] accept error: {}", e),
        }
    }
}

struct Request {
    method: String,
    path: String,
    body: String,
}

fn read_request(stream: &mut TcpStream) -> Option<Request> {
    stream.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
    let mut reader = BufReader::new(stream.try_clone().ok()?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next()?.to_string();
    let path = parts.next()?.to_string();
    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        let n = reader.read_line(&mut line).ok()?;
        if n == 0 || line == "\r\n" {
            break;
        }
        let lower = line.to_ascii_lowercase();
        if let Some(v) = lower.strip_prefix("content-length:") {
            content_length = v.trim().parse().unwrap_or(0);
        }
    }
    let mut body = vec![0u8; content_length];
    reader.read_exact(&mut body).ok()?;
    Some(Request { method, path, body: String::from_utf8_lossy(&body).to_string() })
}

/// 1 リクエストに 1 つの requestId を発行する（検証→業務判断→保存→応答→表示を同じ ID で追う）。
static NEXT_REQUEST_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

fn respond(stream: &mut TcpStream, request_id: u64, status: u16, reason: &str, body: &str) {
    // 応答を送り、同じ requestId で結果をサーバ側ログに 1 行残す（内部詳細は Service 側のログにだけある）
    eprintln!("[book-api-rs] requestId={} -> {}", request_id, status);
    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json; charset=utf-8\r\nX-Request-Id: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        reason,
        request_id,
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
}

fn handle(mut stream: TcpStream, service: &BookService) {
    let request_id = NEXT_REQUEST_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let Some(request) = read_request(&mut stream) else {
        respond(&mut stream, request_id, 400, "Bad Request", &json::error_with_id("リクエストを解釈できません", request_id));
        return;
    };
    let path = request.path.split('?').next().unwrap_or("");
    let Some(raw_id) = path.strip_prefix("/api/books/") else {
        respond(&mut stream, request_id, 404, "Not Found", &json::error_with_id("本が見つかりません", request_id));
        return;
    };
    let raw_id = percent_decode(raw_id);
    match request.method.as_str() {
        "GET" => match service.get(&raw_id, request_id) {
            GetResult::Found(book) => respond(&mut stream, request_id, 200, "OK", &json::book(&book)),
            GetResult::BadInput(msg) => respond(&mut stream, request_id, 400, "Bad Request", &json::error_with_id(msg, request_id)),
            GetResult::Missing(_) => respond(&mut stream, request_id, 404, "Not Found", &json::error_with_id("本が見つかりません", request_id)),
            GetResult::Failure(_) => respond(&mut stream, request_id, 500, "Internal Server Error", &json::error_with_id("内部エラーが発生しました", request_id)),
        },
        "PUT" => {
            let form = parse_form(&request.body);
            let title = form.get("title").map(String::as_str);
            let version = form.get("version").map(String::as_str);
            match service.rename(&raw_id, title, version, request_id) {
                UpdateResult::Updated(book) => respond(&mut stream, request_id, 200, "OK", &json::book(&book)),
                UpdateResult::BadInput(msg) => respond(&mut stream, request_id, 400, "Bad Request", &json::error_with_id(msg, request_id)),
                UpdateResult::Missing(_) => respond(&mut stream, request_id, 404, "Not Found", &json::error_with_id("本が見つかりません", request_id)),
                UpdateResult::Conflict(_) => respond(&mut stream, request_id, 409, "Conflict", &json::error_with_id("他のリクエストで更新されています", request_id)),
                UpdateResult::Failure(_) => respond(&mut stream, request_id, 500, "Internal Server Error", &json::error_with_id("内部エラーが発生しました", request_id)),
            }
        }
        _ => respond(&mut stream, request_id, 405, "Method Not Allowed", &json::error_with_id("メソッドが許可されていません", request_id)),
    }
}

fn parse_form(body: &str) -> std::collections::HashMap<String, String> {
    let mut form = std::collections::HashMap::new();
    for pair in body.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            form.insert(percent_decode(key), percent_decode(value));
        }
    }
    form
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
                if let Ok(v) = u8::from_str_radix(hex, 16) {
                    out.push(v);
                    i += 3;
                    continue;
                }
                out.push(bytes[i]);
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

// 動作確認は Book の最小確認だけ main 側に残す（詳細なテストは cargo test）。
#[allow(dead_code)]
fn _smoke(book: &Book) -> String {
    json::book(book)
}

#[cfg(test)]
mod tests {
    use super::repository::{BookRepository, InMemoryBookRepository, SqliteBookRepository};
    use super::service::{BookService, GetResult, UpdateResult};

    fn check_repository(repo: &dyn BookRepository) {
        assert_eq!(repo.find_by_id(1).unwrap().unwrap().title, "JavaでHTTPを学ぶ");
        assert!(repo.find_by_id(99).unwrap().is_none());
        assert!(repo.update_title(1, "改訂", 1).unwrap());
        assert!(!repo.update_title(1, "上書き", 1).unwrap(), "stale version must be rejected");
        assert_eq!(repo.find_by_id(1).unwrap().unwrap().version, 2);
    }

    #[test]
    fn memory_repository_behaves() {
        let repo = InMemoryBookRepository::new();
        repo.seed(1, "JavaでHTTPを学ぶ").unwrap();
        check_repository(&repo);
    }

    #[test]
    fn sqlite_repository_behaves() {
        let repo = SqliteBookRepository::open(":memory:").unwrap();
        repo.seed(1, "JavaでHTTPを学ぶ").unwrap();
        check_repository(&repo);
    }

    #[test]
    fn service_validates_before_repository() {
        let repo = InMemoryBookRepository::new();
        repo.seed(1, "JavaでHTTPを学ぶ").unwrap();
        let service = BookService::new(&repo);
        assert!(matches!(service.get("1", 1), GetResult::Found(_)));
        assert!(matches!(service.get("abc", 1), GetResult::BadInput(_)));
        assert!(matches!(service.get("99", 1), GetResult::Missing(99)));
        assert!(matches!(service.rename("1", Some("新しい題名"), Some("1"), 1), UpdateResult::Updated(_)));
        assert!(matches!(service.rename("1", Some("競合"), Some("1"), 1), UpdateResult::Conflict(1)));
        assert!(matches!(service.rename("1", Some(" "), Some("1"), 1), UpdateResult::BadInput(_)));
    }

    /// requestId が HTTP 層から保存層の失敗まで同じ値で貫通し、エラー応答に含まれることを固定する。
    #[test]
    fn request_id_traces_to_storage_failure() {
        use super::repository::RepositoryError;
        struct Failing;
        impl BookRepository for Failing {
            fn find_by_id(&self, _id: i64) -> Result<Option<super::model::Book>, RepositoryError> {
                Err(RepositoryError("findById failed: secret-detail".to_string()))
            }
            fn insert(&self, _title: &str) -> Result<super::model::Book, RepositoryError> {
                Err(RepositoryError("insert failed".to_string()))
            }
            fn update_title(&self, _id: i64, _title: &str, _v: i64) -> Result<bool, RepositoryError> {
                Err(RepositoryError("update failed".to_string()))
            }
        }
        let repo = Failing;
        let service = BookService::new(&repo);
        assert!(matches!(service.get("1", 42), GetResult::Failure(42)));
        assert!(matches!(service.rename("1", Some("題名"), Some("1"), 43), UpdateResult::Failure(43)));
        let body = super::json::error_with_id("内部エラーが発生しました", 42);
        assert!(body.contains("\"requestId\":42"));
        assert!(!body.contains("secret-detail"), "error response never leaks storage internals");
    }
}
