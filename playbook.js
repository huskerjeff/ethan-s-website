// The Playbook: a flag-football coach's board. Draw routes, run the play, save it.
// Self-contained ES module; plays are stored only on this device.
const STORAGE_PREFIX = 'ethanArena:v1:';
const storage = {
  get(key, fallback) {
    try { const value = localStorage.getItem(STORAGE_PREFIX + key); return value === null ? fallback : JSON.parse(value); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
};
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const badge = (id) => document.dispatchEvent(new CustomEvent('arena:badge', { detail: id }));
const $ = (id) => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';

// Field is 300 x 200 units; the line of scrimmage is y = 130, the end zone is above y = 30.
const LOS = 130;
const PLAYERS = {
  X: { x: 45, y: LOS, side: -1, label: 'X', name: 'left receiver' },
  Y: { x: 105, y: LOS, side: -1, label: 'Y', name: 'slot receiver' },
  Z: { x: 255, y: LOS, side: 1, label: 'Z', name: 'right receiver' }
};
const QB = { x: 150, y: 155 };
const CENTER = { x: 150, y: LOS };

// Each route returns its path points for a player at (x, y) on a side (-1 left, 1 right).
export const ROUTES = [
  { id: 'go', label: 'Go', tip: 'Straight downfield — beat your man with speed.', path: (p) => [[p.x, p.y], [p.x, p.y - 105]] },
  { id: 'out', label: 'Out', tip: 'Cut to the sideline — the safe throw.', path: (p) => [[p.x, p.y], [p.x, p.y - 50], [p.x + p.side * 40, p.y - 50]] },
  { id: 'in', label: 'In', tip: 'Cut across the middle — open when they blitz.', path: (p) => [[p.x, p.y], [p.x, p.y - 55], [p.x - p.side * 70, p.y - 55]] },
  { id: 'slant', label: 'Slant', tip: 'One quick cut inside — fast and hard to cover.', path: (p) => [[p.x, p.y], [p.x, p.y - 15], [p.x - p.side * 50, p.y - 70]] },
  { id: 'curl', label: 'Curl', tip: "Run, stop, turn around — the quarterback's best friend.", path: (p) => [[p.x, p.y], [p.x, p.y - 70], [p.x - p.side * 8, p.y - 58]] },
  { id: 'reverse', label: 'Reverse', tip: 'Hand it off, then hand it off again — the defense never sees it coming.', path: (p) => [[p.x, p.y], [QB.x - p.side * 12, QB.y + 12], [QB.x - p.side * 115, LOS - 10], [QB.x - p.side * 115, 30]] }
];
const routeById = Object.fromEntries(ROUTES.map((r) => [r.id, r]));

const STARTER_PLAYS = [
  { name: 'The Reverse', note: 'Ethan at wide receiver, Duke at running back. Handoff to Duke, who hands off to Ethan. Touchdown.', routes: { X: 'go', Y: 'reverse', Z: 'curl' }, starter: true },
  { name: "Colton's Catch", note: 'Short pass to Colton, with Ethan coming by to get the pitch.', routes: { X: 'curl', Y: 'slant', Z: 'go' }, starter: true },
  { name: 'The Out Route', note: 'Inside receiver runs an out to the sideline. The bread-and-butter pass — completed again and again.', routes: { X: 'go', Y: 'out', Z: 'curl' }, starter: true }
];
const COACH_TIPS = [
  "If they blitz with the center guy, run the in — that's open.",
  "If they're not blitzing, run the out.",
  'Run the ball. Then run it again.'
];

// Deterministic result: which receiver gets the ball and what the banner says.
export function callPlay(routes, blitz, playName) {
  const who = (id) => Object.keys(routes).find((key) => routes[key] === id);
  if (blitz) {
    if (who('in')) return { target: who('in'), text: 'TOUCHDOWN! The in route beats the blitz.', score: true };
    if (who('reverse')) return { target: who('reverse'), text: 'Tackled behind the line — a reverse is slow against the blitz. Try the in route.', score: false };
    return { target: null, text: "Sacked! They blitzed the center. Try the in route — that's open against the blitz.", score: false };
  }
  if (who('reverse')) return { target: who('reverse'), text: 'TOUCHDOWN! ' + (playName === 'The Reverse' ? 'The Reverse — just like Coach drew it.' : 'The reverse fooled everybody.'), score: true };
  if (who('out')) return { target: who('out'), text: 'TOUCHDOWN! The out route was open.', score: true };
  if (who('slant')) return { target: who('slant'), text: 'First down! The slant was open.', score: true };
  if (who('in')) return { target: who('in'), text: 'First down! The in route found space.', score: true };
  if (who('curl')) return { target: who('curl'), text: 'Short gain on the curl. Try the out route next time.', score: false };
  return { target: who('go'), text: "Incomplete — they're playing deep. Try the out route.", score: false };
}

function initPlaybook() {
  const field = $('playbook-field');
  if (!field) return;
  let routes = { ...STARTER_PLAYS[0].routes };
  let current = 'X';
  let blitz = false;
  let loadedName = STARTER_PLAYS[0].name;
  let tipIndex = 0;
  let animating = false;
  let saved = storage.get('plays', []);
  if (!Array.isArray(saved)) saved = [];
  saved = saved.filter((p) => p && typeof p.name === 'string' && p.routes && Object.keys(PLAYERS).every((k) => routeById[p.routes[k]]));

  const el = (tag, attrs) => { const node = document.createElementNS(SVG_NS, tag); Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v)); return node; };
  const layer = { routes: el('g', { class: 'pb-routes' }), defense: el('g', { class: 'pb-defense' }), dots: el('g', { class: 'pb-dots' }) };
  field.append(layer.routes, layer.defense, layer.dots);
  const dots = {};
  const makeDot = (key, pos, cls, text) => {
    const g = el('g', { class: 'pb-dot ' + cls, transform: `translate(${pos.x} ${pos.y})` });
    g.append(el('circle', { r: 9 }));
    const t = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }); t.textContent = text; g.append(t);
    layer.dots.append(g); dots[key] = g; return g;
  };
  makeDot('C', CENTER, 'pb-center', 'C');
  makeDot('Q', QB, 'pb-qb', 'Q');
  Object.entries(PLAYERS).forEach(([key, p]) => {
    const g = makeDot(key, p, 'pb-receiver', p.label);
    g.addEventListener('click', () => selectReceiver(key));
  });
  const ball = el('circle', { class: 'pb-ball', r: 4, cx: QB.x, cy: QB.y - 10 });
  layer.dots.append(ball);
  const defenders = [{ x: 70, y: 95 }, { x: 150, y: 100 }, { x: 235, y: 95 }];
  const blitzSpots = [{ x: 95, y: 118 }, { x: 150, y: 120 }, { x: 205, y: 118 }];
  const defenseDots = defenders.map((d) => { const c = el('circle', { class: 'pb-defender', r: 8, cx: d.x, cy: d.y }); layer.defense.append(c); return c; });

  function placeDefense() {
    defenseDots.forEach((c, i) => { const spot = blitz ? blitzSpots[i] : defenders[i]; c.setAttribute('cx', spot.x); c.setAttribute('cy', spot.y); });
  }
  function resetDots() {
    Object.entries(PLAYERS).forEach(([key, p]) => dots[key].setAttribute('transform', `translate(${p.x} ${p.y})`));
    ball.setAttribute('cx', QB.x); ball.setAttribute('cy', QB.y - 10);
  }
  function drawRoutes() {
    layer.routes.replaceChildren();
    Object.entries(routes).forEach(([key, id]) => {
      const route = routeById[id];
      if (!route) return;
      const pts = route.path(PLAYERS[key]);
      layer.routes.append(el('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'pb-route' + (key === current ? ' is-current' : '') }));
      const [ax, ay] = pts[pts.length - 1];
      layer.routes.append(el('circle', { cx: ax, cy: ay, r: 3, class: 'pb-route-end' }));
    });
  }
  function renderControls() {
    document.querySelectorAll('[data-receiver]').forEach((b) => {
      const key = b.dataset.receiver;
      b.setAttribute('aria-pressed', String(key === current));
      b.querySelector('.pb-assigned').textContent = routes[key] ? routeById[routes[key]].label.toUpperCase() : '—';
    });
    Object.keys(PLAYERS).forEach((key) => dots[key].classList.toggle('is-current', key === current));
    document.querySelectorAll('[data-route]').forEach((b) => b.setAttribute('aria-pressed', String(routes[current] === b.dataset.route)));
    $('playbook-route-for').textContent = 'ROUTE FOR ' + PLAYERS[current].label + ' (' + PLAYERS[current].name.toUpperCase() + ')';
    const ready = Object.keys(PLAYERS).every((k) => routes[k]);
    $('playbook-run').disabled = !ready || animating;
    $('playbook-run-hint').textContent = ready ? '' : 'Pick a route for each receiver first.';
    $('playbook-blitz').setAttribute('aria-pressed', String(blitz));
    $('playbook-blitz').textContent = 'BLITZ: ' + (blitz ? 'ON' : 'OFF');
    drawRoutes();
  }
  function selectReceiver(key) { current = key; renderControls(); }
  function assignRoute(id) {
    routes[current] = id;
    loadedName = '';
    $('playbook-save').textContent = 'SAVE PLAY';
    $('playbook-tip').textContent = routeById[id].label.toUpperCase() + ': ' + routeById[id].tip;
    badge('playcaller');
    renderControls();
  }

  function animate(points, onDone) {
    // points: { key: [[x,y]...] } for dots, plus optional ball path.
    if (reducedMotion) { onDone(1); return; }
    const duration = 850;
    const startTime = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      onDone(1 - Math.pow(1 - t, 3), t < 1);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const along = (pts, t) => {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(len); total += len; }
    let d = t * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) { const f = segs[i] ? Math.min(1, d / segs[i]) : 1; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }
      d -= segs[i];
    }
    return pts[pts.length - 1];
  };
  function runPlay() {
    if (animating || !Object.keys(PLAYERS).every((k) => routes[k])) return;
    const result = callPlay(routes, blitz, loadedName);
    const paths = Object.fromEntries(Object.keys(PLAYERS).map((k) => [k, routeById[routes[k]].path(PLAYERS[k])]));
    const banner = $('playbook-result');
    banner.textContent = 'Snap…';
    banner.className = 'playbook-result';
    animating = true;
    renderControls();
    resetDots();
    animate(paths, (t, more) => {
      Object.entries(paths).forEach(([k, pts]) => { const [x, y] = along(pts, t); dots[k].setAttribute('transform', `translate(${x} ${y})`); });
      if (result.target) {
        const end = paths[result.target][paths[result.target].length - 1];
        const bt = Math.max(0, (t - 0.35) / 0.65);
        ball.setAttribute('cx', QB.x + (end[0] - QB.x) * bt);
        ball.setAttribute('cy', QB.y - 10 + (end[1] - (QB.y - 10)) * bt);
      }
      if (!more) {
        animating = false;
        banner.textContent = result.text;
        banner.className = 'playbook-result ' + (result.score ? 'is-good' : 'is-bad');
        $('playbook-tip').textContent = "COACH'S TIP: " + COACH_TIPS[tipIndex++ % COACH_TIPS.length];
        renderControls();
      }
    });
  }

  function renderPlays() {
    const list = $('playbook-plays');
    list.replaceChildren();
    const all = [...STARTER_PLAYS, ...saved];
    all.forEach((play) => {
      const li = document.createElement('li');
      const info = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = play.name;
      const summary = document.createElement('span');
      summary.textContent = Object.keys(PLAYERS).map((k) => k + ': ' + routeById[play.routes[k]].label).join(' · ') + (play.starter ? ' · COACH’S PLAY' : '');
      info.append(name, summary);
      if (play.note) { const note = document.createElement('small'); note.textContent = play.note; info.append(note); }
      const run = document.createElement('button');
      run.type = 'button'; run.className = 'outline-button'; run.textContent = 'RUN';
      run.setAttribute('aria-label', 'Load and run ' + play.name);
      run.addEventListener('click', () => {
        routes = { ...play.routes }; loadedName = play.name; current = 'X';
        $('playbook-save').textContent = play.starter ? 'SAVE PLAY' : 'SAVED ✓';
        renderControls(); runPlay();
        $('playbook-field-wrap').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
      });
      li.append(info, run);
      if (!play.starter) {
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'outline-button'; del.textContent = 'DELETE';
        del.setAttribute('aria-label', 'Delete ' + play.name);
        del.addEventListener('click', () => {
          saved = saved.filter((p) => p !== play);
          storage.set('plays', saved);
          $('playbook-save-status').textContent = play.name + ' deleted.';
          renderPlays();
        });
        li.append(del);
      }
      list.append(li);
    });
    $('playbook-empty').hidden = saved.length > 0;
  }
  function savePlay() {
    const input = $('playbook-name');
    const name = input.value.trim().slice(0, 40);
    const status = $('playbook-save-status');
    if (!name) { status.textContent = 'Give it a name first.'; input.focus(); return; }
    if (!Object.keys(PLAYERS).every((k) => routes[k])) { status.textContent = 'Pick a route for each receiver first.'; return; }
    const existing = saved.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    const play = { name, routes: { ...routes } };
    if (existing >= 0) saved[existing] = play; else saved.push(play);
    if (saved.length > 20) saved = saved.slice(-20);
    const ok = storage.set('plays', saved);
    status.textContent = ok ? name + ' saved to MY PLAYS.' : 'Saving needs storage — this browser has it off. The board still works.';
    loadedName = name;
    $('playbook-save').textContent = 'SAVED ✓';
    input.value = '';
    if (saved.length >= 3) badge('routerunner');
    renderPlays();
  }

  document.querySelectorAll('[data-receiver]').forEach((b) => b.addEventListener('click', () => selectReceiver(b.dataset.receiver)));
  document.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => assignRoute(b.dataset.route)));
  $('playbook-run').addEventListener('click', runPlay);
  $('playbook-blitz').addEventListener('click', () => { blitz = !blitz; placeDefense(); resetDots(); $('playbook-result').textContent = blitz ? 'The defense is blitzing. What beats it?' : 'Defense is back in coverage.'; $('playbook-result').className = 'playbook-result'; renderControls(); });
  $('playbook-save').addEventListener('click', savePlay);
  $('playbook-name').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); savePlay(); } });
  placeDefense();
  renderControls();
  renderPlays();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPlaybook, { once: true });
  else initPlaybook();
}
