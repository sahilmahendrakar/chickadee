export const metadata = { title: 'Privacy — Chickadee' };

export default function Privacy() {
  return (
    <div className="sheet">
      <div className="wash wash--tan" aria-hidden="true" />

      <header className="mast">
        <img className="mast__logo" src="/birds/head-right.webp" alt="" width="48" height="48" />
        <a href="/" className="word">Chickadee</a>
        <span className="note">runs entirely on your machine</span>
        <span className="mast__right">
        <a className="gh" href="https://github.com/sahilmahendrakar/chickadee" target="_blank" rel="noopener noreferrer"
           aria-label="Chickadee on GitHub" title="Source on GitHub">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.05.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58C20.57 22.29 24 17.79 24 12.5 24 5.87 18.63.5 12 .5z" />
          </svg>
        </a>
        </span>
      </header>

      <article className="prose">
        <h1>Privacy Policy</h1>
        <div className="date">last updated 4 September 2026</div>

        <p className="lede">
          Chickadee does not collect, transmit, store, or share any personal data.
          There is no server, so there is nothing to collect it with.
        </p>

        <h2>What happens to the page you read</h2>
        <p>Chickadee reads the text of the page you are viewing so it can speak it aloud.
          That text is processed <strong>entirely inside your own browser</strong>. It is never
          sent to us and never sent to a third party. Speech is generated locally by the
          Kokoro-82M model running on your own computer.</p>

        <h2>The only network request</h2>
        <p>On first use, Chickadee downloads the Kokoro-82M voice model (about 310 MB) from
          Hugging Face. This is a one-time download of a static, public file. It is then cached
          in your browser and the extension works offline afterwards. The request contains no
          information about you, the page you are reading, or the text being spoken.</p>

        <h2>What is stored on your device</h2>
        <p>Your chosen voice and default speed are stored with Chrome’s <code>storage.sync</code>{' '}
          API. If you are signed into Chrome these sync across your own devices through your
          Google account, exactly like your other Chrome settings. We have no access to them.
          The voice model is cached in your browser’s storage.</p>

        <h2>Permissions, and why each is needed</h2>
        <ul>
          <li><strong>activeTab</strong> — access to the one page you ask it to read, granted only
            when you start the reader (toolbar button, ⌥R, or the right-click menu). It has no
            access to any other tab and is never loaded into pages ahead of time.</li>
          <li><strong>scripting</strong> — to run the reader on that tab on demand.</li>
          <li><strong>storage</strong> — to remember your voice and speed.</li>
          <li><strong>contextMenus</strong> — to add the “Read aloud from here” right-click item.</li>
        </ul>

        <h2>Analytics and tracking</h2>
        <p>The extension has none. No analytics, no telemetry, no crash reporting, no cookies,
          no identifiers, no advertising.</p>
        <p>This website uses Vercel Web Analytics to count page views. It sets no cookies and
          stores no personal identifiers; the extension never talks to it.</p>

        <h2>Changes</h2>
        <p>Any change to this policy will be published with a new version of the extension.</p>

        <h2>Contact</h2>
        <p>Open an issue at <a href="https://github.com/sahilmahendrakar/chickadee/issues">github.com/sahilmahendrakar/chickadee/issues</a>.</p>
      </article>

      <footer>
        <a href="/">← Back</a>
        <span>Chickadee runs entirely on your machine.</span>
      </footer>
    </div>
  );
}
