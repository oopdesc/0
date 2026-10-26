class Body {
  String kind() { return "body"; }
  static String scope() { return "Body.static"; }
}

class Planet extends Body {
  @Override String kind() { return "planet"; }
  static String scope() { return "Planet.static"; }  // hiding, NOT overriding
  String parent() { return super.kind(); }
}

public class Polymorphism {
  public static void main(String[] args) {
    Body b = new Planet();
    System.out.println(b.kind());   // dynamic dispatch -> runtime object
    System.out.println(b.scope());  // static method -> declared type
    System.out.println(new Planet().parent());
  }
}
