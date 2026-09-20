import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DAILY_LISTENING_ID, DAILY_LISTENING_PATH, DAILY_LISTENING_TITLE } from "../../src/lib/cw-training/daily-listening.ts";

const quote = value => `'${value.replaceAll("'", "''")}'`;

/** Normalize MPEG-2.5/11-kHz input for reliable native end-of-file and repeat events. */
export async function prepareDailyListeningAudio(filename) {
  const directory = await mkdtemp(path.join(tmpdir(), "cw-daily-audio-"));
  try {
    const output = path.join(directory, "playback.mp3");
    execFileSync("ffmpeg", ["-v", "error", "-i", path.resolve(filename), "-map", "0:a:0", "-ar", "44100", "-ac", "1", "-b:a", "32k", output], { timeout: 20_000 });
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", output], { encoding: "utf8", timeout: 20_000 }));
    return { audio: await readFile(output), durationSeconds: Number(probe.format.duration) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Stage bounded chunks, then atomically replace the recording after every chunk arrived. */
export function dailyListeningSql(audio, resource, importId = randomUUID()) {
  if (!audio.length || audio.length > 500_000) throw new Error("Use an MP3 no larger than 500,000 bytes.");
  const encoded = audio.toString("base64");
  const parts = encoded.match(/.{1,32000}/g);
  const payload = JSON.stringify(resource);
  if (payload.length > 20_000) throw new Error("Recording metadata is too large.");
  return [
    `DELETE FROM training_audio_imports WHERE import_id = ${quote(importId)};`,
    ...parts.map((part, index) => `INSERT INTO training_audio_imports(import_id, part, content) VALUES (${quote(importId)}, ${index}, ${quote(part)});`),
    `INSERT INTO training_audio(id, payload, audio_base64)
SELECT ${quote(DAILY_LISTENING_ID)}, ${quote(payload)}, group_concat(content, '')
FROM (SELECT content FROM training_audio_imports WHERE import_id = ${quote(importId)} ORDER BY part)
HAVING count(*) = ${parts.length} AND length(group_concat(content, '')) = ${encoded.length}
ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, audio_base64 = excluded.audio_base64;`,
    `DELETE FROM training_audio_imports WHERE import_id = ${quote(importId)};`,
    "",
  ].join("\n");
}

async function main() {
  const [mp3Path, textPath, outputPath = ".tmp/cw-training-daily-listening.sql"] = process.argv.slice(2);
  if (!mp3Path || !textPath) throw new Error("Usage: import-daily-listening.mjs <mp3> <text> [SQL output inside .tmp/]");
  const output = path.resolve(outputPath);
  if (!output.startsWith(path.resolve(".tmp") + path.sep)) throw new Error("Private SQL must stay inside the ignored .tmp directory.");
  const original = await readFile(mp3Path);
  if (!original.length || original.length > 500_000) throw new Error("Use an MP3 no larger than 500,000 bytes.");
  const text = await readFile(textPath, "utf8");
  if (!text.trim() || text.length > 10_000 || text.includes("\0")) throw new Error("Use a nonempty text list under 10,000 characters.");
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name", "-of", "json", path.resolve(mp3Path)], { encoding: "utf8", timeout: 20_000 }));
  if (!probe.streams.some(stream => stream.codec_name === "mp3")) throw new Error("A valid MP3 is required.");
  const { audio, durationSeconds } = await prepareDailyListeningAudio(mp3Path);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("A valid MP3 with measured duration is required.");
  const resource = { id: DAILY_LISTENING_ID, title: DAILY_LISTENING_TITLE, url: DAILY_LISTENING_PATH, format: "audio", durationSeconds, text };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, dailyListeningSql(audio, resource), { mode: 0o600 });
  console.log(JSON.stringify({ output, bytes: audio.length, durationSeconds, originalSha256: createHash("sha256").update(original).digest("hex"), playbackSha256: createHash("sha256").update(audio).digest("hex"), entries: text.trim().split(/\s+/).length }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(error => { console.error(error.message); process.exitCode = 1; });
