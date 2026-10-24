# whisper-tiny-ar-quran (ONNX)

Speech-to-text model used by the 🎤 button, run in the browser with Transformers.js.

- Original model: [tarteel-ai/whisper-tiny-ar-quran](https://huggingface.co/tarteel-ai/whisper-tiny-ar-quran) (Apache-2.0)
- ONNX export used as-is (no re-conversion needed): [Sharjeelbaig/whisper-tiny-ar-quran-onnx](https://huggingface.co/Sharjeelbaig/whisper-tiny-ar-quran-onnx), converted with Optimum, dynamic q8 quantization
- Mirrored here so the app does not depend on a third-party repo staying online

| File | Used for | SHA-256 |
| --- | --- | --- |
| `onnx/encoder_model_quantized.onnx` | encoder, WASM (q8) | `965e0ca31daf589ffb572e8b6deb1a4e65ad72221c1873c952331ff1c52f50c1` |
| `onnx/encoder_model.onnx` | encoder, WebGPU (fp32) | `f0c604c7ea767c1eab1d26df50dbc3afa861cc28a1a68bd965e6b9e897c5b5c8` |
| `onnx/decoder_model_merged_quantized.onnx` | decoder, always WASM (q8) | `06a5c4409988b9ae7747bd55cf81e3851e3f2238536c86467963e0241464f652` |

Why two encoders: q8 runs well on WASM but is ~6× slower on WebGPU, so WebGPU devices get the
fp32 encoder on the GPU (≈2× faster overall) and keep the q8 decoder on WASM.
