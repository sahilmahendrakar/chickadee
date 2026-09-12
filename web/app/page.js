import fs from 'node:fs';
import path from 'node:path';
import Narrator from './Narrator';

export default function Home() {
  const n = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public/audio/narration.json'), 'utf8')
  );

  return (
    <div className="sheet">
      <div className="wash wash--tan" aria-hidden="true" />

      {/* the masthead lives inside Narrator so the birdsong switch can sit in it */}
      <Narrator sentences={n.sentences} />

      <footer>
        <span>© {new Date().getFullYear()} Chickadee</span>
        <a href="/how-it-works">How it works</a>
        <a href="/privacy">Privacy</a>
        <a href="https://github.com/sahilmahendrakar/chickadee">Source</a>
        <span className="credit">Birdsong: public-domain recordings by G. McGrane and Karlunun</span>
      </footer>
    </div>
  );
}
