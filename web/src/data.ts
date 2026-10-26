/** 公開してよい作品・教材だけを列挙。個人文書や共有フォルダのURLは置かない。 */
export type Category = "作品" | "学習" | "リンク";
export type Resource = {
  id: string;
  title: string;
  subtitle: string;
  category: Category;
  tag: string;
  href: string;
  image?: string;
  accent: string;
};
export const resources: Resource[] = [
  {
    id: "code-lab",
    title: "宇宙をつくるコード実験室",
    subtitle: "Java・Rustの短いコードを編集し、結果と天体の変化を確かめる。",
    category: "学習",
    tag: "予測・実行・復習",
    href: "/learn?section=practice&mode=code",
    accent: "orange",
  },
  {
    id: "art",
    title: "太陽系と宇宙の模型",
    subtitle: "惑星の姿と公転、銀河やブラックホールを観察する。",
    category: "作品",
    tag: "惑星 · 銀河 · 動く模型",
    href: "/art",
    accent: "violet",
  },
  {
    id: "java",
    title: "Java / HTTPの入口",
    subtitle: "入力から応答まで。小さなAPIを読む。",
    category: "学習",
    tag: "Java 21",
    href: "/learn?section=flow",
    accent: "orange",
  },
  {
    id: "rust",
    title: "Rust / 境界を越える",
    subtitle: "所有権、再現性、ブラウザのメモリ。",
    category: "学習",
    tag: "Rust",
    href: "/learn?track=Rust",
    accent: "mint",
  },
  {
    id: "typescript",
    title: "TypeScript / 画面をつくる",
    subtitle: "型と状態を、小さく積み重ねる。",
    category: "学習",
    tag: "TypeScript · React",
    href: "/learn?track=TypeScript",
    accent: "blue",
  },
  {
    id: "github",
    title: "コードのすべて",
    subtitle: "このサイトを、手元のEclipseで再現する。",
    category: "リンク",
    tag: "GitHub",
    href: "https://github.com/oopdesc/0",
    accent: "mint",
  },
  {
    id: "chat",
    title: "ChatGPTで学ぶ",
    subtitle: "自分の説明を伝えて、理解を確かめる。",
    category: "リンク",
    tag: "チャット",
    href: "/aichat",
    accent: "violet",
  },
  {
    id: "youtube",
    title: "Javaの公式資料・日本語",
    subtitle: "Oracle公式の日本語API仕様から調べる。",
    category: "リンク",
    tag: "Java 21 API",
    href: "/learn?section=references",
    accent: "orange",
  },
  {
    id: "huggingface",
    title: "Rustの入門資料・日本語",
    subtitle: "公式日本語の実例集と、入門書の日本語訳を読む。",
    category: "リンク",
    tag: "Rust · 日本語",
    href: "/learn?section=references",
    accent: "blue",
  },
];
