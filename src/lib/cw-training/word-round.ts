import { sendingTextTimings } from "./sending-engine.ts";
import { checkWordSettings, parsePracticeWords, type WordSettings } from "./word-practice.ts";

export interface WordRound {
  words: string[];
  timings: number[];
  starts: number[];
  timingStarts: number[];
  settings: WordSettings;
  duration: number;
}

export function createWordRound(text: string, settings: WordSettings, random = Math.random): WordRound {
  checkWordSettings(settings);
  const words = parsePracticeWords(text);
  if (settings.shuffle) for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  const timings: number[] = [];
  const starts: number[] = [];
  const timingStarts: number[] = [];
  let duration = 0;
  for (const word of words) {
    starts.push(duration);
    timingStarts.push(timings.length);
    const part = sendingTextTimings(word, settings.wpm);
    part.push(-(8400 / settings.wpm + settings.gapSeconds * 1000));
    timings.push(...part);
    duration += part.reduce((sum, ms) => sum + Math.abs(ms), 0) / 1000;
  }
  if (duration > 600) throw new Error("This round exceeds 10 minutes. Use fewer words, a shorter pause, or a faster speed.");
  return { words, timings, starts, timingStarts, settings: { ...settings }, duration };
}

/** Keep the heard prefix and shuffled order; only unsent words change speed. */
export function retimeWordRound(round: WordRound, wpm: number, firstWord: number): WordRound {
  if (firstWord >= round.words.length) return round;
  const settings = { ...round.settings, wpm };
  const tail = createWordRound(round.words.slice(firstWord).join(" "), { ...settings, shuffle: false });
  const boundary = round.starts[firstWord];
  const timingBoundary = round.timingStarts[firstWord];
  const duration = boundary + tail.duration;
  if (duration > 600) throw new Error("This round would exceed 10 minutes. Use a faster speed or start a shorter list.");
  return {
    words: [...round.words], settings, duration,
    timings: [...round.timings.slice(0, timingBoundary), ...tail.timings],
    starts: [...round.starts.slice(0, firstWord), ...tail.starts.map(start => boundary + start)],
    timingStarts: [...round.timingStarts.slice(0, firstWord), ...tail.timingStarts.map(start => timingBoundary + start)],
  };
}

/** One complete round is scheduled as a buffer, independent of JS timer cadence. */
export function renderWordSamples(round: WordRound, pitch: number, sampleRate = 22050): Float32Array {
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
  return samples;
}
