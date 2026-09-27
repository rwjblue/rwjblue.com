import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { WORD_LISTS, COMMON_QSO_WORDS, LEGACY_COMMON_QSO_WORDS, QSO_WORDS_TITLE, ENGLISH_WORDS_TITLE } from '../src/data/cw-listening/words.ts';
import { createWordDraft, restoreWordPractice, recordWordSettings } from '../src/lib/cw-listening/word-practice.ts';
import { practiceQso, recordQsoSettings } from '../src/lib/cw-listening/qso-practice.ts';
import { createListeningDraft, restoreListeningDraft, restoreListeningSession, restoreListeningPreferences, listeningPreset, applyListeningPreset, listeningLinkSettings } from '../src/lib/cw-listening/session.ts';
import { generateQso, qsoFromRecipe, shareableQsoRecipe, QSO_TEMPLATES } from '../src/lib/cw-listening/qso-generator.ts';
import { LISTENING_SPEEDS, listeningSpeedStops } from '../src/lib/cw-listening/speed-control.ts';
import { createTrainingListeningBlock, listeningDraftForBlock, applyListeningTotal } from '../src/lib/cw-training/listening-adapter.ts';
import { wordPracticeAttempt } from '../src/lib/cw-training/word-practice.ts';
import { qsoPracticeAttempt } from '../src/lib/cw-training/qso-practice.ts';
import { dailyListeningSeconds } from '../src/lib/cw-training/daily-listening.ts';

test('public word catalogs have unique tokens, matching MP3 timing identities, and spoken coverage', async () => {
  const recordings = JSON.parse(await readFile('public/audio/cw-training/recordings/index.json', 'utf8')).recordings;
  const speech = JSON.parse(await readFile('public/audio/cw-training/words/index.json', 'utf8')).clips;
  assert.equal(WORD_LISTS[0].title, '30 most common English words');
  assert.equal(WORD_LISTS[1].title, 'Common QSO words');
  assert.equal(WORD_LISTS[0].text.split(' ').length, 30);
  assert.equal(COMMON_QSO_WORDS.split(' ').length, 70);
  assert.equal(COMMON_QSO_WORDS.split(' ')[0], 'VVV');
  assert.deepEqual(COMMON_QSO_WORDS.split(' '), [...new Set(LEGACY_COMMON_QSO_WORDS.split(' '))]);
  assert.equal(new Set(COMMON_QSO_WORDS.split(' ')).size, 70);
  const counts = new Map();
  for (const word of COMMON_QSO_WORDS.split(' ')) counts.set(word, (counts.get(word) ?? 0) + 1);
  assert.deepEqual(Object.fromEntries([...counts].filter(([, count]) => count > 1)), {});
  assert.equal(counts.get('TKS'), 1);
  assert.equal(counts.get('TNX'), 1);
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

test('saved built-in QSO lists lose exact duplicates without rewriting custom lists or history', () => {
  for (const title of [QSO_WORDS_TITLE, "Bob's 77-word reference", '77 most common words']) {
    const word = { ...createWordDraft(), title, text: LEGACY_COMMON_QSO_WORDS.toLowerCase().replaceAll(' ', '\n'),
      used: [`${title}: 75 entries`], settings: { ...createWordDraft().settings, wpm: 37 } };
    const saved = { version: 1, id: 'words-visit', startedAt: '2026-09-26T14:00:00Z', activeSeconds: 38.4,
      draft: { mode: 'words', word }, ended: false, preset: 'words:common-qso' };
    const restored = restoreListeningSession(JSON.parse(JSON.stringify(saved)));
    assert.equal(restored.draft.word.text, COMMON_QSO_WORDS);
    assert.equal(restored.draft.word.settings.wpm, 37);
    assert.deepEqual(restored.draft.word.used, [`${QSO_WORDS_TITLE}: 75 entries`]);
    assert.equal(restored.activeSeconds, 38.4);
    assert.equal(restored.id, saved.id);
    const preferences = restoreListeningPreferences({ version: 1, mode: 'words', words: word });
    assert.equal(preferences.words.text, COMMON_QSO_WORDS);
    assert.equal(createWordDraft(word).text, COMMON_QSO_WORDS);
  }
  for (const [title, text] of [['Custom words', LEGACY_COMMON_QSO_WORDS], [QSO_WORDS_TITLE, 'VVV TKS TNX RR RR']]) {
    const word = { ...createWordDraft(), title, text };
    restoreWordPractice(word);
    assert.equal(word.text, text);
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
  applyListeningPreset(draft, preset);
  assert.equal(draft.word.text, COMMON_QSO_WORDS);
  assert.deepEqual(listeningPreset('?mode=account&list=common-qso'), { key: '' });
  assert.equal(listeningPreset('?mode=stories&story=pota').selection, undefined);
  assert.equal(listeningPreset('?mode=qsos&scenario=ragchew').selection, 'ragchew');
});

test('speed presets retain an exact speed without rounding or duplicating a stop', () => {
  assert.deepEqual(LISTENING_SPEEDS, [12, 15, 18, 20, 23, 25, 28, 30, 35, 40]);
  assert.deepEqual(listeningSpeedStops(20), LISTENING_SPEEDS);
  assert.deepEqual(listeningSpeedStops(37), [12, 15, 18, 20, 23, 25, 28, 30, 35, 37, 40]);
  assert.equal(listeningSpeedStops(10)[0], 10);
  assert.equal(listeningSpeedStops(60).at(-1), 60);
});

test('compact recipes reproduce every station detail and recover older saved exchanges', () => {
  for (const template of QSO_TEMPLATES) for (let seed = 0; seed < 100; seed++) {
    let state = seed;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    const qso = generateQso(template.id, random);
    assert.equal(qso.recipe.length, 35);
    assert.deepEqual(qsoFromRecipe(qso.recipe), qso);
    const legacy = structuredClone(qso);
    delete legacy.recipe;
    const recovered = shareableQsoRecipe(legacy);
    assert.ok(recovered, `Recover ${template.id}, seed ${seed}`);
    assert.deepEqual(qsoFromRecipe(recovered).lines, qso.lines);
    assert.deepEqual(qsoFromRecipe(recovered).stations, qso.stations);
  }
  const changed = generateQso('ragchew', () => 0.5);
  changed.lines[0] = 'CQ DE W1TEST K';
  assert.equal(shareableQsoRecipe(changed), undefined, 'Never share different text for an unrecognized script');
});

test('published v1 recipes retain their original scripts when the generator evolves', () => {
  // Changes to these snapshots require a new format version and a retained v1 renderer.
  const hashes = [
    'a4e35cfbc40f3f7f2f59ed4c2f009b16ca904dc290c7f91a8c4812b8f4328799',
    'e174e8b7739d8ea53b0a7ce8e10dd75e4a57b8c7937f32b936602f092f87945b',
    '02f9054c06eec86885a399462ea51439a67a3629dd334dc2e2654695d06abfaf',
    'eb1395d336c8fa6432e3447520726519245d6a0ecc55b2046fecc24d699328b0',
  ];
  for (const [template, expected] of hashes.entries()) {
    const qso = qsoFromRecipe(`1.${template}.0.0.0.0.0.0.0.0.t.j.d.5.1.5.5.6`);
    assert.equal(createHash('sha256').update(JSON.stringify(qso)).digest('hex'), expected);
  }
});

test('QSO links restore the exact exchange, speed and text visibility without sharing session history', () => {
  const draft = createListeningDraft('qsos');
  draft.qso.qsoId = 'ragchew';
  draft.qso.wpm = 37;
  draft.qso.used = ['PRIVATE PRACTICE HISTORY'];
  const expected = practiceQso(draft.qso);
  for (const revealed of [false, true]) {
    const link = listeningLinkSettings(draft, revealed);
    assert.equal(link.shareable, true);
    assert.ok(link.search.length < 120);
    assert.ok(!link.search.includes('PRIVATE'));
    assert.ok(!link.search.includes(expected.stations[0]));
    const preset = listeningPreset(link.search);
    const restored = createListeningDraft(preset.mode);
    applyListeningPreset(restored, preset);
    assert.equal(restored.qso.wpm, 37);
    assert.equal(preset.revealed, revealed);
    assert.deepEqual(practiceQso(restored.qso), expected);
    assert.deepEqual(restored.qso.used, []);
    assert.equal(listeningPreset(link.search.replace('wpm=37', 'wpm=23')).key, preset.key);
    const saved = restoreListeningSession({ version: 1, id: 'visit', startedAt: '2026-09-26T14:00:00Z', activeSeconds: 15,
      draft: restored, ended: false, preset: preset.key });
    assert.equal(saved.preset, preset.key);
    assert.equal(saved.activeSeconds, 15);
  }
});

test('story and catalog links apply explicit settings while custom words remain device-local', () => {
  for (const search of ['?mode=stories&story=story-light&wpm=60&text=show', '?mode=words&list=common-qso&wpm=12&text=hide']) {
    const preset = listeningPreset(search);
    const draft = createListeningDraft(preset.mode);
    applyListeningPreset(draft, preset);
    assert.deepEqual(listeningPreset(listeningLinkSettings(draft, preset.revealed).search), preset);
  }
  const custom = createListeningDraft('words');
  custom.word.title = 'Custom words'; custom.word.text = 'PRIVATE WORDS';
  const link = listeningLinkSettings(custom, true);
  assert.equal(link.shareable, false);
  assert.ok(!link.search.includes('PRIVATE'));
  assert.equal(listeningPreset('?text=show').revealed, true);
  for (const value of ['0', '9', '61', 'NaN', 'Infinity', '']) assert.equal(listeningPreset(`?wpm=${value}`).wpm, undefined);
  assert.equal(listeningPreset('?text=arbitrary').revealed, undefined);
});

test('malformed or incompatible QSO recipes cannot silently generate a different exchange', () => {
  const recipe = generateQso('ragchew', () => 0).recipe;
  const fields = recipe.split('.');
  const edited = (index, value) => fields.map((field, i) => i === index ? value : field).join('.');
  for (const invalid of ['', 'PRIVATE TEXT', 'a'.repeat(129), edited(0, '2'), edited(1, 'z'), edited(2, 'z'),
    edited(2, '00'), edited(6, '2'), edited(10, fields[2]), edited(11, fields[3]), recipe + '.0']) {
    assert.throws(() => qsoFromRecipe(invalid));
    const preset = listeningPreset(`?mode=qsos&qso=${encodeURIComponent(invalid)}`);
    assert.ok(preset.error);
    assert.equal(preset.generated, undefined);
  }
  assert.ok(listeningPreset(`?mode=stories&qso=${recipe}`).error);
  assert.ok(listeningPreset(`?mode=qsos&scenario=pota&qso=${recipe}`).error);
});

test('new trainer word sessions select QSO words and retain playback preferences without changing saved drafts', () => {
  const now = '2026-09-27T16:00:00Z';
  const custom = { ...createWordDraft(), title: 'Custom words', text: 'MY CUSTOM LIST', used: ['Previous listening'] };
  custom.settings.wpm = 25;
  custom.settings.spokenAnswers = true;
  for (const [previous, preferences, expectedSettings] of [
    [{}, restoreListeningPreferences(), createWordDraft().settings],
    [{ wordPracticeDefaults: custom }, restoreListeningPreferences(), custom.settings],
    [{ wordPracticeDefaults: custom }, { ...restoreListeningPreferences(), words: createWordDraft() }, createWordDraft().settings],
    [{}, { ...restoreListeningPreferences(), words: custom }, custom.settings],
  ]) {
    const before = structuredClone({ previous, preferences });
    const active = createTrainingListeningBlock('words', now, 'new-words', previous, preferences);
    assert.equal(active.wordPractice.title, QSO_WORDS_TITLE);
    assert.equal(active.wordPractice.text, COMMON_QSO_WORDS);
    assert.deepEqual(active.wordPractice.settings, expectedSettings);
    assert.deepEqual(active.wordPractice.used, []);
    assert.deepEqual({ previous, preferences }, before);
    active.wordPractice = structuredClone(custom);
    assert.equal(listeningDraftForBlock(active).word.text, custom.text, 'resuming keeps the selected list');
  }
  assert.equal(createWordDraft().title, ENGLISH_WORDS_TITLE, 'the public player keeps its default');
});

test('trainer transitions keep stable IDs and independent category totals with repeated progress notifications', () => {
  const preferences = restoreListeningPreferences();
  const now = '2026-09-26T14:00:00Z';
  const previous = { wordPracticeDefaults: { ...createWordDraft(), title: 'Custom words', text: 'MY CUSTOM LIST' },
    qsoPracticeDefaults: { qsoId: 'story-radio', wpm: 25, used: [] } };
  const words = createTrainingListeningBlock('words', now, 'words', previous, preferences);
  assert.equal(words.wordPractice.text, COMMON_QSO_WORDS);
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

test('Farnsworth preferences, trainer blocks, history and share links retain both speeds in all modes', () => {
  for (const mode of ['words', 'qsos', 'stories']) {
    const draft = createListeningDraft(mode);
    const settings = mode === 'words' ? draft.word.settings : draft.qso;
    Object.assign(settings, { wpm: 30, fwpm: 15 });
    const saved = restoreListeningDraft(JSON.parse(JSON.stringify(draft)));
    const preferences = restoreListeningPreferences({ version: 1, mode, [mode]: mode === 'words' ? saved.word : saved.qso });
    const fresh = createListeningDraft(mode, preferences);
    assert.equal(mode === 'words' ? fresh.word.settings.fwpm : fresh.qso.fwpm, 15);
    const block = createTrainingListeningBlock(mode, '2026-09-28T12:00:00Z', mode, {}, preferences);
    assert.equal(mode === 'words' ? block.wordPractice.settings.fwpm : block.qsoPractice.fwpm, 15);
    const link = listeningLinkSettings(draft, true);
    assert.match(link.search, /fwpm=15/);
    const recipient = createListeningDraft(mode);
    applyListeningPreset(recipient, listeningPreset(link.search));
    const received = mode === 'words' ? recipient.word.settings : recipient.qso;
    assert.equal(received.wpm, 30);
    assert.equal(received.fwpm, 15);
    applyListeningPreset(recipient, listeningPreset(link.search.replace('&fwpm=15', '')));
    assert.equal(received.fwpm, 30, 'Old links specify normal spacing instead of remembered Farnsworth');
    settings.fwpm = 31;
    assert.equal(restoreListeningDraft(draft), undefined);
    delete settings.fwpm;
    assert.ok(restoreListeningDraft(draft), 'Existing drafts remain valid');
  }
});
