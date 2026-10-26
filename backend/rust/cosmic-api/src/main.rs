//! localhost専用の読取学習API。汎用・本番HTTPサーバーとして公開しないでください。
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{Arc, Mutex, mpsc},
    time::Duration,
};

fn local_headers(request: &str) -> bool {
    let headers: Vec<_> = request
        .lines()
        .skip(1)
        .filter_map(|s| s.split_once(':'))
        .collect();
    let hosts: Vec<_> = headers
        .iter()
        .filter(|(k, _)| k.eq_ignore_ascii_case("host"))
        .collect();
    if hosts.len() != 1 || !matches!(hosts[0].1.trim(), "127.0.0.1:18422" | "localhost:18422") {
        return false;
    }
    headers
        .iter()
        .filter(|(k, _)| k.eq_ignore_ascii_case("origin"))
        .all(|(_, v)| {
            matches!(
                v.trim(),
                "http://127.0.0.1:18420" | "http://localhost:18420"
            )
        })
}

fn response(request: &str) -> (u16, String) {
    let Some(line) = request.lines().next() else {
        return (400, "{\"error\":\"bad request\"}".into());
    };
    let parts: Vec<_> = line.split_whitespace().collect();
    if parts.len() != 3 || parts[2] != "HTTP/1.1" {
        return (400, "{\"error\":\"HTTP/1.1 required\"}".into());
    }
    if parts[0] != "GET" {
        return (405, "{\"error\":\"GET only\"}".into());
    }
    if parts[1] == "/api/health" {
        return (
            200,
            "{\"language\":\"Rust\",\"status\":\"ok\",\"readOnly\":true}".into(),
        );
    }
    if let Some(query) = parts[1].strip_prefix("/api/galaxy?") {
        let count = query
            .strip_prefix("count=")
            .and_then(|s| cosmic_core::requested_count(s).ok());
        let Some(count) = count else {
            return (400, "{\"error\":\"count must be 1..32000\"}".into());
        };
        let points = cosmic_core::galaxy(count, 42);
        return (
            200,
            format!(
                "{{\"language\":\"Rust\",\"count\":{count},\"seed\":42,\"finite\":{},\"model\":\"illustrative spiral\"}}",
                points.iter().all(|v| v.is_finite())
            ),
        );
    }
    (404, "{\"error\":\"not found\"}".into())
}

fn handle(mut stream: TcpStream) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    let mut bytes = [0u8; 4096];
    let mut used = 0;
    let result = loop {
        match stream.read(&mut bytes[used..]) {
            Ok(0) | Err(_) => return,
            Ok(n) => used += n,
        }
        if bytes[..used].windows(4).any(|x| x == b"\r\n\r\n") {
            break match std::str::from_utf8(&bytes[..used]) {
                Ok(s) if local_headers(s) => response(s),
                Ok(_) => (403, "{\"error\":\"local host and origin required\"}".into()),
                Err(_) => (400, "{\"error\":\"bad request\"}".into()),
            };
        }
        if used == bytes.len() {
            break (431, "{\"error\":\"headers too large\"}".into());
        }
    };
    let (code, body) = result;
    let reason = match code {
        200 => "OK",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        _ => "Request Header Fields Too Large",
    };
    let output = format!(
        "HTTP/1.1 {code} {reason}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(output.as_bytes());
}

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:18422")?;
    let (tx, rx) = mpsc::sync_channel::<TcpStream>(8);
    let rx = Arc::new(Mutex::new(rx));
    for _ in 0..2 {
        let rx = rx.clone();
        std::thread::spawn(move || {
            loop {
                let next = rx.lock().unwrap().recv();
                match next {
                    Ok(stream) => handle(stream),
                    Err(_) => break,
                }
            }
        });
    }
    println!("Rust learning API: http://127.0.0.1:18422 (read-only, 2 workers)");
    for stream in listener.incoming().flatten() {
        let _ = tx.try_send(stream);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn health_is_read_only() {
        let (s, b) = response("GET /api/health HTTP/1.1\r\n\r\n");
        assert_eq!(s, 200);
        assert!(b.contains("\"readOnly\":true"));
    }
    #[test]
    fn request_bounds() {
        assert_eq!(response("GET /api/galaxy?count=32000 HTTP/1.1").0, 200);
        assert_eq!(response("GET /api/galaxy?count=32001 HTTP/1.1").0, 400);
    }
    #[test]
    fn not_a_generic_file_server() {
        assert_eq!(response("GET /../../etc/passwd HTTP/1.1").0, 404);
    }
    #[test]
    fn post_cannot_change_state() {
        assert_eq!(response("POST /api/galaxy?count=10 HTTP/1.1").0, 405);
    }
    #[test]
    fn malformed_request() {
        for s in ["", "GET", "GET /api/health HTTP/2"] {
            assert_eq!(response(s).0, 400);
        }
    }
    #[test]
    fn only_local_host_and_origin() {
        assert!(local_headers(
            "GET / HTTP/1.1\r\nHost: 127.0.0.1:18422\r\nOrigin: http://127.0.0.1:18420\r\n\r\n"
        ));
        assert!(!local_headers(
            "GET / HTTP/1.1\r\nHost: attacker.example:18422\r\n\r\n"
        ));
        assert!(!local_headers(
            "GET / HTTP/1.1\r\nHost: localhost:18422\r\nOrigin: https://attacker.example\r\n\r\n"
        ));
    }
    #[test]
    fn duplicate_or_missing_host_is_rejected() {
        assert!(!local_headers("GET / HTTP/1.1\r\n\r\n"));
        assert!(!local_headers(
            "GET / HTTP/1.1\r\nHost: localhost:18422\r\nHost: attacker.example\r\n\r\n"
        ));
    }
}
