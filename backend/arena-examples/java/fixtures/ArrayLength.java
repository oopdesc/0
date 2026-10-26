public class ArrayLength {
  public static void main(String[] args) {
    int[] a = {5, 6, 7};
    System.out.println(a.length);          // element count, not max index
    System.out.println(a[a.length - 1]);  // last valid element
    try {
      System.out.println(a[a.length]);    // invalid: throws
    } catch (ArrayIndexOutOfBoundsException e) {
      System.out.println("out of bounds");
    }
  }
}
