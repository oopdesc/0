import java.util.Optional;

public class OptionalBasics {
  public static void main(String[] args) {
    Optional<String> o = Optional.of("Terra");
    System.out.println(o.isPresent());
    System.out.println(o.orElse("none"));
    System.out.println(Optional.empty().isPresent());
  }
}
