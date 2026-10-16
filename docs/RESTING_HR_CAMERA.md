# Resting HR: fixed 15-second contact camera PPG

Estimates pulse rate, not HRV or a fatigue/medical score. Real-device accuracy is unverified. The user supplied a 150-second screen recording of repeated failed attempts: contact was detected while the previous rolling countdown repeatedly reset. This confirms poor acquisition usability, not a reference heart rate or a raw optical recording.

## Current protocol: camera-rhr-v3 / fixed-rgb-v4

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
