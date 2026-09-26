#!/usr/bin/env node
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { COMMON_WORDS, COMMON_QSO_WORDS, DEFAULT_WORD_SETTINGS, parsePracticeWords } from '../../src/lib/cw-listening/word-practice.ts';
import { createWordRound, renderWordWav } from '../../src/lib/cw-listening/word-round.ts';
import { decodeWordWav } from '../../src/lib/cw-listening/word-wav.ts';

const { values: args } = parseArgs({ options: {
  'bob-text': { type: 'string' }, text: { type: 'string' }, id: { type: 'string' }, help: { type: 'boolean' },
} });
if (args.help) {
  console.log('Generate both public word-list MP3s. Use --text <file> --id <name> for another list, or --bob-text <file> to override the Common QSO words catalog. Existing custom recordings remain.');
  process.exit(0);
}
if (!!args.text !== !!args.id || (args.id && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.id) || ['common', 'bob'].includes(args.id)))) throw new Error('Custom lists require --text <file> and a unique lowercase --id <name>.');
const hash = data => createHash('sha256').update(data).digest('hex');
const folder = resolve('public/audio/cw-training/recordings');
const indexPath = join(folder, 'index.json');
await mkdir(folder, { recursive: true });
let index = { version: 1, recordings: [] };
try { index = JSON.parse(await readFile(indexPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const speechIndex = JSON.parse(await readFile('public/audio/cw-training/words/index.json', 'utf8'));
const lists = [{ id: 'common', text: COMMON_WORDS }, { id: 'bob', text: args['bob-text'] ? await readFile(args['bob-text'], 'utf8') : COMMON_QSO_WORDS }];
if (args.text) lists.push({ id: args.id, text: await readFile(args.text, 'utf8') });
const temp = await mkdtemp(join(tmpdir(), 'cw-word-recordings-'));
try {
  for (const list of lists) {
    const words = parsePracticeWords(list.text);
    const clips = new Map();
    for (const word of new Set(words)) {
      const clip = speechIndex.clips[word];
      if (!clip) throw new Error(`Missing clip for ${word}; generate word speech first.`);
      const bytes = await readFile(resolve('public', '.' + clip.url));
      if (hash(bytes) !== clip.sha256) throw new Error(`Stale speech index for ${word}`);
      clips.set(word, decodeWordWav(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
    }
    for (const spokenAnswers of [false, true]) {
      const settings = { ...DEFAULT_WORD_SETTINGS, shuffle: false, spokenAnswers, audioSource: 'recording' };
      const round = createWordRound(list.text, settings, Math.random, clips);
      const wav = Buffer.from(await renderWordWav(round, settings.pitch).arrayBuffer());
      const stem = `${list.id}-${spokenAnswers ? 'spoken' : 'compact'}`;
      const source = join(temp, stem + '.wav');
      const target = join(folder, stem + '.mp3');
      await writeFile(source, wav);
      const encoded = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-c:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', target], { stdio: 'inherit' });
      if (encoded.error) throw encoded.error;
      if (encoded.status !== 0) throw new Error(`MP3 encoding failed for ${stem}`);
      const sha256 = hash(await readFile(target));
      const record = { id: stem, wordsHash: hash(words.join(' ')), settings, duration: round.duration, starts: round.starts, sha256, url: `/audio/cw-training/recordings/${stem}.mp3` };
      index.recordings = index.recordings.filter(item => item.id !== stem);
      index.recordings.push(record);
      console.log(`${stem}: ${words.length} entries, ${round.duration.toFixed(1)} seconds`);
    }
  }
  index.recordings.sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
} finally { await rm(temp, { recursive: true, force: true }); }
