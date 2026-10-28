//! 保存層の境界。実装を差し替えても handler / service は変わらない。

use crate::model::Book;
use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::sync::Mutex;

/// 保存層の失敗。内部詳細（SQLやファイルパス）は HTTP 応答へ出さず、こちらで保持する。
#[derive(Debug)]
pub struct RepositoryError(pub String);

impl std::fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "storage failure")
    }
}

pub trait BookRepository {
    fn find_by_id(&self, id: i64) -> Result<Option<Book>, RepositoryError>;
    fn insert(&self, title: &str) -> Result<Book, RepositoryError>;
    /// version が一致したときだけ更新する（楽観ロック）。成功なら true。
    fn update_title(&self, id: i64, title: &str, expected_version: i64) -> Result<bool, RepositoryError>;
}

/// 依存は rusqlite だけ、プロセスを止めると消える比較用の実装。
pub struct InMemoryBookRepository {
    books: Mutex<HashMap<i64, Book>>,
    sequence: Mutex<i64>,
}

impl InMemoryBookRepository {
    pub fn new() -> Self {
        InMemoryBookRepository { books: Mutex::new(HashMap::new()), sequence: Mutex::new(0) }
    }

    pub fn seed(&self, id: i64, title: &str) -> Result<(), RepositoryError> {
        let book = Book::new(id, title, 1).map_err(RepositoryError)?;
        self.books.lock().unwrap().insert(id, book);
        let mut seq = self.sequence.lock().unwrap();
        *seq = (*seq).max(id);
        Ok(())
    }
}

impl BookRepository for InMemoryBookRepository {
    fn find_by_id(&self, id: i64) -> Result<Option<Book>, RepositoryError> {
        Ok(self.books.lock().unwrap().get(&id).cloned())
    }

    fn insert(&self, title: &str) -> Result<Book, RepositoryError> {
        let id = {
            let mut seq = self.sequence.lock().unwrap();
            *seq += 1;
            *seq
        };
        let book = Book::new(id, title, 1).map_err(RepositoryError)?;
        self.books.lock().unwrap().insert(id, book.clone());
        Ok(book)
    }

    fn update_title(&self, id: i64, title: &str, expected_version: i64) -> Result<bool, RepositoryError> {
        let mut books = self.books.lock().unwrap();
        match books.get_mut(&id) {
            Some(current) if current.version == expected_version => {
                current.title = title.trim().to_string();
                current.version += 1;
                Ok(true)
            }
            _ => Ok(false),
        }
    }
}

/// SQLite ファイルへ保存する実装。SQL は params! で値を分離し、文字列結合で組み立てない。
pub struct SqliteBookRepository {
    conn: Mutex<Connection>,
}

impl SqliteBookRepository {
    pub fn open(path: &str) -> Result<Self, RepositoryError> {
        let conn = Connection::open(path).map_err(|e| RepositoryError(e.to_string()))?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY, title TEXT NOT NULL, version INTEGER NOT NULL
            );",
        )
        .map_err(|e| RepositoryError(e.to_string()))?;
        Ok(SqliteBookRepository { conn: Mutex::new(conn) })
    }

    pub fn seed(&self, id: i64, title: &str) -> Result<(), RepositoryError> {
        self.conn
            .lock()
            .unwrap()
            .execute("INSERT OR IGNORE INTO books (id, title, version) VALUES (?1, ?2, 1)", params![id, title])
            .map_err(|e| RepositoryError(e.to_string()))?;
        Ok(())
    }
}

impl BookRepository for SqliteBookRepository {
    fn find_by_id(&self, id: i64) -> Result<Option<Book>, RepositoryError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, title, version FROM books WHERE id = ?1")
            .map_err(|e| RepositoryError(e.to_string()))?;
        let mut rows = stmt
            .query_map(params![id], |row| {
                Ok(Book {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    version: row.get(2)?,
                })
            })
            .map_err(|e| RepositoryError(e.to_string()))?;
        match rows.next() {
            Some(Ok(book)) => Ok(Some(book)),
            Some(Err(e)) => Err(RepositoryError(e.to_string())),
            None => Ok(None),
        }
    }

    fn insert(&self, title: &str) -> Result<Book, RepositoryError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("INSERT INTO books (title, version) VALUES (?1, 1)", params![title])
            .map_err(|e| RepositoryError(e.to_string()))?;
        let id = conn.last_insert_rowid();
        Ok(Book { id, title: title.trim().to_string(), version: 1 })
    }

    fn update_title(&self, id: i64, title: &str, expected_version: i64) -> Result<bool, RepositoryError> {
        // WHERE 句の version 条件が楽観ロック。0件更新は「古い version への同時更新」。
        let changed = self
            .conn
            .lock()
            .unwrap()
            .execute(
                "UPDATE books SET title = ?1, version = version + 1 WHERE id = ?2 AND version = ?3",
                params![title, id, expected_version],
            )
            .map_err(|e| RepositoryError(e.to_string()))?;
        Ok(changed == 1)
    }
}
