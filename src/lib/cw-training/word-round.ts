import { encodeWordWav, WORD_SAMPLE_RATE } from "./word-wav.ts";
import { sendingTextTimings } from "./sending-engine.ts";
import { checkWordSettings, parsePracticeWords, type WordSettings } from "./word-practice.ts";

export type WordSpeechClips = ReadonlyMap<string, Float32Array>;

export interface WordRound {
  words: string[];
  timings: number[];
  starts: number[];
  timingStarts: number[];
  settings: WordSettings;
  duration: number;
  speech: { at: number; wordIndex: number; samples: Float32Array }[];
  speechClips?: WordSpeechClips;
  recordingUrl?: string;
}

export function createWordRound(text: string, settings: WordSettings, random = Math.random, speechClips?: WordSpeechClips): WordRound {
  checkWordSettings(settings);
  const words = parsePracticeWords(text);
  if (settings.shuffle) for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  const timings: number[] = [];
  const starts: number[] = [];
  const timingStarts: number[] = [];
  const speech: WordRound["speech"] = [];
  let duration = 0;
  for (const word of words) {
    starts.push(duration);
    timingStarts.push(timings.length);
    const part = sendingTextTimings(word, settings.wpm);
    const gap = 8400 / settings.wpm;
    const repeats = settings.spokenAnswers ? 3 : 1;
    for (let repeat = 0; repeat < repeats; repeat++) {
      timings.push(...part, -gap);
      duration += (part.reduce((sum, ms) => sum + Math.abs(ms), 0) + gap) / 1000;
    }
    if (settings.spokenAnswers) {
      const samples = speechClips?.get(word);
      if (!samples?.length) throw new Error(`No spoken clip for ${word}. Choose compact playback or add its pronunciation and audio clip.`);
      speech.push({ at: duration, wordIndex: starts.length - 1, samples });
      const speechSeconds = samples.length / WORD_SAMPLE_RATE;
      timings.push(-speechSeconds * 1000, -gap);
      duration += speechSeconds + gap / 1000;
    }
    // Extra spacing belongs between items, never between the three repeats.
    if (settings.gapSeconds) {
      timings[timings.length - 1] -= settings.gapSeconds * 1000;
      duration += settings.gapSeconds;
    }
  }
  if (duration > 600) throw new Error("This round exceeds 10 minutes. Use fewer words, a shorter pause, or a faster speed.");
  return { words, timings, starts, timingStarts, settings: { ...settings }, duration, speech, speechClips };
}

/** Keep the heard prefix and shuffled order; only unsent words change speed. */
export function retimeWordRound(round: WordRound, wpm: number, firstWord: number): WordRound {
  if (firstWord >= round.words.length) return round;
  const settings = { ...round.settings, wpm };
  const tail = createWordRound(round.words.slice(firstWord).join(" "), { ...settings, shuffle: false }, Math.random, round.speechClips);
  const boundary = round.starts[firstWord];
  const timingBoundary = round.timingStarts[firstWord];
  const duration = boundary + tail.duration;
  if (duration > 600) throw new Error("This round would exceed 10 minutes. Use a faster speed or start a shorter list.");
  return {
    words: [...round.words], settings, duration, speechClips: round.speechClips,
    speech: [...round.speech.filter(item => item.wordIndex < firstWord), ...tail.speech.map(item => ({ ...item, at: boundary + item.at, wordIndex: firstWord + item.wordIndex }))],
    timings: [...round.timings.slice(0, timingBoundary), ...tail.timings],
    starts: [...round.starts.slice(0, firstWord), ...tail.starts.map(start => boundary + start)],
    timingStarts: [...round.timingStarts.slice(0, firstWord), ...tail.timingStarts.map(start => timingBoundary + start)],
  };
}

/** Render a complete round so dits and dahs do not depend on JS timer cadence. */
export function renderWordSamples(round: WordRound, pitch: number, sampleRate = WORD_SAMPLE_RATE): Float32Array {
  const samples = new Float32Array(Math.ceil(round.duration * sampleRate));
  let elapsed = 0;
  for (const ms of round.timings) {
    const start = Math.round(elapsed * sampleRate);
    elapsed += Math.abs(ms) / 1000;
    const end = Math.min(samples.length, Math.round(elapsed * sampleRate));
    if (ms <= 0) continue;
    const ramp = Math.min(Math.round(sampleRate * 0.005), Math.floor((end - start) / 2));
    for (let i = start; i < end; i++) {
      const edge = Math.min(1, (i - start) / ramp, (end - 1 - i) / ramp);
      const envelope = (1 - Math.cos(Math.PI * edge)) / 2;
      samples[i] = 0.65 * envelope * Math.sin(2 * Math.PI * pitch * (i - start) / sampleRate);
    }
  }
  for (const item of round.speech) {
    if (sampleRate !== WORD_SAMPLE_RATE) throw new Error("Speech requires the standard sample rate.");
    samples.set(item.samples, Math.round(item.at * sampleRate));
  }
  return samples;
}

/** A local, seekable recording lets native media controls resume without Web Audio. */
export function renderWordWav(round: WordRound, pitch: number, volume = 1): Blob {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error("Use a volume between 0 and 1.");
  const samples = renderWordSamples(round, pitch);
  if (volume !== 1) for (let i = 0; i < samples.length; i++) samples[i] *= volume;
  return encodeWordWav(samples);
}
