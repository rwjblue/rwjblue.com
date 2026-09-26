import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { WORD_LISTS, COMMON_QSO_WORDS, QSO_WORDS_TITLE, ENGLISH_WORDS_TITLE } from '../src/data/cw-listening/words.ts';
import { createWordDraft, restoreWordPractice, recordWordSettings } from '../src/lib/cw-listening/word-practice.ts';
import { practiceQso, recordQsoSettings } from '../src/lib/cw-listening/qso-practice.ts';
import { createListeningDraft, restoreListeningDraft, restoreListeningSession, restoreListeningPreferences, listeningPreset, applyListeningPreset } from '../src/lib/cw-listening/session.ts';
import { createTrainingListeningBlock, listeningDraftForBlock, applyListeningTotal } from '../src/lib/cw-training/listening-adapter.ts';
import { wordPracticeAttempt } from '../src/lib/cw-training/word-practice.ts';
import { qsoPracticeAttempt } from '../src/lib/cw-training/qso-practice.ts';
import { dailyListeningSeconds } from '../src/lib/cw-training/daily-listening.ts';

test('public word catalogs preserve exact MP3 timing identities, repeats, and spoken coverage', async () => {
  const recordings = JSON.parse(await readFile('public/audio/cw-training/recordings/index.json', 'utf8')).recordings;
  const speech = JSON.parse(await readFile('public/audio/cw-training/words/index.json', 'utf8')).clips;
  assert.equal(WORD_LISTS[0].title, '30 most common English words');
  assert.equal(WORD_LISTS[1].title, 'Common QSO words');
  assert.equal(WORD_LISTS[0].text.split(' ').length, 30);
  assert.equal(COMMON_QSO_WORDS.split(' ').length, 75);
  assert.equal(new Set(COMMON_QSO_WORDS.split(' ')).size, 70);
  for (const list of WORD_LISTS) {
    const words = list.text.split(' ');
    const hash = createHash('sha256').update(words.join(' ')).digest('hex');
    const matches = recordings.filter(recording => recording.wordsHash === hash);
    assert.equal(matches.length, 2, `${list.title} has compact and spoken recordings`);
    for (const recording of matches) assert.equal(recording.starts.length, words.length);
    for (const word of words) assert.ok(speech[word], `${word} has a spoken clip`);
  }
});

test('both old reference names and English titles migrate without changing text or speed', () => {
  for (const [title, expected] of [["Bob's 77-word reference", QSO_WORDS_TITLE], ['77 most common words', QSO_WORDS_TITLE], ['30 common words', ENGLISH_WORDS_TITLE]]) {
    const draft = { ...createWordDraft(), title, text: 'RR THE RR QTH', used: [`${title}: 4 entries`], settings: { ...createWordDraft().settings, wpm: 37 } };
    restoreWordPractice(draft);
    assert.equal(draft.title, expected);
    assert.equal(draft.text, 'RR THE RR QTH');
    assert.equal(draft.settings.wpm, 37);
    assert.deepEqual(draft.used, [`${expected}: 4 entries`]);
  }
});

test('public sessions restore exact generated exchanges and time but fresh sessions use new drafts', () => {
  const draft = createListeningDraft('qsos');
  const script = structuredClone(practiceQso(draft.qso));
  const saved = { version: 1, id: 'visit', startedAt: '2026-09-26T14:00:00Z', activeSeconds: 38.4, draft, ended: false, preset: 'qsos:ragchew' };
  const restored = restoreListeningSession(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(practiceQso(restored.draft.qso), script);
  assert.equal(restored.activeSeconds, 38.4);
  assert.equal(restored.id, saved.id);
  restored.draft.qso.wpm = 33;
  assert.deepEqual(practiceQso(restored.draft.qso), script);
  assert.equal(saved.draft.qso.wpm, 20);
  assert.equal(restoreListeningDraft({ mode: 'stories', qso: draft.qso }), undefined);
  assert.equal(restoreListeningSession({ ...saved, activeSeconds: NaN }), undefined);
  assert.equal(restoreListeningSession({ ...saved, startedAt: 'bad' }), undefined);
  assert.equal(restoreListeningDraft({ mode: 'qsos', qso: { ...draft.qso, generated: { ...script, lines: ['x'.repeat(1001)] } } }), undefined);
});

test('preferences preserve independent custom words, QSO scenario, and story selection', () => {
  const words = { ...createWordDraft(), text: 'CUSTOM WORDS', title: 'Custom words' };
  const preferences = restoreListeningPreferences({ version: 1, mode: 'stories', revealed: true, words,
    qsos: { qsoId: 'pota', wpm: 32, used: [] }, stories: { qsoId: 'story-light', wpm: 17, used: [] } });
  assert.equal(createListeningDraft('words', preferences).word.text, 'CUSTOM WORDS');
  assert.equal(createListeningDraft('qsos', preferences).qso.qsoId, 'pota');
  assert.equal(createListeningDraft('stories', preferences).qso.qsoId, 'story-light');
  assert.equal(preferences.revealed, true);
  assert.deepEqual(restoreListeningPreferences({ version: 999 }), { version: 1, mode: 'words', revealed: false });
  assert.equal(restoreListeningPreferences({ version: 1, words: { ...words, settings: { ...words.settings, wpm: null } } }).words, undefined);
});

test('preset URLs accept only public catalog choices, never arbitrary text', () => {
  const preset = listeningPreset('?mode=words&list=common-qso&text=PRIVATE');
  assert.equal(preset.key, 'words:common-qso');
  const draft = createListeningDraft(preset.mode);
  applyListeningPreset(draft, preset.selection);
  assert.equal(draft.word.text, COMMON_QSO_WORDS);
  assert.deepEqual(listeningPreset('?mode=account&list=common-qso'), { key: '' });
  assert.equal(listeningPreset('?mode=stories&story=pota').selection, undefined);
  assert.equal(listeningPreset('?mode=qsos&scenario=ragchew').selection, 'ragchew');
});

test('trainer transitions keep stable IDs and independent category totals with repeated progress notifications', () => {
  const preferences = restoreListeningPreferences();
  const now = '2026-09-26T14:00:00Z';
  const previous = { wordPracticeDefaults: { ...createWordDraft(), title: 'Custom words', text: 'MY CUSTOM LIST' },
    qsoPracticeDefaults: { qsoId: 'story-radio', wpm: 25, used: [] } };
  const words = createTrainingListeningBlock('words', now, 'words', previous, preferences);
  assert.equal(words.wordPractice.text, 'MY CUSTOM LIST');
  words.activeSeconds = 7.5; // An unfinished block, already credited before reload.
  applyListeningTotal(words, 12.8);
  applyListeningTotal(words, 12.8);
  applyListeningTotal(words, 10);
  assert.equal(words.activeSeconds, 12.8);
  recordWordSettings(words.wordPractice);
  const wordAttempt = wordPracticeAttempt(words, '2026-09-26T14:02:00Z');
  const story = createTrainingListeningBlock('stories', now, 'story', previous, preferences);
  assert.equal(story.qsoPractice.qsoId, 'story-radio');
  assert.equal(story.qsoPractice.wpm, 25);
  assert.equal(story.activeSeconds, 0);
  assert.equal(listeningDraftForBlock(story).mode, 'stories');
  applyListeningTotal(story, 30);
  recordQsoSettings(story.qsoPractice);
  const storyAttempt = qsoPracticeAttempt(story, '2026-09-26T14:03:00Z');
  assert.equal(wordAttempt.taskId, 'other:word-recognition');
  assert.equal(storyAttempt.taskId, 'other:general');
  assert.equal(wordAttempt.id, 'words');
  assert.equal(storyAttempt.id, 'story');
  assert.equal(dailyListeningSeconds([wordAttempt, storyAttempt], words, '2026-09-26', 'America/New_York'), 12);
  assert.equal(createTrainingListeningBlock('qsos', now, 'contact', previous, preferences).qsoPractice.qsoId, 'short-contact');
});

test('public player dependency graph never imports private training code', async () => {
  const visited = new Set();
  async function visit(url) {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    assert.ok(!url.pathname.includes('/cw-training/'), `Private dependency: ${url.pathname}`);
    const source = await readFile(url, 'utf8');
    assert.ok(!source.includes('/api/cw-training/'), `Private API in ${url.pathname}`);
    for (const match of source.matchAll(/(?:from\s*|import\s*\()(["'])(\.[^"']+)\1/g)) {
      const path = match[2].endsWith('.ts') ? match[2] : `${match[2]}.ts`;
      await visit(new URL(path, url));
    }
  }
  await visit(new URL('../src/lib/cw-listening/client.ts', import.meta.url));
  assert.ok(visited.size >= 12);
});
