export const metadata = {
  title: 'Writing — Chickadee',
  description: 'Notes on how Chickadee works and how it was made.',
};

const source = 'https://github.com/sahilmahendrakar/chickadee';

// Newest first.
const posts = [
  {
    href: '/paradee',
    title: 'Paradee: Distilling a voice model to one-tenth its size',
    summary: 'What I learned shrinking Kokoro-82M into an 8M-parameter voice model that runs on a CPU.',
    date: '2026-10-05',
    label: 'October 5, 2026',
    cover: '/paradee/img/cover-paper.png',
  },
  {
    href: '/how-it-works',
    title: 'Introducing Chickadee',
    summary: 'A few words about how Chickadee works, and what happens when you press play.',
    date: '2026-09-08',
    label: 'September 8, 2026',
    cover: '/writing/introducing-chickadee.webp',
  },
];

export default function Writing() {
  return (
    <div className="sheet field-guide writing">
      <div className="wash wash--tan" aria-hidden="true" />
      <header className="mast">
        <a href="/" className="guide-brand" aria-label="Chickadee home">
          <img className="mast__logo" src="/birds/head-right.webp" alt="" width="48" height="48" />
          <span className="word">Chickadee</span>
        </a>
        <span className="note">runs entirely on your machine</span>
        <span className="mast__right">
          <a className="nav" href="/writing" aria-current="page">Writing</a>
        </span>
      </header>

      <main>
        <header className="writing-head">
          <h1>Writing</h1>
        </header>
        <ol className="writing-list">
          {posts.map((post) => (
            <li key={post.href}>
              <a href={post.href}>
                <div className="writing-text">
                  <time dateTime={post.date}>{post.label}</time>
                  <h2>{post.title}</h2>
                  <p>{post.summary}</p>
                </div>
                <img className="writing-cover" src={post.cover} alt="" loading="lazy" />
              </a>
            </li>
          ))}
        </ol>
      </main>
      <footer>
        <a href="/">Chickadee</a>
        <a href="/how-it-works">How it works</a>
        <a href="/privacy">Privacy</a>
        <a href={source}>Source</a>
        <span className="credit">Any page, read aloud, locally.</span>
      </footer>
    </div>
  );
}
