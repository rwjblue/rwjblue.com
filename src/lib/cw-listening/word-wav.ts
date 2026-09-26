/** The published speech clips and generated rounds share one simple PCM format. */
export const WORD_SAMPLE_RATE = 22050;

export function encodeWordWav(samples: Float32Array): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, WORD_SAMPLE_RATE, true);
  view.setUint32(28, WORD_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return new Blob([bytes], { type: "audio/wav" });
}

/** Decode without starting Web Audio, including WAVs with extra metadata chunks. */
export function decodeWordWav(bytes: ArrayBuffer): Float32Array {
  const view = new DataView(bytes);
  const text = (at: number, length: number) => String.fromCharCode(...new Uint8Array(bytes, at, length));
  const invalid = () => new Error("Speech clip must be a 22050 Hz mono 16-bit PCM WAV.");
  if (bytes.byteLength < 44 || text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE" || view.getUint32(4, true) + 8 !== bytes.byteLength) throw invalid();
  let validFormat = false;
  let data: { start: number; size: number } | undefined;
  for (let at = 12; at + 8 <= bytes.byteLength;) {
    const size = view.getUint32(at + 4, true);
    const start = at + 8;
    if (start + size > bytes.byteLength) throw invalid();
    if (text(at, 4) === "fmt ") {
      validFormat = size >= 16 && view.getUint16(start, true) === 1 && view.getUint16(start + 2, true) === 1
        && view.getUint32(start + 4, true) === WORD_SAMPLE_RATE && view.getUint16(start + 12, true) === 2 && view.getUint16(start + 14, true) === 16;
    }
    if (text(at, 4) === "data") data = { start, size };
    at = start + size + size % 2;
  }
  if (!validFormat || !data || !data.size || data.size % 2 || data.size > WORD_SAMPLE_RATE * 2 * 10) throw invalid();
  const samples = new Float32Array(data.size / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(data.start + i * 2, true) / 32768;
  return samples;
}
