# Stable Cross-Device Face Liveness

## Goal

Make enrollment and attendance liveness reliable on supported mobile browsers and Capacitor WebViews, reduce pose jitter, recover safely from MediaPipe failures, and give users actionable errors without weakening biometric checks.

## Implementation tasks

- [ ] **1. Establish a measurable baseline.** Add non-sensitive diagnostics for model load duration, selected delegate, inference duration, FPS, face count, phase transitions, and failure codes in `googleLivenessTracker.ts`; never log images, landmarks, vectors, names, or account identifiers. → **Verify:** a test scan emits one initialization event, bounded inference summaries, and one terminal result without sensitive data.

- [ ] **2. Make model loading deterministic.** Pin the MediaPipe JavaScript and WASM artifacts to the same exact version, self-host/cache the WASM and face-landmarker model, validate the asset response before initialization, and remove the current `1.0.1`/`0.10.14` mismatch. → **Verify:** enrollment starts with external CDN access blocked after the application assets have been cached.

- [ ] **3. Add delegate and lifecycle recovery.** Attempt GPU initialization with a timeout, close the failed instance, retry once with CPU, stop inference after repeated runtime failures, and pause/reinitialize camera and model state on visibility/Capacitor background-resume events. → **Verify:** forced GPU failure reaches CPU-ready state; backgrounding and resuming does not leave a frozen preview or duplicate camera stream.

- [ ] **4. Move inference off the interaction loop.** Process only new video frames at a capped 10–15 FPS, use a Web Worker where supported, downscale liveness input to `320×240` or `480×360`, and retain a separate image up to 640 px for final InsightFace verification. → **Verify:** controls remain responsive during scanning and only one inference can be in flight.

- [ ] **5. Replace raw frame decisions with a stable pose state machine.** Use MediaPipe facial transformation matrices for yaw/pitch, calibrate a neutral pose from one second of stable samples, median-filter the last 5–7 samples, apply an EMA around `0.25`, introduce enter/exit hysteresis, require 600–800 ms dwell time, and tolerate dropouts up to 200 ms. Completed phases must never regress. → **Verify:** synthetic noisy pose sequences do not flicker state or pass without the required continuous movement.

- [ ] **6. Separate identity-quality gates.** Run the smoothed landmarker with one primary face, perform lower-frequency multiple-face detection, block dark and overexposed frames, require minimum face size/centering, reject blur or obstruction where measurable, and recheck face count and quality on the final captured frame. → **Verify:** no face, two faces, distant face, dark frame, glare, and valid single-face fixtures produce distinct outcomes.

- [ ] **7. Improve the challenge and error UX.** Randomize left/right movement, optionally add blink using blendshapes, debounce instructions, show phase-specific recovery guidance, and map internal failures to stable codes such as `FACE-MODEL-01`, `FACE-CAMERA-02`, and `FACE-SERVER-03`. Keep “multiple people visible,” “face mismatch,” and “face already registered” as separate messages. → **Verify:** raw MediaPipe, browser, Supabase, and InsightFace errors never appear in the UI and every recoverable error has a retry action.

- [ ] **8. Close failure paths in enrollment and attendance.** Catch final `enroll_own_face` rejections, always clear processing state, preserve the database’s atomic duplicate check, prevent partial success messaging, and ensure a failed scan never records attendance. Treat replacing the browser-supplied attendance score with a signed server verification proof as a required security follow-up before production. → **Verify:** duplicate races, network loss, timeout, model crash, and server rejection all fail closed and return the interface to a retryable state.

- [ ] **9. Run automated and real-device verification last.** Add unit tests for filtering/hysteresis/state transitions, component tests for recovery/error mapping, and end-to-end scans for enrollment and attendance. Test recent Chrome/Android, a low-end Android device, Android System WebView/Capacitor, and Safari/iOS; record delegate, FPS, completion time, failure code, and thermal behavior. → **Verify:** production build and security tests pass, valid users complete liveness within 10 seconds in normal lighting, instructions do not visibly oscillate, and unsupported devices fail with a clear fallback message.

## Done when

- [ ] MediaPipe JS, WASM, and model assets are pinned, compatible, and locally cached.
- [ ] GPU failure automatically falls back to CPU without requiring an app restart.
- [ ] Pose decisions use calibration, smoothing, hysteresis, and time-based holds.
- [ ] Multiple faces and poor-quality captures cannot pass.
- [ ] Runtime failures stop cleanly instead of repeating every 100 ms.
- [ ] Enrollment and attendance remain retryable after every recoverable failure.
- [ ] The defined Android, Capacitor, and iOS device matrix meets the completion and responsiveness targets.

## Scope note

The first implementation should stabilize the current web MediaPipe pipeline. A native Android/iOS MediaPipe implementation should be considered only if Capacitor WebView testing still fails the acceptance targets. Server-signed biometric verification proof is tracked as mandatory production security work because client-submitted face scores are not authoritative.
