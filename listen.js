// الاستماع لقراءتها: تسجيل بالمايك، تحويل الصوت إلى 16 kHz أحادي، ثم تحويله إلى نص
// بنموذج ترتيل (whisper-tiny-ar-quran) داخل المتصفح — WebGPU إن وُجد وإلا WASM.
// مع WebGPU: المُرمِّز (الجزء الثقيل) fp32 على كرت الشاشة، والمفكّك q8 على WASM — أسرع بمرتين من q8 كله على WASM،
// لأن q8 على WebGPU بطيء جداً (جرّبناه: أبطأ ٦ مرات).
// النموذج يتنزّل أول مرة فقط، وبعدها يبقى في ذاكرة المتصفح (Cache Storage).
(function () {
  const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
  const MODEL = 'whisper-tiny-ar-quran', SR = 16000, CACHE = 'transformers-cache';
  // [الملف، حجمه بعد فك الضغط، وزنه في شريط التقدم (تقريباً حجم التنزيل)]
  const FILES = [['config.json', 1219], ['generation_config.json', 3772], ['preprocessor_config.json', 356],
    ['tokenizer_config.json', 20525], ['tokenizer.json', 3653235, 1e6], ['onnx/decoder_model_merged_quantized.onnx', 30182187]];
  const ENC = { webgpu: ['onnx/encoder_model.onnx', 32877590], wasm: ['onnx/encoder_model_quantized.onnx', 10165184] };
  const WASM = { '.asyncify': [26861777, 5.6e6], '': [14264838, 2.7e6] };
  const OPT = { language: 'arabic', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 };
  const base = () => new URL('models/', location.href).href;
  let T, asr, loading, device, prog, noStore = false;

  const noGpu = () => { try { localStorage.setItem('qgame_nogpu', '1'); } catch (e) {} };
  async function gpuOK() {
    try { if (localStorage.getItem('qgame_nogpu')) return false; } catch (e) {}
    if (!navigator.gpu) return false;
    try {
      const a = await navigator.gpu.requestAdapter();
      return !!a && !(a.isFallbackAdapter || (a.info && a.info.isFallbackAdapter)); // كرت شاشة حقيقي، مو محاكاة بطيئة
    } catch (e) { return false; }
  }

  // تنزيل ملف مع التقدم وحفظه بنفس المفتاح اللي تدوّر عليه transformers.js
  async function fetchTo(cache, url, size, onBytes) {
    if (await cache.match(url)) return onBytes(size);
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    const parts = [];
    if (r.body && r.body.getReader) {
      const rd = r.body.getReader();
      let got = 0;
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        parts.push(value); got += value.length; onBytes(Math.min(got, size));
      }
    } else parts.push(await r.arrayBuffer());
    const blob = new Blob(parts);
    try {
      await cache.put(url, new Response(blob, { headers: {
        'content-type': r.headers.get('content-type') || 'application/octet-stream', 'content-length': String(blob.size) } }));
    } catch (e) { noStore = true; } // ما فيه مساحة أو تخزين ممنوع: نكمل بدون حفظ
    onBytes(size);
  }

  const make = dev => T.pipeline('automatic-speech-recognition', MODEL, dev === 'webgpu'
    ? { dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' }, device: { encoder_model: 'webgpu', decoder_model_merged: 'wasm' } }
    : { dtype: 'q8', device: 'wasm' });
  async function toWasm() { noGpu(); device = 'wasm'; asr = await make('wasm'); }

  async function boot() {
    T = await import(TJS);
    const e = T.env, ort = e.backends.onnx;
    e.allowLocalModels = true; e.allowRemoteModels = false;
    e.localModelPath = base();
    device = (await gpuOK()) ? 'webgpu' : 'wasm';
    // بدون WebGPU نستخدم نسخة WASM الأصغر
    let kind = '.asyncify';
    const ver = ort && ort.versions && ort.versions.web;
    if (ver && ort.wasm) {
      if (device === 'wasm') kind = '';
      const pre = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ver}/dist/ort-wasm-simd-threaded${kind}`;
      ort.wasm.wasmPaths = { mjs: pre + '.mjs', wasm: pre + '.wasm' };
    }
    const list = FILES.concat([ENC[device]]).map(([f, n, w]) => [base() + MODEL + '/' + f, n, w || n]);
    if (ort && ort.wasm && ort.wasm.wasmPaths && ort.wasm.wasmPaths.wasm) list.unshift([ort.wasm.wasmPaths.wasm, WASM[kind][0], WASM[kind][1]]);
    const all = list.reduce((s, f) => s + f[2], 0), got = list.map(() => 0);
    const tick = () => prog && prog(Math.min(0.99, list.reduce((s, f, i) => s + f[2] * got[i] / f[1], 0) / all));
    tick();
    let cache = null;
    try { cache = typeof caches !== 'undefined' ? await caches.open(CACHE) : null; } catch (err) {}
    if (cache) {
      const q = list.map((f, i) => [f, i]);
      await Promise.all([0, 1].map(async () => {
        while (q.length) { const [[u, n], i] = q.shift(); await fetchTo(cache, u, n, b => { got[i] = b; tick(); }); }
      }));
    } else noStore = true;
    if (noStore) e.useBrowserCache = false;
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (err) {}
    // تجربة قصيرة: تسخّن النموذج وتكشف مشاكل WebGPU من البداية
    let p;
    try { p = await make(device); await p(new Float32Array(SR), OPT); }
    catch (err) { if (device !== 'webgpu') throw err; noGpu(); device = 'wasm'; p = await make('wasm'); }
    asr = p;
    prog && prog(1);
  }

  function load(onProgress) {
    if (onProgress) prog = onProgress;
    if (asr) return Promise.resolve();
    if (!loading) loading = boot().catch(err => { loading = null; asr = null; throw err; });
    return loading;
  }

  async function cached() {
    try {
      if (typeof caches === 'undefined') return false;
      const c = await caches.open(CACHE);
      return !!(await c.match(base() + MODEL + '/onnx/decoder_model_merged_quantized.onnx'));
    } catch (e) { return false; }
  }

  // ===== التسجيل =====
  let rec, stream, chunks, actx, src, raf;
  const AC = window.AudioContext || window.webkitAudioContext, ua = navigator.userAgent;
  const APPLE = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    || /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
  // لازم تنادى مباشرة من ضغطة الزر (سفاري)
  function unlock() {
    try { if (!actx && AC) actx = new AC(); if (actx && actx.state === 'suspended') actx.resume(); } catch (e) {}
  }

  async function start(onLevel) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    // آيفون/سفاري: mp4 (AAC) هو الأضمن للتسجيل وفك الصوت · أندرويد/كروم: webm (Opus)
    const types = APPLE ? ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    const type = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.start(1000);
    // مؤشر صوتها حول الزر
    try {
      src = actx.createMediaStreamSource(stream);
      const an = actx.createAnalyser(), buf = new Uint8Array(512);
      an.fftSize = 512; src.connect(an);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let m = 0;
        for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128));
        onLevel && onLevel(m / 128);
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {}
  }

  function cleanup() {
    cancelAnimationFrame(raf);
    try { src && src.disconnect(); } catch (e) {}
    src = null;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  function stop() {
    return new Promise((res, rej) => {
      const r = rec;
      if (!r) return rej(new Error('not recording'));
      rec = null;
      r.onstop = () => {
        cleanup();
        decode(new Blob(chunks, { type: r.mimeType || 'audio/webm' })).then(res, rej);
      };
      try { r.stop(); } catch (e) { cleanup(); rej(e); }
    });
  }

  function cancel() {
    const r = rec;
    rec = null;
    if (r) { r.onstop = null; try { r.stop(); } catch (e) {} }
    cleanup();
  }

  // فك التسجيل (webm/opus أو mp4/aac) ثم 16 kHz أحادي
  async function decode(blob) {
    const ab = await blob.arrayBuffer();
    if (!actx) actx = new AC();
    const buf = await new Promise((res, rej) => {
      const p = actx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
    const n = Math.max(1, Math.ceil(buf.duration * SR));
    try {
      const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, oc = new OC(1, n, SR);
      const s = oc.createBufferSource();
      s.buffer = buf; s.connect(oc.destination); s.start(0);
      const out = await new Promise((res, rej) => {
        oc.oncomplete = e => res(e.renderedBuffer);
        const p = oc.startRendering();
        if (p && p.then) p.then(res, rej);
      });
      return out.getChannelData(0).slice();
    } catch (e) {
      const ch = buf.numberOfChannels, len = buf.length, mono = new Float32Array(len), r = buf.sampleRate / SR, y = new Float32Array(n);
      for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
      for (let i = 0; i < n; i++) { const p = i * r, k = p | 0, t = p - k; y[i] = (mono[k] || 0) * (1 - t) + (mono[k + 1] || 0) * t; }
      return y;
    }
  }

  // صوت → نص: نخفض صوت الطفلة قليلاً، نقطّع عند الوقفات، ونسمع كل مقطع
  async function transcribe(pcm, onStep) {
    await load();
    const lw = Match.lower(pcm, SR), segs = Match.segments(lw.x, SR, { maxLen: Match.CFG.maxLen * lw.f });
    let text = '';
    for (let i = 0; i < segs.length; i++) {
      onStep && onStep(i, segs.length);
      const x = lw.x.slice(segs[i][0], segs[i][1]);
      let out;
      try { out = await asr(x, OPT); }
      catch (err) { if (device !== 'webgpu') throw err; await toWasm(); out = await asr(x, OPT); }
      text += ' ' + out.text;
    }
    return text.trim();
  }

  window.Listen = {
    supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && AC),
    get ready() { return !!asr; },
    get device() { return device; },
    unlock, load, cached, start, stop, cancel, transcribe, decode,
  };
})();
