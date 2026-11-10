import "./bookshelf.css";

const repository = "https://github.com/oopdesc/all-beings-flourishing";
const universe = repository + "/tree/main/books/universe-2026";
const happiness = repository + "/tree/main/books/all-beings-2026";
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
        <h1>著作を読む</h1>
        <p>観測と数理から宇宙をたどる本と、幸福や協力について考える本を公開しています。</p>
      </header>
      <section className="book-work" aria-labelledby="book-universe">
        <h2 id="book-universe">宇宙をどこまで知れるのか</h2>
        <p>科学と数学で本質をたどる。全文を3言語で公開しています。</p>
        <ul className="book-editions" aria-label="宇宙の本の言語版">
          {editions.map(({ language, label, title, subtitle, read }) => (
            <li className="book-edition" key={language} lang={language}>
              <img src={`/covers/universe-${language}.webp`} width="240" height="384" alt="" decoding="async" />
              <div>
                <span>{label}</span>
                <h3>{title}</h3>
                <p>{subtitle}</p>
                <a href={`${universe}/${language}`}>{read} ↗</a>
              </div>
            </li>
          ))}
        </ul>
        <p className="book-credits">
          <a href={universe}>宇宙の本の版と書誌情報 ↗</a>
          {" · "}<a href={repository + "/blob/main/books/universe-2026/NOTICE.md"}>原著と利用条件 ↗</a>
        </p>
      </section>
      <section className="book-work" aria-labelledby="book-happiness">
        <h2 id="book-happiness">すべての存在の幸福を考える</h2>
        <p>避けられる苦しみを減らし、協力や生き方の選択を広げるにはどうすればよいかを考えます。</p>
        <div className="book-editions">
          <article className="book-edition">
            <img src="/covers/happiness-ja.webp" width="240" height="384" alt="" loading="lazy" decoding="async" />
            <div>
              <span>日本語</span>
              <h3>知性と協力と自己超越の哲学</h3>
              <a href={repository + "/blob/main/read/00.md#s1"}>日本語版を無料で読む ↗</a>
            </div>
          </article>
        </div>
        <p className="book-credits"><a href={happiness}>幸福の本の版と書誌情報 ↗</a></p>
      </section>
      <p className="book-credits">
        表紙 © 2026 oopdesc。表示用に縮小しています。
        {" · "}<a href={repository}>公開書籍の一覧 ↗</a>
      </p>
    </main>
  );
}
