'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioClip } from './AudioClip';
import { currentTime, nearestStep, toggle, useFrame, usePlayer } from './player';

const ASSETS = '/paradee';

const STAGES = [
  {
    tab: 'Kokoro',
    title: 'Kokoro, the teacher',
    src: `${ASSETS}/audio/bib_kokoro.mp3`,
    img: `${ASSETS}/img/spec_bib_kokoro.webp`,
  },
  {
    tab: 'First decoder',
    title: 'Paradee, first decoder',
    src: `${ASSETS}/audio/bib_1_robotic.mp3`,
    img: `${ASSETS}/img/spec_bib_1_robotic.webp`,
  },
  {
    tab: 'Discriminator',
    title: 'Paradee, discriminator added',
    src: `${ASSETS}/audio/bib_2_buzz.mp3`,
    img: `${ASSETS}/img/spec_bib_2_buzz.webp`,
  },
  {
    tab: 'Phase filter',
    title: 'Paradee, with the phase filter',
    src: `${ASSETS}/audio/bib_3_final.mp3`,
    img: `${ASSETS}/img/spec_bib_3_final.webp`,
  },
];

const SECONDS = 4.9;
// The close-up covers the start of the sentence, "Males and females are".
const ZOOM = { from: 0.3, to: 1.5 };
const zoomImg = (img) => img.replace('/spec_', '/zoom_');

// Which stage's spectrogram each step of the story shows.
const STEP_STAGE = [0, 1, 2, 2, 3];
// Steps that compare fine detail open on the close-up.
const STEP_ZOOM = [false, true, true, false, true];

function Step({ index, active, kicker, title, children }) {
  return (
    <div className={`pd-step${active ? ' pd-active' : ''}`} data-step={index} data-part="dec">
      <div className="pd-kicker">{kicker}</div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/**
 * The decoder section, in the same form as the Kokoro walkthrough. The story
 * scrolls on the left while a spectrogram stays pinned beside it and follows
 * the stage being described.
 */
export function DecoderStory() {
  const root = useRef(null);
  const head = useRef(null);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(null);
  const [zoomPick, setZoomPick] = useState(null);
  const player = usePlayer();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mobile = window.matchMedia('(max-width: 860px)');
    const pick = () => setStep(nearestStep(el, mobile.matches ? 0.72 : 0.5));
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    pick();
    return () => {
      window.removeEventListener('scroll', pick);
      window.removeEventListener('resize', pick);
    };
  }, []);

  // A manual choice holds until the reader scrolls on to the next step.
  useEffect(() => {
    setPicked(null);
    setZoomPick(null);
  }, [step]);

  // Whichever stage is playing wins, so the picture always matches the sound.
  const live = player.playing ? STAGES.findIndex((s) => s.src === player.src) : -1;
  const shown = live >= 0 ? live : picked ?? STEP_STAGE[step];
  const stage = STAGES[shown];
  const zoom = zoomPick ?? STEP_ZOOM[step];
  const from = zoom ? ZOOM.from : 0;
  const to = zoom ? ZOOM.to : SECONDS;
  const ticks = zoom ? [0.4, 0.6, 0.8, 1.0, 1.2, 1.4] : [0, 1, 2, 3, 4];

  useFrame(live >= 0, (on) => {
    if (!head.current) return;
    const t = currentTime();
    head.current.style.opacity = on && t >= from && t <= to ? '1' : '0';
    if (on) head.current.style.left = `${((t - from) / (to - from)) * 100}%`;
  });

  return (
    <section className="pd-band" aria-label="How the student decoder's audio improved">
      <div className="pd-scrolly" ref={root}>
        <div className="pd-steps pd-steps-long">
          <Step index={0} active={step === 0} kicker="Step 1" title="Kokoro’s spectrogram">
            <p>
              The first student decoder learned only by comparing its audio&rsquo;s spectrogram with Kokoro&rsquo;s. A
              spectrogram is a picture of sound. Time goes left to right, frequency goes up, and brighter means louder.
              Here&rsquo;s Kokoro saying the sentence.
            </p>
            <AudioClip src={STAGES[0].src} label="Kokoro" note="82M" />
            <p>
              The thin bright stripes at the bottom are the harmonics of her voice. The dashed line at 2 kHz matters
              here. Below it, the decoder has the helper tone to work from. Above it, the decoder has to make the sound
              completely on its own.
            </p>
          </Step>

          <Step index={1} active={step === 1} kicker="Step 2" title="The first student decoder">
            <p>
              My first student decoder was not great. It sounded like the right voice with a creepy robot talking at
              the same time.
            </p>
            <AudioClip src={STAGES[1].src} label="First student decoder" />
            <p>
              Here&rsquo;s the spectrogram that first student decoder produced. Below the 2 kHz line it looks a lot
              like Kokoro. But above the line, if you look closely, it&rsquo;s smooth and blurry where Kokoro&rsquo;s
              is discrete and detailed.
            </p>
          </Step>

          <Step index={2} active={step === 2} kicker="Step 3" title="Adding a discriminator">
            <p>
              I then tried adversarial training. A second small network, the discriminator, tries to tell
              Paradee&rsquo;s audio apart from Kokoro&rsquo;s, and the decoder learns to fool it. With it, the UTMOS
              score went from 3.0 to 4.4. Even after that, though, there was still a slight buzz.
            </p>
            <AudioClip src={STAGES[2].src} label="With the discriminator" />
            <p>You can see that above 2 kHz, the spectrogram looks a bit less blurry than before.</p>
          </Step>

          <Step index={3} active={step === 3} kicker="Step 4" title="Finding where the buzz comes from">
            <p>
              At this point, I was beginning to get stuck trying to train the model more. Instead, I decided to isolate
              where the buzz was coming from. I created an audio sample that had the student&rsquo;s magnitudes (how
              loud each frequency is) but the teacher&rsquo;s phase. That got rid of the buzz, which means the student
              audio&rsquo;s phase was the issue.
            </p>
            <p>
              I then applied the teacher&rsquo;s phase to different frequency bands, and found that fixing the phase
              between 2 and 8 kHz alone was enough to remove the buzz. That&rsquo;s right above where the helper tone
              stops.
            </p>
          </Step>

          <Step index={4} active={step === 4} kicker="Step 5" title="Adding a phase filter">
            <p>
              Instead of continuing to try to train the buzz away, I decided to use a phase filter, which corrects the
              phase in that range after the audio is generated, using the helper tone as a reference. It compares the
              phase of the generated audio with the helper tone, smooths out the differences, and rebuilds the audio
              with the corrected phase. That managed to remove most of the buzz.
            </p>
            <AudioClip src={STAGES[3].src} label="Paradee" note="8M" />
            <p>
              The whole progression is in the panel, from the first small decoder to the final Paradee. Flip through
              the stages and watch the lines above the helper tone line go from blurry to more defined as the buzz is
              progressively removed.
            </p>
          </Step>
        </div>

        <div className="pd-stage-wrap">
          <div className="pd-stage">
            <div className="pd-pipe" role="group" aria-label="Decoder stage">
              {STAGES.map((s, i) => (
                <div key={s.tab} className="pd-contents">
                  {i > 0 && <span className="pd-arrow">→</span>}
                  <button
                    type="button"
                    aria-pressed={i === shown}
                    className={`pd-node${i === shown ? (i === 0 ? ' pd-on-in' : ' pd-on-dec') : ''}`}
                    onClick={() => setPicked(i)}
                  >
                    <b>{s.tab}</b>
                  </button>
                </div>
              ))}
            </div>

            <div className="pd-spec">
              <div className="pd-spec-title">
                {stage.title}
                {zoom && <span> · close-up of “Males and females are”</span>}
              </div>
              <div className="pd-spec-y" aria-hidden="true">
                {[8, 6, 4, 2, 0].map((k) => (
                  <span key={k} style={{ top: `${(1 - k / 8) * 100}%` }}>
                    {k} kHz
                  </span>
                ))}
              </div>
              <div className="pd-spec-frame">
                {STAGES.map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={s.img}
                    src={s.img}
                    alt={i === shown && !zoom ? `Spectrogram of ${s.title}` : ''}
                    className={i === shown && !zoom ? 'pd-show' : ''}
                  />
                ))}
                {STAGES.map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={zoomImg(s.img)}
                    src={zoomImg(s.img)}
                    alt={i === shown && zoom ? `Close-up of the spectrogram of ${s.title}` : ''}
                    className={i === shown && zoom ? 'pd-show' : ''}
                  />
                ))}
                <div className={`pd-spec-band${step === 3 && live < 0 && picked === null && !zoom ? ' pd-show' : ''}`}>
                  <span>With Kokoro&rsquo;s phase in this band, 2 to 8 kHz, the buzz goes away</span>
                </div>
                <div className="pd-spec-line">
                  <span>helper tone stops here</span>
                </div>
                <div className="pd-spec-head" ref={head} />
              </div>
              <div className="pd-spec-x" aria-hidden="true">
                {ticks.map((s) => (
                  <span key={s} style={{ left: `${((s - from) / (to - from)) * 100}%` }}>
                    {s} s
                  </span>
                ))}
              </div>
            </div>

            <div className="pd-controls">
              <button type="button" className="pd-pill" onClick={() => toggle(stage.src)}>
                {live === shown ? 'Stop' : '▶ Play'}
              </button>
              <div className="pd-zoom" role="group" aria-label="How much of the sentence to show">
                <button type="button" aria-pressed={!zoom} onClick={() => setZoomPick(false)}>
                  Whole sentence
                </button>
                <button type="button" aria-pressed={zoom} onClick={() => setZoomPick(true)}>
                  Close-up
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
