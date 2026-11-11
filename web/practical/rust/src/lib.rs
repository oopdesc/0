use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Book { pub id: i32, pub title: String, pub version: i32 }
#[derive(Debug, PartialEq, Eq)]
pub enum Update { Updated, Missing, Conflict }
pub struct Repository { books: HashMap<i32, Book> }
impl Default for Repository {
    fn default() -> Self {
        Self { books: HashMap::from([(1, Book { id: 1, title: "Rust".into(), version: 1 })]) }
    }
}
impl Repository {
    pub fn find(&self, id: i32) -> Option<Book> { self.books.get(&id).cloned() }
    // The exclusive &mut borrow keeps comparison and mutation together in this model.
    pub fn compare_and_set(&mut self, id: i32, title: &str, expected: i32) -> Update {
        let Some(book) = self.books.get_mut(&id) else { return Update::Missing; };
        if book.version != expected { return Update::Conflict; }
        book.title = title.to_owned();
        book.version += 1;
        Update::Updated
    }
}
pub fn valid_id(_raw: &str) -> Result<i32, &'static str> {
    // TODO 1: ASCII digits only, leading zero allowed, 1..2147483647.
    todo!("valid_id")
}
pub fn find(repository: &Repository, raw: &str) -> Result<Option<Book>, &'static str> {
    Ok(repository.find(valid_id(raw)?))
}
pub fn rename(_repository: &mut Repository, _raw: &str, _title: &str, _expected: i32) -> Result<Update, &'static str> {
    // TODO 2: validate first, then call compare_and_set exactly once.
    todo!("rename")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn valid_ids_and_leading_zeros() {
        assert_eq!(valid_id("1"), Ok(1)); assert_eq!(valid_id("001"), Ok(1));
        assert_eq!(valid_id("2147483647"), Ok(i32::MAX));
    }
    #[test] fn strict_format_and_range() {
        for raw in ["", "0", "-1", "+1", "1abc", "１", "1.0", " 1", "2147483648"] { assert!(valid_id(raw).is_err(), "{raw}"); }
    }
    #[test] fn found_and_missing_are_distinct() {
        let repo=Repository::default();
        assert_eq!(find(&repo,"1").unwrap().unwrap().title,"Rust");
        assert_eq!(find(&repo,"2"),Ok(None));
    }
    #[test] fn successful_rename_increments_version() {
        let mut repo=Repository::default();
        assert_eq!(rename(&mut repo,"1","Rust実践",1),Ok(Update::Updated));
        assert_eq!(find(&repo,"1").unwrap().unwrap(),Book{id:1,title:"Rust実践".into(),version:2});
    }
    #[test] fn two_readers_cannot_silently_overwrite() {
        let mut repo=Repository::default();
        let a=find(&repo,"1").unwrap().unwrap().version; let b=find(&repo,"1").unwrap().unwrap().version;
        assert_eq!(rename(&mut repo,"1","Aの変更",a),Ok(Update::Updated));
        assert_eq!(rename(&mut repo,"1","Bの変更",b),Ok(Update::Conflict));
        assert_eq!(repo.find(1).unwrap(),Book{id:1,title:"Aの変更".into(),version:2});
    }
    #[test] fn missing_update_changes_nothing() {
        let mut repo=Repository::default();
        assert_eq!(rename(&mut repo,"2","存在しない本",1),Ok(Update::Missing));
        assert_eq!(repo.find(1).unwrap().version,1);
    }
    #[test] fn invalid_inputs_do_not_change_data() {
        let mut repo=Repository::default();
        for title in [""," \t\r\n"] { assert!(rename(&mut repo,"1",title,1).is_err()); }
        assert!(rename(&mut repo,"abc","有効な名前",1).is_err());
        assert!(rename(&mut repo,"1","有効な名前",0).is_err());
        assert_eq!(repo.find(1).unwrap(),Book{id:1,title:"Rust".into(),version:1});
    }
}
