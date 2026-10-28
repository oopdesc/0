//! 教材用の最小JSON生成。制御文字を含め、文字列の規則を明示する。
use crate::model::Book;

pub fn book(b: &Book) -> String {
    format!("{{\"id\":{},\"title\":\"{}\",\"version\":{}}}", b.id, escape(&b.title), b.version)
}
pub fn error(message: &str) -> String {
    format!("{{\"error\":\"{}\"}}", escape(message))
}
pub fn error_with_id(message: &str, request_id: u64) -> String {
    format!("{{\"error\":\"{}\",\"requestId\":{}}}", escape(message), request_id)
}
pub fn escape(s: &str) -> String {
    use std::fmt::Write as _;
    let mut out = String::new();
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            '\u{00}'..='\u{1f}' => write!(out,"\\u{:04x}",ch as u32).unwrap(),
            _ => out.push(ch),
        }
    }
    out
}
