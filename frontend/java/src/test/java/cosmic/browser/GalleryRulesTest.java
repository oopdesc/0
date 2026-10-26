package cosmic.browser;

/** 外部サービスを使わずに入力の境界を確認する、小さな実行可能テスト。 */
public final class GalleryRulesTest {

  private static int passed;

  private static void check(boolean condition) {
    if (!condition) throw new AssertionError("check " + (passed + 1));
    passed++;
  }

  public static void main(String[] args) {
    check(GalleryRules.sceneIndex(-1) == 0);
    check(GalleryRules.sceneIndex(99) == 2);
    check(GalleryRules.sceneIndex(1) == 1);
    check(GalleryRules.seed(0) == 1);
    check(GalleryRules.seed(Integer.MAX_VALUE) == GalleryRules.MAX_SEED);
    check(GalleryRules.seed(42) == 42);
    check(GalleryRules.finiteClamp(Double.NaN, 0, 1, .5) == .5);
    check(GalleryRules.finiteClamp(Double.POSITIVE_INFINITY, 0, 1, .5) == .5);
    check(GalleryRules.finiteClamp(-1, 0, 1, .5) == 0);
    check(GalleryRules.finiteClamp(2, 0, 1, .5) == 1);
    check(GalleryRules.indexForId("m104") == 2);
    check(GalleryRules.indexForId("black-hole") == 1);
    check(GalleryRules.indexForId("unknown") == 0);
    check(GalleryRules.indexForId(null) == 0);
    check(GalleryRules.catalog().startsWith("[{\"mode\":0"));
    check(GalleryRules.catalog().contains("M104 / ソンブレロ銀河"));
    check(GalleryRules.settings(-8, 0, Double.NaN, 999).contains("\"seed\":1"));
    check(
      GalleryRules.settings(-8, 0, Double.NaN, 999).contains("\"exposure\":1.8")
    );
    check(GalleryRules.settings(2, 42, .6, 1).contains("\"id\":\"m104\""));
    check(
      !GalleryRules.settings(2, 42, Double.NaN, Double.NaN).contains("NaN")
    );
    check(GalleryRules.orbit(720, 99, -1, 99).contains("\"azimuth\":0.0"));
    check(GalleryRules.orbit(720, 99, -1, 99).contains("\"elevation\":85.0"));
    check(GalleryRules.orbit(720, 99, -1, 99).contains("\"distance\":1.6"));
    check(
      !GalleryRules.orbit(
        Double.NaN,
        Double.POSITIVE_INFINITY,
        Double.NaN,
        Double.NaN
      ).contains("NaN")
    );
    System.out.println("Java browser model: " + passed + " checks passed");
  }
}
