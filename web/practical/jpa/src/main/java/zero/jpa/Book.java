package zero.jpa;
import jakarta.persistence.*;

@Entity
@Table(name = "workshop_books")
public class Book {
    @Id @GeneratedValue private Long id;
    private String title;
    // TODO 1: Add the standard version mapping annotation to this field.
    private long version;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id")
    private Author author;
    protected Book() {}
    public Book(String title, Author author) { this.title = title; this.author = author; }
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public long getVersion() { return version; }
    public Author getAuthor() { return author; }
}
