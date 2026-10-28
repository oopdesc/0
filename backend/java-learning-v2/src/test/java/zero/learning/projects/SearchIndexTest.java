package zero.learning.projects;
import static org.junit.jupiter.api.Assertions.*;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
class SearchIndexTest {
    @Test void caseInsensitiveSubstringKeepsOriginalTitlesAndOrder() {
        assertEquals(List.of("Java入門", "java応用"), SearchIndex.find(List.of("Java入門","Rust","java応用")," JAVA "));
        assertEquals(List.of("Java入門"), SearchIndex.find(List.of("Java入門","Rust"),"入門"));
        assertEquals(List.of(), SearchIndex.find(List.of("Java"),"Ｊａｖａ")); // No implicit NFKC.
    }
    @Test void queryValidationCountsUnicodeCodePointsWithoutChangingInput() {
        assertFalse(SearchIndex.validQuery("　 "));
        assertTrue(SearchIndex.validQuery("  Java  "));
        assertTrue(SearchIndex.validQuery("😀".repeat(80)));
        assertFalse(SearchIndex.validQuery("😀".repeat(81)));
        assertThrows(NullPointerException.class, () -> SearchIndex.validQuery(null));
    }
    @Test void allTermsMustMatchWithoutWidthNormalization() {
        assertTrue(SearchIndex.containsAllTerms("Java String 入門", " 入門　JAVA "));
        assertTrue(SearchIndex.containsAllTerms("Java String 入門", "string JAVA"));
        assertFalse(SearchIndex.containsAllTerms("Java String 入門", "JAVA Rust"));
        assertFalse(SearchIndex.containsAllTerms("Java", "Ｊａｖａ"));
        assertFalse(SearchIndex.containsAllTerms("Java", "　"));
        assertThrows(NullPointerException.class, () -> SearchIndex.containsAllTerms(null, "x"));
    }
    @Test void uniqueIdsKeepFirstOrderAndUnknownValues() {
        var source = List.of("java:q0001", "old-unknown", "java:q0001", "JAVA:Q0001", "rust:q0001");
        var result = SearchIndex.uniqueIds(source);
        assertEquals(List.of("java:q0001", "old-unknown", "JAVA:Q0001", "rust:q0001"), result);
        assertThrows(UnsupportedOperationException.class, () -> result.add("x"));
        var bad = new ArrayList<String>(); bad.add(null);
        assertThrows(NullPointerException.class, () -> SearchIndex.uniqueIds(bad));
        assertThrows(NullPointerException.class, () -> SearchIndex.uniqueIds(null));
    }
    @Test void pageBoundsAreCheckedAndResultIsIndependent() {
        var items = new ArrayList<>(List.of("a", "b", "c", "d"));
        var page = SearchIndex.slicePage(items, 1, 2);
        assertEquals(List.of("b", "c"), page);
        items.set(1, "changed"); assertEquals(List.of("b", "c"), page);
        assertThrows(UnsupportedOperationException.class, () -> page.add("x"));
        assertEquals(List.of(), SearchIndex.slicePage(items, Integer.MAX_VALUE, 20));
        assertThrows(IllegalArgumentException.class, () -> SearchIndex.slicePage(items, -1, 1));
        assertThrows(IllegalArgumentException.class, () -> SearchIndex.slicePage(items, 0, 0));
        assertThrows(IllegalArgumentException.class, () -> SearchIndex.slicePage(items, 0, 21));
    }
    @Test void categoryIdsAreExactAndOrderingIsPreserved() {
        var a = new SearchIndex.Lesson("java:q0001", "A", "core");
        var b = new SearchIndex.Lesson("rust:q0001", "B", "other");
        var c = new SearchIndex.Lesson("old-id", "C", "core");
        var result = SearchIndex.filterCategory(List.of(a,b,c), "core");
        assertEquals(List.of(a,c), result); assertEquals(List.of(), SearchIndex.filterCategory(List.of(a), "CORE"));
        assertThrows(UnsupportedOperationException.class, () -> result.add(b));
        assertThrows(NullPointerException.class, () -> SearchIndex.filterCategory(null, "core"));
        assertThrows(NullPointerException.class, () -> SearchIndex.filterCategory(List.of(a), null));
    }
    @Test void exactIndexUsesUtf16AndDoesNotNormalize() {
        assertEquals(3, SearchIndex.indexExact("A😀B", "B"));
        assertEquals(0, SearchIndex.indexExact("Java", "Ja"));
        assertEquals(-1, SearchIndex.indexExact("Java", "java"));
        assertEquals(-1, SearchIndex.indexExact("Java", "Ｊａｖａ"));
        assertEquals(-1, SearchIndex.indexExact("Java", ""));
        assertThrows(NullPointerException.class, () -> SearchIndex.indexExact(null, "x"));
    }
    @Test void blankQueryReturnsNothingAndResultsAreCapped() {
        assertEquals(List.of(), SearchIndex.find(List.of("Java")," "));
        var titles=new ArrayList<String>(); for(int i=0;i<25;i++) titles.add("Java"+i);
        var result=SearchIndex.find(titles,"java"); assertEquals(20,result.size()); assertEquals("Java19",result.get(19));
        assertThrows(UnsupportedOperationException.class, () -> result.add("mutation"));
        assertThrows(NullPointerException.class, () -> SearchIndex.find(null,"x"));
        assertThrows(NullPointerException.class, () -> SearchIndex.find(List.of("x"),null));
    }
}
