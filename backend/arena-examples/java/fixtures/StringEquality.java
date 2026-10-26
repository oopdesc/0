public class StringEquality {
  public static void main(String[] args) {
    String a = new String("orbit");
    String b = new String("orbit");
    System.out.println(a == b);       // reference identity
    System.out.println(a.equals(b));  // value equality
  }
}
