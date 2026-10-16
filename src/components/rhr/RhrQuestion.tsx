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
  X,
} from 'lucide-react'
import {
  getSurveyShellClasses,
  getSurveyUiTokens,
  type SurveyAppearanceTheme,
} from '@/lib/surveyFormAppearance'
import {
  analyzeRhr,
  fingerPresent,
  RHR_DURATION_MS,
  RHR_POSITIONS,
  RHR_VERSION,
  rhrReason,
  type PpgSample,
  type RhrPosition,
  type RhrRecord,
} from '@/lib/rhr/protocol'
import {
  enableCameraLight,
  primaryRearCamera,
  type TorchState,
} from '@/lib/rhr/camera'
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
    [remaining, setRemaining] = useState(15),
    [contact, setContact] = useState(false),
    [result, setResult] = useState<RhrAnswer | null>(null),
    [cameras, setCameras] = useState<MediaDeviceInfo[]>([]),
    [camera, setCamera] = useState(''),
    [light, setLight] = useState<TorchState | 'off'>('off'),
    [lightConfirmed, setLightConfirmed] = useState(false)
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    wave = useRef<SVGPolylineElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0),
    frame = useRef(0),
    videoFrame = useRef<number | null>(null),
    running = useRef(false),
    deadline = useRef<ReturnType<typeof setTimeout> | null>(null),
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
  }
  const save = async (
    record: RhrRecord,
    ticket: string,
    measuredPosition: RhrPosition,
  ) => {
    stopCamera()
    const current = generation.current
    setPhase('saving')
    setError('')
    pending.current = { record, ticket, position: measuredPosition }
    const analysis = analyzeRhr(record)
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
          durationSeconds: 15,
          protocolVersion: RHR_VERSION,
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
  const enableCamera = async () => {
    stopCamera()
    const current = generation.current
    setPhase('opening')
    setError('')
    setContact(false)
    setLight('off')
    setLightConfirmed(false)
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
      light === 'off'
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
        start = performance.now()
      let lastMediaTime = -1,
        lastContact = 0,
        lastPaint = 0
      running.current = true
      setRemaining(15)
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
        const elapsedMs = Math.min(RHR_DURATION_MS, performance.now() - start)
        const record = { samples, elapsedMs, interruption: reason, torch: true }
        void save(record, ticket, position)
      }
      finishScan.current = end
      deadline.current = setTimeout(() => end(null), RHR_DURATION_MS)
      const sample = () => {
        if (!running.current) return
        const t = performance.now() - start
        if (t >= RHR_DURATION_MS) {
          end(null)
          return
        }
        const v = video.current
        if (v && v.readyState >= 2 && v.currentTime !== lastMediaTime) {
          lastMediaTime = v.currentTime
          // Downsample a centered ROI; only aggregate intensity samples leave the device.
          const side = Math.min(v.videoWidth, v.videoHeight) * 0.55
          context.drawImage(
            v,
            (v.videoWidth - side) / 2,
            (v.videoHeight - side) / 2,
            side,
            side,
            0,
            0,
            32,
            32,
          )
          const pixels = context.getImageData(0, 0, 32, 32).data
          let r = 0,
            g = 0,
            b = 0,
            clipped = 0,
            min = 255,
            max = 0
          for (let i = 0; i < pixels.length; i += 4) {
            r += pixels[i]
            g += pixels[i + 1]
            b += pixels[i + 2]
            if (pixels[i] >= 252 && pixels[i + 1] >= 252) clipped++
            min = Math.min(min, pixels[i])
            max = Math.max(max, pixels[i])
          }
          const n = pixels.length / 4,
            s: PpgSample = {
              t,
              r: r / n,
              g: g / n,
              b: b / n,
              clipped: clipped / n,
              spread: (max - min) / 255,
            }
          samples.push(s)
          if (t - lastContact > 250) {
            setContact(fingerPresent(s))
            lastContact = t
          }
          if (t - lastPaint > 100 && wave.current) {
            const recent = samples.slice(-100),
              center = recent.reduce((a, s) => a + s.r, 0) / recent.length,
              amplitude = Math.max(
                1,
                ...recent.map((s) => Math.abs(s.r - center)),
              )
            wave.current.setAttribute(
              'points',
              recent
                .map(
                  (s, i) =>
                    `${i * 3},${40 - ((s.r - center) / amplitude) * 26}`,
                )
                .join(' '),
            )
            lastPaint = t
          }
        }
        setRemaining(Math.ceil((RHR_DURATION_MS - t) / 1000))
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
        className={`pvt-ui pvt-question-card mt-3 rounded-2xl border p-4 ${ui.sliderCardBorder}`}
        data-pvt-theme={theme}
      >
        <div className="flex items-center gap-3">
          <Heart className={ui.selectedValueText} />
          <div>
            <p className="font-semibold text-white">
              {completed ? `${completed.bpm} bpm` : 'Resting heart rate'}
            </p>
            <p className="text-sm text-slate-300">
              {completed
                ? `${positionLabels[completed.position]} · Ready to submit`
                : '15-second camera measurement'}
            </p>
          </div>
        </div>
        {!completed && (
          <button
            ref={launch}
            type="button"
            className={`${button} mt-4`}
            onClick={() => setOpen(true)}
          >
            <Camera size={18} />
            Measure resting HR
          </button>
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
                  >
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
                    <div className="pvt-result-panel">
                      <p className="pvt-kicker">
                        {remaining > 13 ? 'SETTLING SIGNAL' : 'MEASURING PULSE'}
                      </p>
                      <div className="rhr-countdown">
                        <Heart size={26} />
                        <strong data-testid="rhr-countdown">{remaining}</strong>
                        <span>seconds remaining</span>
                      </div>
                      <svg
                        viewBox="0 0 300 80"
                        className="rhr-wave"
                        aria-label="Live camera intensity signal"
                      >
                        <polyline
                          ref={wave}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                      <p className="pvt-result-copy" aria-live="polite">
                        {contact
                          ? 'Keep your fingertip still. Breathe normally.'
                          : 'Cover the rear camera completely. Use light pressure.'}
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
                          {positionLabels[result.position]} · 15-second scan
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
                        Cover the rear camera lens with your fingertip, keep
                        light pressure and breathe normally. No tapping during
                        this check.
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
                          15 seconds total, including signal settling. An
                          unclear signal requires a new scan. Video stays on
                          your phone; only signal samples are checked.
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
                          (phase === 'ready' && !lightConfirmed)
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
                            Start 15-second scan
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
