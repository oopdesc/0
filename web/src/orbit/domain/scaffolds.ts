import type { Lesson, Stage } from './types';

export interface Scaffold { fill: string; partial: string; choices: string[]; blocks: string[] }
export function getScaffold(lesson: Lesson): Scaffold {
  const example = lesson.sources.example;
  if (lesson.id === 'java-array') {
    return { fill: example.replace('i < orbits.length', 'i ___ orbits.length'), partial: example.replace('i < orbits.length', '__________'), choices: ['<', '<='], blocks: [
      'int[] orbits = { 1, 2, 3 };', 'int count = 0;', 'for (int i = 0; i < orbits.length; i++) {\n    int orbit = orbits[i];\n    count++;\n}', 'System.out.println(count);',
    ] };
  }
  if (lesson.id === 'java-stream') {
    return { fill: example.replace('radius >= 4', 'radius ___ 4'), partial: example.replace('radius >= 4', '__________'), choices: ['>=', '>'], blocks: [
      'List<Integer> radii = List.of(2, 4, 6, 8);', 'long count = radii.stream()\n    .filter(radius -> radius >= 4)\n    .count();', 'System.out.println(count);',
    ] };
  }
  if (lesson.id === 'java-polymorphism') {
    return { fill: example.replace('new Planet()', 'new ___()'), partial: example.replace('Body body = new Planet();', 'Body body = new __________();'), choices: ['Planet', 'Star'], blocks: [
      'interface Body { String kind(); }\nclass Planet implements Body {\n    public String kind() { return "planet"; }\n}\nclass Star implements Body {\n    public String kind() { return "star"; }\n}\nclass OrbitLab {\n    public static void main(String[] args) {',
      '        Body body = new Planet();', '        System.out.println(body.kind());', '    }\n}',
    ] };
  }
  if (lesson.id === 'rust-result') {
    return { fill: example.replace('radius > 0', 'radius ___ 0'), partial: example.replace('radius > 0', '__________'), choices: ['>', '>='], blocks: [
      `fn make_orbit(radius: i32) -> Result<i32, &'static str> {\n    if radius > 0 { Ok(radius) } else { Err("invalid") }\n}\nfn main() {`,
      '    let radius = 3;', '    match make_orbit(radius) {\n        Ok(value) => println!("{}", value),\n        Err(message) => println!("{}", message),\n    }', '}',
    ] };
  }
  if (lesson.id === 'rust-ownership') {
    return { fill: example.replace('= &stars;', '= ___;'), partial: example.replace('let view = &stars;', 'let view = __________;'), choices: ['&stars', 'stars', 'stars.clone()'], blocks: [
      'let stars = vec![1, 2, 3];', 'let view = &stars;', 'println!("{}", view.len());', 'println!("{}", stars.len());',
    ] };
  }
  return { fill: example.replace('index: usize = 1', 'index: usize = ___'), partial: example.replace('index: usize = 1', 'index: usize = __________'), choices: ['1', '3'], blocks: [
    'let orbits = vec![1, 2, 3];', 'let index: usize = 1;', 'match orbits.get(index) {\n    Some(radius) => println!("{}", radius),\n    None => println!("none"),\n}',
  ] };
}
export function stageSource(lesson: Lesson, stage: Stage): string {
  const scaffold = getScaffold(lesson);
  if (stage === 'fill') return scaffold.fill;
  if (stage === 'partial') return scaffold.partial;
  if (stage === 'reorder') return '';
  return lesson.sources[stage];
}
export function stagePrompt(lesson: Lesson, stage: Stage): string {
  if (stage === 'fill') return '選択肢で空欄を埋め、出力を予測して実行。間違いも試してみよう。';
  if (stage === 'reorder') return 'ブロックを依存関係に沿って並べ、コードに反映してから実行しよう。';
  if (stage === 'partial') return '選択肢なしで空欄を書き換え、完成例の動きを再現しよう。';
  return lesson.stagePrompts[stage];
}
export function shuffledBlocks(lesson: Lesson): string[] {
  const blocks = getScaffold(lesson).blocks;
  return [blocks[blocks.length - 1], ...blocks.slice(0, -1)];
}
