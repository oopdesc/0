package cosmic.browser;

/** ブラウザとJVMで共有する純粋なJava。DOMやGPUを知らず、入力と作品の設定だけを扱う。 */
public final class GalleryRules {

  private GalleryRules() {}

  public static final int SCENE_COUNT = 3;
  public static final int MAX_SEED = 999999;

  public record Scene(
    String id,
    String name,
    String caption,
    String description,
    double red,
    double green,
    double blue,
    double tilt,
    double speed
  ) {}

  private static final Scene[] SCENES = {
    new Scene(
      "m51",
      "M51 / 子持ち銀河",
      "渦巻銀河と、その伴銀河。",
      "ハッブル宇宙望遠鏡が捉えたM51です。青い星の集まり、赤い星形成領域、暗い塵の筋を拡大して観察できます。",
      .24,
      .56,
      1,
      .58,
      .045
    ),
    new Scene(
      "black-hole",
      "ブラックホール",
      "ブラックホールの降着円盤。",
      "NASAの科学可視化です。降着円盤のガスの動きと、重力で曲げられた光を表しています。望遠鏡で撮影した動画ではありません。",
      1,
      .46,
      .16,
      .72,
      .055
    ),
    new Scene(
      "m104",
      "M104 / ソンブレロ銀河",
      "横から見た、塵の円盤。",
      "ハッブル宇宙望遠鏡が捉えたソンブレロ銀河M104です。明るい中心を横切る暗い塵の筋と、周囲の淡い広がりを観察できます。",
      .22,
      .85,
      .72,
      .38,
      .026
    ),
  };

  public static String camera(
    double zoom,
    double brightness,
    double x,
    double y
  ) {
    return (
      "{\"zoom\":" +
      finiteClamp(zoom, 1, 2.8, 1) +
      ",\"brightness\":" +
      finiteClamp(brightness, .6, 1.8, 1) +
      ",\"x\":" +
      finiteClamp(x, -25, 25, 0) +
      ",\"y\":" +
      finiteClamp(y, -25, 25, 0) +
      "}"
    );
  }

  /** 三次元カメラの角度・距離を検証する。画面のライブラリには依存しない。 */
  public static String orbit(
    double azimuth,
    double elevation,
    double distance,
    double brightness
  ) {
    double a = Double.isFinite(azimuth)
      ? ((((azimuth + 180) % 360) + 360) % 360) - 180
      : -70;
    double e = finiteClamp(elevation, -85, 85, 35);
    double d = finiteClamp(distance, 1.6, 8, 3.8);
    double radians = Math.PI / 180;
    double horizontal = d * Math.cos(e * radians);
    return (
      "{\"azimuth\":" +
      a +
      ",\"elevation\":" +
      e +
      ",\"distance\":" +
      d +
      ",\"brightness\":" +
      finiteClamp(brightness, .6, 1.8, 1) +
      ",\"x\":" +
      horizontal * Math.cos(a * radians) +
      ",\"y\":" +
      horizontal * Math.sin(a * radians) +
      ",\"z\":" +
      d * Math.sin(e * radians) +
      "}"
    );
  }

  public static int sceneIndex(int value) {
    return Math.max(0, Math.min(SCENE_COUNT - 1, value));
  }

  public static Scene scene(int value) {
    return SCENES[sceneIndex(value)];
  }

  public static int seed(int value) {
    return Math.max(1, Math.min(MAX_SEED, value));
  }

  public static double finiteClamp(
    double value,
    double min,
    double max,
    double fallback
  ) {
    if (!Double.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
  }

  public static int indexForId(String id) {
    for (int i = 0; i < SCENES.length; i++) if (
      SCENES[i].id().equals(id)
    ) return i;
    return 0;
  }

  /** JSONは固定の作品名と検証済み数値だけから作る。任意HTML・任意scriptは生成しない。 */
  public static String settings(
    int mode,
    int rawSeed,
    double tilt,
    double exposure
  ) {
    Scene s = scene(mode);
    double safeTilt = finiteClamp(tilt, 0.15, 1.2, s.tilt());
    double safeExposure = finiteClamp(exposure, 0.6, 1.8, 1.0);
    return (
      "{\"mode\":" +
      sceneIndex(mode) +
      ",\"id\":\"" +
      s.id() +
      "\",\"seed\":" +
      seed(rawSeed) +
      ",\"tilt\":" +
      safeTilt +
      ",\"exposure\":" +
      safeExposure +
      ",\"speed\":" +
      s.speed() +
      ",\"color\":[" +
      s.red() +
      "," +
      s.green() +
      "," +
      s.blue() +
      "]}"
    );
  }

  public static String catalog() {
    StringBuilder json = new StringBuilder("[");
    for (int i = 0; i < SCENES.length; i++) {
      Scene s = SCENES[i];
      if (i > 0) json.append(',');
      json
        .append("{\"mode\":")
        .append(i)
        .append(",\"id\":\"")
        .append(s.id())
        .append("\",\"name\":\"")
        .append(s.name())
        .append("\",\"caption\":\"")
        .append(s.caption())
        .append("\",\"description\":\"")
        .append(s.description())
        .append("\",\"tilt\":")
        .append(s.tilt())
        .append('}');
    }
    return json.append(']').toString();
  }
}
