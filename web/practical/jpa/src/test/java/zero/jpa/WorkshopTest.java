package zero.jpa;
import jakarta.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class WorkshopTest {
    private SessionFactory factory;
    private long firstId;
    private BookQueries queries;
    @BeforeEach void start() {
        factory = new Configuration().addAnnotatedClass(Book.class).addAnnotatedClass(Author.class)
            .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
            .setProperty("hibernate.connection.url", "jdbc:h2:mem:workshop_" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1")
            .setProperty("hibernate.connection.pool_size", "2")
            .setProperty("hibernate.hbm2ddl.auto", "create-drop")
            .setProperty("hibernate.generate_statistics", "true")
            .setProperty("hibernate.show_sql", "false")
            .buildSessionFactory();
        try (EntityManager em = factory.createEntityManager()) {
            em.getTransaction().begin();
            for (int i = 0; i < 3; i++) {
                Author author = new Author("Author " + i); em.persist(author);
                Book book = new Book("Book " + i, author); em.persist(book);
                if (i == 0) firstId = book.getId();
            }
            em.getTransaction().commit();
        }
        queries = new BookQueries(factory);
        factory.getStatistics().clear();
    }
    @AfterEach void stop() { if (factory != null) factory.close(); }
    private String title() { try (EntityManager em = factory.createEntityManager()) { return em.find(Book.class, firstId).getTitle(); } }

    @Test void dataCanBePersistedAndRead() { assertEquals("Book 0", title()); }
    @Test void samePersistenceContextKeepsIdentity() {
        try (EntityManager em = factory.createEntityManager()) { assertSame(em.find(Book.class, firstId), em.find(Book.class, firstId)); }
    }
    @Test void committedManagedChangeIsStored() {
        try (EntityManager em = factory.createEntityManager()) {
            em.getTransaction().begin(); em.find(Book.class, firstId).setTitle("committed"); em.getTransaction().commit();
        }
        assertEquals("committed", title());
    }
    @Test void detachedChangeIsNotAutomaticallyStored() {
        Book detached;
        try (EntityManager em = factory.createEntityManager()) { detached = em.find(Book.class, firstId); }
        detached.setTitle("detached change");
        assertEquals("Book 0", title());
    }
    @Test void authorsAreFetchedWithoutNPlusOne() {
        var views = queries.listBooks();
        assertEquals(3, views.size()); assertEquals("Author 0", views.get(0).authorName());
        assertEquals(1, factory.getStatistics().getPrepareStatementCount(), "This fixture should use exactly one SELECT");
    }
    @Test void queryParameterIsLiteralData() {
        assertEquals(1, queries.findByTitle("Book 0").size());
        assertTrue(queries.findByTitle("unused' OR '1'='1").isEmpty(), "Input must not become a JPQL expression");
    }
    @Test void failureBeforeCommitRollsBackTheChange() {
        assertThrows(IllegalStateException.class, () -> queries.renameThenFailForExercise(firstId, "must rollback"));
        assertEquals("Book 0", title());
    }
    @Test void staleVersionCannotSilentlyOverwrite() {
        try (EntityManager a = factory.createEntityManager(); EntityManager b = factory.createEntityManager()) {
            a.getTransaction().begin(); b.getTransaction().begin();
            Book first = a.find(Book.class, firstId), stale = b.find(Book.class, firstId);
            first.setTitle("A committed"); a.getTransaction().commit();
            stale.setTitle("B stale");
            RuntimeException failure = assertThrows(RuntimeException.class, () -> b.getTransaction().commit());
            Throwable cause = failure;
            while (cause != null && !(cause instanceof OptimisticLockException)) cause = cause.getCause();
            assertNotNull(cause, "Expected an optimistic lock failure, not any unrelated failure");
            if (b.getTransaction().isActive()) b.getTransaction().rollback();
        }
        assertEquals("A committed", title());
    }
}
