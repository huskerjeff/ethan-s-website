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
  for (const id of ['shot-button', 'shot-reset', 'shot-score', 'shot-round', 'shot-best', 'shot-meter', 'meter-marker', 'shot-message', 'trivia-question', 'trivia-answers', 'trivia-next', 'trivia-restart', 'trivia-feedback', 'badge-progress', 'motion']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing element: ' + id);
  }
  assert.equal((html.match(/class="team-select"/g) || []).length, 3);
  assert.equal((html.match(/class="achievement"/g) || []).length, 4);
  assert.ok((html.match(/aria-live="polite"/g) || []).length >= 3);
  assert.match(app, /localStorage/);
  assert.match(app, /catch \{/);
  assert.equal((app.match(/question: '/g) || []).length, 6);
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
