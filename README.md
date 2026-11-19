# Ethan's Arena

A handcrafted, sports-inspired personal website celebrating Ethan's favorite teams, flag football, and Las Vegas adventures with Dad. It is designed as a playful clubhouse rather than a team storefront.

## What's inside

- Original responsive night-arena art direction, with team-color themes for the Bengals, Warriors, and Golden Knights
- Optional, procedurally generated Three.js football, basketball, and hockey puck scene
- **Shoot the Three:** keyboard/touch timing game, ten shots per round, device-local personal best
- **Quiz Hall:** Trivia Blitz with Football, Basketball and Hockey decks (8 questions each, 24 total) plus a Mixed deck of 10; best score saved per deck on this device
- **Number Game:** match six players to their jersey numbers; a player card appears on each correct answer
- Four achievement badges unlocked by exploring and playing
- A personal flag-football / Curry / Vegas-with-Dad strip and expandable adventure prompts
- Optional, **off by default** synthesized swish sound
- Reduced-motion, keyboard-focus, WebGL failure, and mobile fallbacks

No analytics, cookies, accounts, contact forms, ad pixels, location requests, player photos, or team logos are included. High scores, theme, and badges use only this browser's localStorage and continue to work if storage is unavailable.

## Local preview

Serve the folder over HTTP because the site uses local ES modules:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/ . No framework, package installation, or build step is required to run the website. The Three.js enhancement and web fonts use third-party CDNs; if they cannot load, the static website and games remain usable.

## Test

Node.js 22+ is recommended:

```bash
npm test
node --check app.js
node --check arena.js
```

The tests are dependency-free static smoke checks. They do **not** replace a real browser, screen-reader, keyboard, or device review. A GitHub Actions workflow runs the same checks on pull requests.

## Deployment / preview

The repository is currently public, but **no production deployment is configured by this change**. To publish through GitHub Pages, an authorized repository administrator can enable Pages in **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, and save **after** the pull request has been reviewed and merged. The expected URL would then be `https://huskerjeff.github.io/ethan-s-website/`, but it must be verified rather than assumed live.

Alternatively, a private preview can be hosted through a provider chosen by the owner. Do not make the repository private/public, enable publishing, or change sharing without authorization.

## Project structure

- `index.html` — accessible semantic content and game controls
- `styles.css` — responsive art direction, team themes, and reduced-motion styles
- `app.js` — games, trivia, badges, themes, device-local persistence, optional audio
- `arena.js` — lazy Three.js enhancement with static and low-power fallbacks
- `favicon.svg` — original site mark
- `tests/site.test.mjs` — dependency-free smoke tests
- `.github/workflows/validate.yml` — PR checks

## Accessibility and privacy

The main navigation, game controls, trivia answers, and expandable adventure cards work without a mouse. There is a skip link, clear focus outlines, status messages, 44px minimum interactive targets, and a `prefers-reduced-motion` off-ramp. Sound never autoplays and starts off. There are no personally identifying details such as a surname, school, age, address, or travel dates.

Before publishing, manually verify desktop and mobile (320px, 390px, tablet), keyboard traversal, screen-reader announcements, and WebGL on/off. Do not add real-time game data without checking source rights, licensing, accuracy, and child privacy.

## Design review

This update responds to the Nov 18, 2026 Muse source-only review. The original sports-broadcast palette and lightweight static-site architecture are preserved. The review's suggested `three.module.min.js` URL is **not used without verification**: instead, the pinned `three.module.js` is fetched only after the page loads and the hero becomes visible, and animation pauses when off-screen or in a hidden tab. Deployment remains a separate owner-controlled decision.
