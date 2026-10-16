# Resting HR: fixed 15-second contact camera PPG

Estimates pulse rate, not HRV or a fatigue/medical score. Real-device accuracy is unverified. The user supplied a 150-second screen recording of repeated failed attempts: contact was detected while the previous rolling countdown repeatedly reset. This confirms poor acquisition usability, not a reference heart rate or a raw optical recording.

## Current protocol: camera-rhr-v4 / original-ppg-v1

At the user’s explicit request, restore the first working iPhone algorithm after repeated failures and implausible 30 BPM readings in later versions. `original.ts` is an unmodified copy of `332c6f7:src/lib/rhr/protocol.ts` (also identical to the first feature commit’s protocol source). A regression test checks byte identity and numerical parity across signals/frame rates. `restored.ts` only adapts version validation and the 15-second session clock; it does not change estimator thresholds or select recent suffixes.

Restore the original central-ROI RGB aggregation, red+green clipping and full red spatial range. The broad earlier exposure tuning remains disabled; the narrow red-ceiling setup repair described below is now used only for that observed acquisition pattern. Retain the iPhone torch compatibility fix, main-lens selection, frame-rate request before final light verification, current circle/wave design, posture/rest capture, diagnostics and camera cleanup.

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

## Honor red-ceiling acquisition repair

The two user-provided Honor JSON files contain the same attempt, not two independent measurements. The capture delivered approximately 30 real fps with torch reported on. Post-settling RGB means were about 253.44 / 0.012 / 0.0004; red spanned only about 1.08 levels. Legacy clipped=0 is expected because the unchanged original sampler counts pixels only when both red and green reach 252. A red-only near-ceiling image therefore escaped the old brightness check. This suggests an acquisition/exposure problem; aggregate colors alone cannot establish sensor clipping, the correct pulse rate, or accuracy against a reference.

Setup now recognizes a narrow near-flat red-ceiling pattern: at least 95% of recent samples have red ≥250 and green/blue ≤2, with a red range <2. These are acquisition heuristics, not clinical cutoffs. Normal colored streams, a varying red channel and streams with an available green/blue channel do not trigger this repair. No BPM is inferred from the warning.

After the initial setup check, request lower exposure compensation only for that pattern, inside the camera's reported range and step, at most four one-EV (or one hardware step if larger) changes per camera opening. A missing control, ignored request or reached limit stops automatic changes and gives a useful message. Existing stream constraints and torch are retained when applying the new exposure. Only settings reporting the requested EV count as a confirmed request; even then the image must be checked again. Clear pre-adjustment samples and wait for at least 1.5 seconds of fresh frames before accepting the camera check or requesting another adjustment. The existing 30-second idle camera timeout still bounds setup. Camera switching/closing cancels pending UI work and releases the old stream.

The 15-second measurement never adjusts exposure, extends time, restarts, relaxes estimator checks or substitutes a BPM. The original estimator and RGB aggregation remain unchanged. Local setup/signal diagnostics include exposure requests, reported values and pre-adjustment frame/color statistics, so physical Honor follow-up can distinguish an ignored control from an unchanged red image after a reported EV change. Exposure preferences are not persisted. Actual Honor success and accuracy still require new physical-device measurements; synthetic camera repair is not proof of physiological accuracy.

Additional owned browser scenarios: `RHR_SCENARIO=exposure/exposure-ignored/exposure-unsupported/exposure-no-effect`. The first simulates a camera whose image recovers after two exposure changes; the remaining cases verify that blocked/ineffective controls never produce an invented result or an unbounded loop. No user diagnostic or device identifier is committed to the repository.

## Android metering stability (acquisition revision android-camera-hold-v1)

The next physical Honor diagnostic had normal-looking average red/green levels, no red-ceiling warning and no exposure adjustment requests. It still failed the original estimator. It contains large color drift and an optical disturbance around 9–11 seconds; the full record and its segments do not identify a consistent pulse. This does not distinguish finger movement/pressure from camera processing and does not establish a true BPM. Do not relax the estimator merely to accept this record.

For Android only, after the initial covered-frame check, request supported manual white balance, freeze the reported focus distance, and request supported manual exposure using the reported exposure time when available. No ISO, shutter time, color temperature or focus distance is guessed. Chromium's Android implementation maps fixed/manual white balance to AWB lock; manual exposure uses the last known exposure time, with a driver fallback if metadata is missing. These are best-effort camera requests, not proof of stable optical acquisition. Unsupported/failed controls are recorded; a resolved request whose mode is not reported manual remains unconfirmed. iPhone/non-Android paths issue no new metering requests and keep their existing camera check.

Discard all frames from before a camera change and check at least 1.5 seconds of fresh data. Android setup also screens for substantial first-to-last color drift in the recent 2.5-second window, allowing ordinary pulse variation. If exposure hold makes the image dark, saturated, stale or too slow, release that exposure hold once, retain other available controls and check fresh data again. There is one hold attempt and at most one exposure release per camera opening, bounded by the existing 30-second idle camera stop. Closing/switching cancels pending UI work. Start is blocked while camera settings are being changed. No camera constraints change during the fixed 15-second scan.

Explicit local diagnostic downloads now identify the acquisition revision, requested/reported hold modes, exposure release, exposureTime/colorTemperature capabilities when exposed, and allowlisted camera settings sampled about once per second during a scan. These remain outside signed answers, storage and CSV. The original signal estimator and RGB sampling are unchanged; the supplied disturbed record remains rejected. Physical Honor success and comparison against a reference remain unverified until a new device measurement is supplied.

Owned browser scenarios: `android`, `android-ignored`, `android-rollback`, `android-unsupported`, `android-cancel`, `iphone-controls`. They check recovery of a simulated auto-metering stream, no fabricated BPM from flat data despite resolved control requests, one exposure rollback, unavailable modes, closing during a pending request, no in-scan mutations and no metering changes on iPhone.

Primary implementation references: [Chromium Android camera controls](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/media/capture/video/android/java/src/org/chromium/media/VideoCaptureCamera2.java), [Image Capture constraints and settings](https://www.w3.org/TR/image-capture/), [smartphone PPG signal-quality limitations](https://www.mdpi.com/1424-8220/20/7/1923). These inform acquisition engineering; they do not validate this app's HR accuracy.

## Adaptive Android sensitivity (introduced in android-adaptive-gain-v2)

The next physical Honor record confirmed manual focus and AE off (reported as exposureMode:none by Chromium), a reported 30ms exposure, ISO 100 and ~30 actual fps. Average post-settling red/green were about 87/9; the original estimator again rejected the pulse. This is substantially dimmer than the earlier normal-colored attempt. Manual mode can lose auto-metered gain: holding settings alone was insufficient. The record does not establish the sole cause of all failures or a reference BPM. User-provided comparison readings are never inputs to acquisition or analysis.

After an Android exposure hold, screen for a dim red/green image (red <120 and green <20) and calibrate sensor sensitivity from real RGB brightness. For covered images below red 140, request one doubled ISO step; for a red-ceiling image above 230, request one halved step. Respect the advertised ISO min/max/step, an engineering ceiling of 1600 and at most four gain requests per camera opening. Never apply these gain requests to a continuously auto-exposed stream or to iPhone. Shutter time, sampling grid/ROI, estimator thresholds, capture duration and allowed pulse range remain unchanged.

After each request, clear old samples and inspect at least 1.5 seconds of fresh covered frames. Record requested/reported ISO, before/after frame statistics and whether brightness changed in the requested direction by more than max(2 levels, 5%). Stop gain changes on unsupported/ignored controls, no observed response, a reached limit or the attempt budget. If the image remains unusably dim/saturated, release the manual exposure once and check fresh auto-exposed frames. The existing 30-second idle setup stop remains; the timed capture is still exactly 15 seconds with no camera changes or resets. These brightness/ISO cutoffs are engineering acquisition heuristics, not clinical quality criteria. Only the unchanged final estimator can accept a pulse.

Explicit local diagnostics add gainAdjustments and the acquisition revision. No gain settings or reference BPM are added to wellness answers, CSV or the database. Raw supplied signals stay out of the repository; replaying a rejected record does not manufacture an accepted BPM. Physical success and accuracy still need a new real-device capture after calibration.

Additional owned browser cases: android-gain (a known 55 BPM optical waveform at a simulated dim manual gain, corrected through real canvas brightness feedback), android-gain-ignored, android-gain-no-effect and android-gain-limit. They verify measured image response, no in-capture constraints, bounded fallback and no invented result from flat input. They do not establish physical Honor compatibility.

Apply the additional dim-image setup gate only while an Android manual-exposure hold is active. Automatic exposure, unsupported controls and a released exposure hold retain the original light check; low average brightness alone must not veto a usable pulse on an otherwise working device. `android-dim-auto` verifies that a lower-brightness but clear known optical signal still completes with unsupported metering controls.

## Repeated-attempt lifecycle

Start acquires a synchronous in-flight guard and cancels the setup inactivity timer before requesting a server ticket. A network failure returns the same live camera to a fresh setup check and rearms inactivity. Save retries submit the existing captured record, with a separate in-flight guard; they never start a second capture. Camera enumeration, start/save replies, capture callbacks and screen wake-lock resolution are scoped to their originating generation. Late work from a closed attempt cannot open a stale stream or affect a later capture. Stopping pauses and detaches the preview, stops tracks, cancels sampling/timers and releases the screen wake lock. A camera-ended event in setup returns to an actionable camera reopen state.

Five regression cases failed against the previous build before the fixes: delayed enumeration after close/reopen opened a third stale camera; a delayed start crossed the setup idle timeout; synchronous double Start requested two tickets; synchronous double Retry save submitted twice; and a previous scan's late wake lock attached to a later scan.

Run `npm run test:rhr:camera` against a production-built local server with `RHR_PLAYWRIGHT_MODULE`, optional `RHR_BROWSER`, `RHR_BASE`, and `PVT_TEST_DATABASE_URL` (explicit loopback fixture database) set. The 41-scenario matrix uses three workers and owned canvas streams; network cases use a local fixture survey and intercepted HR requests, never a production player. It covers three consecutive 55/72/90 BPM captures without reloading, failure then recovery, adaptive Android gain across reopened streams, permission denial, track end, missing frames, backgrounding, cancellation, queued callbacks from a cancelled scan, pending device enumeration, delayed/failed start and save retry. Original signal validation, elapsed duration, actual frame requirements, capture controls and stored/exported data formats are unchanged. Simulated browser tests verify software lifecycle behavior, not physical camera accuracy or guaranteed acceptance of every finger signal.


## Unusable manual-metering metadata (current acquisition android-metering-compat-v3)

A physical Samsung S21 diagnostic from Samsung Internet 30 / Chromium 143 has a lit rear camera, 361 delivered frames (~24.15 actual fps), full optical coverage and a completed 15-second capture. Its green channel is exactly zero throughout; the red trace fails the original periodicity test (correlation ~0.052, required 0.7). It cannot supply an accepted reference HR. Capture timing/coverage pass; this is not an incomplete attempt or simply a low-frame-rate rejection.

The same record exposes current ISO 0 against a 50–3200 capability and focusDistance 0 against 0.1–3.6. The previous setup attempted that invalid focus value and requested manual exposure without a usable reported ISO. ISO 0 is not evidence that the physical sensor operated at ISO 0: Chromium can populate current ISO from its request builder instead of measured capture metadata. The record does not prove manual mode caused all waveform problems, but it identifies an unsafe acquisition assumption to fix. Reference: [Chromium Camera2 capability/reporting and manual controls](https://chromium.googlesource.com/chromium/src/+/f2db5409f4065feeb5525a59fea56cc48298d9db/media/capture/video/android/java/src/org/chromium/media/VideoCaptureCamera2.java).

Before locking camera exposure/colors, validate exposed ISO and shutter values against finite positive values and their advertised bounds. If the browser exposes neither a value nor its capability, retain prior compatibility behavior. When it advertises a range but supplies missing/zero/invalid metadata, leave metering automatic, without inventing an ISO or shutter. Validate focus against its advertised range too; zero remains valid when the device explicitly supports it. If metadata becomes unusable after a manual request, make one bounded request to restore automatic exposure and automatic white balance, preserving light/frame constraints and discarding pre-adjustment frames. Local diagnostics record skippedReason and automaticRecovery; no changes to wellness answers or CSV fields. Failure to restore is recorded, not advertised as a confirmed hardware fix.

Three owned browser regressions fail against the prior build and pass after the change: zero ISO before hold (automatic exposure retained), ISO becoming zero after hold (automatic exposure/colors restored once), and a flat signal in automatic mode (still no invented HR). These cases simulate Samsung-shaped metadata and ~25 actual fps; they do not establish real S21 accuracy. Existing Honor-style adaptive gain, iPhone controls, original sampling/estimator, 15-second duration and quality criteria stay unchanged. A new real-device retry is required to determine whether this correction resolves the reported S21 failure.
