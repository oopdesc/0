//! 処理の判断を行う層。HTTP の言葉（ステータスコード）は持たず、結果の種類で handler へ返す。

use crate::model::Book;
use crate::repository::{BookRepository, RepositoryError};

#[derive(Debug, PartialEq)]
pub enum GetResult {
    Found(Book),
    BadInput(&'static str),
    Missing(i64),
    Failure(u64),
}

#[derive(Debug, PartialEq)]
pub enum UpdateResult {
    Updated(Book),
    BadInput(&'static str),
    Missing(i64),
    Conflict(i64),
    Failure(u64),
}

pub fn parse_id(raw: &str) -> Option<i64> {
    // Java 教材と同じ契約: 先頭が 0 でない 1〜6 桁の10進数
    let bytes = raw.as_bytes();
    if bytes.is_empty() || bytes.len() > 6 {
        return None;
    }
    if !bytes.iter().all(|b| b.is_ascii_digit()) || bytes[0] == b'0' {
        return None;
    }
    raw.parse::<i64>().ok()
}

pub struct BookService<'a> {
    repository: &'a dyn BookRepository,
}

impl<'a> BookService<'a> {
    pub fn new(repository: &'a dyn BookRepository) -> Self {
        BookService { repository }
    }

    /// request_id は HTTP 層で発行されたものをそのまま使う（検証→業務判断→保存→応答を1つの ID で追う）。
    fn failure(&self, e: RepositoryError, request_id: u64) -> u64 {
        // 内部の詳細はサーバ側ログだけに残し、応答には含めない
        eprintln!("[book-api-rs] requestId={} stage=storage result=failure detail={}", request_id, e.0);
        request_id
    }

    pub fn get(&self, raw_id: &str, request_id: u64) -> GetResult {
        let Some(id) = parse_id(raw_id) else {
            return GetResult::BadInput("IDは1以上の整数にしてください");
        };
        match self.repository.find_by_id(id) {
            Ok(Some(book)) => GetResult::Found(book),
            Ok(None) => GetResult::Missing(id),
            Err(e) => GetResult::Failure(self.failure(e, request_id)),
        }
    }

    pub fn rename(&self, raw_id: &str, title: Option<&str>, raw_version: Option<&str>, request_id: u64) -> UpdateResult {
        let Some(id) = parse_id(raw_id) else {
            return UpdateResult::BadInput("IDは1以上の整数にしてください");
        };
        let Some(title) = title.map(str::trim).filter(|t| !t.is_empty()) else {
            return UpdateResult::BadInput("titleは必須です");
        };
        let Some(version) = raw_version.and_then(|v| v.trim().parse::<i64>().ok()) else {
            return UpdateResult::BadInput("versionは整数にしてください");
        };
        match self.repository.find_by_id(id) {
            Ok(None) => UpdateResult::Missing(id),
            Ok(Some(_)) => match self.repository.update_title(id, title, version) {
                Ok(false) => UpdateResult::Conflict(id),
                Ok(true) => match self.repository.find_by_id(id) {
                    Ok(Some(book)) => UpdateResult::Updated(book),
                    Ok(None) => UpdateResult::Missing(id),
                    Err(e) => UpdateResult::Failure(self.failure(e, request_id)),
                },
                Err(e) => UpdateResult::Failure(self.failure(e, request_id)),
            },
            Err(e) => UpdateResult::Failure(self.failure(e, request_id)),
        }
    }
}
