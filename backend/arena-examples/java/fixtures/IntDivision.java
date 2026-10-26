public class IntDivision {
  public static void main(String[] args) {
    int a = 7 / 2;
    double b = a;              // widening happens AFTER the integer division
    double c = 7.0 / 2;        // binary numeric promotion -> double division
    System.out.println(a);
    System.out.println(b);
    System.out.println(c);
  }
}
