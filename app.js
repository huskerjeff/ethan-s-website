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

// Verified evergreen sports trivia: no live data, APIs, or tracking.
const questionBank = [
  { question: 'How many points is a shot from beyond the NBA three-point line?', answers: ['2 points', '3 points', '4 points', '5 points'], correct: '3 points' },
  { question: 'Which sport uses a puck?', answers: ['Basketball', 'Baseball', 'Ice hockey', 'Football'], correct: 'Ice hockey' },
  { question: 'What is the Cincinnati Bengals fan chant?', answers: ['Who Dey', 'Go Pack Go', 'Fly Eagles Fly', 'Skol'], correct: 'Who Dey' },
  { question: 'What is Stephen Curry famous for?', answers: ['Three-point shooting', 'Goalkeeping', 'Pitching', 'Faceoffs'], correct: 'Three-point shooting' },
  { question: 'What is the Golden State Warriors fan community often called?', answers: ['Dub Nation', 'The Dawg Pound', 'Raider Nation', 'The 12s'], correct: 'Dub Nation' },
  { question: 'How many points is an NFL touchdown worth before the extra point?', answers: ['3', '4', '6', '7'], correct: '6' }
];
let triviaQuestions = [];
let questionIndex = 0;
let triviaScore = 0;
let triviaStreak = 0;
let triviaAnswered = false;
let triviaFinished = false;
let triviaBest = Number(storage.get('triviaBest', 0)) || 0;
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function updateTriviaScore() {
  $('trivia-streak').textContent = 'STREAK: ' + triviaStreak;
  $('trivia-best').textContent = 'BEST: ' + triviaBest + ' / ' + questionBank.length;
}
function showQuestion() {
  triviaAnswered = false;
  const q = triviaQuestions[questionIndex];
  $('trivia-progress').textContent = 'QUESTION ' + (questionIndex + 1) + ' OF ' + triviaQuestions.length;
  $('trivia-question').textContent = q.question;
  $('trivia-feedback').textContent = 'Choose one answer.';
  $('trivia-next').hidden = true;
  $('trivia-next').textContent = questionIndex === triviaQuestions.length - 1 ? 'SEE RESULTS ↗' : 'NEXT QUESTION ↗';
  const grid = $('trivia-answers');
  grid.replaceChildren();
  shuffle(q.answers).forEach((answer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer';
    button.textContent = answer;
    button.addEventListener('click', () => {
      if (triviaAnswered) return;
      triviaAnswered = true;
      const correct = answer === q.correct;
      if (correct) { triviaScore++; triviaStreak++; } else { triviaStreak = 0; }
      grid.querySelectorAll('button').forEach((item) => {
        item.disabled = true;
        if (item.textContent === q.correct) item.classList.add('correct');
        if (item === button && !correct) item.classList.add('wrong');
      });
      $('trivia-feedback').textContent = correct ? 'CORRECT! Keep the streak alive.' : 'GOOD TRY! The answer is ' + q.correct + '.';
      $('trivia-next').hidden = false;
      updateTriviaScore();
    });
    grid.appendChild(button);
  });
  updateTriviaScore();
}
function startTrivia() {
  triviaQuestions = shuffle(questionBank);
  questionIndex = 0; triviaScore = 0; triviaStreak = 0; triviaFinished = false;
  showQuestion();
}
$('trivia-next').addEventListener('click', () => {
  if (!triviaAnswered || triviaFinished) return;
  questionIndex++;
  if (questionIndex < triviaQuestions.length) { showQuestion(); return; }
  triviaFinished = true;
  if (triviaScore > triviaBest) { triviaBest = triviaScore; storage.set('triviaBest', triviaBest); }
  earnBadge('trivia');
  $('trivia-progress').textContent = 'FINAL SCORE';
  $('trivia-question').textContent = triviaScore + ' / ' + triviaQuestions.length + ' — ' + (triviaScore === triviaQuestions.length ? 'PERFECT GAME!' : 'GREAT RUN!');
  $('trivia-answers').replaceChildren();
  $('trivia-feedback').textContent = 'Your best score stays on this device. Hit RESTART TRIVIA to play again.';
  $('trivia-next').hidden = true;
  updateTriviaScore();
});
$('trivia-restart').addEventListener('click', startTrivia);
startTrivia();

// The site is fully usable before any third-party 3D code is requested.
function scheduleArena() {
  const run = () => initArena({ canvas: $('scene'), stage: $('hero-stage'), toggle: $('motion'), reducedMotion });
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1800 });
  else window.setTimeout(run, 250);
}
if (document.readyState === 'complete') scheduleArena();
else window.addEventListener('load', scheduleArena, { once: true });
