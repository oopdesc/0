package zero.jpa;
import jakarta.persistence.*;

@Entity
@Table(name = "workshop_authors")
public class Author {
    @Id @GeneratedValue private Long id;
    private String name;
    protected Author() {}
    public Author(String name) { this.name = name; }
    public String getName() { return name; }
}
