import "./bookshelf.css";

const repository = "https://github.com/oopdesc/all-beings-flourishing";
const book = repository + "/tree/main/books/universe-2026";
const editions = [
  {
    language: "ja",
    label: "日本語",
    title: "宇宙をどこまで知れるのか",
    subtitle: "科学と数学で本質をたどる",
    read: "日本語版を無料で読む",
  },
  {
    language: "en",
    label: "English",
    title: "How Much Can We Know About the Universe?",
    subtitle: "Tracing Fundamental Questions Through Science and Mathematics",
    read: "Read the English edition",
  },
  {
    language: "zh-Hant",
    label: "繁體中文",
    title: "我們能認識宇宙到什麼程度",
    subtitle: "以科學與數學追尋本質",
    read: "免費閱讀繁體中文版",
  },
] as const;

export default function Bookshelf() {
  return (
    <main className="page-shell books-page">
      <header className="page-heading">
        <span className="eyebrow">oopdescの公開書籍</span>
        <h1>宇宙をどこまで知れるのか</h1>
        <p>観測と数理を手がかりに、宇宙について確かめられたことと、まだ開いている問いをたどります。全文を3言語で無料公開しています。</p>
      </header>
      <ul className="book-editions" aria-label="無料で読める言語版">
        {editions.map(({ language, label, title, subtitle, read }) => (
          <li className="book-edition" key={language} lang={language}>
            <img src={`/covers/universe-${language}.webp`} width="240" height="384" alt="" decoding="async" />
            <div>
              <span>{label}</span>
              <h2>{title}</h2>
              <p>{subtitle}</p>
              <a href={`${book}/${language}`}>{read} ↗</a>
            </div>
          </li>
        ))}
      </ul>
      <p className="book-credits">
        表紙 © 2026 oopdesc。表示用に縮小しています。 <a href={repository + "/blob/main/books/universe-2026/NOTICE.md"}>原著と利用条件</a>
        {" · "}<a href={repository}>公開書籍の一覧 ↗</a>
      </p>
    </main>
  );
}
