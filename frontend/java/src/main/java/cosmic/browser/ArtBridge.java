package cosmic.browser;

import org.teavm.jso.JSExport;

/** TeaVMの境界。Javaの同じ判定を、公開ブラウザでもJVMでも実行する。 */
public final class ArtBridge {

  private ArtBridge() {}

  public static void main(String[] args) {}

  @JSExport
  public static String catalog() {
    return GalleryRules.catalog();
  }

  @JSExport
  public static String settings(
    int mode,
    int seed,
    double tilt,
    double exposure
  ) {
    return GalleryRules.settings(mode, seed, tilt, exposure);
  }

  @JSExport
  public static int indexForId(String id) {
    return GalleryRules.indexForId(id);
  }

  @JSExport
  public static String camera(
    double zoom,
    double brightness,
    double x,
    double y
  ) {
    return GalleryRules.camera(zoom, brightness, x, y);
  }

  @JSExport
  public static String orbit(double azimuth, double elevation, double distance, double brightness) {
    return GalleryRules.orbit(azimuth, elevation, distance, brightness);
  }

  @JSExport
  public static String run(String exercise, String input) {
    return PracticeEngine.run(exercise, input);
  }

  @JSExport
  public static int reviewDays(int successes, boolean recalled) {
    return PracticeEngine.reviewDays(successes, recalled);
  }
}
