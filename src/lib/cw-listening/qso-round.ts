import { createWordRound, type WordRound } from "./word-round.ts";
import { checkQsoSpeed, QSO_PITCHES, type PracticeQso } from "./qso-practice.ts";

export interface QsoLine {
  station: string;
  pitch: number;
  start: number;
  end: number;
  firstWord: number;
  wordCount: number;
}
export interface QsoRound extends WordRound { lines: QsoLine[]; wordEnds: number[] }

/** Use the word player's Morse timing and PCM renderer for one seekable QSO. */
export function createQsoRound(qso: PracticeQso, wpm: number): QsoRound {
  checkQsoSpeed(wpm);
  const settings = { wpm, pitch: QSO_PITCHES[0], gapSeconds: 0, shuffle: false, repeat: false };
  const round: QsoRound = { words: [], starts: [], timingStarts: [], timings: [], pitches: [], speech: [], settings, duration: 0, lines: [], wordEnds: [] };
  for (const [index, text] of qso.lines.entries()) {
    const part = createWordRound(text, settings);
    const pitch = QSO_PITCHES[qso.kind === "story" ? 0 : index % 2];
    const wordGap = 8.4 / wpm;
    const lineEnd = round.duration + part.duration - wordGap;
    round.lines.push({ station: qso.stations[index % 2], pitch, start: round.duration, end: lineEnd, firstWord: round.words.length, wordCount: part.words.length });
    round.starts.push(...part.starts.map(start => round.duration + start));
    round.wordEnds.push(...part.starts.map((_, i) => round.duration + (part.starts[i + 1] ?? part.duration) - wordGap));
    round.timingStarts.push(...part.timingStarts.map(start => round.timings.length + start));
    round.words.push(...part.words);
    // Replace the final word gap with a two-second line pause; no trailing handoff.
    part.timings[part.timings.length - 1] = index < qso.lines.length - 1 ? -2000 : 0;
    round.timings.push(...part.timings);
    round.pitches!.push(...part.timings.map(() => pitch));
    round.duration = lineEnd + (index < qso.lines.length - 1 ? 2 : 0);
  }
  if (!round.lines.length || round.duration > 1200) throw new Error("Choose a selection shorter than 20 minutes.");
  return round;
}

/** The media clock drives both line changes and word highlights, including seeks. */
export function qsoPosition(round: QsoRound, seconds: number): { line: number; word: number } {
  const at = Math.max(0, seconds);
  let line = round.lines.filter(line => line.start <= at).length - 1;
  if (line < 0) line = 0;
  const word = round.starts.filter(start => start <= at).length - 1;
  return { line, word: word >= 0 && at < round.wordEnds[word] ? word : -1 };
}
