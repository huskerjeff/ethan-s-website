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
  assert.equal((html.match(/class="achievement"/g) || []).length, 13);
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

test('Trophy Case has 13 badges with SVG glyphs and wired unlocks', () => {
  const pb = read('playbook.js');
  const ids = [...html.matchAll(/data-badge="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 13);
  for (const id of ids) assert.ok(app.includes('  ' + id + ": { name: '"), 'Badge missing from BADGES: ' + id);
  assert.doesNotMatch(html.slice(html.indexOf('badge-grid'), html.indexOf('id="badge-progress"')), /<span aria-hidden="true">[^<]/, 'Badges should use SVG glyphs, not text symbols');
  assert.equal((html.match(/data-soon/g) || []).length, 3);
  assert.match(pb, /badge\('playcaller'\)/);
  assert.match(pb, /badge\('routerunner'\)/);
  assert.match(app, /earnBadge\('numbers'\)/);
  assert.match(app, /NEXT UP: /);
  assert.ok(html.includes('id="badge-next"'));
});

test('Trophy Case round 4: badge links, unlock banner, progress on top', () => {
  const shelf = html.slice(html.indexOf('id="trophies"'), html.indexOf('id="adventures"'));
  // 1. The seven earnable badges link to the game that earns them; COMING SOON badges stay plain.
  const links = { explorer: 'teams', team: 'teams', shooter: 'play', trivia: 'trivia', playcaller: 'playbook', routerunner: 'playbook', numbers: 'numbers', downtown: 'curry-range', recordchaser: 'curry-records-title' };
  for (const [id, target] of Object.entries(links)) {
    assert.ok(shelf.includes('<a class="achievement" data-badge="' + id + '" href="#' + target + '">'), 'Badge should link to its game: ' + id);
    assert.ok(app.includes("go: '#" + target + "'"), 'BADGES entry should point to #' + target);
  }
  assert.equal((shelf.match(/<a class="achievement"/g) || []).length, 9);
  assert.equal((shelf.match(/<div class="achievement"[^>]*data-soon/g) || []).length, 3);
  assert.match(app, /badge-next-link/);
  assert.match(css, /a\.achievement:focus-visible/);
  // 2. Unlocks show a dismissible banner next to the game's own status line.
  for (const near of ['theme-status', 'shot-message', 'trivia-feedback', 'playbook-result', 'playbook-save-status', 'number-feedback']) {
    assert.ok(app.includes("near: '" + near + "'"), 'Missing banner spot: ' + near);
    assert.ok(html.includes('id="' + near + '"'), 'Banner spot missing from page: ' + near);
  }
  assert.match(app, /'BADGE UNLOCKED: '/);
  assert.match(app, /Dismiss badge message/);
  assert.match(css, /\.unlock-close\{[^}]*min-height:44px/);
  assert.match(css, /prefers-reduced-motion:no-preference\)\{\.unlock-banner\.pop/);
  // 3. Progress and NEXT UP sit directly under the heading, above the grid.
  const heading = shelf.indexOf('id="badges-title"');
  const progress = shelf.indexOf('id="badge-progress"');
  const next = shelf.indexOf('id="badge-next"');
  const grid = shelf.indexOf('class="badge-grid"');
  assert.ok(heading < progress && progress < next && next < grid, 'Progress and NEXT UP should come before the badge grid');
});


test('The Court has five ordered spots, four record cards and badge links', async () => {
  const { SPOTS, RECORDS } = await import('../curry.js');
  assert.equal(SPOTS.length, 5); assert.equal(RECORDS.length, 4);
  assert.deepEqual(SPOTS.map(s => s.zone), [30,24,18,14,10]);
  assert.deepEqual(SPOTS.map(s => s.speed), [.05,.06,.07,.08,.09]);
  assert.equal((html.match(/data-curry-spot=/g)||[]).length,5);
  assert.equal((html.match(/data-curry-record=/g)||[]).length,4);
  assert.ok(html.indexOf('id="play"') < html.indexOf('id="curry-range"'));
  assert.ok(html.indexOf('id="curry-range"') < html.indexOf('id="trivia"'));
  assert.match(app, /dispatchEvent\(new CustomEvent\('arena:three'\)\)/);
  assert.match(html, /src=".\/curry.js"/);
});

test('The Court keeps per-spot streaks, unlocks sequentially and survives serialization', async () => {
  const { rangeState, takeShot } = await import('../curry.js');
  let state=rangeState();
  assert.equal(state.unlocked,0); assert.equal(state.spot,0);
  state=takeShot(state,50).state; state=takeShot(state,50).state;
  state=takeShot(state,0).state;
  assert.equal(state.streak[0],0); assert.equal(state.best[0],2); assert.equal(state.unlocked,0);
  for(let i=0;i<3;i++) state=takeShot(state,50).state;
  assert.equal(state.unlocked,1);
  state=rangeState(JSON.parse(JSON.stringify(state))); assert.equal(state.unlocked,1);
  for(let spot=1;spot<4;spot++) { state.spot=spot; for(let i=0;i<3;i++) state=takeShot(state,50).state; }
  assert.equal(state.unlocked,4);
  state.spot=4;
  assert.equal(takeShot(state,44).made,false); assert.equal(takeShot(state,45).made,true); assert.equal(takeShot(state,55).made,true); assert.equal(takeShot(state,56).made,false);
  assert.equal(rangeState({spot:4,unlocked:0}).spot,0);
  assert.deepEqual(rangeState({flipped:[0,0,4,-1,1]}).flipped,[0,1]);
});

test('Practice counter increments safely and exposes only reached milestones', async () => {
  const { nextTotal, milestonesAt, MILESTONES } = await import('../curry.js');
  assert.equal(nextTotal(9),10); assert.equal(nextTotal(-2),1);
  assert.equal(nextTotal(Number.MAX_SAFE_INTEGER),Number.MAX_SAFE_INTEGER);
  for(const m of MILESTONES) {
    assert.equal(milestonesAt(m.n-1).some(x=>x.n===m.n),false);
    assert.equal(milestonesAt(nextTotal(m.n-1)).at(-1).text,m.text);
  }
  assert.deepEqual(milestonesAt(0),[]);
});
