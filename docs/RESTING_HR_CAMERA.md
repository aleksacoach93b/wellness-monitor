# Resting HR: fixed 15-second contact camera PPG

Estimates pulse rate, not HRV or a fatigue/medical score. Real-device accuracy is unverified. The user supplied a 150-second screen recording of repeated failed attempts: contact was detected while the previous rolling countdown repeatedly reset. This confirms poor acquisition usability, not a reference heart rate or a raw optical recording.

## Current protocol: camera-rhr-v4 / original-ppg-v1

At the user’s explicit request, restore the first working iPhone algorithm after repeated failures and implausible 30 BPM readings in later versions. `original.ts` is an unmodified copy of `332c6f7:src/lib/rhr/protocol.ts` (also identical to the first feature commit’s protocol source). A regression test checks byte identity and numerical parity across signals/frame rates. `restored.ts` only adapts version validation and the 15-second session clock; it does not change estimator thresholds or select recent suffixes.

Restore the original central-ROI RGB aggregation, red+green clipping and full red spatial range. Disable the later preflight exposure tuning. Retain the iPhone torch compatibility fix, main-lens selection, frame-rate request before final light verification, current circle/wave design, posture/rest capture, diagnostics and camera cleanup.

The first release calculated final BPM after capture, with no short-window live BPM. Restore that behavior: show the countdown and real trace during the fixed 15 seconds, then the original final estimate if accepted. No provisional 30 BPM, no synthetic pulse icon animation, no automatic countdown restarts. Original validation still may reject an unreadable scan; hardware accuracy is not established by source restoration or synthetic testing.

V4 uses the existing signed 15-second answer shape with targetDurationSeconds:15 and restarts:0. Preserve v1/v2/v3 captures, outstanding receipts and existing data/CSV headers. No database migration or survey edits. The following v3 discussion is historical, not the algorithm used for new measurements.

## Previous protocol: camera-rhr-v3 / fixed-rgb-v4 (cached clients only)

Rest quietly for five minutes; select Seated, Standing, Reclined or Lying down and confirm rest. Enable a rear camera/light. Cover the active lens near the light with light fingertip pressure; covering only the flash cannot image the finger. Setup/permissions are separate from capture.

**Capture stops after 15 seconds. No quality-triggered extension or automatic restart.** The first two seconds allow exposure settling. A preview estimate appears when available, without gating final analysis or resetting the clock. At 15 seconds the server independently checks the record and derives the final BPM. A genuinely unusable signal returns no reading and offers a manual repeat. Cancelling, backgrounding, losing the camera or changing orientation invalidates the attempt. All camera/light/timer/frame callbacks and wake locks are released. An idle ready camera expires after 30 seconds.

The circle contains remaining time, provisional BPM, the actual optical trace and a heart animated on newly detected peaks. No synthetic pulse animation or invented BPM. Reduced-motion is respected. A normalized visible waveform or red preview does not prove a usable pulse.

## Signal processing

Sample the central 55% square ROI at 32×32, using distinct real video frames. Extract averaged RGB, per-channel saturation and spatial percentiles. Video is never recorded/uploaded. Preserve boolean/array torch capability support, main rear-lens preference, stream configuration before final torch verification, manual light confirmation when settings are inconclusive, and bounded exposure adjustment before capture.

V3 uses contiguous recent suffixes starting at 2, 4, 6 or 7 seconds, preferring the longest accepted suffix. These allow early settling/artifacts to be excluded without extending acquisition or stitching isolated good fragments. Every candidate needs at least 7.7 seconds of samples and a tail within 300ms of the 15-second deadline. Short previews are informative only.

Engineering screens, **not validated clinical thresholds**:

- Average frame rate ≥12 fps and no gap >300ms in the selected suffix. Broad optical-contact screen on ≥85% of samples, allowing device-dependent red ratios.
- Assess RGB separately. Exclude substantially saturated/dark or abruptly jumping channels. Interpolate to 30Hz, remove local illumination drift, smooth, and trim half a second at each end.
- Detect both autocorrelation period and peak intervals. Handle tied/quantized peaks deterministically. Require correlation ≥0.6, interval MAD ≤0.25, at least four peaks, and period/peak agreement within max(8 BPM, 10%). Estimate range 30–180 BPM. Low amplitude is allowed only above the adaptive noise floor.
- Rank channels by correlation and estimator agreement. A weak channel no longer vetoes a stronger usable channel; similarly strong conflicting channels still reject the result. Require the final five-second autocorrelation period to be reasonably consistent with the selected suffix, protecting against stale early-only pulse data.
- High HR is not itself an error and is never pulled toward a presumed normal value. Flat, noisy, missing, uncovered or interrupted data do not automatically receive a BPM. Periodic movement/light can imitate PPG; no camera-only algorithm authenticates a physiological source.

A failed attempt offers **Download signal diagnostics** inside Scan details: explicit local JSON download of averaged RGB/timing and analysis, without video/player identifiers. It is not automatically uploaded, persisted or included in a survey response. Cleared on closing or starting another capture. This enables analysis of physical-device signals that a screen recording cannot provide.

## Data compatibility and exports

Keep existing NUMBER widget definitions valid for v1/v2/v3. Current clients explicitly request v3. Cached clients without a version retain v1 behavior; v2 clients retain their historical rolling-window replay. Preserve all scoped outstanding receipts and stored historical answers. No database migration or live survey edits.

Start tickets bind player/survey/question, posture, rest confirmation and protocol. Finish checks protocol matching, wall time, bounded RGB/timestamps/record size and interruption/light status. V3 is limited to 15 seconds / 1500 samples; v2 retains 60 seconds / 3600. Only accepted results get signed receipts. V3 stores durationSeconds:15, targetDurationSeconds:15, restarts:0, protocol/algorithm, posture, rest and quality metrics. V2 retains its actual elapsed duration and 5+10 metadata; v1 retains its old 15-second format. Wellness submission trusts signed values and strips the receipt. Raw samples are not stored by the server.

Main CSV headers remain unchanged, with the existing BPM, posture, duration and protocol fields. Power BI and Live Ops continue through normal wellness submission. HR is not folded into readiness. `/rhr/demo` captures real camera data without API writes or saved player data.

## Validation limits

Unit/native integration and synthetic browser captures check deadline, channel selection, timing, signatures, exports, controls and cleanup. They cannot establish iPhone/Honor accuracy. Test repeated real-device captures against an independent reference before operational reliance. If failures persist, use explicit signal diagnostics to investigate saturation, amplitude, frame cadence and estimator rejection rather than lowering thresholds blindly.

Primary references inform the approach; they do not validate our durations or cutoffs:

- Smartphone PPG quality screening: https://www.mdpi.com/1424-8220/20/7/1923
- Device/channel/ROI differences: https://www.mdpi.com/1424-8220/17/10/2385
- Camera/light API: https://www.w3.org/TR/image-capture/
- WebKit light settings: https://bugs.webkit.org/show_bug.cgi?id=280970

## Camera compatibility check (estimator unchanged)

A three-second setup check counts distinct video frames, independently of advertised frameRate. It reports missing/stale frames, delivered rate below the original estimator's 20 fps requirement, gaps, dark/saturated frames and inconsistent optical coverage. The check is separate from the unchanged 15-second capture. A passed camera check is not a validated pulse or a guarantee of final acceptance. Setup remains bounded by the existing 30-second camera inactivity timeout.

The explicit Improve camera stream action requests a compact 160×120 ideal stream with a minimum 20 fps and re-verifies the light afterwards. It never lowers estimator thresholds or modifies a working stream automatically. Unsupported/ignored constraints remain visible through measured setup failure. A compact preference is restored only after a complete accepted measurement used it.

The picker opens the chosen camera immediately and compares the requested ID with the reported actual device ID, rejecting a reported mismatch or front camera. IDs are browser camera entries, not proof of distinct physical lenses: the player confirms the active lens using the preview. After a failed scan, Repeat with this camera preserves the selection; Try another rear camera requests a distinct exposed ID. If no alternative is exposed, the UI states that rather than suggesting a nonexistent alternate lens. Only accepted measurements remember the working camera ID locally.

Setup Camera details offers a local download even when the camera check blocks starting; failed measurements retain the full signal download. Local diagnostic downloads now include requested/actual camera IDs, allowlisted settings/capabilities, user agent, light confirmation, setup statistics and actual captured-frame statistics. They contain no video/player identity, are never uploaded automatically and are never added to signed wellness answers. This distinguishes an early estimator rejection with fps:0 from an actual low-rate stream. The first working estimator and original sampling remain byte-identical/unchanged.

Run owned synthetic camera cases with Playwright available through RHR_PLAYWRIGHT_MODULE, optional RHR_BROWSER, and RHR_SCENARIO=stable/slow/ignored/mismatch/flat/switch. `node tests/rhr.camera-browser.cjs` targets explicit RHR_BASE or loopback by default and blocks non-GET API requests. These tests establish UI/capture behavior only. Physical Honor Magic6 Pro/iPhone verification is still required.

Vercel uses the same Webpack production build validated locally to avoid the recurring Turbopack Google-font query resolver failure. Fonts and dependencies are unchanged.
