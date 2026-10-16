'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Heart,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Timer,
  Armchair,
  X,
} from 'lucide-react'
import {
  getSurveyShellClasses,
  getSurveyUiTokens,
  type SurveyAppearanceTheme,
} from '@/lib/surveyFormAppearance'
import {
  fingerPresent,
  RHR_DURATION_MS as RHR_MAX_MS,
  RHR_FIXED_ALGORITHM_VERSION as RHR_ALGORITHM_VERSION,
  RHR_POSITIONS,
  RHR_FIXED_VERSION as RHR_VERSION,
  rhrReason,
  type PpgSample,
  type RhrPosition,
  type RhrRecord,
  type RhrAnalysis,
} from '@/lib/rhr/protocol'
import {
  enableCameraLight,
  configurePulseCamera,
  adjustPulseExposure,
  primaryRearCamera,
  type TorchState,
} from '@/lib/rhr/camera'
import { analyzeRhrRecord, type RhrSessionView } from '@/lib/rhr/session'
import { FixedRhrSession as RhrSession } from '@/lib/rhr/fixed'
import { sampleVideo, contactHint, opticalTrace } from '@/lib/rhr/sampling'
import { parseRhrAnswer, type RhrAnswer } from '@/lib/rhr/options'
import '../pvt/pvt-focus.css'
import './rhr.css'
const positionLabels = {
  seated: 'Seated',
  standing: 'Standing',
  reclined: 'Reclined',
  lying: 'Lying down',
}
type Phase =
  | 'setup'
  | 'opening'
  | 'ready'
  | 'scan'
  | 'saving'
  | 'result'
  | 'repeat'
  | 'retry-save'
export default function RhrQuestion({
  surveyId,
  question,
  playerId,
  theme = 'dark',
  value,
  onChange,
  demo = false,
  password: suppliedPassword,
}: {
  surveyId: string
  question: { id: string }
  playerId: string
  theme?: SurveyAppearanceTheme
  value: string
  onChange: (value: string) => void
  demo?: boolean
  password?: string
}) {
  const [open, setOpen] = useState(false),
    [phase, setPhase] = useState<Phase>('setup'),
    [position, setPosition] = useState<RhrPosition | null>(null),
    [rested, setRested] = useState(false),
    [password, setPassword] = useState(''),
    [needsCode, setNeedsCode] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState<RhrSessionView>(() =>
      new RhrSession().snapshot(),
    ),
    [contact, setContact] = useState(false),
    [result, setResult] = useState<RhrAnswer | null>(null),
    [cameras, setCameras] = useState<MediaDeviceInfo[]>([]),
    [camera, setCamera] = useState(''),
    [light, setLight] = useState<TorchState | 'off'>('off'),
    [lightConfirmed, setLightConfirmed] = useState(false),
    [hint, setHint] = useState(
      'Cover the active camera lens with your fingertip',
    ),
    [contactReady, setContactReady] = useState(false),
    [exposureBusy, setExposureBusy] = useState(false),
    [diagnostics, setDiagnostics] = useState<RhrAnalysis | null>(null)
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    wave = useRef<SVGPolylineElement>(null),
    heart = useRef<HTMLSpanElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0),
    frame = useRef(0),
    videoFrame = useRef<number | null>(null),
    running = useRef(false),
    deadline = useRef<ReturnType<typeof setTimeout> | null>(null),
    qualityClock = useRef<ReturnType<typeof setInterval> | null>(null),
    lastCapture = useRef<RhrRecord | null>(null),
    pending = useRef<{
      record: RhrRecord
      ticket: string
      position: RhrPosition
    } | null>(null),
    launch = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    wake = useRef<WakeLockSentinel | null>(null)
  const shell = getSurveyShellClasses(theme),
    ui = getSurveyUiTokens(theme),
    completed = parseRhrAnswer(value)
  const stopCamera = () => {
    running.current = false
    generation.current++
    if (deadline.current) clearTimeout(deadline.current)
    deadline.current = null
    if (qualityClock.current) clearInterval(qualityClock.current)
    qualityClock.current = null
    cancelAnimationFrame(frame.current)
    if (videoFrame.current !== null)
      video.current?.cancelVideoFrameCallback?.(videoFrame.current)
    videoFrame.current = null
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    void wake.current?.release().catch(() => {})
    wake.current = null
  }
  useEffect(
    () => () => {
      stopCamera()
    },
    [],
  )
  useEffect(() => {
    if (!open) return
    const before = document.body.style.overflow,
      returnFocus = launch.current
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => {
      document.body.style.overflow = before
      returnFocus?.focus()
    }
  }, [open])
  const close = () => {
    stopCamera()
    setOpen(false)
    setPhase('setup')
    setError('')
    pending.current = null
    setResult(null)
    lastCapture.current = null
  }
  const save = async (
    record: RhrRecord,
    ticket: string,
    measuredPosition: RhrPosition,
  ) => {
    lastCapture.current = record
    stopCamera()
    const current = generation.current
    setPhase('saving')
    setError('')
    pending.current = { record, ticket, position: measuredPosition }
    const analysis = analyzeRhrRecord(record)
    setDiagnostics(analysis)
    if (analysis.quality !== 'ACCEPTED') {
      setError(rhrReason(analysis.reasons))
      setPhase('repeat')
      pending.current = null
      return
    }
    try {
      let answer: RhrAnswer
      if (demo)
        answer = {
          kind: 'RHR',
          bpm: analysis.bpm!,
          position: measuredPosition,
          rested: true,
          durationSeconds: Math.round(record.elapsedMs / 100) / 10,
          targetDurationSeconds: 15,
          restarts: analysis.restarts!,
          protocolVersion: RHR_VERSION,
          algorithmVersion: RHR_ALGORITHM_VERSION,
          measuredAt: new Date().toISOString(),
          quality: 'ACCEPTED',
          torch: record.torch,
          fps: analysis.fps,
          beats: analysis.beats,
          correlation: analysis.correlation!,
        }
      else {
        const response = await fetch(
          `/api/kiosk/${encodeURIComponent(surveyId)}/rhr`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'finish', ticket, record }),
            signal: AbortSignal.timeout(15000),
          },
        )
        const data = await response.json()
        if (!response.ok)
          throw new Error(
            data.error || 'Unable to save. Retry this measurement.',
          )
        if (!data.accepted) {
          setError(rhrReason(data.analysis?.reasons || []))
          setPhase('repeat')
          pending.current = null
          return
        }
        answer = data.result
      }
      if (current !== generation.current) return
      setResult(answer)
      setPhase('result')
      pending.current = null
    } catch (e) {
      if (current !== generation.current) return
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to save. Retry this measurement.',
      )
      setPhase('retry-save')
    }
  }
  const finishScan = useRef<(reason: string | null) => void>(() => {})
  useEffect(() => {
    if (phase !== 'scan') return
    const hidden = () => {
        if (document.hidden) finishScan.current('hidden')
      },
      blur = () => finishScan.current('blur'),
      orientation = () => finishScan.current('orientation')
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('blur', blur)
    window.addEventListener('orientationchange', orientation)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('blur', blur)
      window.removeEventListener('orientationchange', orientation)
    }
  }, [phase])
  // Preflight uses real frames before the player explicitly starts quality-guided capture.
  // Exposure adjustments stop when this effect leaves 'ready'; no tuning mid-capture.
  useEffect(() => {
    if (phase !== 'ready') return
    let cancelled = false,
      busy = false,
      attempts = 0,
      stable = 0,
      previousTime = -1,
      lastTune = 0
    const inspect = async () => {
      if (
        cancelled ||
        busy ||
        !video.current ||
        !canvas.current ||
        video.current.currentTime === previousTime
      )
        return
      previousTime = video.current.currentTime
      const sample = sampleVideo(video.current, canvas.current, 0)
      if (!sample) return
      const covered = fingerPresent(sample)
      stable = covered ? stable + 1 : 0
      setContactReady(stable >= 6)
      setContact(covered)
      setHint(contactHint(sample))
      const track = stream.current?.getVideoTracks()[0]
      if (
        track &&
        attempts < 4 &&
        performance.now() - lastTune > 1000 &&
        (sample.clipped > 0.1 ||
          (sample.r > 245 && sample.g > 245) ||
          sample.r < 35)
      ) {
        attempts++
        lastTune = performance.now()
        busy = true
        setExposureBusy(true)
        try {
          const changed = await adjustPulseExposure(track, sample)
          if (!cancelled && changed) {
            stable = 0
            setContactReady(false)
          }
          if (!changed) attempts = 4
        } finally {
          busy = false
          if (!cancelled) setExposureBusy(false)
        }
      }
    }
    const timer = setInterval(() => {
      void inspect()
    }, 125)
    void inspect()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [phase])
  const enableCamera = async () => {
    stopCamera()
    const current = generation.current
    setPhase('opening')
    setError('')
    setContact(false)
    setLight('off')
    setLightConfirmed(false)
    setContactReady(false)
    setExposureBusy(false)
    setDiagnostics(null)
    lastCapture.current = null
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext)
        throw new Error(
          'Open this page over HTTPS in Safari on your phone to use the rear camera.',
        )
      let media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { exact: 'environment' },
          ...(camera ? { deviceId: { exact: camera } } : {}),
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 30, max: 60 },
        },
      })
      if (current !== generation.current) {
        media.getTracks().forEach((t) => t.stop())
        return
      }
      stream.current = media
      let track = media.getVideoTracks()[0]
      if (
        track.getSettings().facingMode &&
        track.getSettings().facingMode !== 'environment'
      )
        throw new Error('Select a rear camera to measure your pulse.')
      const devices = await navigator.mediaDevices.enumerateDevices()
      setCameras(
        devices.filter(
          (d) =>
            d.kind === 'videoinput' &&
            (!d.label || !/front|user|facetime/i.test(d.label)),
        ),
      )
      const primary = !camera
        ? primaryRearCamera(devices.filter((d) => d.kind === 'videoinput'))
        : null
      if (primary && primary !== track.getSettings().deviceId) {
        media.getTracks().forEach((t) => t.stop())
        media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: primary },
            facingMode: { exact: 'environment' },
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 30, max: 60 },
          },
        })
        if (current !== generation.current) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        stream.current = media
        track = media.getVideoTracks()[0]
        if (
          track.getSettings().facingMode &&
          track.getSettings().facingMode !== 'environment'
        )
          throw new Error('Select a rear camera to measure your pulse.')
      }
      if (!video.current)
        throw new Error('Camera preview could not start. Please retry.')
      video.current.srcObject = media
      await video.current.play()
      if (current !== generation.current) return
      await configurePulseCamera(track)
      if (current !== generation.current) return
      // Verify light after configuring the stream: some engines reset settings.
      const lightState = await enableCameraLight(track)
      if (current !== generation.current) return
      setLight(lightState)
      setLightConfirmed(lightState === 'on')
      track.addEventListener(
        'ended',
        () => {
          if (running.current) finishScan.current('camera-ended')
        },
        { once: true },
      )
      setPhase('ready')
      deadline.current = setTimeout(() => {
        stopCamera()
        setPhase('setup')
        setError('Camera stopped after inactivity. Enable it again when ready.')
      }, 30000)
    } catch (e) {
      if (current !== generation.current) return
      stopCamera()
      setPhase('setup')
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser and try again.'
          : e instanceof Error && e.name === 'OverconstrainedError'
            ? 'A compatible rear camera was not found. Use a supported phone.'
            : e instanceof Error
              ? e.message
              : 'Unable to open the rear camera.',
      )
    }
  }
  const begin = async () => {
    if (
      !position ||
      !rested ||
      !stream.current ||
      !lightConfirmed ||
      light === 'off' ||
      exposureBusy ||
      stream.current.getVideoTracks()[0]?.readyState !== 'live'
    )
      return
    setError('')
    setPhase('opening')
    const current = generation.current
    try {
      let ticket = 'demo'
      if (!demo) {
        const response = await fetch(
          `/api/kiosk/${encodeURIComponent(surveyId)}/rhr`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'start',
              playerId,
              questionId: question.id,
              password: suppliedPassword ?? (password || undefined),
              context: { position, rested: true },
              protocolVersion: RHR_VERSION,
            }),
            signal: AbortSignal.timeout(15000),
          },
        )
        const data = await response.json()
        if (response.status === 401) setNeedsCode(true)
        if (!response.ok) throw new Error(data.error || 'Unable to start.')
        ticket = data.ticket
      }
      if (current !== generation.current) return
      if (deadline.current) clearTimeout(deadline.current)
      const context = canvas.current?.getContext('2d', {
        willReadFrequently: true,
      })
      if (!context || !video.current)
        throw new Error('Camera sampling is unavailable.')
      const samples: PpgSample[] = [],
        session = new RhrSession(),
        start = performance.now()
      let lastPeak = -1
      const publish = (view: RhrSessionView) => {
        setProgress(view)
        if (view.lastPeakAt !== null && view.lastPeakAt - lastPeak >= 250) {
          lastPeak = view.lastPeakAt
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            heart.current?.animate?.(
              [
                { transform: 'scale(1)' },
                { transform: 'scale(1.23)', offset: 0.35 },
                { transform: 'scale(1)' },
              ],
              { duration: 220 },
            )
        }
      }
      let lastMediaTime = -1,
        lastContact = 0,
        lastPaint = 0
      running.current = true
      setProgress(session.snapshot())
      setPhase('scan')
      navigator.wakeLock
        ?.request('screen')
        .then((lock) => {
          if (!running.current) void lock.release()
          else wake.current = lock
        })
        .catch(() => {})
      const end = (reason: string | null) => {
        if (!running.current) return
        running.current = false
        const elapsedMs = Math.min(RHR_MAX_MS, performance.now() - start)
        const record: RhrRecord = {
          protocolVersion: RHR_VERSION,
          samples,
          elapsedMs,
          interruption: reason,
          torch: true,
        }
        void save(record, ticket, position)
      }
      finishScan.current = end
      qualityClock.current = setInterval(() => {
        if (!running.current) return
        const view = session.advanceTo(
          Math.min(RHR_MAX_MS, performance.now() - start),
        )
        publish(view)
        if (view.stage === 'complete' || view.stage === 'timeout') end(null)
      }, 250)
      deadline.current = setTimeout(() => {
        publish(session.advanceTo(RHR_MAX_MS))
        end(null)
      }, RHR_MAX_MS)
      const sample = () => {
        if (!running.current) return
        const t = performance.now() - start
        if (t >= RHR_MAX_MS) {
          end(null)
          return
        }
        const v = video.current
        if (v && v.readyState >= 2 && v.currentTime !== lastMediaTime) {
          lastMediaTime = v.currentTime
          // Only aggregate real frame intensities; no video is recorded or uploaded.
          const s = canvas.current ? sampleVideo(v, canvas.current, t) : null
          if (!s) {
            schedule()
            return
          }
          samples.push(s)
          const view = session.push(s)
          if (view.stage === 'complete' || view.stage === 'timeout') {
            publish(view)
            end(null)
            return
          }
          if (t - lastContact > 250) {
            setContact(fingerPresent(s))
            setHint(contactHint(s))
            lastContact = t
          }
          if (t - lastPaint > 100 && wave.current) {
            wave.current.setAttribute(
              'points',
              opticalTrace(samples.slice(-100)),
            )
            lastPaint = t
          }
        }
        schedule()
      }
      const schedule = () => {
        if (video.current?.requestVideoFrameCallback)
          videoFrame.current = video.current.requestVideoFrameCallback(sample)
        else frame.current = requestAnimationFrame(sample)
      }
      schedule()
    } catch (e) {
      if (current !== generation.current) return
      setError(e instanceof Error ? e.message : 'Unable to start.')
      setPhase('ready')
    }
  }
  const retry = () => {
    stopCamera()
    pending.current = null
    setPhase('setup')
    setResult(null)
    setError('')
  }
  const button = `pvt-action inline-flex w-full items-center justify-center gap-2 px-5 py-3 font-semibold text-white disabled:opacity-50 ${ui.primaryCtaButton} ${ui.focusVisibleRing}`
  return (
    <>
      <div
        className={`pvt-ui pvt-question-card rhr-question mt-3 rounded-2xl border ${ui.sliderCardBorder}`}
        data-pvt-theme={theme}
      >
        <div className="rhr-question-heading">
          <span className="rhr-heart-tile">
            <Heart size={28} />
          </span>
          <span className="rhr-time-chip">
            <Timer size={13} />
            15s CHECK
          </span>
        </div>
        <div className="rhr-question-orbit" aria-hidden="true">
          <Heart size={28} />
        </div>
        <div className="rhr-question-copy">
          <p className="rhr-eyebrow">RESTING PULSE</p>
          <h3>
            {completed ? (
              <>
                {completed.bpm}
                <small> bpm</small>
              </>
            ) : (
              'Resting heart rate'
            )}
          </h3>
          <p>
            {completed
              ? `${positionLabels[completed.position]} · Ready to submit`
              : 'A quiet moment. A simple camera check.'}
          </p>
        </div>
        {!completed ? (
          <>
            <div className="rhr-question-facts">
              <span>
                <Timer size={15} />
                15 seconds
              </span>
              <span>
                <Camera size={15} />
                Rear camera
              </span>
              <span>
                <Armchair size={15} />
                At rest
              </span>
            </div>
            <p className="rhr-question-rest">
              Rest quietly for 5 minutes before measuring.
            </p>
            <button
              ref={launch}
              type="button"
              className={button}
              onClick={() => setOpen(true)}
            >
              <Camera size={18} />
              <span>Measure resting HR</span>
              <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <div className="rhr-completed-chip">
            <CheckCircle2 size={17} />
            Measurement complete
          </div>
        )}
      </div>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Resting heart rate"
            tabIndex={-1}
            ref={dialog}
            className={`pvt-ui rhr-dialog fixed inset-0 z-[10000] overflow-y-auto text-white outline-none ${shell.root}`}
            data-pvt-theme={theme}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && phase !== 'scan' && phase !== 'saving')
                close()
              if (e.key === 'Tab') {
                const nodes = dialog.current?.querySelectorAll<HTMLElement>(
                  'button:not(:disabled),input:not(:disabled),select:not(:disabled)',
                )
                if (!nodes?.length) return
                const first = nodes[0],
                  last = nodes[nodes.length - 1]
                if (
                  e.shiftKey &&
                  (document.activeElement === first ||
                    document.activeElement === dialog.current)
                ) {
                  e.preventDefault()
                  last.focus()
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault()
                  first.focus()
                }
              }
            }}
          >
            <div className="pvt-dialog-inner">
              <div className="pvt-dialog-content">
                <section className="pvt-glass-panel">
                  <header className="pvt-dialog-header">
                    <div className="pvt-wordmark">
                      <span className="pvt-brand-mark">
                        <Heart size={23} />
                      </span>
                      <div>
                        <span>Resting heart rate</span>
                        <small>15-SECOND CAMERA CHECK</small>
                      </div>
                    </div>
                    {phase !== 'scan' && phase !== 'saving' && (
                      <button
                        type="button"
                        className="pvt-close"
                        aria-label="Close resting HR"
                        onClick={close}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </header>
                  <div
                    className="rhr-camera-preview"
                    data-active={['opening', 'ready', 'scan'].includes(phase)}
                    data-scanning={phase === 'scan'}
                  >
                    <span className="rhr-preview-label">Camera preview</span>
                    <video
                      ref={video}
                      muted
                      playsInline
                      className="rhr-video"
                      aria-hidden="true"
                    />
                  </div>
                  <canvas ref={canvas} width={32} height={32} hidden />
                  {phase === 'scan' ? (
                    <div className="rhr-scan-panel">
                      <div
                        className="rhr-pulse-circle"
                        role="progressbar"
                        aria-label="15-second measurement countdown"
                        aria-valuemin={0}
                        aria-valuemax={15}
                        aria-valuenow={Math.ceil(progress.remainingMs / 1000)}
                        data-stage={progress.stage}
                      >
                        <svg
                          className="rhr-pulse-ring"
                          viewBox="0 0 260 260"
                          aria-hidden="true"
                        >
                          <circle
                            cx="130"
                            cy="130"
                            r="116"
                            className="rhr-pulse-track"
                          />
                          <circle
                            cx="130"
                            cy="130"
                            r="116"
                            className="rhr-pulse-progress"
                            pathLength="1"
                            strokeDasharray="1"
                            strokeDashoffset={Math.min(
                              1,
                              Math.max(0, progress.remainingMs / 15000),
                            )}
                            transform="rotate(-90 130 130)"
                          />
                        </svg>
                        <div className="rhr-pulse-center">
                          <span
                            className="rhr-pulse-stage"
                            data-testid="rhr-stage"
                          >
                            {progress.stage === 'detecting'
                              ? 'DETECTING PULSE'
                              : progress.stage === 'recovering'
                                ? 'RECHECKING SIGNAL'
                                : 'MEASURING'}
                          </span>
                          <span className="rhr-pulse-time">
                            <span data-testid="rhr-countdown">
                              {Math.ceil(progress.remainingMs / 1000)}
                            </span>
                            s left
                          </span>
                          <div className="rhr-live-bpm">
                            <strong data-testid="rhr-live-bpm">
                              {contact && progress.provisionalBpm !== null
                                ? progress.provisionalBpm
                                : '—'}
                            </strong>
                            <span
                              ref={heart}
                              className="rhr-beat-heart"
                              aria-hidden="true"
                            >
                              <Heart size={29} fill="currentColor" />
                            </span>
                          </div>
                          <span className="rhr-provisional-label">
                            {progress.provisionalBpm === null
                              ? 'Finding your pulse'
                              : 'BPM · Live estimate'}
                          </span>
                          <svg
                            viewBox="0 0 300 80"
                            className="rhr-circle-wave"
                            aria-label="Live optical camera signal"
                          >
                            <polyline
                              ref={wave}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            />
                          </svg>
                        </div>
                      </div>
                      <span className="rhr-contact-chip" data-contact={contact}>
                        {contact ? 'Contact detected' : 'Adjust fingertip'}
                      </span>
                      <p className="rhr-scan-instruction">
                        Keep your hand relaxed and still.
                        <br />
                        Breathe normally.
                      </p>
                      <ol className="rhr-steps" aria-label="Measurement stages">
                        <li
                          data-state={
                            progress.stage === 'detecting' ? 'current' : 'done'
                          }
                        >
                          <span>
                            {progress.stage === 'detecting' ? '1' : '✓'}
                          </span>
                          Detect
                        </li>
                        <li
                          data-state={
                            progress.stage === 'measuring' ||
                            progress.stage === 'recovering'
                              ? 'current'
                              : 'next'
                          }
                        >
                          <span>2</span>Measure
                        </li>
                        <li data-state="next">
                          <span>3</span>Complete
                        </li>
                      </ol>
                      <p className="rhr-live-hint" aria-live="polite">
                        {hint}
                      </p>
                      <p className="rhr-scan-limit">
                        15 seconds · No automatic restarts
                      </p>
                      <button
                        type="button"
                        className="pvt-stop"
                        onClick={() => finishScan.current('cancelled')}
                      >
                        Cancel measurement
                      </button>
                    </div>
                  ) : phase === 'result' && result ? (
                    <div className="pvt-result-panel">
                      <p className="pvt-kicker">MEASUREMENT COMPLETE</p>
                      <div className="pvt-success-halo">
                        <CheckCircle2 size={48} />
                      </div>
                      <div className="pvt-completion-median">
                        <span>Resting heart rate estimate</span>
                        <strong>
                          <span data-testid="rhr-bpm">{result.bpm}</span>
                          <small>bpm</small>
                        </strong>
                        <p>
                          {positionLabels[result.position]} ·{' '}
                          {result.durationSeconds}s total
                          {result.restarts
                            ? ` · ${result.restarts} automatic restart${result.restarts === 1 ? '' : 's'}`
                            : ''}
                        </p>
                      </div>
                      <p className="pvt-result-copy">
                        Camera estimate · Device validation pending. Compare
                        readings taken in the same resting position.
                      </p>
                      <button
                        type="button"
                        data-testid="rhr-done"
                        className={button}
                        onClick={() => {
                          onChange(JSON.stringify(result))
                          close()
                        }}
                      >
                        Done
                        <ArrowRight size={20} />
                      </button>
                    </div>
                  ) : phase === 'repeat' || phase === 'retry-save' ? (
                    <div className="pvt-result-panel">
                      <p className="pvt-kicker">
                        {phase === 'repeat'
                          ? 'REPEAT REQUIRED'
                          : 'SAVE PENDING'}
                      </p>
                      <div className="pvt-success-halo">
                        <RotateCcw size={42} />
                      </div>
                      <h2>
                        {phase === 'repeat'
                          ? 'Repeat measurement'
                          : 'Retry saving'}
                      </h2>
                      <p role="alert" className="pvt-result-copy">
                        {error}
                      </p>
                      {diagnostics && (
                        <details className="rhr-diagnostics">
                          <summary>Scan details</summary>
                          <p>
                            {diagnostics.fps.toFixed(1)} fps ·{' '}
                            {diagnostics.samples} frames ·{' '}
                            {diagnostics.usableSeconds.toFixed(1)}s analyzed
                          </p>
                          <p>{diagnostics.reasons.join(' · ')}</p>
                          {lastCapture.current && (
                            <button
                              type="button"
                              className="pvt-stop"
                              onClick={() => {
                                const record = lastCapture.current
                                if (!record) return
                                const blob = new Blob(
                                  [
                                    JSON.stringify({
                                      algorithmVersion: RHR_ALGORITHM_VERSION,
                                      record,
                                      analysis: diagnostics,
                                    }),
                                  ],
                                  { type: 'application/json' },
                                )
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = 'resting-hr-signal.json'
                                a.click()
                                setTimeout(() => URL.revokeObjectURL(url), 1000)
                              }}
                            >
                              Download signal diagnostics
                            </button>
                          )}
                          <p>
                            Diagnostics contain timing and averaged camera
                            colors, without video or player identity. Download
                            only if you want to share them for troubleshooting.
                          </p>
                          <p>
                            If this repeats, try another rear lens near the
                            flash. Open this page in Chrome on Android or Safari
                            on iPhone.
                          </p>
                        </details>
                      )}
                      <button
                        type="button"
                        className={button}
                        data-testid="rhr-repeat"
                        onClick={() =>
                          phase === 'retry-save' && pending.current
                            ? void save(
                                pending.current.record,
                                pending.current.ticket,
                                pending.current.position,
                              )
                            : retry()
                        }
                      >
                        {phase === 'retry-save'
                          ? 'Retry save'
                          : 'Repeat measurement'}
                        <RotateCcw size={18} />
                      </button>
                      <button
                        type="button"
                        className="pvt-stop"
                        onClick={close}
                      >
                        Back to questionnaire
                      </button>
                    </div>
                  ) : phase === 'saving' ? (
                    <div className="pvt-result-panel">
                      <Loader2 className="mx-auto animate-spin" size={36} />
                      <h2>Checking your signal…</h2>
                      <p className="pvt-result-copy">
                        Keep this screen open while your result is verified.
                      </p>
                    </div>
                  ) : (
                    <div className="pvt-setup-panel">
                      <h2>
                        A quiet moment.
                        <br />
                        <span>Your resting pulse.</span>
                      </h2>
                      <p className="pvt-result-copy">
                        Rest quietly for at least 5 minutes before starting.
                        Cover the active rear camera lens with your fingertip,
                        close to the flash. Let the light illuminate your
                        finger; covering only the flash will not work. Use light
                        pressure and breathe normally.
                      </p>
                      <fieldset
                        className="pvt-position-field"
                        disabled={phase === 'opening'}
                      >
                        <legend>
                          Measurement position{' '}
                          <span className="text-rose-400">*</span>
                        </legend>
                        <div className="pvt-position-options">
                          {RHR_POSITIONS.map((p) => (
                            <button
                              type="button"
                              key={p}
                              className={`pvt-position-choice ${ui.focusVisibleRing}`}
                              aria-pressed={position === p}
                              onClick={() => setPosition(p)}
                            >
                              {positionLabels[p]}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <label className="rhr-rest-confirm">
                        <input
                          type="checkbox"
                          checked={rested}
                          onChange={(e) => setRested(e.target.checked)}
                        />
                        <span>
                          I have rested quietly for at least 5 minutes.
                        </span>
                      </label>
                      <p className="pvt-consistency-note">
                        <ShieldCheck size={16} />
                        <span>
                          One 15-second measurement, including camera settling.
                          The countdown never restarts. Video stays on your
                          phone.
                        </span>
                      </p>
                      {phase === 'ready' && (
                        <div
                          className="rhr-light-status"
                          role="status"
                          data-testid="rhr-light-status"
                        >
                          <p>
                            {light === 'on'
                              ? 'Camera light enabled. Cover the lens shown in the live preview.'
                              : 'Camera light requested. Check that the rear light is actually on.'}
                          </p>
                          <p
                            className="rhr-preflight-hint"
                            data-testid="rhr-preflight-hint"
                          >
                            {exposureBusy
                              ? 'Adjusting camera exposure…'
                              : contactReady
                                ? 'Contact ready · You can start the scan'
                                : hint}
                          </p>
                          {light !== 'on' && (
                            <>
                              <label className="rhr-rest-confirm">
                                <input
                                  type="checkbox"
                                  checked={lightConfirmed}
                                  onChange={(e) =>
                                    setLightConfirmed(e.target.checked)
                                  }
                                />
                                <span>
                                  I can see the rear camera light is on.
                                </span>
                              </label>
                              <button
                                type="button"
                                className="pvt-stop"
                                onClick={async () => {
                                  const track =
                                      stream.current?.getVideoTracks()[0],
                                    current = generation.current
                                  if (!track) return
                                  setLightConfirmed(false)
                                  setError('')
                                  try {
                                    const state = await enableCameraLight(track)
                                    if (current !== generation.current) return
                                    setLight(state)
                                    setLightConfirmed(state === 'on')
                                  } catch (e) {
                                    if (current !== generation.current) return
                                    setError(
                                      e instanceof Error
                                        ? e.message
                                        : 'Unable to switch on the camera light.',
                                    )
                                  }
                                }}
                              >
                                Try switching the light on again
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {cameras.length > 1 && (
                        <label className="rhr-camera-label">
                          Rear camera
                          <select
                            value={camera}
                            className={ui.inputFieldBase}
                            disabled={phase === 'opening'}
                            onChange={(e) => {
                              setCamera(e.target.value)
                              stopCamera()
                              setPhase('setup')
                            }}
                          >
                            <option value="">Automatic rear camera</option>
                            {cameras.map((c) => (
                              <option key={c.deviceId} value={c.deviceId}>
                                {c.label || 'Rear camera'}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {cameras.length > 1 && (
                        <p className="rhr-lens-note">
                          Multiple rear lenses? Cover a lens and watch the
                          preview to identify the active one. Select the lens
                          nearest the flash if contact stays unclear.
                        </p>
                      )}
                      {needsCode && (
                        <label className="rhr-camera-label">
                          Player access code
                          <input
                            type="password"
                            autoComplete="off"
                            className={ui.inputFieldBase}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </label>
                      )}
                      {error && (
                        <p className="pvt-alert" role="alert">
                          {error}
                        </p>
                      )}
                      <button
                        type="button"
                        className={button}
                        disabled={
                          !position ||
                          !rested ||
                          phase === 'opening' ||
                          (phase === 'ready' &&
                            (!lightConfirmed || exposureBusy))
                        }
                        onClick={() =>
                          phase === 'ready' ? void begin() : void enableCamera()
                        }
                      >
                        {phase === 'opening' ? (
                          <>
                            <Loader2 className="animate-spin" size={18} />
                            Getting ready…
                          </>
                        ) : phase === 'ready' ? (
                          <>
                            Start measurement
                            <ArrowRight size={18} />
                          </>
                        ) : (
                          <>
                            <Camera size={18} />
                            Enable rear camera
                          </>
                        )}
                      </button>
                      <p className="rhr-estimate-note">
                        Resting HR estimate · Not a medical measurement. No HRV
                        or fatigue score.
                      </p>
                    </div>
                  )}
                </section>
              </div>
              <p className="pvt-dialog-footer">
                {demo
                  ? 'Demo · No player data saved'
                  : 'Submit your wellness questionnaire to save this reading for your coach.'}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
