// Stands in for the phonemizer package (eSpeak NG), which the extension doesn't ship. See build.mjs.
export async function phonemize() {
  throw new Error('eSpeak is not part of this build; phonemes come from misaki-en.js and paradee-g2p.js');
}
