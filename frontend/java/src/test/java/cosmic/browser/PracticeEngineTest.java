package cosmic.browser;

public final class PracticeEngineTest {

  private static int count;

  private static void check(boolean condition) {
    if (!condition) throw new AssertionError("check " + (count + 1));
    count++;
  }

  public static void main(String[] args) {
    check(PracticeEngine.run("clamp", "-1").contains("\"result\":\"0\""));
    check(PracticeEngine.run("clamp", "101").contains("\"result\":\"100\""));
    check(PracticeEngine.run("clamp", " 42 ").contains("\"result\":\"42\""));
    check(PracticeEngine.run("clamp", "1.5").contains("\"ok\":false"));
    check(PracticeEngine.run("clamp", "2147483648").contains("\"ok\":false"));
    check(PracticeEngine.run("clamp", "").contains("\"ok\":false"));
    check(PracticeEngine.run("filter", " JAVA ").contains("Java / browser"));
    check(!PracticeEngine.run("filter", "java").contains("Rust / ownership"));
    check(PracticeEngine.run("filter", "").contains("Rust / ownership"));
    check(PracticeEngine.run("copy", "3,1,2").contains("[1, 2, 3]"));
    check(PracticeEngine.run("copy", "3,1,2").contains("[3, 1, 2]"));
    check(PracticeEngine.run("copy", "1,").contains("\"ok\":false"));
    check(
      PracticeEngine.run("copy", "1,2,3,4,5,6,7,8,9,10,11,12,13").contains(
        "\"ok\":false"
      )
    );
    check(PracticeEngine.run("json", "\"\n\\").contains("\"ok\":true"));
    check(PracticeEngine.run("unknown", "").contains("\"ok\":false"));
    check(PracticeEngine.run(null, "").contains("\"ok\":false"));
    check(PracticeEngine.run("json", null).contains("\"ok\":false"));
    check(PracticeEngine.run("json", "x".repeat(161)).contains("\"ok\":false"));
    check(PracticeEngine.reviewDays(-1, true) == 1);
    check(PracticeEngine.reviewDays(1, true) == 3);
    check(PracticeEngine.reviewDays(999, true) == 30);
    check(PracticeEngine.reviewDays(4, false) == 1);
    check(PracticeEngine.parseInteger("１２") == 12);
    check(PracticeEngine.parseInteger("١٢") == 12);
    check(PracticeEngine.parseInteger("-２") == -2);
    check(PracticeEngine.run("clamp", "Ⅲ").contains("\"ok\":false"));
    check(PracticeEngine.run("clamp", "²").contains("\"ok\":false"));
    check(PracticeEngine.run("clamp", "＋１２").contains("\"ok\":false"));
    System.out.println("Java practice engine: " + count + " checks passed");
  }
}
