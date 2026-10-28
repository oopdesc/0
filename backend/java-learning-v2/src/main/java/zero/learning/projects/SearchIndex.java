package zero.learning.projects;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/** Search over supplied strings only; there is no network or dynamic execution. */
public final class SearchIndex {
    private static final int LIMIT = 20;
    private SearchIndex() {}
    public record Lesson(String id, String title, String category) {
        public Lesson {
            Objects.requireNonNull(id, "id"); Objects.requireNonNull(title, "title"); Objects.requireNonNull(category, "category");
            if (id.isBlank()) throw new IllegalArgumentException("id must not be blank");
        }
    }
    public static List<String> find(List<String> titles, String query) {
        Objects.requireNonNull(titles, "titles"); Objects.requireNonNull(query, "query");
        String needle = query.trim().toLowerCase(Locale.ROOT);
        if (needle.isEmpty()) return List.of();
        List<String> matches = new ArrayList<>();
        for (String title : titles) {
            Objects.requireNonNull(title, "title");
            if (title.toLowerCase(Locale.ROOT).contains(needle)) {
                matches.add(title);
                if (matches.size() == LIMIT) break;
            }
        }
        return List.copyOf(matches);
    }

    /** Validate a query without modifying or saving it. The limit is Unicode code points. */
    public static boolean validQuery(String query) {
        Objects.requireNonNull(query, "query");
        String stripped = query.strip();
        return !stripped.isEmpty() && stripped.codePointCount(0, stripped.length()) <= 80;
    }

    /** AND matching, using Java whitespace and ROOT case conversion, with no NFKC. */
    public static boolean containsAllTerms(String title, String query) {
        Objects.requireNonNull(title, "title"); Objects.requireNonNull(query, "query");
        String stripped = query.strip();
        if (stripped.isEmpty()) return false;
        String text = title.toLowerCase(Locale.ROOT);
        for (String term : stripped.split("\\p{javaWhitespace}+")) {
            if (!text.contains(term.toLowerCase(Locale.ROOT))) return false;
        }
        return true;
    }

    /** Deduplicate exact IDs only, retaining first occurrence and unknown IDs. */
    public static List<String> uniqueIds(List<String> ids) {
        Objects.requireNonNull(ids, "ids");
        var seen = new LinkedHashSet<String>();
        for (String id : ids) seen.add(Objects.requireNonNull(id, "id"));
        return List.copyOf(seen);
    }

    /** A page is independent of the caller list; size is between 1 and 20 inclusive. */
    public static List<String> slicePage(List<String> items, int offset, int size) {
        Objects.requireNonNull(items, "items");
        if (offset < 0 || size < 1 || size > LIMIT) throw new IllegalArgumentException("invalid page");
        if (offset >= items.size()) return List.of();
        int end = (int) Math.min((long) offset + size, items.size());
        return List.copyOf(items.subList(offset, end));
    }

    /** Category IDs are compared exactly; no identifiers are normalized or deleted. */
    public static List<Lesson> filterCategory(List<Lesson> lessons, String category) {
        Objects.requireNonNull(lessons, "lessons"); Objects.requireNonNull(category, "category");
        List<Lesson> matches = new ArrayList<>();
        for (Lesson lesson : lessons) {
            Objects.requireNonNull(lesson, "lesson");
            if (lesson.category().equals(category)) matches.add(lesson);
        }
        return List.copyOf(matches);
    }

    /** Return an exact match's UTF-16 index; this does not change case or width. */
    public static int indexExact(String title, String needle) {
        Objects.requireNonNull(title, "title"); Objects.requireNonNull(needle, "needle");
        if (needle.isEmpty()) return -1;
        return title.indexOf(needle);
    }
}
