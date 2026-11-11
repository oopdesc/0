# 回答例：入力を検証し、更新を一つの原子的操作へ渡す

## Java：2つのTODOメソッドだけを置換する

```java
public static int validId(String raw) {
    if (raw == null || !raw.matches("[0-9]+")) throw new IllegalArgumentException("invalid id");
    try {
        int id = Integer.parseInt(raw);
        if (id <= 0) throw new IllegalArgumentException("invalid id");
        return id;
    } catch (NumberFormatException error) {
        throw new IllegalArgumentException("invalid id");
    }
}

public Update rename(String raw, String title, int expectedVersion) {
    int id = validId(raw);
    if (title == null || title.matches("[ \\t\\r\\n]*") || expectedVersion < 1)
        throw new IllegalArgumentException("invalid update");
    return repository.compareAndSet(id, title, expectedVersion);
}
```

数字の判定だけでなく、変換時の範囲も検査する。NumberFormatExceptionはIllegalArgumentExceptionの派生なので、外側へ統一した型で返す。入力不正と未登録は分ける。取得したBookのversionを調べてから無条件更新しても、実DBでは競合を防げない。

## Rust：2つのTODO関数だけを置換する

```rust
pub fn valid_id(raw: &str) -> Result<i32, &'static str> {
    if raw.is_empty() || !raw.bytes().all(|b| b.is_ascii_digit()) { return Err("invalid id"); }
    raw.parse::<i32>().ok().filter(|id| *id > 0).ok_or("invalid id")
}

pub fn rename(repository: &mut Repository, raw: &str, title: &str, expected: i32) -> Result<Update, &'static str> {
    let id = valid_id(raw)?;
    if title.chars().all(|c| matches!(c, ' ' | '\t' | '\r' | '\n')) || expected < 1 {
        return Err("invalid update");
    }
    Ok(repository.compare_and_set(id, title, expected))
}
```

`?`で入力不正を呼び出し側へ返す。Optionの未登録とResultの入力不正を混同しない。排他的な借用はこのモデルでの同時アクセスを制約するが、分散システムの排他やDBトランザクションを自動で実装するものではない。

## テスト設計をさらに良くする

- 先頭0と最大値を受け入れるか確認する。
- 成功だけでなく、競合・不正入力の後にデータが変化しないことを確認する。
- 更新の成功は既存版との比較を含む操作にする。別SELECTの判定だけで済ませない。
- 実DBでは更新件数・トランザクション・障害時のrollbackを別に試す。
- この小さな教材のversionはi32/int。最大値に達する運用やIDの重複登録、認証、HTTP入力の最大長等は未実装であり、実サービスにそのまま持ち込まない。
