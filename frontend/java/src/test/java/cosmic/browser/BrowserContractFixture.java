package cosmic.browser;

/** NodeからJVM/TeaVMの同一入力・同一出力を照合するための固定fixture。 */
public final class BrowserContractFixture {

  public static void main(String[] args) {
    System.out.println(GalleryRules.catalog());
    System.out.println(GalleryRules.camera(Double.NaN, 9, -999, 999));
    System.out.println(
      GalleryRules.settings(99, -1, Double.NaN, Double.POSITIVE_INFINITY)
    );
    String[][] cases = {
      { "clamp", "101" },
      { "clamp", "-1" },
      { "clamp", "1.5" },
      { "clamp", "2147483648" },
      { "filter", " JAVA " },
      { "filter", "" },
      { "copy", "3,1,2" },
      { "copy", "1," },
      { "json", "quote\"\n\\" },
      { "unknown", "" },
      { "clamp", "１２" },
      { "clamp", "١٢" },
      { "clamp", "\u300012\u3000" },
      { "filter", "ＪＡＶＡ" },
      { "filter", "İ" },
      { "copy", "３,1,-２" },
      { "json", "日本語😀\u2028\u2029" },
      { "clamp", "Ⅲ" },
      { "clamp", "²" },
      { "clamp", "＋１２" },
    };
    for (String[] c : cases) System.out.println(PracticeEngine.run(c[0], c[1]));
    double[][] views = {
      { -70, 35, 3.8, 1.15 },
      { 720, 99, -1, 99 },
      { -999, -99, 999, -1 },
      { Double.NaN, Double.POSITIVE_INFINITY, Double.NaN, Double.NaN },
    };
    for (double[] v : views)
      System.out.println(GalleryRules.orbit(v[0], v[1], v[2], v[3]));
  }
}
