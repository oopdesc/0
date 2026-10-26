import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public class StreamFilter {
  public static void main(String[] args) {
    List<Integer> masses = Arrays.asList(3, 12, 7, 20, 1);
    List<Integer> big = masses.stream()
        .filter(m -> m > 6)
        .collect(Collectors.toList());
    System.out.println(big.size());
    System.out.println(big);
    System.out.println(masses.size()); // source collection is unchanged
  }
}
