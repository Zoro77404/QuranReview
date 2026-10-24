# PROGRESS
plan: none
phase: — GitHub Pages + PWA
status: done
tested: —
updated: 2026-10-25

## About
- Arabic Quran review game (Juz Tabarak + Juz Amma), static HTML/JS, RTL
- Hosted on GitHub Pages (main, root); PWA with service worker
- github: https://github.com/Zoro77404/QuranReview
- site: https://zoro77404.github.io/QuranReview/

## Done
- Published index.html (copy of quran-review-game.html) + manifest, 🐥 icons, sw.js

- Surah picker: no default, pulsing purple dropdown, start button grey until picked
- Hint circles play their ayah with the reciter (stop on close/switch)

## Map
- `quran-review-game.html` — original game file
- `index.html` — published copy + PWA tags; keep in sync with the original
- `sw.js` — cache name `quran-review-v6` (v3 was the 🎤 + map version, now rolled back); bump it when index.html changes
- `icons/` — generated from Segoe UI Emoji 🐥

## Decisions
- 🎤 + journey map rolled back here; that version lives in Zoro77404/QuranReview2 (test site https://zoro77404.github.io/QuranReview2/) (Desktop\QuranReview2)

## Later

## Next
None
