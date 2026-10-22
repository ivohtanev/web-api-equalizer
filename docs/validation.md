# Validation — 2026-10-22

`npm run check` passes TypeScript validation, 18 tests, formatting and the
production bundle build. Dependency installation reported zero vulnerabilities.

Automated coverage includes portable profiles and independent preset edits,
filter-response estimation, graph routing and smoothing, compressor bypass,
serialized setting updates, separate tab sessions, restricted-page errors,
failed activation cleanup, ended tracks, capture timeout and late-track cleanup,
and popup control bindings.

The built unpacked extension was also loaded in an isolated Brave profile
(reported Chromium engine 155.0.8059.85). Browser automation verified:

- Successful extension and service-worker loading.
- Direct popup rendering with ten sliders and no JavaScript page errors.
- Music edits surviving switches to Podcast and back.
- Edited gains surviving a popup page reload through real extension storage.
- Restore defaults affecting the selected preset.
- A readable error when enabling from an unsupported extension page.

The screenshot in this folder comes from that browser run. This verifies real
extension rendering, messaging and persistence. Audio capture lifecycle tests
use simulated browser APIs. Actual toolbar-invoked audio capture, audible DSP,
multi-tab playback and protected media still need the listening checks in the
README before publication. No claim is made that all websites permit capture.

The original Open YouTube Tools checkout remained clean on
`codex/simplify-eq-approaches`, at commit
`44f867ee2ae0a7b55275fd9ecbad0e3c2dcac823`.
