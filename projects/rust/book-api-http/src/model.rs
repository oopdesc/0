//! 書籍1件。version は楽観ロック（同時更新の検出）に使う。

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Book {
    pub id: i64,
    pub title: String,
    pub version: i64,
}

impl Book {
    pub fn new(id: i64, title: &str, version: i64) -> Result<Book, String> {
        if id <= 0 {
            return Err("id must be positive".to_string());
        }
        let title = title.trim();
        if title.is_empty() {
            return Err("title is required".to_string());
        }
        if version < 0 {
            return Err("version must be >= 0".to_string());
        }
        Ok(Book { id, title: title.to_string(), version })
    }
}
