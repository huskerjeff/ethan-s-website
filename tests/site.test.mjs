import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('styles.css');
const app = read('app.js');
const arena = read('arena.js');
const favicon = read('favicon.svg');

test('site assets and semantic navigation are wired', () => {
  for (const asset of ['styles.css', 'app.js', 'favicon.svg']) assert.ok(html.includes('./' + asset));
  assert.match(html, /<main id="main">/);
  assert.match(html, /class="skip-link" href="#main"/);
  assert.match(html, /<nav aria-label="Primary navigation">/);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing anchor target: ' + id);
  }
});

test('games, themes and badges have accessible hooks', () => {
  for (const id of ['shot-button', 'shot-reset', 'shot-score', 'shot-round', 'shot-best', 'shot-meter', 'meter-marker', 'shot-message', 'trivia-question', 'trivia-answers', 'trivia-next', 'trivia-restart', 'trivia-feedback', 'trivia-deck-intro', 'number-question', 'number-answers', 'number-next', 'number-restart', 'number-feedback', 'number-card', 'number-progress', 'number-streak', 'number-best', 'badge-progress', 'motion']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing element: ' + id);
  }
  assert.equal((html.match(/class="team-select"/g) || []).length, 3);
  assert.equal((html.match(/class="achievement"/g) || []).length, 4);
  assert.ok((html.match(/aria-live="polite"/g) || []).length >= 3);
  assert.match(app, /localStorage/);
  assert.match(app, /catch \{/);
});

test('responsive and reduced-motion fallback styles are present', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /\[hidden\]/);
});

test('3D is lazy, pinned, and can pause', () => {
  assert.match(arena, /await import\('https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.170\.0\/build\/three\.module\.js'\)/);
  assert.match(arena, /IntersectionObserver/);
  assert.match(arena, /visibilitychange/);
  assert.match(arena, /webglcontextlost/);
  assert.match(arena, /requestAnimationFrame/);
  assert.match(arena, /reducedMotion/);
  assert.match(arena, /SphereGeometry/);
  assert.match(arena, /CylinderGeometry/);
});

test('site remains child-safe and asset-light', () => {
  assert.doesNotMatch(html, /<form\b|<iframe\b|<img\b/i);
  assert.doesNotMatch(html, /google-analytics|googletagmanager|facebook\.net|pixel\.|doubleclick/i);
  assert.match(favicon, /<svg\b/);
  assert.match(html, /<meta name="theme-color"/);
  assert.match(html, /<meta property="og:title"/);
});

// Pull every q(...) entry out of a named block in app.js and evaluate it with a stub.
// The block runs from startMarker to the first line that is only "]" or "];".
function questionsIn(source, startMarker) {
  const lines = source.slice(source.indexOf(startMarker)).split(/\r?\n/).map((line) => line.trim());
  const end = lines.findIndex((line, i) => i > 0 && (line === ']' || line === '];'));
  const q = (question, answers, correct, card) => ({ question, answers, correct, card });
  return lines.slice(0, end).filter((line) => line.startsWith('q('))
    .map((line) => new Function('q', 'return ' + line.replace(/,$/, ''))(q));
}

test('Quiz Hall has three 8-question decks with valid answers', () => {
  for (const deck of ['football', 'basketball', 'hockey']) {
    const questions = questionsIn(app, deck + ': {');
    assert.equal(questions.length, 8, deck + ' deck should have 8 questions');
    for (const item of questions) {
      assert.equal(item.answers.length, 4, item.question);
      assert.ok(item.answers.includes(item.correct), 'Correct answer missing: ' + item.question);
      assert.equal(new Set(item.answers).size, 4, 'Duplicate answers: ' + item.question);
    }
    assert.ok(html.includes('data-deck="' + deck + '"'), 'Missing deck button: ' + deck);
  }
  assert.ok(html.includes('data-deck="mixed"'));
  assert.match(app, /const MIXED_COUNT = 10;/);
});

test('Number Game has six players with cards', () => {
  const numbers = questionsIn(app, 'const numberBank');
  assert.equal(numbers.length, 6);
  for (const item of numbers) {
    assert.equal(item.answers.length, 3, item.question);
    assert.ok(item.answers.includes(item.correct), item.question);
    assert.ok(item.card && item.card.length > 10, 'Missing player card: ' + item.question);
  }
  assert.match(html, /<section id="numbers"/);
});

test('The Playbook has six routes, starter plays and the blitz rule', async () => {
  const pb = read('playbook.js');
  const { ROUTES, callPlay } = await import('../playbook.js');
  assert.equal(ROUTES.length, 6);
  assert.deepEqual(ROUTES.map((r) => r.id), ['go', 'out', 'in', 'slant', 'curl', 'reverse']);
  for (const id of ['go', 'out', 'in', 'slant', 'curl', 'reverse']) assert.ok(html.includes('data-route="' + id + '"'), 'Missing route button ' + id);
  for (const name of ['The Reverse', "Colton's Catch", 'The Out Route']) assert.ok(pb.includes(name), 'Missing starter play ' + name);
  assert.match(html, /<section id="playbook"/);
  assert.ok(html.includes('./playbook.js'));
  // Blitz rule: the in route beats the blitz; without an in route the play fails.
  assert.equal(callPlay({ X: 'go', Y: 'in', Z: 'curl' }, true).score, true);
  assert.equal(callPlay({ X: 'go', Y: 'slant', Z: 'curl' }, true).score, false);
  assert.equal(callPlay({ X: 'go', Y: 'out', Z: 'curl' }, false).score, true);
  assert.match(callPlay({ X: 'go', Y: 'reverse', Z: 'curl' }, false, 'The Reverse').text, /just like Coach drew it/);
  assert.match(pb, /arena:badge/);
  assert.match(app, /addEventListener\('arena:badge'/);
});
