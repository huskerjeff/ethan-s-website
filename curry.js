// The Court: local-only shooting ladder and lifetime practice counter.
export const SPOTS = [
  { id: 'ft', label: 'Free-Throw Line', distance: '15 ft', zone: 30, speed: .05, story: '15 feet. Every great shooter starts here. Warm up.' },
  { id: 'corner', label: 'The Corner', distance: '22 ft', zone: 24, speed: .06, story: '22 feet. The shortest three in the game — and the sneakiest.' },
  { id: 'key', label: 'Top of the Key', distance: '23 ft 9 in', zone: 18, speed: .07, story: '23 feet, 9 inches. The classic three. This is where the meter starts to bite.' },
  { id: 'logo', label: 'The Logo', distance: 'Way downtown', zone: 14, speed: .08, story: "Way downtown. Curry pulls up from here like it's a layup." },
  { id: 'half', label: 'Half Court', distance: '47 ft', zone: 10, speed: .09, story: '47 feet. The shot that makes the whole arena stand up. Good luck.' }
];
export const RECORDS = [
  { n: '2,974', story: 'December 14, 2021. Madison Square Garden. Curry passes Ray Allen for the most three-pointers in NBA history.' },
  { n: '3,000', story: 'Two weeks later, the first player ever to 3,000 threes.' },
  { n: '4,000', story: 'The first player ever to 4,000 threes. Nobody else is close.' },
  { n: '402', story: 'Threes in one season (2015–16). The single-season record.' }
];
export const MILESTONES = [
  { n: 10, text: 'Double digits!' }, { n: 100, text: 'One hundred threes!' },
  { n: 402, text: "You just matched Curry's single-season record!" },
  { n: 1000, text: 'One thousand!' },
  { n: 2974, text: 'YOU DID IT. You matched the record. The wall is yours.' }
];
const integer = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max ? n : 0;
export function rangeState(saved = {}) {
  saved = saved && typeof saved === 'object' ? saved : {};
  const unlocked = integer(saved.unlocked, 4);
  const scores = key => SPOTS.map((_, i) => i <= unlocked && Array.isArray(saved[key]) ? integer(saved[key][i], 3) : 0);
  return { spot: Math.min(integer(saved.spot, 4), unlocked), unlocked, streak: scores('streak'), best: scores('best'), flipped: [...new Set(Array.isArray(saved.flipped) ? saved.flipped.filter(i => Number.isInteger(i) && i >= 0 && i < 4) : [])] };
}
export function takeShot(state, meter) {
  const next = rangeState(state), i = next.spot, zone = SPOTS[i].zone;
  const made = Number.isFinite(meter) && meter >= 50 - zone / 2 && meter <= 50 + zone / 2;
  next.streak[i] = made ? Math.min(3, next.streak[i] + 1) : 0;
  next.best[i] = Math.max(next.best[i], next.streak[i]);
  const previous = next.unlocked;
  if (next.streak[i] === 3) next.unlocked = Math.max(next.unlocked, Math.min(4, i + 1));
  return { state: next, made, opened: next.unlocked > previous };
}
export function nextTotal(total) { return Math.min(Number.MAX_SAFE_INTEGER, integer(total, Number.MAX_SAFE_INTEGER) + 1); }
export function milestonesAt(total) { return MILESTONES.filter(m => total >= m.n); }

function initCourt() {
  const $ = id => document.getElementById(id);
  if (!$('curry-range')) return;
  const storage = {
    get(key, fallback) { try { const value = localStorage.getItem('ethanArena:v1:' + key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('ethanArena:v1:' + key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const badge = id => document.dispatchEvent(new CustomEvent('arena:badge', { detail: id }));
  let state = rangeState(storage.get('curryRange', {}));
  const expanded = new Set(state.flipped);
  let total = integer(storage.get('recordTotal', 0), Number.MAX_SAFE_INTEGER);
  let meter = 0, direction = 1, frame = 0, last = null, running = false;
  const button = $('curry-shot'), ball = $('curry-ball');
  const spots = [...document.querySelectorAll('[data-curry-spot]')];
  const cards = [...document.querySelectorAll('[data-curry-record]')];
  const persist = () => { if (!storage.set('curryRange', state)) $('curry-storage').textContent = 'Storage is unavailable. This visit still works, but new progress will not survive a reload.'; };
  function meterUI() {
    $('curry-meter').value = meter;
    $('curry-marker').style.left = meter + '%';
  }
  function render() {
    const current = SPOTS[state.spot];
    spots.forEach((spot, i) => {
      spot.disabled = i > state.unlocked;
      spot.setAttribute('aria-pressed', String(i === state.spot));
      spot.querySelector('.curry-spot-state').textContent = i > state.unlocked ? 'LOCKED · MAKE 3 IN A ROW TO UNLOCK' : state.best[i] === 3 ? 'CLEARED ✓ · BEST: 3 IN A ROW' : 'UNLOCKED ✓ · BEST: ' + state.best[i] + ' IN A ROW';
    });
    $('curry-current').textContent = current.label + ' · ' + current.distance;
    $('curry-story').textContent = current.story;
    $('curry-streak').textContent = 'STREAK: ' + state.streak[state.spot] + '/3';
    $('curry-best').textContent = 'BEST: ' + state.best[state.spot] + '/3';
    $('curry-zone').style.left = (50 - current.zone / 2) + '%';
    $('curry-zone').style.width = current.zone + '%';
    cards.forEach((card, i) => {
      const flipped = expanded.has(i);
      card.setAttribute('aria-expanded', String(flipped));
      card.querySelector('.curry-record-story').hidden = !flipped;
    });
    meterUI();
  }
  function renderTotal() {
    $('record-total').textContent = String(total).padStart(5, '0');
    $('record-distance').textContent = total < 2974 ? "Curry's record-setting milestone: 2,974. You're " + (2974 - total).toLocaleString() + ' away. Keep shooting.' : 'You reached the 2,974 milestone. Keep shooting!';
    $('record-milestones').replaceChildren(...milestonesAt(total).map(m => {
      const line = document.createElement('li'); line.textContent = m.n.toLocaleString() + ': ' + m.text; return line;
    }));
  }
  function addThree() {
    total = nextTotal(total);
    if (!storage.set('recordTotal', total)) $('curry-storage').textContent = 'Storage is unavailable. This visit still works, but new progress will not survive a reload.';
    renderTotal();
    const milestone = MILESTONES.find(m => m.n === total);
    $('record-message').textContent = milestone ? milestone.text : '+1 practice make. Lifetime total: ' + total.toLocaleString() + '.';
  }
  document.addEventListener('arena:three', addThree);
  function stop() { running = false; cancelAnimationFrame(frame); frame = 0; last = null; }
  function tick(time) {
    if (!running) return;
    const dt = last === null ? 0 : Math.min(time - last, 50); last = time;
    meter += dt * SPOTS[state.spot].speed * direction;
    if (meter >= 100) { meter = 100; direction = -1; }
    if (meter <= 0) { meter = 0; direction = 1; }
    meterUI(); frame = requestAnimationFrame(tick);
  }
  spots.forEach((spot, i) => spot.addEventListener('click', () => {
    if (i > state.unlocked) return;
    stop(); state.spot = i; meter = 0; ball.classList.remove('swish', 'miss');
    button.textContent = 'START SHOT'; $('curry-message').textContent = SPOTS[i].story;
    persist(); render();
  }));
  button.addEventListener('click', () => {
    if (!running) {
      meter = 0; direction = 1; last = null; running = true;
      button.textContent = 'RELEASE SHOT'; $('curry-message').textContent = 'Release in the green. Press Enter or Space on RELEASE SHOT.';
      frame = requestAnimationFrame(tick); return;
    }
    stop();
    const result = takeShot(state, meter); state = result.state;
    ball.classList.remove('swish', 'miss');
    if (!reduce) { void ball.offsetWidth; ball.classList.add(result.made ? 'swish' : 'miss'); }
    let message = result.made ? (state.spot === 4 ? 'HALF COURT! The whole arena is on its feet!' : 'SWISH! Nothing but net.') : 'Just missed! Your streak resets. Try again.';
    if (result.opened) message += ' ' + SPOTS[state.unlocked].label + ' unlocked! Choose it in the ladder.';
    else if (result.made && state.streak[state.spot] === 3) message += ' Three in a row! Spot cleared.';
    $('curry-message').textContent = message;
    button.textContent = 'NEXT SHOT'; persist(); render();
    if (result.made) {
      document.dispatchEvent(new CustomEvent('arena:three'));
      document.dispatchEvent(new CustomEvent('arena:swish'));
    }
    if (state.unlocked === 4) badge('downtown');
  });
  cards.forEach((card, i) => card.addEventListener('click', () => {
    const story = card.querySelector('.curry-record-story');
    if (expanded.has(i)) expanded.delete(i); else expanded.add(i);
    story.hidden = !expanded.has(i); card.setAttribute('aria-expanded', String(!story.hidden));
    if (!state.flipped.includes(i)) state.flipped.push(i);
    persist();
    if (state.flipped.length === 4) badge('recordchaser');
  }));
  $('record-reset').addEventListener('click', () => { $('record-confirm').hidden = false; $('record-no').focus(); });
  $('record-no').addEventListener('click', () => { $('record-confirm').hidden = true; $('record-reset').focus(); });
  $('record-yes').addEventListener('click', () => {
    total = 0;
    const saved = storage.set('recordTotal', 0);
    renderTotal(); $('record-message').textContent = saved ? 'Your practice count is reset to zero. Ladder progress and badges are kept.' : 'Count reset for this visit. Storage is unavailable; the reset could not be saved.';
    $('record-confirm').hidden = true; $('record-reset').focus();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) { stop(); button.textContent = 'START SHOT'; $('curry-message').textContent = 'Shot paused when you left. Your streak is kept. Start when ready.'; }
  });
  render(); renderTotal();
  if (state.unlocked === 4) badge('downtown');
  if (state.flipped.length === 4) badge('recordchaser');
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCourt, { once: true });
  else initCourt();
}
