import MorseCW from "morse-pro/src/morse-pro-cw.js";

/** Generate the reference with the same upstream dictionary and timing model. */
export function sendingTextTimings(text: string, wpm: number): number[] {
  if (!Number.isFinite(wpm) || wpm <= 0) throw new RangeError("Sending speed must be a positive number.");
  const speed = wpm;
  if (!text.trim()) return [];
  const cw = new MorseCW({ wpm: speed, fwpm: speed, dictionaryOptions: ["prosigns"] });
  const tokens = cw.loadText(text);
  if (tokens === null || tokens.error) throw new Error("This prompt contains characters that cannot be sent as Morse.");
  return [...cw.getTimings(tokens)];
}
