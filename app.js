import { initArena } from './arena.js';

const $ = (id) => document.getElementById(id);
const STORAGE_PREFIX = 'ethanArena:v1:';
const storage = {
  get(key, fallback) {
    try { const value = localStorage.getItem(STORAGE_PREFIX + key); return value === null ? fallback : JSON.parse(value); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); }
    catch { /* Browsers with disabled storage still get a playable site. */ }
  }
};
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const badgeIds = ['explorer', 'team', 'shooter', 'trivia'];
let unlocked = storage.get('badges', []);
if (!Array.isArray(unlocked)) unlocked = [];
unlocked = unlocked.filter((id) => badgeIds.includes(id));
function renderBadges() {
  badgeIds.forEach((id) => {
    const item = document.querySelector('[data-badge="' + id + '"]');
    if (item) {
      item.classList.toggle('unlocked', unlocked.includes(id));
      item.setAttribute('aria-label', id + ': ' + (unlocked.includes(id) ? 'unlocked' : 'locked'));
    }
  });
  $('badge-progress').textContent = unlocked.length + ' OF ' + badgeIds.length + ' UNLOCKED';
}
function earnBadge(id) {
  if (!badgeIds.includes(id) || unlocked.includes(id)) return;
  unlocked.push(id);
  storage.set('badges', unlocked);
  renderBadges();
}
renderBadges();

const themeNames = { arena: 'Arena', bengals: 'Bengals', warriors: 'Warriors', knights: 'Golden Knights' };
function setTheme(theme, announce = true) {
  if (!Object.hasOwn(themeNames, theme)) theme = 'arena';
  document.body.dataset.team = theme;
  document.querySelectorAll('[data-theme]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
  });
  if (announce) $('theme-status').textContent = themeNames[theme] + ' colors activated. Your pick is saved on this device.';
  storage.set('theme', theme);
}
setTheme(storage.get('theme', 'arena'), false);
document.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => {
  setTheme(button.dataset.theme);
  earnBadge('team');
}));
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      earnBadge('explorer');
      observer.disconnect();
    }
  }, { threshold: 0.2 });
  observer.observe($('teams'));
} else {
  $('teams').addEventListener('pointerenter', () => earnBadge('explorer'), { once: true });
  document.querySelector('a[href="#teams"]').addEventListener('click', () => earnBadge('explorer'), { once: true });
}

// Shoot the Three: a fully local ten-shot timing game.
let shotBest = Number(storage.get('shotBest', 0)) || 0;
let shots = 0;
let buckets = 0;
let meter = 0;
let direction = 1;
let running = false;
let lastFrame = 0;
let animationFrame = 0;
let soundEnabled = false;
let audioContext = null;
const marker = $('meter-marker');
const shotButton = $('shot-button');
const courtBall = $('court-ball');
const shotMessage = $('shot-message');
function formatScore(value) { return String(value).padStart(2, '0'); }
function updateShotUI() {
  $('shot-score').textContent = formatScore(buckets);
  $('shot-round').textContent = shots + ' / 10';
  $('shot-best').textContent = formatScore(shotBest);
  $('shot-meter').value = meter;
  marker.style.left = meter + '%';
}
function stopAnimation() {
  running = false;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  lastFrame = 0;
}
function resetShots() {
  stopAnimation();
  shots = 0; buckets = 0; meter = 0; direction = 1;
  courtBall.classList.remove('swish', 'miss');
  shotButton.textContent = 'START SHOT';
  shotMessage.textContent = 'Tap START SHOT, then tap RELEASE when the marker reaches green.';
  updateShotUI();
}
function animateMeter(timestamp) {
  if (!running) return;
  const dt = lastFrame ? Math.min(timestamp - lastFrame, 50) : 0;
  lastFrame = timestamp;
  meter += dt * 0.08 * direction;
  if (meter >= 100) { meter = 100; direction = -1; }
  if (meter <= 0) { meter = 0; direction = 1; }
  updateShotUI();
  animationFrame = requestAnimationFrame(animateMeter);
}
function playSwishSound() {
  if (!soundEnabled) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext = audioContext || new Context();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + .13);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.065, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .2);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + .21);
  } catch { /* Audio is optional. */ }
}
function animateBall(made) {
  courtBall.classList.remove('swish', 'miss');
  if (reducedMotion) return;
  void courtBall.offsetWidth;
  courtBall.classList.add(made ? 'swish' : 'miss');
}
shotButton.addEventListener('click', () => {
  if (running) {
    stopAnimation();
    shots++;
    const made = meter >= 43 && meter <= 57;
    if (made) {
      buckets++;
      earnBadge('shooter');
      playSwishSound();
    }
    animateBall(made);
    shotMessage.textContent = made ? 'SWISH! Nothing but net. ' : 'Just missed! Find that green release window. ';
    if (shots === 10) {
      if (buckets > shotBest) { shotBest = buckets; storage.set('shotBest', shotBest); }
      shotMessage.textContent += 'Final score: ' + buckets + ' out of 10. ' + (buckets === shotBest ? 'Personal best: ' + shotBest + '.' : 'Try again to beat ' + shotBest + '.');
      shotButton.textContent = 'PLAY AGAIN';
    } else {
      shotButton.textContent = 'NEXT SHOT';
      shotMessage.textContent += (10 - shots) + ' shots remaining.';
    }
    updateShotUI();
    return;
  }
  if (shots === 10) resetShots();
  meter = 0;
  direction = 1;
  running = true;
  lastFrame = 0;
  shotButton.textContent = 'RELEASE SHOT';
  shotMessage.textContent = 'Release in the green! Press the button again or use Enter/Space while focused.';
  animationFrame = requestAnimationFrame(animateMeter);
});
$('shot-reset').addEventListener('click', resetShots);
$('sound-toggle').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  $('sound-toggle').textContent = 'SOUND: ' + (soundEnabled ? 'ON' : 'OFF');
  $('sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) {
    stopAnimation();
    shotButton.textContent = 'NEXT SHOT';
    shotMessage.textContent = 'Shot paused when you left the tab. Start again when ready.';
  }
});
updateShotUI();

// Quiz Hall: three themed decks plus a mixed deck, and the Number Game.
// Verified evergreen sports facts only: no live data, APIs, or tracking.
const q = (question, answers, correct, card) => ({ question, answers, correct, ...(card ? { card } : {}) });
const decks = {
  football: {
    label: 'FOOTBALL', intro: 'Pads optional. Knowledge required.',
    questions: [
      q('How many points is a touchdown worth?', ['3', '6', '7', '2'], '6'),
      q('What is the Cincinnati Bengals fan chant?', ['Who Dey', 'Go Pack Go', 'Fly Eagles Fly', 'Skol'], 'Who Dey'),
      q('How many Super Bowls have the Bengals played in?', ['1', '2', '3', '4'], '3'),
      q('What number does Joe Burrow wear?', ['7', '9', '12', '1'], '9'),
      q('In flag football, how do you stop the ball carrier?', ['Tackle them', 'Pull their flag', 'Tag their helmet', 'Steal the ball'], 'Pull their flag'),
      q('How many points is a field goal worth?', ['1', '2', '3', '6'], '3'),
      q('What year did the Bengals play their first season?', ['1960', '1968', '1970', '1976'], '1968'),
      q('What do Bengals fans shout back after “Who dey think gonna beat dem Bengals?”', ['Nobody!', 'Everybody!', 'The Steelers!', 'Who knows!'], 'Nobody!')
    ]
  },
  basketball: {
    label: 'BASKETBALL', intro: 'From downtown to the record books.',
    questions: [
      q('How many points is a shot from beyond the three-point line?', ['2', '3', '4', '5'], '3'),
      q('What number does Stephen Curry wear?', ['11', '23', '30', '3'], '30'),
      q('What record did Stephen Curry break on December 14, 2021?', ['Most points in a game', 'Most career three-pointers', 'Most assists', 'Most steals'], 'Most career three-pointers'),
      q('How many players from one team are on the court at a time?', ['4', '5', '6', '7'], '5'),
      q('How many NBA championships did the Warriors win from 2015 to 2022?', ['2', '3', '4', '5'], '4'),
      q('How many points is a free throw worth?', ['0', '1', '2', '3'], '1'),
      q('How long is an NBA game, in playing time?', ['40 minutes', '48 minutes', '60 minutes', '90 minutes'], '48 minutes'),
      q('Which college did Stephen Curry play for?', ['Duke', 'Davidson', 'Kentucky', 'Kansas'], 'Davidson')
    ]
  },
  hockey: {
    label: 'HOCKEY', intro: 'Fast ice, cold facts.',
    questions: [
      q('Which sport uses a puck?', ['Basketball', 'Baseball', 'Ice hockey', 'Football'], 'Ice hockey'),
      q('How many games did the Golden Knights win in their very first season?', ['33', '41', '51', '61'], '51'),
      q('Which season did the Golden Knights first play?', ['2015–16', '2016–17', '2017–18', '2019–20'], '2017–18'),
      q('How many periods are in a hockey game, and how long is each?', ['Two of 30 minutes', 'Three of 20 minutes', 'Four of 15 minutes', 'Three of 15 minutes'], 'Three of 20 minutes'),
      q("What is the Golden Knights' home arena?", ['T-Mobile Arena', 'Allegiant Stadium', 'The Sphere', 'MGM Grand Garden'], 'T-Mobile Arena'),
      q('What year did the Golden Knights win their first Stanley Cup?', ['2018', '2021', '2023', '2024'], '2023'),
      q('What is it called when a player scores three goals in one game?', ['A triple', 'A hat trick', 'A treble', 'A turkey'], 'A hat trick'),
      q('How many skaters, not counting the goalie, does a team have on the ice?', ['3', '4', '5', '6'], '5')
    ]
  }
};
const MIXED_COUNT = 10;
const numberBank = [
  q('What number does Stephen Curry wear?', ['30', '11', '23'], '30', 'The greatest shooter ever. 4,000+ career threes and counting.'),
  q('What number does Joe Burrow wear?', ['9', '1', '7'], '9', 'The quarterback who took the Bengals back to the Super Bowl.'),
  q('What number did Klay Thompson wear for the Warriors?', ['11', '30', '5'], '11', "Curry's Splash Brother. Half of the greatest shooting backcourt ever."),
  q('What number does Draymond Green wear?', ['23', '11', '30'], '23', 'The heartbeat of the Warriors. Defense, passing, and fire.'),
  q("What number does Ja'Marr Chase wear?", ['1', '9', '5'], '1', "Burrow's favorite target. One of the fastest receivers in football."),
  q('What number did Marc-André Fleury wear for the Golden Knights?', ['29', '35', '31'], '29', "The Flower. The goalie who backstopped the Knights' first magical season.")
];

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// One quiz state machine drives both Trivia Blitz and the Number Game.
// Elements are found by prefix: <prefix>-progress, -streak, -best, -question,
// -answers, -feedback, -next, -restart, and an optional -card.
function createQuiz(prefix, { onFinish } = {}) {
  const el = (name) => $(prefix + '-' + name);
  let questions = [];
  let index = 0, score = 0, streak = 0, best = 0, bestKey = '';
  let answered = false, finished = false, restartWith = null;
  function updateScore() {
    el('streak').textContent = 'STREAK: ' + streak;
    el('best').textContent = 'BEST: ' + best + ' / ' + questions.length;
  }
  function hideCard() {
    const card = el('card');
    if (card) { card.hidden = true; card.textContent = ''; }
  }
  function show(moveFocus) {
    answered = false;
    const item = questions[index];
    el('progress').textContent = 'QUESTION ' + (index + 1) + ' OF ' + questions.length;
    el('question').textContent = item.question;
    el('feedback').textContent = 'Choose one answer.';
    el('next').hidden = true;
    el('next').textContent = index === questions.length - 1 ? 'SEE RESULTS ↗' : 'NEXT QUESTION ↗';
    hideCard();
    const grid = el('answers');
    grid.replaceChildren();
    shuffle(item.answers).forEach((answer) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer';
      button.textContent = answer;
      button.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const correct = answer === item.correct;
        if (correct) { score++; streak++; } else { streak = 0; }
        grid.querySelectorAll('button').forEach((other) => {
          other.disabled = true;
          if (other.textContent === item.correct) other.classList.add('correct');
          if (other === button && !correct) other.classList.add('wrong');
        });
        el('feedback').textContent = correct ? 'CORRECT! Keep the streak alive.' : 'GOOD TRY! The answer is ' + item.correct + '.';
        const card = el('card');
        if (card && correct && item.card) { card.textContent = 'PLAYER CARD: ' + item.card; card.hidden = false; }
        el('next').hidden = false;
        el('next').focus();
        updateScore();
      });
      grid.appendChild(button);
    });
    if (moveFocus) grid.querySelector('button')?.focus();
    updateScore();
  }
  // source: an array (shuffled each run) or a function returning a fresh question list.
  function start(source, key, moveFocus = false) {
    restartWith = () => start(source, key, true);
    questions = typeof source === 'function' ? source() : shuffle(source);
    bestKey = key;
    best = Number(storage.get(bestKey, 0)) || 0;
    index = 0; score = 0; streak = 0; finished = false;
    show(moveFocus);
  }
  el('next').addEventListener('click', () => {
    if (!answered || finished) return;
    index++;
    if (index < questions.length) { show(true); return; }
    finished = true;
    if (score > best) { best = score; storage.set(bestKey, best); }
    if (onFinish) onFinish(score, questions.length);
    el('progress').textContent = 'FINAL SCORE';
    el('question').textContent = score + ' / ' + questions.length + ' — ' + (score === questions.length ? 'PERFECT GAME!' : 'GREAT RUN!');
    el('answers').replaceChildren();
    hideCard();
    el('feedback').textContent = 'Your best score stays on this device. Hit RESTART to play again.';
    el('next').hidden = true;
    el('restart').focus();
    updateScore();
  });
  el('restart').addEventListener('click', () => { if (restartWith) restartWith(); });
  return { start };
}

const trivia = createQuiz('trivia', { onFinish: () => earnBadge('trivia') });
function startDeck(deckId, moveFocus = false) {
  const deck = decks[deckId];
  document.querySelectorAll('[data-deck]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.deck === deckId)));
  if (deck) {
    $('trivia-deck-intro').textContent = deck.label + ' DECK — ' + deck.intro;
    trivia.start(deck.questions, 'triviaBest:' + deckId, moveFocus);
  } else {
    $('trivia-deck-intro').textContent = 'MIXED DECK — ten questions from all three decks.';
    const all = Object.values(decks).flatMap((d) => d.questions);
    trivia.start(() => shuffle(all).slice(0, MIXED_COUNT), 'triviaBest', moveFocus);
  }
}
document.querySelectorAll('[data-deck]').forEach((button) => button.addEventListener('click', () => startDeck(button.dataset.deck, true)));
startDeck('mixed');

const numberGame = createQuiz('number', { onFinish: () => earnBadge('numbers') });
numberGame.start(numberBank, 'numberBest');

// The site is fully usable before any third-party 3D code is requested.
function scheduleArena() {
  const run = () => initArena({ canvas: $('scene'), stage: $('hero-stage'), toggle: $('motion'), reducedMotion });
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1800 });
  else window.setTimeout(run, 250);
}
if (document.readyState === 'complete') scheduleArena();
else window.addEventListener('load', scheduleArena, { once: true });
