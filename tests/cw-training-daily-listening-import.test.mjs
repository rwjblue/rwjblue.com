import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareDailyListeningAudio } from "../scripts/cw-training/import-daily-listening.mjs";

const available = ['ffmpeg', 'ffprobe'].every(command => spawnSync(command, ['-version'], { stdio: 'ignore' }).status === 0);
test("import creates a standard-rate playback copy without changing the source or tempo", { skip: !available && "FFmpeg and ffprobe are needed for audio import" }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cw-import-test-'));
  try {
    const source = path.join(directory, 'source.mp3');
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=650:duration=2', '-ar', '11025', '-b:a', '16k', source]);
    const before = await readFile(source);
    const { audio, durationSeconds } = await prepareDailyListeningAudio(source);
    assert.deepEqual(await readFile(source), before);
    const playback = path.join(directory, 'playback.mp3');
    await writeFile(playback, audio);
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', playback], { encoding: 'utf8' }));
    assert.equal(info.streams[0].sample_rate, '44100');
    assert.equal(info.streams[0].channels, 1);
    const pcm = filename => execFileSync('ffmpeg', ['-v', 'error', '-i', filename, '-ar', '44100', '-f', 's16le', 'pipe:1']);
    assert.equal(pcm(playback).length, pcm(source).length, 'resampling preserves decoded duration');
    assert.ok(durationSeconds >= 2 && durationSeconds < 2.3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
