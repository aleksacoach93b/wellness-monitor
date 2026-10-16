# Resting HR: quality-guided contact camera PPG

This opt-in wellness question estimates pulse rate, not HRV, blood pressure, oxygen saturation, readiness or a diagnosis. Physical/reference accuracy is not established by software tests. A user reported successful but inconsistent iPhone acquisition and unsuccessful Honor acquisition; device compatibility remains subject to real-device validation.

## Current player protocol (camera-rhr-v2 / quality-window-v3)

Rest quietly for at least five minutes. Choose Seated, Standing, Reclined or Lying down and confirm prior rest. Compare consistent positions and conditions. Enable a rear camera and continuous light. Cover the active lens lightly with a fingertip near the light; covering only the flash is insufficient. The live preview identifies which lens is active.

The normal target is **5 seconds of detection followed by 10 continuous stable seconds**. Setup/permissions are separate. Detection can take longer if a usable pulse is not yet found. Missing contact, frame gaps, low-quality optical estimates or a material change in the provisional estimate invalidate the current measurement window. The countdown returns to a new 10-second window once a usable signal is available. Contact loss also requires reacquisition. The attempt is bounded to **60 seconds**; timeout, cancellation, backgrounding, orientation changes and camera termination produce no result. Camera, light, animation/frame callbacks, timers and wake lock are released on finish, close, error and unmount. An idle ready camera expires after 30 seconds.

The circle shows the phase countdown, a clearly labeled **live BPM estimate** when a usable period is found, and the actual optical trace. This is PPG, not ECG. The heart icon animates only when a new detected optical peak is reported; no synthetic beat timer is used. Reduced-motion preference disables beat/progress animation. Preliminary BPM can change; only the verified final result can be submitted.

## Capture and quality screens

A fixed central 55% square ROI is downsampled to 32×32. RGB means, per-channel saturation and red spatial 5th–95th percentile range are extracted from real frames. Prefer video-frame callbacks and otherwise sample only distinct video timestamps. Video is not recorded or uploaded. Capability checks support boolean and array torch shapes. Request a useful frame rate before final torch verification. Unconfirmed torch settings require visual confirmation. Optional bounded exposure adjustments happen before the timed attempt, never during it. Unknown/ignored hardware controls are not proof of successful illumination or correction.

`RhrSession` runs a deterministic 250ms quality clock shared by the UI and server replay. A clock tick uses only frames captured at or before that tick. The live window is 5 seconds; final acceptance uses a new 10-second window after initial detection. There is no accumulation of isolated good fragments.

Engineering screens (not validated clinical cutoffs):

- At least 96% contact-screen samples, average ≥14.5 fps (nominal 15 fps) and gaps ≤200ms; live/final windows must span their target minus at most 250ms and have a recent tail.
- Detrend illumination drift, interpolate onto 30Hz and smooth camera noise. Exclude clipped or abruptly jumping channels individually. Assess red, green and blue channels.
- Normal candidates require autocorrelation ≥0.7, independent peak-period agreement within 5 BPM, interval MAD ≤0.16 and estimates in 30–180 BPM. The final window requires at least four detected peaks and stable autocorrelation periods in both halves within 7 BPM of the full-window estimate. Qualified channels must agree within 5 BPM.
- A low-rate **provisional preview only** may use one interior peak with correlation ≥0.85 and at least 2.2 observed periods when the 5-second window is too short for an interior peak interval. It exposes no fabricated peak agreement; final acceptance still requires four peaks and both estimators.
- Preview changes exceeding max(8 BPM, 12% of the acquisition anchor) restart the window. Failed final checks or a final estimate differing from the latest preview by >5 BPM restart it as well. High pulse itself is not treated as an error or capped toward a normal value.
- Fully clipped, flat, noisy, uncovered, interrupted or inconsistent streams do not receive a final BPM. Periodic movement/light can resemble PPG; this algorithm does not attest sensor authenticity or diagnose irregular rhythms.

## Server, storage and exports

The widget remains existing NUMBER with options `{widget:"RHR_CAMERA", protocolVersion, durationSeconds:15}`. Both v1 and v2 definitions are accepted. Current clients explicitly request v2 at start; cached clients without a version retain v1 behavior. No enum/table/schema migration or live survey modification is needed.

Start tickets bind player, team/survey/question, posture, rest confirmation and protocol version. Finish validates bounded timestamps/values, replays the entire recorded session on the server and independently derives the accepted window, BPM and restart count. A v1 ticket cannot authorize a v2 record. Full capture is bounded to 60 seconds / 3600 aggregate samples / 1MB request text. Wall time must support the claimed duration. Completion must be within 750ms of the replay-derived accepted window, so an old good segment cannot be submitted after later inactivity.

Accepted v2 snapshots store the actual elapsed `durationSeconds`, `targetDurationSeconds:15`, `detectionSeconds:5`, `stableWindowSeconds:10`, restart count, versions, posture, rest confirmation and quality metrics. Only accepted results get a scoped signed receipt. Wellness submission revalidates the receipt and strips it before storing. Editing displayed BPM, duration or restart count cannot alter signed values. Raw video and aggregate samples are not retained. Mandatory HR questions cannot be skipped or impersonated by a plain numeric entry.

CSV headers are unchanged. Existing Duration s now contains the actual duration for v2 answers; Protocol contains protocol/algorithm revisions. Legacy values/answers/receipts are preserved. Power BI and Live Ops retain the existing integration. No HR value is folded into readiness scoring. `/rhr/demo` uses real camera capture without API writes or saved player data; synthetic signals are injected only by isolated browser tests.

## Legacy compatibility

`camera-rhr-v1 / adaptive-rgb-v2` retains its fixed 15-second capture, first two seconds discarded, ≥12.5-second analyzed span and at least five peaks. Legacy samples without per-channel clipping fields and existing 48-hour signed receipts remain supported. They do not silently acquire the new repeat/elapsed-time semantics.

## Verification and references

Tests cover legacy behavior, low/high stable rates, 110→80 BPM changes, contact loss, timeout, frame gaps/rates, malformed/stale records, channel clipping, low-amplitude noise, camera controls, scoped receipts, exports and the real-time browser flow. Browser signals are synthetic and establish software behavior, not accuracy on an iPhone or Honor. Compare repeated physical-device results with a suitable reference before operational reliance.

Primary references informing signal-quality screening and hardware controls; they do not validate these particular thresholds or durations:

- Smartphone PPG quality screening: https://www.mdpi.com/1424-8220/20/7/1923
- Device/channel/ROI differences: https://www.mdpi.com/1424-8220/17/10/2385
- Camera/flash reflection PPG: https://pubmed.ncbi.nlm.nih.gov/24618594/
- Torch, exposure and capability API: https://www.w3.org/TR/image-capture/
- WebKit stale light-settings caveat: https://bugs.webkit.org/show_bug.cgi?id=280970
