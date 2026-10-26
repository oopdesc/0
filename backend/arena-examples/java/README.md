# Java verification fixtures

The browser runtime is a **teaching subset** (`src/core/lang/interpreter.ts`),
not a JVM. These fixtures exist so the Java rules taught in the app are checked
against a real compiler and runtime.

```bash
npm run verify:java
# or: bash scripts/verify-java.sh
```

`scripts/verify-java.sh` compiles every `fixtures/*.java` with `javac` into a
temporary directory, runs the class with `java`, and compares stdout to
`fixtures/expected/<Name>.txt`. It fails on any mismatch. If `javac` is not
installed it reports `SKIP` (it does not silently pass).

| Fixture | Rule verified | Expected |
| --- | --- | --- |
| `IntDivision.java` | `int/int` truncates; widening happens after; `double/int` promotes | `3`, `3.0`, `3.5` |
| `ArrayLength.java` | `.length` is element count; `a[a.length]` throws | `3`, `7`, `out of bounds` |
| `Polymorphism.java` | instance method dispatch vs static method hiding; `super` | `planet`, `Body.static`, `body` |
| `StringEquality.java` | `==` identity vs `equals()` value | `false`, `true` |
| `StreamFilter.java` | `filter/collect` does not mutate the source list | `3`, `[12, 7, 20]`, `5` |
| `ExceptionBoundary.java` | `5/0` → `ArithmeticException`, catch then continue | `/ by zero`, `after-catch` |
| `OptionalBasics.java` | `Optional.of/empty`, `isPresent`, `orElse` | `true`, `Terra`, `false` |

Verified with **OpenJDK 11** (`javac 11`). Java 16+ constructs (`record`,
`sealed`) are taught by reading and prediction in the app; they are not
compiled here because the available JDK is 11.

If you integrate TeaVM / CheerpJ / a real browser JVM later, keep
`executeSource()` in `src/core/lang/index.ts` as the adapter and update the UI
honesty labels in `SettingsView` / `HomeView`.
