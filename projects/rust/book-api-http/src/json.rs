//! 教材用の最小 JSON 生成。外部ライブラリは使わない。

use crate::model::Book;

pub fn book(b: &Book) -> String {
    format!("{{\"id\":{},\"title\":\"{}\",\"version\":{}}}", b.id, escape(&b.title), b.version)
}

pub fn error(message: &str) -> String {
    format!("{{\"error\":\"{}\"}}", escape(message))
}

/// エラー応答には requestId を含め、利用者がサーバ側ログと照合できるようにする（内部詳細は含めない）。
pub fn error_with_id(message: &str, request_id: u64) -> String {
    format!("{{\"error\":\"{}\",\"requestId\":{}}}", escape(message), request_id)
}

pub fn escape(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}
