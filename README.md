# Ethan's Arena

A lightweight, interactive sports-and-adventure homepage. No accounts, forms, analytics, or user tracking.

## Features
- Three.js football, basketball, and hockey puck arena with a static fallback
- Basketball shot-timing mini-game and sports trivia
- Team theme switcher for Bengals, Warriors, and Golden Knights
- Locally saved personal bests, theme choice, and achievement badges
- Responsive layout, keyboard controls, reduced-motion support, accessible focus states

## Run locally
Open `index.html` in a browser. For more reliable ES-module behavior, start a local HTTP server:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/.

## Deployment
This repository contains a standalone `index.html`; no build system is needed. A live deployment has **not** been verified. Enable hosting only after reviewing site visibility and checking the site on mobile and desktop.

## Validation checklist
- [ ] Open at desktop, 390px, and 320px; verify navigation and hero fit
- [ ] Test trivia and shooting with touch and keyboard
- [ ] Reload to confirm theme, personal bests, and badges persist locally
- [ ] Test reduced motion, WebGL disabled, and disconnected CDN behavior
- [ ] Check browser console and network errors
- [ ] Check accessibility with keyboard and screen reader

## Privacy
The site intentionally includes no identifying details about the child, login, analytics, or data submission. Browser localStorage holds only local preferences and game progress. Avoid adding photos, school details, precise location information, or unlicensed team graphics.

## Implementation notes
Three.js is version-pinned and loaded after the window load event. The official ES module is used, rather than assuming a separate `three.module.min.js` distribution exists. Animation is paused when the page is hidden or the hero is not visible.
