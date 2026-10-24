// مقارنة قراءتها بالآيات: تطبيع النص ثم محاذاة حرفاً بحرف وتقييم كل كلمة (أخضر / أحمر / رمادي)
(function (root) {
  const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g; // تشكيل، تطويل، علامات المصحف

  // تطبيع: بدون تشكيل، أ/إ/آ/ٱ → ا، ة → ه، ى → ي، والهمزات على كراسيها
  function norm(s) {
    return String(s).normalize('NFC').replace(MARKS, '')
      .replace(/[أإآٱٲٳ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
      .replace(/ک/g, 'ك').replace(/[یې]/g, 'ي').replace(/ھ/g, 'ه')
      .replace(/[^\u0621-\u064A]+/g, ' ').trim();
  }
  const words = s => { const t = norm(s); return t ? t.split(' ') : []; };

  // حروف يتلخبط فيها الأطفال أو المستمع: خطأ نصف
  const NEAR = ['تط', 'دض', 'سص', 'ذزظ', 'ثسذ', 'هح', 'قك', 'اعه', 'يا', 'وا', 'غخ', 'مب', 'من', 'لر', 'لن', 'سزش', 'جزد', 'كت', 'رغ', 'ثت'];
  const near = {};
  NEAR.forEach(g => { for (const a of g) for (const b of g) if (a !== b) near[a + b] = 1; });

  const CFG = { sub: 1, near: 0.5, del: 1, ins: 0.8, pass: 0.9, f0: 240, maxLen: 14 };
  // كم خطأ نسمح في الكلمة حسب طولها
  const tol = n => n <= 2 ? 1 : n <= 4 ? 1.5 : n <= 7 ? 2.5 : 3;

  // محاذاة شبه عامة: ما قرأته قبل الجواب أو بعده لا يُحسب عليها
  function align(E, R) {
    const n = E.length, m = R.length, W = m + 1;
    const D = new Float32Array((n + 1) * W), B = new Uint8Array((n + 1) * W);
    for (let i = 1; i <= n; i++) { D[i * W] = i * CFG.del; B[i * W] = 2; }
    for (let i = 1; i <= n; i++) {
      const e = E[i - 1];
      for (let j = 1; j <= m; j++) {
        const r = R[j - 1];
        const s = e === r ? 0 : near[e + r] ? CFG.near : CFG.sub;
        let v = D[(i - 1) * W + j - 1] + s, b = 1;
        const d = D[(i - 1) * W + j] + CFG.del; if (d < v) { v = d; b = 2; }
        const x = D[i * W + j - 1] + CFG.ins; if (x < v) { v = x; b = 3; }
        D[i * W + j] = v; B[i * W + j] = b;
      }
    }
    let j = 0;
    for (let k = 1; k <= m; k++) if (D[n * W + k] < D[n * W + j]) j = k;
    // لكل حرف متوقع: كلفته، وهل هو محذوف، وكم حرفاً زائداً قبله
    const cost = new Float32Array(n), del = new Uint8Array(n), insB = new Float32Array(n + 1);
    let i = n;
    while (i > 0) {
      const b = B[i * W + j];
      if (b === 1) { const e = E[i - 1], r = R[j - 1]; cost[i - 1] = e === r ? 0 : near[e + r] ? CFG.near : CFG.sub; i--; j--; }
      else if (b === 2) { cost[i - 1] = CFG.del; del[i - 1] = 1; i--; }
      else { insB[i] += CFG.ins; j--; }
    }
    return { cost, del, insB };
  }

  // exp: نصوص الآيات المتوقعة (بدون تشكيل) · heard: ما سمعه النموذج
  // يرجع لكل آية قائمة كلماتها مع الحالة: ok / bad / miss
  function grade(exp, heard, strict) {
    const ayahs = exp.map(words), W = [];
    ayahs.forEach((ws, a) => ws.forEach((w, k) => W.push({ a, k, w })));
    let E = '', R = words(heard).join('');
    const start = [];
    W.forEach(x => { start.push(E.length); E += x.w; });
    const { cost, del, insB } = align(E, R);
    let ok = 0;
    W.forEach((x, q) => {
      const s = start[q], n = x.w.length;
      let c = 0, d = 0;
      for (let t = s; t < s + n; t++) { c += cost[t]; d += del[t]; if (t > s) c += insB[t] / (strict ? 1 : 2); }
      if (strict) c += (insB[s] + insB[s + n]) / 2;
      x.st = c <= (strict ? 0.5 : tol(n)) ? 'ok' : d >= n / 2 ? 'miss' : 'bad';
      if (x.st === 'ok') ok++;
    });
    const out = ayahs.map(ws => ws.map(w => ({ w, st: 'miss' })));
    W.forEach(x => { out[x.a][x.k].st = x.st; });
    const pct = W.length ? ok / W.length : 0;
    return { ayahs: out, pct, pass: pct >= CFG.pass, ok, total: W.length };
  }

  // كلفة المحاذاة كاملة (كم تبعد قراءتها عن هذه الآيات)
  function dist(exp, heard) {
    const { cost, insB } = align(words(exp.join(' ')).join(''), words(heard).join(''));
    let c = 0;
    cost.forEach(v => c += v); insB.forEach(v => c += v);
    return c;
  }

  // الحكم: مثل grade، لكن إذا كانت قراءتها أقرب لآيات ثانية من نفس السورة (مثل الكافرون ٤ و٥)
  // نعتبرها قرأت آية تشبهها، ونلوّن الفروق بدقة. alts: مجموعات آيات بديلة بنفس العدد
  function judge(exp, heard, alts) {
    const g = grade(exp, heard);
    if (!g.pass || !alts || !alts.length) return g;
    const key = words(exp.join(' ')).join(''), c0 = dist(exp, heard);
    let best = Infinity;
    alts.forEach(a => { if (words(a.join(' ')).join('') !== key) best = Math.min(best, dist(a, heard)); });
    if (best >= c0 - Math.max(1.5, 0.15 * c0)) return g;
    const s = grade(exp, heard, true);
    s.pass = false; s.other = true;
    return s;
  }

  // يوزّع حالات كلمات النص البسيط على كلمات الرسم العثماني (عدد الكلمات قد يختلف: يا أيها = يَٰٓأَيُّهَا)
  function paint(uthmani, graded) {
    const toks = uthmani.split(/\s+/).filter(Boolean);
    const un = toks.map(norm).map(t => t.replace(/ /g, ''));
    let U = '', uw = [];
    un.forEach((t, k) => { for (const _ of t) uw.push(k); U += t; });
    let C = '', cs = [];
    graded.forEach(g => { for (const _ of g.w) cs.push(g.st); C += g.w; });
    // محاذاة بسيطة بين الرسمين
    const n = C.length, m = U.length, Wd = m + 1, D = new Uint16Array((n + 1) * Wd);
    for (let i = 0; i <= n; i++) D[i * Wd] = i;
    for (let j = 0; j <= m; j++) D[j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
      D[i * Wd + j] = Math.min(D[(i - 1) * Wd + j - 1] + (C[i - 1] === U[j - 1] ? 0 : 1), D[(i - 1) * Wd + j] + 1, D[i * Wd + j - 1] + 1);
    const hit = toks.map(() => []);
    let i = n, j = m;
    while (i > 0 && j > 0) {
      const v = D[i * Wd + j];
      if (v === D[(i - 1) * Wd + j - 1] + (C[i - 1] === U[j - 1] ? 0 : 1)) { hit[uw[j - 1]].push(cs[i - 1]); i--; j--; }
      else if (v === D[(i - 1) * Wd + j] + 1) i--;
      else j--;
    }
    return toks.map((t, k) => {
      const h = hit[k];
      if (!un[k]) return { t, st: '' };
      if (!h.length) return { t, st: 'miss' };
      const st = h.every(x => x === 'ok') ? 'ok' : h.every(x => x === 'miss') ? 'miss' : h.filter(x => x === 'ok').length >= h.length * 0.8 ? 'ok' : 'bad';
      return { t, st };
    });
  }

  // تقطيع التسجيل عند الوقفات: النموذج تدرّب على آية آية، فالمقاطع القصيرة تُفهم أحسن
  // يرجع قائمة [بداية، نهاية] بالعينات
  function segments(x, sr, o) {
    o = Object.assign({ gap: 0.35, maxLen: 8, pad: 0.15 }, o);
    const hop = Math.round(sr * 0.02), nF = Math.floor(x.length / hop);
    if (nF < 5) return [];
    const db = new Float32Array(nF);
    for (let f = 0; f < nF; f++) {
      let s = 0;
      for (let t = f * hop; t < (f + 1) * hop; t++) s += x[t] * x[t];
      db[f] = 10 * Math.log10(s / hop + 1e-10);
    }
    const srt = Array.from(db).sort((a, b) => a - b);
    const floor = srt[Math.floor(nF * 0.1)], peak = srt[Math.floor(nF * 0.98)];
    if (peak < -55) return [];                                   // صمت
    if (peak - floor < 10) return [[0, x.length]];               // ما فيه وقفات واضحة
    const thr = floor + (peak - floor) * 0.3;
    // مناطق الصوت، مع سدّ الفراغات القصيرة
    const gapF = Math.round(o.gap / 0.02), reg = [];
    let f = 0;
    while (f < nF) {
      if (db[f] <= thr) { f++; continue; }
      let s = f, e = f, quiet = 0;
      while (f < nF && quiet < gapF) { if (db[f] > thr) { e = f; quiet = 0; } else quiet++; f++; }
      if (e - s >= 5) reg.push([s, e + 1]);                       // تجاهل الطقّات القصيرة
    }
    // نضم المناطق المتجاورة إلى مقاطع لا تزيد عن maxLen ثانية
    const maxF = o.maxLen / 0.02, out = [];
    reg.forEach(r => {
      const c = out[out.length - 1];
      if (c && r[1] - c[0] <= maxF) c[1] = r[1]; else out.push(r.slice());
    });
    const padS = Math.round(o.pad * sr);
    return out.map(([s, e]) => [Math.max(0, s * hop - padS), Math.min(x.length, e * hop + padS)]);
  }

  // طبقة الصوت التقريبية (Hz) بالارتباط الذاتي على إطارات مختارة
  function pitch(x, sr) {
    const fr = Math.round(sr * 0.04), lo = Math.floor(sr / 500), hi = Math.ceil(sr / 70), res = [];
    let peak = 0;
    for (let i = 0; i < x.length; i += 64) peak = Math.max(peak, Math.abs(x[i]));
    const step = Math.max(fr, Math.floor(x.length / 300));
    for (let i = 0; i + fr + hi < x.length; i += step) {
      let e = 0;
      for (let t = 0; t < fr; t++) e += x[i + t] * x[i + t];
      if (Math.sqrt(e / fr) < peak * 0.08) continue;
      let best = 0, k = 0;
      for (let l = lo; l <= hi; l++) {
        let c = 0;
        for (let t = 0; t < fr; t++) c += x[i + t] * x[i + t + l];
        if (c > best) { best = c; k = l; }
      }
      if (k && best > 0.35 * e) res.push(sr / k);
    }
    if (res.length < 5) return 0;
    res.sort((a, b) => a - b);
    return res[res.length >> 1];
  }

  // صوت الطفل أعلى من أصوات القرّاء: نخفضه ونبطئه قليلاً قبل النموذج
  function lower(x, sr) {
    const f0 = pitch(x, sr), f = Math.min(1.5, Math.max(1, f0 / CFG.f0));
    if (f < 1.05) return { x, f: 1, f0 };
    const n = Math.floor(x.length * f), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = i / f, k = p | 0, t = p - k; y[i] = x[k] * (1 - t) + (x[k + 1] || 0) * t; }
    return { x: y, f, f0 };
  }

  const api = { norm, words, grade, judge, paint, segments, pitch, lower, CFG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Match = api;
})(this);
