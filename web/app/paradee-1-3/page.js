import { AudioClip } from '../paradee/components/AudioClip';
import { Snippet } from '../paradee/components/Figures';
import { ReadingProgress } from '../paradee/components/ReadingProgress';
import '../paradee/paradee.css';

// From PARADEE_13_POST in sahilmahendrakar.com's lib/native-posts.ts.
const post = {
  id: 'paradee-1-3',
  title: 'Paradee 1.3: The smallest multilingual TTS model',
  subtitle:
    'Paradee now speaks Hindi, French and Spanish along with English, without growing in size or losing quality on existing voices.',
  date: '2026-11-09',
  readingMinutes: 4,
};
const DATE_LABEL = 'November 9, 2026';

const ASSETS = '/paradee-1-3';
// The post's home is on Sahil's site; this page is a copy of it.
const URL = 'https://sahilmahendrakar.com/writings/paradee-1-3';
const source = 'https://github.com/sahilmahendrakar/chickadee';
const HF = 'https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3';
const COVER = { url: `${ASSETS}/img/cover.jpg`, width: 1600, height: 900, alt: 'A watercolour pale blue budgie singing as it flies around a small globe.' };
const STORE = 'https://chromewebstore.google.com/detail/chickadee/nbghebngnkkjcgpcmhchpijmcdkclndm';

const CLIPS = [
  {
    id: 'af_heart',
    label: 'English (Heart)',
    lang: 'en',
    text: 'In the wild, parakeets fly in loud, colorful flocks across the open grasslands of Australia.',
  },
  {
    id: 'hf_alpha',
    label: 'Hindi (Alpha)',
    lang: 'hi',
    text: 'जंगल में तोते ऑस्ट्रेलिया के खुले घास के मैदानों के ऊपर शोर मचाते, रंग-बिरंगे झुंडों में उड़ते हैं।',
  },
  {
    id: 'ff_siwis',
    label: 'French (Siwis)',
    lang: 'fr',
    text: 'En Australie, on peut voir les perruches voler en grandes bandes colorées au-dessus des prairies.',
  },
  {
    id: 'em_alex',
    label: 'Spanish (Alex)',
    lang: 'es',
    text: 'En libertad, los periquitos vuelan en bandadas ruidosas y coloridas sobre las praderas abiertas de Australia.',
  },
];

const VOICES = [
  { language: 'English (American)', voices: 'Heart, Puck' },
  { language: 'English (British)', voices: 'Isabella, Fable' },
  { language: 'Hindi', voices: 'Alpha, Omega' },
  { language: 'French', voices: 'Siwis' },
  { language: 'Spanish', voices: 'Alex' },
];

const PHONEMES = [
  { language: 'English', word: 'Australia', lang: 'en', phonemes: 'ɔstɹˈAljə' },
  { language: 'Hindi', word: 'ऑस्ट्रेलिया', lang: 'hi', phonemes: 'ɔsʈɾˈeːlɪjˌaː' },
  { language: 'French', word: 'Australie', lang: 'fr', phonemes: 'ostʁalˈi' },
  { language: 'Spanish', word: 'Australia', lang: 'es', phonemes: 'Wstɾˈalja' },
];

const SCORES = [
  { voice: 'Heart', language: 'English', utmos: '4.38 / 4.52', nisqa: '4.93 / 5.00', wer: '2.7% / 3.0%' },
  { voice: 'Puck', language: 'English', utmos: '4.35 / 4.47', nisqa: '5.01 / 5.04', wer: '2.8% / 3.0%' },
  { voice: 'Isabella', language: 'English', utmos: '4.07 / 4.41', nisqa: '5.08 / 5.12', wer: '2.9% / 2.9%' },
  { voice: 'Fable', language: 'English', utmos: '4.17 / 4.32', nisqa: '4.96 / 5.00', wer: '2.7% / 3.0%' },
  { voice: 'Alpha', language: 'Hindi', utmos: '3.99 / 4.29', nisqa: '3.98 / 4.37', wer: '21.7% / 20.7%' },
  { voice: 'Omega', language: 'Hindi', utmos: '3.82 / 4.09', nisqa: '4.57 / 4.73', wer: '21.6% / 19.8%' },
  { voice: 'Siwis', language: 'French', utmos: '3.45 / 3.65', nisqa: '4.39 / 4.65', wer: '6.8% / 6.8%' },
  { voice: 'Alex', language: 'Spanish', utmos: '3.14 / 3.34', nisqa: '4.72 / 4.98', wer: '5.0% / 5.1%' },
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

export default function Paradee13Post() {
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
                width={1210}
                height={820}
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
              Two weeks ago I released <a href="/paradee-1-2">Paradee-8M-v1.2</a>, which gave my small
              voice model four of <a href="https://huggingface.co/hexgrad/Kokoro-82M">Kokoro-82M</a>&rsquo;s English
              voices. Today I&rsquo;m releasing <a href={HF}>Paradee-8M-v1.3</a>. It&rsquo;s one model with eight voices
              in four languages: English (American and British), Hindi, French and Spanish. The file is still 8.5 MB and
              it still runs about 62x faster than real time on one CPU thread.
            </p>
            <p>Here&rsquo;s a sentence about parakeets in each language.</p>
            {CLIPS.map((c) => (
              <div key={c.id} className="pd-lang-clip">
                <blockquote lang={c.lang}>{c.text}</blockquote>
                <AudioClip src={`${ASSETS}/audio/parakeets_${c.id}.mp3`} label={c.label} />
              </div>
            ))}

            <p>These are the eight voices.</p>
            <div className="pd-table-wrap">
              <table className="pd-table pd-table-text">
                <thead>
                  <tr>
                    <th scope="col">Language</th>
                    <th scope="col">Voices</th>
                  </tr>
                </thead>
                <tbody>
                  {VOICES.map((r) => (
                    <tr key={r.language}>
                      <th scope="row">{r.language}</th>
                      <td>{r.voices}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="pd-diagram"
              src={`${ASSETS}/img/multilingual_model_sizes.png`}
              width={1600}
              height={800}
              alt="Size of single TTS models that speak more than one language: Paradee 1.3 8M, M5-TTS 50M, Supertonic 2 66M, Kokoro 82M, Supertonic 3 about 99M, Phonon about 100M, Magpie Multilingual 357M"
            />
            <p>
              Paradee 1.3 is the smallest single TTS model that speaks more than one language. It&rsquo;s about 6x
              smaller than the next smallest, M5-TTS, which has 50M parameters.
            </p>

            <h2>How Paradee learned to speak new languages</h2>
            <p>
              Paradee learns to convert phonemes, symbols that stand for sounds, into audio. Some phonemes are reused
              across languages, while other phonemes are unique to one language. Kokoro uses a constant set of 114
              phonemes for every language it speaks. Since Paradee mirrors Kokoro&rsquo;s architecture, it also has
              support for the same 114 phonemes. Until now, though, only the phonemes for English sounds had been
              trained. So Paradee had to learn how to map unfamiliar phonemes from new languages to sounds.
            </p>
            <p>
              Each new voice also needed its own voice vector, a short list of numbers the model reads at every step. It
              sets the speaker&rsquo;s pitch and tone, and also their rhythm, intonation and the way they say each sound,
              which is a big part of an accent. The same phoneme sounds different from a Hindi speaker than from an
              American one. Each new voice started as a copy of Heart&rsquo;s vector and learned its own during training.
              The four new voice vectors add only 192 numbers, so the file stays the same size.
            </p>
            <p>
              Each language also needs its own phonemizer, a program that turns written text into phonemes. Kokoro turns
              English into phonemes with its own dictionary. For Hindi, French and Spanish it uses{' '}
              <a href="https://github.com/espeak-ng/espeak-ng">eSpeak</a>, a program that knows the pronunciation rules
              of many languages. Paradee does the same, and the voice you pick decides the language. Here is
              &ldquo;Australia&rdquo; in each one.
            </p>
            <div className="pd-table-wrap">
              <table className="pd-table pd-table-text">
                <thead>
                  <tr>
                    <th scope="col">Language</th>
                    <th scope="col">Word</th>
                    <th scope="col">Phonemes</th>
                  </tr>
                </thead>
                <tbody>
                  {PHONEMES.map((r) => (
                    <tr key={r.language}>
                      <th scope="row">{r.language}</th>
                      <td lang={r.lang}>{r.word}</td>
                      <td>{r.phonemes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              A and W are Kokoro&rsquo;s shorthand for the sounds in &ldquo;day&rdquo; and &ldquo;now&rdquo;. The Hindi
              word has a ʈ, a t made with the tongue curled back, which English doesn&rsquo;t have.
            </p>

            <h2>Scoring a multilingual model</h2>
            <div className="pd-table-wrap">
              <table className="pd-table pd-table-text pd-table-scores">
                <thead>
                  <tr>
                    <th scope="col">Voice</th>
                    <th scope="col">Language</th>
                    <th scope="col">UTMOS</th>
                    <th scope="col">NISQA</th>
                    <th scope="col">Word error rate</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORES.map((r) => (
                    <tr key={r.voice}>
                      <th scope="row">{r.voice}</th>
                      <td>{r.language}</td>
                      <td>{r.utmos}</td>
                      <td>{r.nisqa}</td>
                      <td>{r.wer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Each cell is Paradee, then Kokoro, on 200 held-out sentences per voice. UTMOS and NISQA predict how a
              listener would rate the audio from 1 to 5. Word error rate is the share of words that Whisper large-v3 gets
              wrong when it transcribes the audio in its own language.
            </p>
            <p>
              UTMOS and NISQA were trained mostly on English recordings, so for Hindi, French and Spanish their scores are
              not a great metric for voice naturalness. However, we can compare Paradee&rsquo;s scores to Kokoro&rsquo;s
              scores for an idea of how similar Paradee sounds to Kokoro. Hindi word error rates are high for both models
              because many Hindi words have more than one accepted spelling. The <a href={HF}>model card</a> also lists
              character error rates, which count single letters and don&rsquo;t have that problem.
            </p>

            <h2>One model or one per language</h2>
            <p>
              One question I wanted to explore in making Paradee multilingual is the following: Is there quality loss
              from squeezing so many voices and languages into a tiny model?
            </p>
            <p>
              In order to investigate that question, I trained multiple single-language Paradee models along with the
              shared multilingual model. I then compared the performance of the multilingual model against the
              language-specific models.
            </p>
            <p>
              The English voices score the same as in 1.2 (UTMOS within 0.03 for every voice), so adding the new
              languages didn&rsquo;t cost them any quality. French also came out the same as the French-only model. Hindi
              lost a little. The Hindi-only model sounded slightly cleaner (NISQA 0.15 to 0.2 higher) with the same error
              rate, though this difference is minimal. When listening to the models side-by-side, it was hard for me to
              notice any difference.
            </p>
            <p>
              Based on these results, it seems that there may be slight quality loss from having a single multilingual
              model compared to multiple single-language models at this size. However, this loss is minimal, not across
              all languages, and a human listener could not tell the difference.
            </p>

            <h2>What&rsquo;s Next?</h2>
            <p>
              Next I want to add support for more languages. Currently, Paradee can only learn a language from its
              teacher Kokoro. I want to explore if we can add more languages from Kokoro without losing quality, and
              whether it is possible to add new languages that are not supported by Kokoro. I also want to explore
              code-switching, where one sentence mixes two languages, like Hindi with English words in it. Right now each
              sentence is read in the language of the voice you pick.
            </p>

            <h2>Try it</h2>
            <p>
              Paradee-8M-v1.3 is the light voice in <a href={STORE}>Chickadee</a>, a Chrome extension that reads web pages
              aloud using local voice models. Version 1.5.0 lists the voices by language. Choose Paradee as the model and
              pick a voice.
            </p>
            <p>The Python package uses 1.3 by default, and 1.2 and 1.1 are still available.</p>
            <Snippet
              code={`pip install git+https://github.com/sahilmahendrakar/paradee\npython -m paradee "Paradee est une petite voix qui fonctionne partout." --voice ff_siwis -o bonjour.wav`}
            />

            <h2>Links</h2>
            <ul>
              <li>
                Model: <a href={HF}>Hugging Face</a>
              </li>
              <li>
                Code: <a href="https://github.com/sahilmahendrakar/paradee">GitHub</a>
              </li>
              <li>
                Chickadee: <a href={STORE}>Chrome Web Store</a>
              </li>
              <li>
                Paper (describes v1.0): <a href="https://arxiv.org/abs/2610.06817">arXiv</a>
              </li>
              <li>
                Earlier posts: <a href="/paradee-1-2">Paradee 1.2</a>,{' '}
                <a href="/paradee-1-1">Paradee 1.1</a>, <a href="/paradee">Paradee</a>
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
