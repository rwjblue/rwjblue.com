import MorseCW from "morse-pro/src/morse-pro-cw.js";

export function checkListeningSpeed(wpm: number, fwpm = wpm): void {
  if (!Number.isFinite(wpm) || wpm < 10 || wpm > 60
    || !Number.isFinite(fwpm) || fwpm < 5 || fwpm > wpm) {
    throw new RangeError("Use 10-60 character WPM and an effective speed from 5 WPM up to the character speed.");
  }
}

function encoder(wpm: number, fwpm = wpm): MorseCW {
  if (!Number.isFinite(wpm) || wpm <= 0 || !Number.isFinite(fwpm) || fwpm <= 0 || fwpm > wpm) {
    throw new RangeError("Sending speeds must be positive, with effective speed no higher than character speed.");
  }
  return new MorseCW({ wpm, fwpm, dictionaryOptions: ["prosigns"] });
}

/** Use upstream Farnsworth timing for both character and word spacing. */
export function morseWordGap(wpm: number, fwpm = wpm): number {
  return encoder(wpm, fwpm).wordSpace;
}

/** Generate the reference with the same upstream dictionary and timing model. */
export function sendingTextTimings(text: string, wpm: number, fwpm = wpm): number[] {
  const cw = encoder(wpm, fwpm);
  if (!text.trim()) return [];
  const tokens = cw.loadText(text);
  if (tokens === null || tokens.error) throw new Error("This prompt contains characters that cannot be sent as Morse.");
  return [...cw.getTimings(tokens)];
}
