package cosmic.learning;

/** 外部ライブラリなしで実行できる、入力境界と不変性の検査。 */
public final class LearningServerTest {

  private static int checks;

  private static void check(boolean yes) {
    checks++;
    if (!yes) throw new AssertionError("Check " + checks + " failed");
  }

  public static void main(String[] args) {
    check(LearningServer.search("").size() == 9);
    check(LearningServer.search("ＪＡＶＡ").size() == 3);
    check(LearningServer.search(" Rust ").size() == 3);
    check(LearningServer.search("存在しない").isEmpty());
    check(LearningServer.quote("a\"b\\c\n").equals("\"a\\\"b\\\\c\\n\""));
    check(LearningServer.quote("\u0001").equals("\"\\u0001\""));
    check(LearningServer.catalog("Java").contains("java-http"));
    check(!LearningServer.catalog("Rust").contains("java-http"));
    check(LearningServer.search("x".repeat(80)).isEmpty());
    try {
      LearningServer.search("x".repeat(81));
      throw new AssertionError();
    } catch (IllegalArgumentException expected) {
      checks++;
    }
    try {
      LearningServer.search(null);
      throw new AssertionError();
    } catch (IllegalArgumentException expected) {
      checks++;
    }
    try {
      LearningServer.LESSONS.clear();
      throw new AssertionError();
    } catch (UnsupportedOperationException expected) {
      checks++;
    }
    check(LearningServer.LESSONS.size() == 9);
    System.out.println("Java learning checks: " + checks + " passed");
  }
}
