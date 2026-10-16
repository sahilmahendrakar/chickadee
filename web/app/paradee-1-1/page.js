import { AudioClip } from '../paradee/components/AudioClip';
import { Snippet } from '../paradee/components/Figures';
import { ReadingProgress } from '../paradee/components/ReadingProgress';
import '../paradee/paradee.css';

// From PARADEE_11_POST in sahilmahendrakar.com's lib/native-posts.ts.
const post = {
  id: 'paradee-1-1',
  title: 'Paradee-8M-v1.1',
  subtitle: 'A new decoder head makes Paradee three times faster and removes most of the buzz.',
  date: '2026-10-19',
  readingMinutes: 3,
};
const DATE_LABEL = 'October 19, 2026';

const ASSETS = '/paradee-1-1';
// The post's home is on Sahil's site; this page is a copy of it.
const URL = 'https://sahilmahendrakar.com/writings/paradee-1-1';
const source = 'https://github.com/sahilmahendrakar/chickadee';

const COVER = { url: `${ASSETS}/img/cover.jpg`, width: 1600, height: 900, alt: 'A watercolour blue parakeet singing on a twig, with music notes.' };

const ROWS = [
  { label: 'File size', v10: '9.0 MB', v11: '8.5 MB' },
  { label: 'Speed on one CPU thread', v10: '18x real time', v11: '62x real time' },
  { label: 'Naturalness score (out of 5)', v10: '4.41', v11: '4.39' },
  { label: 'Words misheard', v10: '5.9%', v11: '5.9%' },
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

export default function Paradee11Post() {
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
                style={{ width: '52%' }}
                src={`${ASSETS}/img/cover-paper.webp`}
                alt={COVER.alt}
                width={834}
                height={696}
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
              A few weeks ago I released <a href="/paradee">Paradee</a>, an 8M parameter voice model distilled from{' '}
              <a href="https://huggingface.co/hexgrad/Kokoro-82M">Kokoro-82M</a>. Today I&rsquo;m releasing
              <a href="https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.1">Paradee-8M-v1.1</a>. It sounds cleaner, and it runs more than three times faster.
            </p>
            <p>Here&rsquo;s one sentence read by both versions.</p>
            <blockquote>
              In the wild, parakeets fly in loud, colorful flocks across the open grasslands of Australia.
            </blockquote>
            <div className="pd-clips">
              <AudioClip src={`${ASSETS}/audio/parakeets_v1_0.mp3`} label="Paradee-8M-v1.0" />
              <AudioClip src={`${ASSETS}/audio/parakeets_v1_1.mp3`} label="Paradee-8M-v1.1" />
            </div>
            <div className="pd-table-wrap">
              <table className="pd-table">
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">Paradee-8M-v1.0</th>
                    <th scope="col" className="pd-table-us">Paradee-8M-v1.1</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      <td>{r.v10}</td>
                      <td className="pd-table-us">{r.v11}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              These are measured on the same 200 held-out sentences as before.{' '}
              <a href="https://arxiv.org/abs/2204.02152">UTMOS</a> is a model trained on human ratings that predicts how
              natural a clip sounds. UTMOS wasn&rsquo;t a reliable metric for the buzz or static noise listeners could
              hear in Paradee-8M-v1.0. So for this release I relied on listening to the two side by side rather than on
              UTMOS.
            </p>

            <p>
              Here&rsquo;s how v1.1 compares with Kokoro and other small open voice models on the same sentences. The
              area of each bubble shows the model&rsquo;s file size.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="pd-diagram"
              src={`${ASSETS}/img/quality_vs_speed.webp`}
              width={1200}
              height={736}
              alt="Naturalness score against speed on one CPU thread for Kokoro-82M, Piper, KittenTTS, Kokoro-7M-Distill, Paradee v1.0 and Paradee v1.1, with bubble area showing file size. Paradee v1.1 is the fastest at 62x and scores 4.39."
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="pd-diagram"
              src={`${ASSETS}/img/wer_vs_speed.webp`}
              width={1200}
              height={736}
              alt="Word error rate against speed on one CPU thread for the same models. Paradee v1.1 has 5.9% word error rate at 62x real time."
            />

            <h2>What changed</h2>
            <p>
              Version 1.1 keeps the text side and most of the decoder, and replaces only the last part, the part that
              produces the waveform. In v1.0 that was a smaller copy of Kokoro&rsquo;s waveform generator. It takes the
              decoder&rsquo;s 80 frames per second and upsamples them step by step until it reaches 24,000 audio samples
              per second. That upsampling used most of Paradee&rsquo;s compute, and the phase it predicted was slightly
              off, which caused the buzz. I needed a separate filter after it to clean that up.
            </p>
            <p>
              For v1.1 I replaced it with a head based on <a href="https://arxiv.org/abs/2306.00814">Vocos</a>. Vocos
              never upsamples. It predicts each frame&rsquo;s spectrogram directly at the frame rate and turns that into
              audio with a fixed formula, so it is much faster. I also hoped a head like this would let me fix the buzz
              in the model itself instead of with a filter.
            </p>
            <p>
              My head differs from Vocos for voiced sounds. A voiced sound, like a vowel, is made of a tone at the pitch
              plus tones at two, three, four times the pitch and so on. Since the text side already predicts the pitch,
              the head generates those tones directly, so their timing is always right, and the network only predicts
              how loud each one should be. Everything else is made by shaping random noise.
            </p>
            <p>The result is faster inference and cleaner audio, without the filter from v1.0.</p>
            <p>
              Here&rsquo;s a close-up of the word &ldquo;wild&rdquo; between 1.5 and 4.5 kHz. Time goes left to right,
              frequency goes up, and brighter means louder. Kokoro has distinct stripes that rise and fall with the
              pitch. In v1.0 they are smeared, and in v1.1 they are clear again.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="pd-diagram"
              src={`${ASSETS}/img/zoom_wild.webp`}
              width={1200}
              height={430}
              alt="Close-up spectrograms of Kokoro, Paradee-8M-v1.0 and Paradee-8M-v1.1 on the word wild, 1.5 to 4.5 kHz. Kokoro and 1.1 show distinct stripes, 1.0 looks smeared."
            />

            <h2>Try it</h2>
            <p>
              Paradee-8M-v1.1 is now the light voice in{' '}
              <a href="https://chromewebstore.google.com/detail/chickadee/nbghebngnkkjcgpcmhchpijmcdkclndm">Chickadee</a>,
              a Chrome extension that reads web pages aloud using local voice models. Install it, choose Paradee as the
              voice model, and have it read out a web page.
            </p>
            <p>The Python package now uses v1.1 by default, and the model file is a drop-in replacement for v1.0.</p>
            <Snippet
              code={`pip install git+https://github.com/sahilmahendrakar/paradee\npython -m paradee "Paradee is a small voice that runs anywhere." -o hello.wav`}
            />

            <h2>Links</h2>
            <ul>
              <li>
                Model: <a href="https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.1">Hugging Face</a>
              </li>
              <li>
                Code: <a href="https://github.com/sahilmahendrakar/paradee">GitHub</a>
              </li>
              <li>
                Chickadee: <a href="https://chromewebstore.google.com/detail/chickadee/nbghebngnkkjcgpcmhchpijmcdkclndm">Chrome Web Store</a>
              </li>
              <li>
                Paper (describes v1.0): <a href="https://arxiv.org/abs/2610.06817">arXiv</a>
              </li>
              <li>
                First post: <a href="/paradee">Paradee: Distilling a voice model to one-tenth its size</a>
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
