import { AudioClip } from './components/AudioClip';
import { KokoroWalkthrough } from './components/KokoroWalkthrough';
import { DecoderStory } from './components/DecoderStory';
import { Comparison, DistillationDiagram, Snippet } from './components/Figures';
import { ReadingProgress } from './components/ReadingProgress';
import './paradee.css';

// From PARADEE_POST in sahilmahendrakar.com's lib/native-posts.ts.
const post = {
  id: 'paradee',
  title: 'Paradee: Distilling a voice model to one-tenth its size',
  subtitle: 'What I learned shrinking Kokoro-82M into an 8M-parameter voice model that runs on a CPU.',
  date: '2026-10-05',
  readingMinutes: 8,
};
const DATE_LABEL = 'October 5, 2026';

const ASSETS = '/paradee';
// The post's home is on Sahil's site; this page is a copy of it.
const URL = 'https://sahilmahendrakar.com/thoughts/paradee';
const source = 'https://github.com/sahilmahendrakar/chickadee';

// The paper PDF on GitHub until the arXiv page is out.
const ARXIV_URL = 'https://github.com/sahilmahendrakar/paradee/blob/main/paper/Paradee-Mahendrakar-2026.pdf';
const PAPER_TITLE = 'Paradee: Distilling Kokoro-82M into an 8M-Parameter Single-Voice Text-to-Speech Model';

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
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Chickadee — a watercolour chickadee on a twig. Any page, read aloud, locally.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: post.title,
    description: post.subtitle,
  },
};

export default function ParadeePost() {
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
      </header>

      <main>
        <article className="pd-article">
          <div className="pd-col">
            <header className="pd-header">
              <h1 className="pd-title">{post.title}</h1>
              <p className="pd-subtitle">{post.subtitle}</p>
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
              A couple of weeks ago I released <a href="https://www.usechickadee.com">Chickadee</a>, an open-source Chrome
              extension that reads web pages aloud. It runs entirely on your own computer and it&rsquo;s completely free.
              I built it because I wanted a quick and easy way to have the browser read to me that&rsquo;s free and that I
              could trust wouldn&rsquo;t share my data.
            </p>
            <p>
              The voice model I used for Chickadee is{' '}
              <a href="https://huggingface.co/hexgrad/Kokoro-82M">Kokoro-82M</a>, an open text-to-speech model. The first
              time I heard it, I was almost taken aback at how natural a model under 100 million parameters could sound.
              Here it is reading a sentence out loud from the Wikipedia page for chickadees:
            </p>
            <blockquote>
              Mountain chickadees can hide as many as 80,000 individual seeds each, which they retrieve during the winter.
            </blockquote>
            <AudioClip src={`${ASSETS}/audio/chickadee_kokoro.mp3`} label="Kokoro" note="82M" />
            <p>
              But running Kokoro inside a browser is still very resource intensive. The model download takes up 310 MB,
              and it needs WebGPU, which many laptops don&rsquo;t support well. Even on machines that it can run on, it
              consumes a lot of resources.
            </p>
            <p>
              Around the same time as I was releasing Chickadee, I was beginning to grow interested in{' '}
              <a href="https://arxiv.org/abs/1503.02531">model distillation</a>, a technique that trains a smaller student
              model to approximate a larger teacher model&rsquo;s performance. I wanted to see if I could distill Kokoro
              into a smaller model that I could ship with Chickadee and that could easily run on any device. Another
              insight I had is that while Kokoro is able to produce audio for many voices, I could limit the smaller model
              to just one voice to further save on size. In a way, this is an example of domain-specific distillation.
            </p>
            <p>
              The result is Paradee, an 8M parameter voice model distilled from Kokoro that sounds like Kokoro&rsquo;s{' '}
              <code>af_heart</code> voice at about a tenth of the size. Here are both of them reading a line from
              Wikipedia&rsquo;s page on black-capped chickadees.
            </p>
            <blockquote>Males and females are generally similar, although males have a larger bib.</blockquote>
            <div className="pd-clips">
              <AudioClip src={`${ASSETS}/audio/bib_kokoro.mp3`} label="Kokoro" note="82M" />
              <AudioClip src={`${ASSETS}/audio/bib_paradee.mp3`} label="Paradee" note="8M" />
            </div>
            <p>
              As you can hear, they&rsquo;re not identical. If you put them side by side, Kokoro is still a little
              cleaner. On its own though, Paradee is easy to listen to and very natural sounding for a model its size.
            </p>
            <p>Here is a quick comparison of Kokoro and Paradee:</p>
            <Comparison />
            <p>
              These are measured on 200 held-out sentences. The naturalness score comes from{' '}
              <a href="https://arxiv.org/abs/2204.02152">UTMOS</a>, a model trained on human ratings that predicts how
              natural a clip sounds. &ldquo;Words misheard&rdquo; is how many words{' '}
              <a href="https://github.com/openai/whisper">Whisper</a>, a speech recognition model, gets wrong when it
              transcribes the audio.
            </p>
  
            <h2>A brief background on how Kokoro works</h2>
            <p>
              Kokoro can largely be split into two halves, a text side and an acoustic side (or decoder). I take advantage
              of this two component architecture when distilling the student model, but more on that later.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="pd-diagram"
              src={`${ASSETS}/img/kokoro_arch.png`}
              width={2660}
              height={1060}
              alt="Kokoro's architecture. Text becomes phonemes, the text side produces timing, pitch, loudness and feature encodings, and the decoder turns those and a helper tone into audio."
            />
            <p>
              Here is an overview of how Kokoro turns text into speech. First, a library called{' '}
              <a href="https://github.com/hexgrad/misaki">misaki</a> turns the text into phonemes, the individual sounds
              of speech. &ldquo;Males&rdquo; becomes something like &ldquo;mˈAlz&rdquo;. Misaki mostly looks words up in a
              pronunciation dictionary. It isn&rsquo;t part of Kokoro&rsquo;s 82M parameters, and Paradee uses it
              unchanged. From then on, Kokoro only works with phonemes.
            </p>
            <p>
              The text side (28M parameters) reads the phonemes and works out how to say them. It decides how long to hold
              each sound, how the pitch should rise and fall, and how loud each sound should be. It also produces a
              512-dimensional feature encoding for each phoneme.
            </p>
            <p>
              The decoder (53M parameters) turns the timing, pitch, loudness and feature encodings into audio, in two
              stages. First, each phoneme&rsquo;s features are stretched to its predicted length, and the decoder blocks
              combine them with the pitch, loudness and voice into one representation per frame. Then the waveform
              generator upsamples those frames into 24,000 samples of audio per second. To make voiced sounds easier,
              Kokoro also precomputes a helper tone from the predicted pitch, using a fixed formula rather than anything
              learned. The waveform generator uses this tone as an extra input alongside the frames. The waveform
              generator is a convolutional network that gradually upsamples the frames and predicts a spectrogram. For
              every frequency at every moment, the spectrogram holds two values: the magnitude is how loud that frequency
              is, and the phase is where its wave is in its cycle. A fixed inverse Fourier transform then turns that
              spectrogram into the sound wave.
            </p>
            <p>Here&rsquo;s Kokoro going through each step for the chickadee sentence. Scroll to follow it through.</p>
          </div>
  
          <KokoroWalkthrough />
  
          <div className="pd-col post-body">
            <h2>How I distilled Kokoro into Paradee</h2>
            <p>
              Paradee is the same design as Kokoro, but with every layer made much smaller. I trained it using
              distillation. That is, I trained a small student model to reproduce the outputs of a larger teacher model.
              Kokoro&rsquo;s two halves made it possible to do this more efficiently, since I was able to distill each
              half separately.
            </p>
            <DistillationDiagram />
            <p>
              The student&rsquo;s text side has the same three components as Kokoro&rsquo;s, but each layer is about a
              third as wide, which brings it down to 4.2M parameters. Similarly, the student decoder is about a quarter as
              wide, at 3.9M parameters. Since Paradee only needs to produce one voice, I also removed the voice input and
              replaced it with a single learned vector.
            </p>
            <p>
              To build the training data, I had Kokoro read 12,000 sentences, about 24 hours of audio. For every sentence,
              I saved the phonemes, everything Kokoro&rsquo;s text side produced (the length of each phoneme, the pitch
              and loudness curves, and the feature encodings), and the final audio.
            </p>
            <p>
              Each half of the student was distilled in isolation. The student text side takes the phonemes as input and
              tries to predict the text side output (length, pitch, loudness, and feature encodings). Training it is
              straightforward, since I can compare each prediction directly against Kokoro&rsquo;s saved values.
              Similarly, the student decoder is given Kokoro&rsquo;s own lengths, pitch, loudness and feature encodings as
              input, and it has to produce Kokoro&rsquo;s audio from them. Once both halves were trained, I connected
              them, with the student text side feeding the student decoder, and they worked together without any extra
              training.
            </p>
            <p>
              All the training was done on my MacBook Pro over about 30 hours of compute. For comparison, Kokoro&rsquo;s
              authors trained it with about 1,000 GPU-hours on A100s.
            </p>
  
            <h2>Distilling the decoder, and getting it to sound right</h2>
            <p>Shrinking the text side was relatively straightforward. The decoder was much more troublesome.</p>
          </div>
  
          <DecoderStory />
  
          <div className="pd-col post-body">
            <p>
              Paradee has 8M parameters, fits in a 9 MB file, and runs about 18 times faster than real time on a single
              CPU core. It scores 4.41 on UTMOS against Kokoro&rsquo;s 4.52. There&rsquo;s still a slight buzz on some
              stressed syllables if you listen for it, so there is certainly still room for improvement. But for a model a
              tenth of the size, it sounds quite natural compared to alternatives.
            </p>
  
            <h2>Paradee in Chickadee</h2>
            <p>
              The next version of Chickadee has a new option called &ldquo;Paradee — light.&rdquo; Paradee comes
              built into the extension, so there&rsquo;s nothing to download, and it works on computers where Kokoro
              can&rsquo;t run.
            </p>
  
            <h2>Try it</h2>
            <p>
              Install{' '}
              <a href="https://chromewebstore.google.com/detail/chickadee/nbghebngnkkjcgpcmhchpijmcdkclndm">Chickadee</a>,
              choose Paradee as the voice model, and have it read out a web page.
            </p>
            <p>Alternatively, you can try it directly through Python:</p>
            <Snippet
              code={`pip install git+https://github.com/sahilmahendrakar/paradee\npython -m paradee "Paradee is a small voice that runs anywhere." -o hello.wav`}
            />
            <p>
              The code, including everything I used to train it, is on{' '}
              <a href="https://github.com/sahilmahendrakar/paradee">GitHub</a>, and the model and more samples are on{' '}
              <a href="https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.0">Hugging Face</a>. It&rsquo;s open source
              under Apache 2.0, the same license as Kokoro.
            </p>
            <p>
              <em>
                A complete technical write up can be found in{' '}
                {ARXIV_URL ? <a href={ARXIV_URL}>{PAPER_TITLE}</a> : PAPER_TITLE}.
              </em>
            </p>
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
