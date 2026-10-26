import type { Dialect } from '../lang';

export interface Snippet {
  id: string;
  label: string;
  dialect: Dialect;
  code: string;
  note: string;
}

export const SNIPPETS: Snippet[] = [
  {
    id: 'java-solar', label: 'Java / 太陽系を組む', dialect: 'java',
    note: 'class で天体を定義し、orbit() で軌道を生成する。',
    code: `// Java: 天体をクラスで表し、宇宙を組み立てる
class Body {
  String describe() { return "celestial body"; }
}
class Planet extends Body {
  String describe() { return "planet"; }
}

clear();
star(0, 0, 2600, "#f4c07a", "Sol");
Body terra = new Planet();
planet(90, 0, 4.2, "#79c7bd", terra.describe());

int[] radii = {50, 120, 190};
for (int i = 0; i < radii.length; i++) {
  orbit(0, 0, radii[i], 8, 0.7);
}
println("bodies=" + bodyCount());`,
  },
  {
    id: 'java-spiral', label: 'Java / 渦巻銀河', dialect: 'java',
    note: 'for と三角関数で星群を配置する。',
    code: `// Java: ループで螺旋の腕を描く
clear();
gravity(0.4);
spiral(3, 700, 240, 2.6, "#a9c9e8");
dust(120, 300, "#5f7686");
star(0, 0, 900, "#f2b36b", "Core");
println("stars=" + bodyCount());`,
  },
  {
    id: 'java-oop', label: 'Java / 多態と継承', dialect: 'java',
    note: 'override されたメソッドは実体側が呼ばれる。',
    code: `class CelestialBody {
  String kind() { return "body"; }
}
class Star extends CelestialBody {
  String kind() { return "star"; }
  String parent() { return super.kind(); }
}
class Planet extends CelestialBody {
  String kind() { return "planet"; }
}
CelestialBody a = new Star();
CelestialBody b = new Planet();
println(a.kind());
println(b.kind());
println(new Star().parent());`,
  },
  {
    id: 'rust-orbit', label: 'Rust / Vec で軌道を作る', dialect: 'rust',
    note: 'vec! と for..in で星群を生成する。',
    code: `// Rust: Vec の各要素が 1 本の軌道になる
clear();
star(0, 0, 2600, "#f4c07a", "Sol");

let radii = vec![55.0, 95.0, 140.0, 200.0];
for r in radii {
  make_orbit(0, 0, r, 6, 0.6);
}
planet(260, 0, 5, "#79c7bd", "Terra");
println!("bodies={}", body_count());`,
  },
  {
    id: 'rust-option', label: 'Rust / Option と match', dialect: 'rust',
    note: '失敗を値として扱い、宇宙の初期化を決める。',
    code: `// Rust: 初期化の成否を Result で表す
fn init(seed: i32) -> Result<i32, i32> {
  if seed > 0 { return Ok(seed * 3); }
  return Err(0);
}

let result = init(4);
let count = match result {
  Ok(n) => n,
  Err(e) => 1,
};
clear();
star(0, 0, 900, "#f2b36b", "Core");
make_spiral(3, count * 20, 210);
println!("{}", body_count());`,
  },
  {
    id: 'rust-borrow', label: 'Rust / 借用チェック', dialect: 'rust',
    note: '可変参照は同時に 1 つ。コメントを外すと E0499。',
    code: `// Rust: 借用チェッカー（教育用サブセット）
let mut x = 1;
let a = &mut x;
// let b = &mut x;  // <- ここを外すと E0499
println!("{}", a);

let mut total = 0;
for i in 0..6 {
  total += i;
}
println!("total={}", total);`,
  },
];

export function snippetsFor(dialect: Dialect): Snippet[] {
  return SNIPPETS.filter((s) => s.dialect === dialect);
}

export function defaultSnippet(dialect: Dialect): Snippet {
  return snippetsFor(dialect)[0]!;
}
