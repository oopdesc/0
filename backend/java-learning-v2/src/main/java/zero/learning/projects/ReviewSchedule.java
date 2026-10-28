package zero.learning.projects;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalDouble;

/** Local, deterministic study-record example. No database or external service. */
public final class ReviewSchedule {
    private static final int[] DAYS = {1, 3, 7, 14, 30};
    private ReviewSchedule() {}
    public record Attempt(boolean correct, boolean helped) {}
    public record Summary(int blindCorrect, int assistedCorrect, int incorrect) {}
    public record Due(String problemId, LocalDate date) {
        public Due {
            Objects.requireNonNull(problemId, "problemId");
            Objects.requireNonNull(date, "date");
            if (problemId.isBlank()) throw new IllegalArgumentException("problemId must not be blank");
        }
    }

    /** correct+helped is distinct from a correct answer without assistance. */
    public static Summary summarize(List<Attempt> attempts) {
        Objects.requireNonNull(attempts, "attempts");
        int blind = 0, assisted = 0, wrong = 0;
        for (Attempt attempt : attempts) {
            Objects.requireNonNull(attempt, "attempt");
            if (!attempt.correct()) wrong++;
            else if (attempt.helped()) assisted++;
            else blind++;
        }
        return new Summary(blind, assisted, wrong);
    }

    /** A wrong answer resets the interval; help does not increase independent recall. */
    public static int nextCount(int current, Attempt attempt) {
        if (current < 0) throw new IllegalArgumentException("current must be nonnegative");
        Objects.requireNonNull(attempt, "attempt");
        if (!attempt.correct()) return 0;
        if (attempt.helped()) return current;
        return current == Integer.MAX_VALUE ? current : current + 1;
    }

    /** Accuracy includes both kinds of correct answer; no data has no numeric rate. */
    public static OptionalDouble accuracy(Summary summary) {
        Objects.requireNonNull(summary, "summary");
        if (summary.blindCorrect() < 0 || summary.assistedCorrect() < 0 || summary.incorrect() < 0)
            throw new IllegalArgumentException("counts must be nonnegative");
        long correct = (long) summary.blindCorrect() + summary.assistedCorrect();
        long total = correct + summary.incorrect();
        return total == 0 ? OptionalDouble.empty() : OptionalDouble.of((double) correct / total);
    }

    /** Keeps caller order; a date equal to today is already due. */
    public static List<Due> dueOnOrBefore(List<Due> items, LocalDate today) {
        Objects.requireNonNull(items, "items");
        Objects.requireNonNull(today, "today");
        List<Due> due = new ArrayList<>();
        for (Due item : items) {
            Objects.requireNonNull(item, "item");
            if (!item.date().isAfter(today)) due.add(item);
        }
        return List.copyOf(due);
    }

    /** Return a new immutable history; never mutate the caller's list. */
    public static List<Attempt> append(List<Attempt> history, Attempt attempt) {
        Objects.requireNonNull(history, "history");
        Objects.requireNonNull(attempt, "attempt");
        List<Attempt> next = new ArrayList<>(history);
        next.add(attempt);
        return List.copyOf(next);
    }

    public static Optional<Attempt> latest(List<Attempt> history) {
        Objects.requireNonNull(history, "history");
        return history.isEmpty() ? Optional.empty() : Optional.of(history.get(history.size() - 1));
    }

    /** This is a starting schedule, not a scientifically universal optimum. */
    public static LocalDate nextReview(LocalDate from, int successfulRecalls) {
        Objects.requireNonNull(from, "from");
        if (successfulRecalls < 0) throw new IllegalArgumentException("successfulRecalls must be nonnegative");
        return from.plusDays(DAYS[Math.min(successfulRecalls, DAYS.length - 1)]);
    }
}
