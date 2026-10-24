# PROGRESS
plan: none
phase: — 🎤 reading check + journey map
status: done
tested: 🎤 + map (local Chrome e2e, phone viewport)
updated: 2026-10-24

## About
- Arabic Quran review game for a girl (Juz Tabarak + Juz Amma), static HTML/JS, RTL, feminine wording
- Hosted on GitHub Pages (main, root, .nojekyll); PWA with service worker
- Speech: Transformers.js 4.3.1 (jsDelivr `dist/transformers.min.js`), model mirrored in `models/`
- github: https://github.com/Zoro77404/QuranReview
- site: https://zoro77404.github.io/QuranReview/

## Done
- Published index.html (copy of quran-review-game.html) + manifest, 🐥 icons, sw.js
- 🎤 listen & grade: MediaRecorder → 16 kHz → whisper-tiny-ar-quran → word colors, ≥90% = auto point
- 🗺️ journey map (67→114 islands, 0–3 ⭐), growing mascot 🥚→🦅, daily streak 🔥, all in localStorage

## Map
- `index.html` — game + map + mic UI; `quran-review-game.html` = same minus PWA tags (keep in sync)
- `match.js` — normalize, char-level alignment, per-word ok/bad/miss, look-alike ayah check, pause segmentation, kid-voice lowering
- `listen.js` — model download (progress bar, Cache Storage `transformers-cache`), recording, decode, transcribe
- `data/quran-simple-clean-67-114.json` — alquran.cloud quran-simple-clean, bismillah stripped
- `models/whisper-tiny-ar-quran/` — ONNX (from Sharjeelbaig/whisper-tiny-ar-quran-onnx), see SOURCE.md
- `sw.js` — cache `quran-review-v3`; bump when app files change; skips /models/
- localStorage: `qgame_progress_v1` (stars, streak, day, stage, at, N), `qgame_v2` (uthmani text), `qgame_nogpu`

## Decisions
- Existing ONNX on HF used (no conversion); mirrored in repo so it can't disappear
- WebGPU: fp32 encoder on GPU + q8 decoder on WASM (q8 on WebGPU was 6× slower); else all q8 WASM
- Tuning (Node harness, 84 clips: reciters, pitch-shifted "kid" voices, real kids chorus, wrong/partial/look-alike readings):
  split at pauses (≤14 s), lower high voices (f0/240, max 1.5×), lenient per-word tolerance + near letters
- Kid's chorus (Minshawy teacher recordings) still only ~30% pass → backup buttons stay

## Later
- Real recordings of her voice would allow better tuning (CFG in match.js)

## Next
None
