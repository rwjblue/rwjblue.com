import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeWordWav, encodeWordWav } from '../src/lib/cw-training/word-wav.ts';
import { loadWordRecording, loadWordSpeech } from '../src/lib/cw-training/word-assets.ts';
import { COMMON_WORDS } from '../src/lib/cw-training/word-practice.ts';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const buffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

test('every pronunciation has a non-silent PCM clip matching the published index', async () => {
  const manifest = JSON.parse(await readFile('data/cw-training/word-speech.json', 'utf8'));
  const index = JSON.parse(await readFile('public/audio/cw-training/words/index.json', 'utf8'));
  assert.equal(new Set(manifest.words.map(entry => entry.word)).size, manifest.words.length);
  for (const entry of manifest.words) {
    assert.ok(entry.pronunciation.trim());
    assert.ok(entry.path.startsWith('public/audio/cw-training/words/'));
    const bytes = await readFile(entry.path);
    const clip = index.clips[entry.word];
    assert.equal(clip.url, '/' + entry.path.slice('public/'.length));
    assert.equal(clip.sha256, hash(bytes), entry.word);
    const samples = decodeWordWav(buffer(bytes));
    assert.ok(samples.length > 2205 && samples.length < 22050 * 10, entry.word);
    assert.ok(samples.some(sample => Math.abs(sample) > .1), entry.word);
    assert.ok(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1), entry.word);
  }
  assert.equal(manifest.words.find(entry => entry.word === 'QTH').pronunciation, 'Q T H');
  assert.equal(manifest.words.find(entry => entry.word === 'QSY').pronunciation, 'Q S Y');
  assert.equal(manifest.words.find(entry => entry.word === 'DIPOLE').pronunciation, 'dipole');
});

test('all four ready-made MP3s match their index and have bounded, ordered word positions', async () => {
  const index = JSON.parse(await readFile('public/audio/cw-training/recordings/index.json', 'utf8'));
  assert.deepEqual(index.recordings.map(item => item.id).sort(), ['bob-compact', 'bob-spoken', 'common-compact', 'common-spoken']);
  for (const item of index.recordings) {
    const bytes = await readFile('public' + item.url);
    assert.equal(hash(bytes), item.sha256);
    assert.ok(bytes.length > 1000);
    assert.equal(item.settings.wpm, 40);
    assert.equal(item.settings.pitch, 450);
    assert.equal(item.settings.shuffle, false);
    assert.equal(item.starts.length, item.id.startsWith('bob') ? 75 : 30);
    assert.equal(item.starts[0], 0);
    assert.ok(item.starts.every((at, i) => at < item.duration && (!i || at > item.starts[i - 1])));
    assert.ok(item.duration < 600);
  }
});

test('PCM decoder rejects malformed, truncated or wrong-format clips', async () => {
  const bytes = await encodeWordWav(new Float32Array(1000).fill(.25)).arrayBuffer();
  const samples = decodeWordWav(bytes);
  assert.ok(Math.abs(samples[0] - .25) < 1 / 32768);
  assert.throws(() => decodeWordWav(bytes.slice(0, -2)), /PCM WAV/);
  const stereo = bytes.slice(0);
  new DataView(stereo).setUint16(22, 2, true);
  assert.throws(() => decodeWordWav(stereo), /PCM WAV/);
  const wrongRate = bytes.slice(0);
  new DataView(wrongRate).setUint32(24, 44100, true);
  assert.throws(() => decodeWordWav(wrongRate), /PCM WAV/);
});

test('asset loading reuses speech, rejects missing custom words, and loads MP3 metadata without speech downloads', async t => {
  const requested = [];
  let failSpeechIndex = true;
  t.mock.method(globalThis, 'fetch', async url => {
    requested.push(url);
    if (url.endsWith('/words/index.json') && failSpeechIndex) { failSpeechIndex = false; return new Response('', {status:503}); }
    const path = 'public' + new URL(url, 'http://localhost').pathname;
    return new Response(await readFile(path));
  });
  const recording = await loadWordRecording(COMMON_WORDS, true);
  assert.match(recording.recordingUrl, /common-spoken\.mp3\?v=/);
  assert.equal(recording.words.length, 30);
  assert.equal(requested.length, 1);
  await assert.rejects(loadWordSpeech('DIPOLE QTH'), /Check your connection/);
  const clips = await loadWordSpeech('DIPOLE QTH');
  assert.equal(clips.size, 2);
  const count = requested.length;
  const again = await loadWordSpeech('QTH DIPOLE QTH');
  assert.equal(requested.length, count);
  assert.equal(again.get('DIPOLE'), clips.get('DIPOLE'));
  await assert.rejects(loadWordSpeech('NEWWORD'), /No spoken clips for NEWWORD/);
  await assert.rejects(loadWordRecording('NEWWORD', true), /No ready-made recording/);
});
