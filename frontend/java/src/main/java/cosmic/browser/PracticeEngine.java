package cosmic.browser;

import java.util.Arrays;
import java.util.Locale;

/** 定義済みの小さなJava演習だけを実行する。入力をコードとして評価する機能は持たない。 */
public final class PracticeEngine {

  private PracticeEngine() {}

  public static String run(String exercise, String input) {
    if (input == null || input.length() > 160) return failure(
      "入力は160文字以内にしてください。"
    );
    try {
      return switch (exercise == null ? "" : exercise) {
        case "clamp" -> clamp(input);
        case "filter" -> filter(input);
        case "copy" -> copy(input);
        case "json" -> success(
          quote(input),
          "文字列の値と、JSONに書き出す表現を区別します。二重引用符・改行・バックスラッシュを確認してください。"
        );
        default -> failure("この演習は見つかりません。");
      };
    } catch (NumberFormatException e) {
      return failure(
        "整数として読み取れません。小数・空欄・intの範囲を超える値を確認してください。"
      );
    }
  }

  private static String clamp(String input) {
    int value = parseInteger(input);
    int result = Math.max(0, Math.min(100, value));
    return success(
      Integer.toString(result),
      "数字を半角の0〜9へ揃えて整数に変換し、0〜100に収めます。変換できない入力は、範囲を調整する前にエラーになります。"
    );
  }

  private static String filter(String input) {
    String query = input.trim().toLowerCase(Locale.ROOT);
    String[] source = {
      "Java / HTTP",
      "Java / record",
      "Java / browser",
      "Rust / ownership",
      "GLSL / light",
    };
    StringBuilder result = new StringBuilder("[");
    for (String item : source)
      if (item.toLowerCase(Locale.ROOT).contains(query)) {
        if (result.length() > 1) result.append(", ");
        result.append(item);
      }
    return success(
      result.append(']').toString(),
      "trimと小文字化の後に部分一致で絞ります。空文字は全件に一致します。全角と半角をそろえる処理は、この演習には含めていません。"
    );
  }

  private static String copy(String input) {
    String[] parts = input.split(",", -1);
    if (parts.length > 12) return failure("配列は12個以内にしてください。");
    int[] original = new int[parts.length];
    for (int i = 0; i < parts.length; i++) original[i] = parseInteger(parts[i]);
    int[] sorted = Arrays.copyOf(original, original.length);
    Arrays.sort(sorted);
    return success(
      "元の配列: " +
        Arrays.toString(original) +
        "\n並べ替え後: " +
        Arrays.toString(sorted),
      "コピーした配列だけを並べ替えています。sorted = originalに変えたら、結果はどう変わるでしょうか。"
    );
  }

  public static int reviewDays(int successes, boolean recalled) {
    if (!recalled) return 1;
    int[] days = { 1, 3, 7, 14, 30 };
    return days[Math.max(0, Math.min(days.length - 1, successes))];
  }

  /**
   * TeaVM 0.16のparseIntはASCII数字だけを読むため、Unicodeの十進数字を先に揃える。
   * isDigitで十進数字に限定し、ローマ数字や上付き数字を整数として受け入れない。
   * 符号とintの範囲の判定はInteger.parseIntに任せる。
   */
  static int parseInteger(String raw) {
    String value = raw.trim();
    StringBuilder ascii = new StringBuilder();
    for (int i = 0; i < value.length(); i++) {
      char c = value.charAt(i);
      if (i == 0 && (c == '+' || c == '-')) {
        ascii.append(c);
      } else {
        if (!Character.isDigit(c)) throw new NumberFormatException();
        int digit = Character.digit(c, 10);
        if (digit < 0 || digit > 9) throw new NumberFormatException();
        ascii.append((char) ('0' + digit));
      }
    }
    return Integer.parseInt(ascii.toString());
  }

  private static String success(String value, String explanation) {
    return (
      "{\"ok\":true,\"result\":" +
      quote(value) +
      ",\"explanation\":" +
      quote(explanation) +
      "}"
    );
  }

  private static String failure(String message) {
    return (
      "{\"ok\":false,\"result\":" +
      quote(message) +
      ",\"explanation\":\"入力を変えてもう一度試せます。\"}"
    );
  }

  static String quote(String value) {
    StringBuilder out = new StringBuilder("\"");
    char[] hex = "0123456789abcdef".toCharArray();
    for (int i = 0; i < value.length(); i++) {
      char c = value.charAt(i);
      if (c == '"' || c == '\\') out.append('\\').append(c);
      else if (c < 32) out
        .append("\\u00")
        .append(hex[c >> 4])
        .append(hex[c & 15]);
      else out.append(c);
    }
    return out.append('"').toString();
  }
}
