package zero.jpa;
import jakarta.persistence.*;
import java.util.List;

public final class BookQueries {
    public record View(String title, String authorName) {}
    private final EntityManagerFactory factory;
    public BookQueries(EntityManagerFactory factory) { this.factory = factory; }

    public List<View> listBooks() {
        try (EntityManager em = factory.createEntityManager()) {
            // TODO 2: Fetch the author needed by this use case in the same query.
            return em.createQuery("select b from Book b order by b.id", Book.class)
                .getResultList().stream().map(b -> new View(b.getTitle(), b.getAuthor().getName())).toList();
        }
    }

    public List<Book> findByTitle(String title) {
        try (EntityManager em = factory.createEntityManager()) {
            // TODO 3: This concatenation is deliberately unsafe. Bind the input as data.
            return em.createQuery("select b from Book b where b.title = '" + title + "'", Book.class)
                .getResultList();
        }
    }

    public void renameThenFailForExercise(long id, String nextTitle) {
        try (EntityManager em = factory.createEntityManager()) {
            EntityTransaction tx = em.getTransaction();
            tx.begin();
            try {
                em.find(Book.class, id).setTitle(nextTitle);
                // TODO 4: This exercise deliberately commits before an error.
                tx.commit();
                throw new IllegalStateException("simulated failure");
            } catch (RuntimeException error) {
                if (tx.isActive()) tx.rollback();
                throw error;
            }
        }
    }
}
