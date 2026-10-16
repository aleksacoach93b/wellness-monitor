# Resting heart rate: 15-second contact camera PPG

This opt-in question estimates pulse rate only. It does not calculate HRV, blood pressure, oxygen saturation, fatigue, readiness or a diagnosis. Hardware/reference validation is pending. Automated tests exercise software and synthetic signals; they cannot establish accuracy on an iPhone or in football players.

## Player protocol

Rest quietly for at least five minutes before measuring. The scan itself is fixed at 15 seconds, including the first two seconds reserved for exposure/contact settling. Camera permission/setup is separate. Choose Seated, Standing, Reclined or Lying down and confirm prior rest. Compare only consistent positions and conditions; standing values must not be pooled with lying values.

The player enables a rear camera with a controllable continuous light, lightly covers its lens with a fingertip, starts the scan and remains still while breathing normally. An unsupported rear camera/light gives an explicit error; there is no front-camera substitution or invented fallback value. Camera selection is offered when more than one rear candidate is available. The screen stops capture at 15 seconds even when signal quality is poor. A failure requires an explicit new scan; there is no automatic extension. The live trace is camera intensity, not an ECG.

Camera tracks and light are released after capture, close, cancellation, unmount or error. A ready camera also expires after 30 seconds of inactivity. Hidden/blur/orientation/ended-track events interrupt an active scan. Video frames stay on the device and are never recorded or uploaded. Only timestamped ROI RGB averages, global/per-channel clipping and spatial-range measures are sent for server processing; those samples are not retained after verification.

## Signal processing and acceptance

Central 55% square ROI is downsampled to 32×32. Prefer actual video-frame callbacks; fall back to animation frames with distinct video timestamps. The algorithm uses actual monotonic sample times, rejects incomplete or slow/gapped streams, and interpolates onto 30 Hz. It discards the first two seconds, removes slow illumination drift and smooths camera noise. Red, green and blue channels are assessed independently. A clipped channel or a channel with abrupt exposure jumps is excluded without discarding clean channels. Each accepted channel still has to pass autocorrelation, peak agreement, interval regularity and split-window stability checks.

An autocorrelation period estimate and a separately detected, sub-frame-refined peak-interval estimate must agree within 5 bpm. Accepted signals require correlation ≥0.7, at least five peaks, interval median absolute deviation ≤0.16 of the median interval, agreement between usable color channels and stable estimates across two halves. The implemented operating range is 30–180 bpm; rejected signals are not evidence of an abnormal pulse. At least 96% of analyzed samples must satisfy the contact screen, acquisition must span at least 12.5 seconds after settling, at least 180 post-settling frames are required, nominal acquisition must be ≥15 fps (14.5 fps average tolerance), and gaps must be ≤200 ms. These thresholds are engineering quality screens, not validated clinical thresholds. Periodic movement or lighting can resemble a pulse; the algorithm cannot prove sensor authenticity.

The 15-second window is a product constraint and needs independent validation. Published accuracy of another app, algorithm or longer recording does not validate this implementation. Reference sources:

- Smartphone fingertip PPG validation using 20-second recordings: https://mhealth.jmir.org/2017/3/e33/
- Camera/torch constraints: https://www.w3.org/TR/image-capture/
- WebKit camera settings caveat (runtime capability checks are required): https://bugs.webkit.org/show_bug.cgi?id=280970

## Integration and data

The builder exposes **Resting heart rate (15s camera)**. It is stored as existing NUMBER type with `Question.options = {widget:"RHR_CAMERA", protocolVersion:"camera-rhr-v1", durationSeconds:15}`. No enum/table/schema migration is required. Ordinary NUMBER questions keep their original behavior. Camera questions are excluded from Coach Mode's bulk duration assignment.

`POST /api/kiosk/{surveyId}/rhr` authenticates the player through the existing kiosk grant or access code and checks team/question/survey ownership. A short-lived signed start ticket binds player, survey, question, position and rest confirmation. Finish checks wall time and recomputes quality and bpm from bounded aggregate samples. Only an accepted result gets a signed 48-hour result receipt. This prevents editing the reported bpm or switching the player/question; it does not attest physical sensor inputs. Failed signals produce no completion value.

The normal wellness submission revalidates the receipt and stores the server-signed snapshot without the receipt/token. Required measurements cannot be omitted or entered manually. There is no database write or new production question assignment merely from deployment. The coach explicitly adds the question to a survey. Main public CSV retains a numeric parent BPM column, plus BPM, position, duration, quality, measured time, protocol, light use, frame rate and rest-confirmation columns. Power BI exports equivalent fields. Live Ops shows submitted values with position separately from readiness scoring. Existing historical survey columns and answers are not rewritten.

`/rhr/demo` uses the real camera/algorithm but makes no API requests or saves player data. It has no synthetic signal button. Browser QA injects fake camera signals only in an isolated owned test browser; these are never production player measurements.

## Verification

`node --test tests/rhr.test.cjs` covers synthetic pulse rates, drift/jitter/noise, low frame rates, gaps, flat/saturated/uncovered signals and scoped signed results. Native integration tests use only the explicit loopback fixture and synthetic accounts. Physical-device checks must compare repeated measurements against a suitable reference, including low resting pulse, camera lens choice, skin/contact/lighting conditions and repeatability. Until that work is completed the feature remains labeled a camera estimate with device validation pending.

## iPhone camera-light compatibility correction

A real iPhone report exposed a startup bug: the initial code called `.includes(true)` on `getCapabilities().torch`, which some WebKit versions return as a boolean. Startup now accepts both the boolean and array shapes and probes constraints when capability reporting is absent. Automatic selection prefers the main rear lens over ultrawide/telephoto/virtual candidates; manual choices remain explicit. Video playback starts visibly before enabling the light. The light helper tries both direct and advanced constraint forms and checks settings after each successful call.

A resolved `applyConstraints` promise is not treated as proof that the lamp physically lit. When settings report true, the UI says light enabled. If state is absent/stale false, Start remains disabled until the player explicitly confirms seeing the rear light on; a retry-light action is available. Unsupported tracks and rejected constraints remain errors. No synthetic camera/pulse data or fallback BPM are added to the product. Software regression tests now include the boolean shape, stale/ignored settings and lens fallback; they are not physical-device verification.


## Adaptive capture and Session Dial revision

`adaptive-rgb-v2` is stored in the signed `algorithmVersion` of new answers and appended to the existing CSV Protocol value. The fixed 15-second player protocol and `camera-rhr-v1` widget definition remain compatible; existing answers and outstanding signed receipts remain valid. No historical rows, CSV headers, database schema or survey assignments are rewritten.

A user reported successful acquisition on one iPhone and repeated failures on an Honor Magic Pro. The exact Honor model/browser/rejection cause is not yet confirmed. These changes address identified portability weaknesses; they do not establish a device-specific fix or universal compatibility:

- Real-frame preflight shows dark, overexposed, missing contact or contact-ready feedback. Six consecutive covered preflight samples enable Start. This is positioning/setup, not an automatic extension to the timed scan.
- Best-effort 30 fps configuration preserves the light request. Cameras delivering 15 fps are assessed using actual timestamps and the same pulse-consistency checks; insufficient/gapped streams still fail.
- Up to four supported, bounded exposure-compensation adjustments are possible before capture. Settings are not adjusted during the 15-second scan. Unavailable/ignored hardware controls do not imply successful correction.
- Spatial contact uniformity uses red 5th–95th percentiles rather than single extreme pixels. Per-channel saturation prevents a clipped red channel from masquerading as a usable signal or vetoing a genuine green/blue signal. The warm-color contact screen tolerates modest white-balance differences, but it does not prove skin/contact. All three channels saturated, flat signals, random noise, interruptions and inconsistent pulse estimates remain repeat conditions.
- The signal amplitude floor is normalized to channel DC level, with an absolute 0.025-intensity-unit minimum, instead of a universal 0.12-intensity-unit floor. This is an engineering change that needs reference validation, particularly for weak signals and artifact rejection.
- Session Dial adds a compact live camera preview, 15 time segments, stage indicators and the real optical waveform. There is no synthetic heartbeat, live BPM or quality percentage. Failed attempts expose local aggregate frame/coverage/reason details; no videos are recorded or uploaded.

The fingertip must cover the active camera lens, with the nearby torch illuminating the tissue. Covering only the lamp cannot provide the camera signal. A phone's lens/light layout and browser controls can prevent usable acquisition even if the device has a camera and flash. Chrome on Android and Safari on iPhone are suggested test browsers, not a guarantee. Validate each model against a reference; 15 seconds remains fixed even if a given phone needs a repeat.

Primary references informing the design:
- Device/channel/ROI differences: https://www.mdpi.com/1424-8220/17/10/2385
- Reflection PPG uses the camera as sensor and flash as light source: https://pubmed.ncbi.nlm.nih.gov/24618594/
- Capability-bounded exposure/torch controls: https://www.w3.org/TR/image-capture/

Software checks include 15/24/60 fps synthetic rates, independent saturated-channel fallback, low-amplitude noise rejection, spatial outliers, bounded exposure requests, and native server parsing/signing/CSV preservation. None substitutes for physical Honor/reference verification.
