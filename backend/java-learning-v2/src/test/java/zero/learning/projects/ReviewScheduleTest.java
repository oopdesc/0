package zero.learning.projects;
import static org.junit.jupiter.api.Assertions.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
class ReviewScheduleTest {
    @Test void summarizeDistinguishesAssistanceAndErrors() {
        var attempts = List.of(new ReviewSchedule.Attempt(true, false), new ReviewSchedule.Attempt(true, true), new ReviewSchedule.Attempt(false, true));
        assertEquals(new ReviewSchedule.Summary(1,1,1), ReviewSchedule.summarize(attempts));
        assertEquals(new ReviewSchedule.Summary(0,0,0), ReviewSchedule.summarize(List.of()));
        assertThrows(NullPointerException.class, () -> ReviewSchedule.summarize(null));
    }
    @Test void recallCountRequiresIndependentSuccessAndResetsOnFailure() {
        var blind = new ReviewSchedule.Attempt(true, false);
        var helped = new ReviewSchedule.Attempt(true, true);
        var wrong = new ReviewSchedule.Attempt(false, false);
        assertEquals(3, ReviewSchedule.nextCount(2, blind));
        assertEquals(2, ReviewSchedule.nextCount(2, helped));
        assertEquals(0, ReviewSchedule.nextCount(2, wrong));
        assertEquals(Integer.MAX_VALUE, ReviewSchedule.nextCount(Integer.MAX_VALUE, blind));
        assertThrows(IllegalArgumentException.class, () -> ReviewSchedule.nextCount(-1, blind));
        assertThrows(NullPointerException.class, () -> ReviewSchedule.nextCount(1, null));
    }
    @Test void accuracyHasNoValueWithoutAttemptsAndAvoidsOverflow() {
        assertTrue(ReviewSchedule.accuracy(new ReviewSchedule.Summary(0,0,0)).isEmpty());
        assertEquals(2.0/3.0, ReviewSchedule.accuracy(new ReviewSchedule.Summary(1,1,1)).orElseThrow(), 1e-12);
        assertEquals(2.0/3.0, ReviewSchedule.accuracy(new ReviewSchedule.Summary(Integer.MAX_VALUE,Integer.MAX_VALUE,Integer.MAX_VALUE)).orElseThrow(), 1e-12);
        assertThrows(IllegalArgumentException.class, () -> ReviewSchedule.accuracy(new ReviewSchedule.Summary(-1,0,0)));
        assertThrows(NullPointerException.class, () -> ReviewSchedule.accuracy(null));
    }
    @Test void dueItemsIncludeTodayAndPreserveInputOrder() {
        LocalDate now = LocalDate.of(2026, 10, 28);
        var future = new ReviewSchedule.Due("future", now.plusDays(1));
        var past = new ReviewSchedule.Due("past", now.minusDays(1));
        var today = new ReviewSchedule.Due("today", now);
        var due = ReviewSchedule.dueOnOrBefore(List.of(future, past, today), now);
        assertEquals(List.of(past, today), due);
        assertThrows(UnsupportedOperationException.class, () -> due.add(future));
        assertThrows(NullPointerException.class, () -> ReviewSchedule.dueOnOrBefore(null, now));
        assertThrows(NullPointerException.class, () -> ReviewSchedule.dueOnOrBefore(List.of(), null));
        assertThrows(IllegalArgumentException.class, () -> new ReviewSchedule.Due(" ", now));
    }
    @Test void appendReturnsIndependentImmutableHistory() {
        var first = new ReviewSchedule.Attempt(true, true);
        var second = new ReviewSchedule.Attempt(false, false);
        var source = new ArrayList<>(List.of(first));
        var next = ReviewSchedule.append(source, second);
        assertEquals(List.of(first), source); assertEquals(List.of(first, second), next);
        source.clear(); assertEquals(2, next.size());
        assertThrows(UnsupportedOperationException.class, () -> next.add(first));
        assertThrows(NullPointerException.class, () -> ReviewSchedule.append(null, second));
        assertThrows(NullPointerException.class, () -> ReviewSchedule.append(List.of(), null));
    }
    @Test void latestHandlesEmptyAndReturnsLastAttempt() {
        var first = new ReviewSchedule.Attempt(true, false);
        var last = new ReviewSchedule.Attempt(false, false);
        assertTrue(ReviewSchedule.latest(List.of()).isEmpty());
        assertEquals(last, ReviewSchedule.latest(List.of(first, last)).orElseThrow());
        assertThrows(NullPointerException.class, () -> ReviewSchedule.latest(null));
    }
    @Test void reviewIntervalsCoverEdgesAndCap() {
        LocalDate from=LocalDate.of(2026,10,28);
        assertEquals(from.plusDays(1), ReviewSchedule.nextReview(from,0));
        assertEquals(from.plusDays(3), ReviewSchedule.nextReview(from,1));
        assertEquals(from.plusDays(7), ReviewSchedule.nextReview(from,2));
        assertEquals(from.plusDays(14), ReviewSchedule.nextReview(from,3));
        assertEquals(from.plusDays(30), ReviewSchedule.nextReview(from,4));
        assertEquals(from.plusDays(30), ReviewSchedule.nextReview(from,999));
        assertThrows(IllegalArgumentException.class, () -> ReviewSchedule.nextReview(from,-1));
        assertThrows(NullPointerException.class, () -> ReviewSchedule.nextReview(null,0));
    }
}
