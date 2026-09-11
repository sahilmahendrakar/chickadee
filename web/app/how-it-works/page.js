export const metadata = {
  title: 'How Chickadee works — a little field guide',
  description: 'From words on a page to a voice in your browser. A short guide to getting started, local speech, privacy, and what your computer needs.',
};

const source = 'https://github.com/sahilmahendrakar/chickadee';

export default function HowItWorks() {
  return (
    <div className="sheet field-guide">
      <div className="wash wash--tan" aria-hidden="true" />
      <header className="mast">
        <a href="/" className="guide-brand" aria-label="Chickadee home">
          <img className="mast__logo" src="/birds/head-right.webp" alt="" width="48" height="48" />
          <span className="word">Chickadee</span>
        </a>
        <span className="note">runs entirely on your machine</span>
      </header>

      <main>
        <article>
          <header className="guide-hero">
            <div className="guide-eyebrow">A little field guide <span>·</span> 4 minute read</div>
            <h1>How a page<br />finds its <em>voice.</em></h1>
            <p className="guide-deck">A few words about how Chickadee works,<br className="guide-desktop-break" /> and what happens when you press play.</p>
            <figure className="guide-bird">
              <img src="/birds/head-study.webp" alt="Watercolor studies of a chickadee" width="380" height="380" />
              <figcaption>a small bird. a small model.</figcaption>
            </figure>
          </header>

          <div className="guide-intro">
            <span className="guide-margin">the short version</span>
            <p>Chickadee turns the words on a web page into speech, <em>right on your computer.</em> The voice comes from a small, open speech model inside your browser. Your reading stays with you.</p>
          </div>

          <figure className="guide-diagram">
            <div className="guide-diagram__label">Inside your browser</div>
            <ol>
              <li><span className="guide-step-icon" aria-hidden="true">Aa</span><strong>The page</strong><span>text from your browser</span></li>
              <li><span className="guide-step-icon guide-wave" aria-hidden="true">∿∿∿</span><strong>The speech model</strong><span>runs on your machine</span></li>
              <li><span className="guide-step-icon" aria-hidden="true">♫</span><strong>A voice</strong><span>one sentence at a time</span></li>
            </ol>
            <figcaption>fig. 1 — the whole journey stays on your machine</figcaption>
          </figure>

          <section className="guide-section">
            <div className="guide-margin"><span>01</span> Getting started</div>
            <div className="guide-copy">
              <h2>Your first listen.</h2>
              <p>Install Chickadee, open an article, and press <kbd>⌥ R</kbd> on Mac or <kbd>Alt R</kbd> on Windows. You can also open the extension from your toolbar and use its read button.</p>
              <p>The first time, Chickadee downloads the speech model: about 310 MB. Give that first download a little time. The model is saved in your browser, ready for the next read.</p>
              <p>As the voice speaks, the current sentence lights up on the page. Pause, skip, or adjust the speed with the controls at the bottom. To begin partway through, right-click a word and choose “Read aloud from here.” You can choose a different voice in the extension’s toolbar menu.</p>
            </div>
          </section>

          <section className="guide-section">
            <div className="guide-margin"><span>02</span> Behind the voice</div>
            <div className="guide-copy">
              <h2>A small model, close to home.</h2>
              <p>The voice is made by Kokoro-82M, an open speech model. Chickadee runs it using your computer’s graphics hardware through a browser feature called WebGPU.</p>
              <p>It works through the page sentence by sentence, preparing the next few while the current one plays. The article stays where it is, with each spoken sentence highlighted in place. You can follow along with your eyes, or just listen.</p>
            </div>
          </section>

          <section className="guide-section">
            <div className="guide-margin"><span>03</span> Your words stay yours</div>
            <div className="guide-copy">
              <h2>Nothing you read is uploaded.</h2>
              <p>The extension processes page text inside your browser. There is no Chickadee speech server receiving your articles, and the extension has no analytics or tracking. It accesses a page when you ask it to read.</p>
              <p>An internet connection is needed for the initial model download. Once the model is cached, speech works offline on pages you already have open or available offline. If that cache is cleared, the model will need to download again.</p>
              <p>Your voice and speed preferences are saved through Chrome’s settings storage and may sync across your devices. For the details, including how this website differs from the extension, read the <a href="/privacy">privacy policy</a>.</p>
            </div>
          </section>

          <section className="guide-section">
            <div className="guide-margin"><span>04</span> The practical bits</div>
            <div className="guide-copy">
              <h2>A few things to know.</h2>
              <p>You’ll need a Chrome-based browser, such as Chrome or Edge, and a computer with WebGPU support. Chickadee checks before downloading the model and tells you if your setup cannot run it. Speech generation uses your computer’s resources, so performance depends on your hardware.</p>
              <p>Start with a regular article page. Browser settings pages and other protected pages cannot be read by the extension. Offline speech also cannot open an article you haven’t loaded yet.</p>
              <p>Chickadee is free and open source. Because your computer makes the audio, there is no per-read speech server bill, subscription, or API key. You can <a href={source}>look through the source</a> or <a href={`${source}/issues`}>report a rough edge</a>.</p>
            </div>
          </section>

          <div className="guide-end">
            <span className="fig">the best explanation is a listen.</span>
            <h2>Bring a page to life.</h2>
            <a className="btn cta" href="https://chromewebstore.google.com/detail/chickadee/nbghebngnkkjcgpcmhchpijmcdkclndm">Add to Chrome</a>
            <a className="guide-text-link" href="/">Or hear it on the homepage →</a>
          </div>
        </article>
      </main>
      <footer>
        <a href="/">Chickadee</a>
        <a href="/privacy">Privacy</a>
        <a href={source}>Source</a>
        <span className="credit">Any page, read aloud, locally.</span>
      </footer>
    </div>
  );
}
