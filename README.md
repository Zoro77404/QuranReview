# مراجعة تبارك وعمّ 🐥

لعبة لمراجعة حفظ جزء تبارك وجزء عمّ (من سورة الملك إلى سورة الناس).

**افتحيها من الجوال:** https://zoro77404.github.io/QuranReview/

ثم من قائمة المتصفح اختاري «إضافة إلى الشاشة الرئيسية» لتصير مثل التطبيق، وتشتغل بدون إنترنت بعد أول فتح (الصوت يحتاج إنترنت).

---

## For the developer

- This repo is the **live** site (GitHub Pages from `main`, root). Everything pushed here reaches her phone.
- The newer version with 🎤 reading check + 🗺️ journey map is kept apart in the test repo
  [Zoro77404/QuranReview2](https://github.com/Zoro77404/QuranReview2) (`Desktop\QuranReview2`) until it is ready.
  Test site: https://zoro77404.github.io/QuranReview2/
- After changing `index.html`, keep `quran-review-game.html` in sync and bump `CACHE` in `sw.js` so phones update.
