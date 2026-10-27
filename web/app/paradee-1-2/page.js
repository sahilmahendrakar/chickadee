import { AudioClip } from '../paradee/components/AudioClip';
import { Snippet } from '../paradee/components/Figures';
import { ReadingProgress } from '../paradee/components/ReadingProgress';
import '../paradee/paradee.css';

// From PARADEE_12_POST in sahilmahendrakar.com's lib/native-posts.ts.
const post = {
  id: 'paradee-1-2',
  title: 'Paradee 1.2: Expanding to additional voices',
  subtitle: 'Paradee now speaks four voices without growing in size or losing quality.',
  date: '2026-10-28',
  readingMinutes: 3,
};
const DATE_LABEL = 'October 28, 2026';

const ASSETS = '/paradee-1-2';
// The post's home is on Sahil's site; this page is a copy of it.
const URL = 'https://sahilmahendrakar.com/writings/paradee-1-2';
const source = 'https://github.com/sahilmahendrakar/chickadee';

const COVER = { url: `${ASSETS}/img/cover.jpg`, width: 1600, height: 900, alt: 'Four watercolour budgies, blue, green, yellow and violet, singing on one branch.' };

const PAPER = 'https://arxiv.org/abs/2610.06817';
const PAPER_TITLE = 'Paradee: Distilling Kokoro-82M into an 8M-Parameter Single-Voice Text-to-Speech Model';

const VOICES = [
  { id: 'af_heart', name: 'Heart', accent: 'American' },
  { id: 'am_puck', name: 'Puck', accent: 'American' },
  { id: 'bf_isabella', name: 'Isabella', accent: 'British' },
  { id: 'bm_fable', name: 'Fable', accent: 'British' },
];

const UTMOS = [
  { voice: 'af_heart', paradee: '4.40', kokoro: '4.52' },
  { voice: 'bf_isabella', paradee: '4.06', kokoro: '4.41' },
  { voice: 'am_puck', paradee: '4.32', kokoro: '4.47' },
  { voice: 'bm_fable', paradee: '4.18', kokoro: '4.32' },
];

const WER = [
  { voice: 'af_heart', paradee: '5.8%', kokoro: '5.7%' },
  { voice: 'bf_isabella', paradee: '5.7%', kokoro: '5.6%' },
  { voice: 'am_puck', paradee: '5.4%', kokoro: '6.3%' },
  { voice: 'bm_fable', paradee: '5.7%', kokoro: '5.7%' },
];

const PHONEMES = [
  { word: 'avocado', american: 'ˌɑvəkˈɑdO', british: 'ˌavəkˈɑːdQ' },
  { word: 'tomato', american: 'təmˈATO', british: 'təmˈɑːtQ' },
  { word: 'schedule', american: 'skˈɛʤˌul', british: 'ʃˈɛdjuːl' },
];

export const metadata = {
  title: post.title,
  description: post.subtitle,
  alternates: { canonical: URL },
  openGraph: {
    type: 'article',
    title: post.title,
    description: post.subtitle,
    publishedTime: post.date,
    url: URL,
    siteName: 'Chickadee',
    images: [COVER],
  },
  twitter: {
    card: 'summary_large_image',
    title: post.title,
    description: post.subtitle,
    images: [COVER.url],
  },
};

function ScoreTable({ metric, rows }) {
  return (
    <div className="pd-table-wrap">
      <table className="pd-table">
        <thead>
          <tr>
            <th scope="col">{metric}</th>
            <th scope="col" className="pd-table-us">Paradee-8M-v1.2</th>
            <th scope="col">Kokoro-82M</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.voice}>
              <th scope="row">{r.voice}</th>
              <td className="pd-table-us">{r.paradee}</td>
              <td>{r.kokoro}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Paradee12Post() {
  return (
    <div className="sheet pd">
      <ReadingProgress />
      <div className="wash wash--tan" aria-hidden="true" />
      <header className="mast">
        <a href="/" className="guide-brand" aria-label="Chickadee home">
          <img className="mast__logo" src="/birds/head-right.webp" alt="" width="48" height="48" />
          <span className="word">Chickadee</span>
        </a>
        <span className="note">runs entirely on your machine</span>
        <span className="mast__right">
          <a className="nav" href="/blog">Blog</a>
        </span>
      </header>

      <main>
        <article className="pd-article">
          <div className="pd-col">
            <header className="pd-header">
              <h1 className="pd-title">{post.title}</h1>
              <p className="pd-subtitle">{post.subtitle}</p>
              <img
                className="pd-cover"
                src={`${ASSETS}/img/cover-paper.webp`}
                alt={COVER.alt}
                width={1591}
                height={681}
              />
              <div className="pd-meta">
                <time dateTime={post.date}>{DATE_LABEL}</time>
                <span aria-hidden="true">·</span>
                <span>{post.readingMinutes} min read</span>
                <span aria-hidden="true">·</span>
                <span>By Sahil Mahendrakar</span>
              </div>
              <p className="pd-origin">
                This post first appeared on <a href={URL}>sahilmahendrakar.com</a>.
              </p>
            </header>
          </div>

          <div className="pd-col post-body">
            <p>
              Last week I released <a href="/paradee-1-1">Paradee-8M-v1.1</a>, a faster and clearer
              version of my small voice model distilled from{' '}
              <a href="https://huggingface.co/hexgrad/Kokoro-82M">Kokoro-82M</a>. Until now Paradee only had one voice,
              Kokoro&rsquo;s af_heart. Today I&rsquo;m releasing{' '}
              <a href="https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.2">Paradee-8M-v1.2</a>, which has four
              voices in the same 8.5 MB file and without any quality loss.
            </p>
            <p>Here&rsquo;s one sentence read by each voice.</p>
            <blockquote>
              In the wild, parakeets fly in loud, colorful flocks across the open grasslands of Australia.
            </blockquote>
            <div className="pd-clips">
              {VOICES.map((v) => (
                <AudioClip key={v.id} src={`${ASSETS}/audio/parakeets_${v.id}.mp3`} label={`${v.name} (${v.accent})`} />
              ))}
            </div>

            <p>
              <strong>UTMOS</strong> (higher is better)
              <br />
              UTMOS is a model trained on human ratings that predicts how natural a clip sounds, on a scale from 1 to 5.
            </p>
            <ScoreTable metric="UTMOS" rows={UTMOS} />

            <p>
              <strong>WER</strong> (lower is better)
              <br />
              WER is the share of words that Whisper, a speech recognition model, transcribes wrongly.
            </p>
            <ScoreTable metric="WER" rows={WER} />

            <p>
              These are measured on the same 200 held-out sentences as before. UTMOS predicts how natural a clip sounds,
              out of 5, and WER is the share of words Whisper mishears. af_heart scores 4.40, against 4.39 in v1.1, so
              adding the other voices didn&rsquo;t reduce the existing voice&rsquo;s quality. The file size and speed are
              the same as v1.1.
            </p>

            <h2>What changed</h2>
            <p>
              Kokoro describes each voice with a vector, and the model reads that vector at every step. Paradee 1.1 only
              ever saw one voice, so it learned a single fixed vector. For v1.2 each half of the model has a small table
              with one vector per voice, and the voice you pick chooses the row. Everything else is shared between the
              four voices.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="pd-diagram"
              src={`${ASSETS}/img/voices_before_after.webp`}
              width={1500}
              height={920}
              alt="Paradee 1.1 and 1.2 side by side: in 1.2 each half has a table of four voice vectors, and the chosen voice picks the row"
            />
            <p>
              The British voices also need British pronunciation. Kokoro uses different phonemes for the same word
              between British and American voices. Some examples of words with different American and British phonemes
              are included below:
            </p>
            <div className="pd-table-wrap">
              <table className="pd-table pd-table-text">
                <thead>
                  <tr>
                    <th scope="col">Word</th>
                    <th scope="col">American</th>
                    <th scope="col">British</th>
                  </tr>
                </thead>
                <tbody>
                  {PHONEMES.map((r) => (
                    <tr key={r.word}>
                      <th scope="row">{r.word}</th>
                      <td>{r.american}</td>
                      <td>{r.british}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              The phonemizer in the package and in Chickadee was updated to use British phonemes when a British voice is
              used.
            </p>
            <p>
              In order to add the additional voices, I started from the v1.1 weights and kept training both the
              text-side and the decoder on Kokoro reading 12,000 sentences in each of the four voices. For more
              information on how the training of Paradee works, see{' '}
              <a href={PAPER}>
                <em>{PAPER_TITLE}</em>
              </a>
              . The result is Paradee-8M-v1.2 with four voices, the same tiny model size, and no quality loss compared to
              v1.1 on its existing voice.
            </p>

            <h2>Try it</h2>
            <p>
              Paradee-8M-v1.2 is now the light voice in{' '}
              <a href="https://chromewebstore.google.com/detail/chickadee/nbghebngnkkjcgpcmhchpijmcdkclndm">Chickadee</a>,
              a Chrome extension that reads web pages aloud using local voice models. Choose Paradee as the model and
              pick one of the four voices.
            </p>
            <p>The Python package uses v1.2 by default, and v1.1 is still available.</p>
            <Snippet
              code={`pip install git+https://github.com/sahilmahendrakar/paradee\npython -m paradee "Paradee is a small voice that runs anywhere." --voice bf_isabella -o hello.wav`}
            />

            <h2>Links</h2>
            <ul>
              <li>
                Model: <a href="https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.2">Hugging Face</a>
              </li>
              <li>
                Code: <a href="https://github.com/sahilmahendrakar/paradee">GitHub</a>
              </li>
              <li>
                Chickadee: <a href="https://chromewebstore.google.com/detail/chickadee/nbghebngnkkjcgpcmhchpijmcdkclndm">Chrome Web Store</a>
              </li>
              <li>
                v1.0 Paper:{' '}
                <a href={PAPER}>
                  <em>{PAPER_TITLE}</em>
                </a>
              </li>
              <li>
                Earlier posts: <a href="/paradee-1-1">Paradee 1.1</a>,{' '}
                <a href="/paradee">Paradee</a>
              </li>
            </ul>
          </div>
        </article>
      </main>

      <footer>
        <a href="/">Chickadee</a>
        <a href="/blog">Blog</a>
        <a href="/privacy">Privacy</a>
        <a href={source}>Source</a>
        <span className="credit">Any page, read aloud, locally.</span>
      </footer>
    </div>
  );
}
