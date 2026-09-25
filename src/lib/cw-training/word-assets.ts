import { parsePracticeWords, type WordSettings } from "./word-practice.ts";
import type { WordRound, WordSpeechClips } from "./word-round.ts";
import { decodeWordWav } from "./word-wav.ts";

interface Clip { url: string; sha256: string }
interface Recording extends Clip { wordsHash: string; settings: WordSettings; starts: number[]; duration: number }
let speechIndex: Promise<{ clips: Record<string, Clip> }> | undefined;
let recordingIndex: Promise<{ recordings: Recording[] }> | undefined;
const samples = new Map<string, Promise<Float32Array>>();

async function fetchAsset(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Audio could not be loaded. Check your connection and press Play to retry.");
  return response;
}

export async function loadWordSpeech(text: string): Promise<WordSpeechClips> {
  speechIndex ??= fetchAsset("/audio/cw-training/words/index.json").then(r => r.json()).catch(error => { speechIndex = undefined; throw error; });
  const { clips } = await speechIndex;
  const words = [...new Set(parsePracticeWords(text))];
  const missing = words.filter(word => !clips[word]);
  if (missing.length) throw new Error(`No spoken clips for ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""}. Choose compact mode or add these words to the pronunciation manifest.`);
  const result = new Map<string, Float32Array>();
  // Bound simultaneous requests and retain decoded clips across shuffled rounds.
  for (let at = 0; at < words.length; at += 4) await Promise.all(words.slice(at, at + 4).map(async word => {
    const clip = clips[word];
    const url = `${clip.url}?v=${clip.sha256}`;
    if (!samples.has(url)) samples.set(url, fetchAsset(url).then(r => r.arrayBuffer()).then(decodeWordWav).catch(error => { samples.delete(url); throw error; }));
    result.set(word, await samples.get(url)!);
  }));
  return result;
}

export async function loadWordRecording(text: string, settings: WordSettings): Promise<WordRound | undefined> {
  // A fixed recording can never supply a fresh shuffle. Repeat is a transport
  // preference, so it does not affect the sound of an individual round.
  if (settings.shuffle) return;
  const words = parsePracticeWords(text);
  // This index is an optimization. Its absence must not block generated audio.
  const { recordings }: { recordings: Recording[] } = await (recordingIndex ??= fetchAsset("/audio/cw-training/recordings/index.json")
    .then(r => r.json()).catch(() => { recordingIndex = undefined; return { recordings: [] }; }));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(words.join(" ")));
  const wordsHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const recording = recordings.find(item => item.wordsHash === wordsHash
    && item.settings.wpm === settings.wpm && item.settings.pitch === settings.pitch
    && item.settings.gapSeconds === settings.gapSeconds && !item.settings.shuffle
    && !!item.settings.spokenAnswers === !!settings.spokenAnswers);
  if (!recording || recording.starts.length !== words.length) return;
  return {
    words, starts: recording.starts, duration: recording.duration, settings: { ...settings },
    recordingUrl: `${recording.url}?v=${recording.sha256}`, timings: [], timingStarts: [], speech: [],
  };
}
