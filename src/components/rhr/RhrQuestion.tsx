'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TestLaunchButton from '@/components/survey/TestLaunchButton'
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
  RHR_DURATION_MS as RHR_MAX_MS,
  RHR_RESTORED_ALGORITHM_VERSION as RHR_ALGORITHM_VERSION,
  RHR_POSITIONS,
  RHR_RESTORED_VERSION as RHR_VERSION,
  type PpgSample,
  type RhrPosition,
  type RhrRecord,
  type RhrAnalysis,
} from '@/lib/rhr/protocol'
import {
  enableCameraLight,
  configurePulseCamera,
  primaryRearCamera,
  reducePulseExposure,
  holdAndroidPulseCamera,
  releasePulseExposureHold,
  needsAndroidCameraHold,
  RHR_ACQUISITION_VERSION,
  adjustAndroidPulseGain,
  type GainAdjustment,
  type CameraHold,
  type ExposureAdjustment,
  type TorchState,
} from '@/lib/rhr/camera'
import { analyzeRhrRecord, type RhrSessionView } from '@/lib/rhr/session'
import { RestoredRhrSession as RhrSession } from '@/lib/rhr/restored'
import { fingerPresent } from '@/lib/rhr/original'
import {
  sampleOriginalVideo as sampleVideo,
  opticalTrace,
} from '@/lib/rhr/sampling'
import {
  cameraDetails,
  captureFailure,
  checkCamera,
  frameSummary,
  improveFrameStream,
  nextRearCamera,
  verifySelectedCamera,
  type CameraCheck,
} from '@/lib/rhr/compatibility'
import { observationReasons } from '@/lib/rhr/observationProtocol'
import { parseRhrAnswer, type RhrAnswer } from '@/lib/rhr/options'
import '../pvt/pvt-focus.css'
import './rhr.css'
function downloadDiagnostics(payload: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function cameraName(devices: MediaDeviceInfo[], id: string) {
  const index = devices.findIndex((d) => d.deviceId === id)
  if (index < 0) return 'Rear camera'
  const name = devices[index].label || 'Rear camera'
  return `Camera ${index + 1} · ${name.length > 60 ? name.slice(0, 60) + '…' : name}`
}
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
    [cameraCheck, setCameraCheck] = useState<CameraCheck>(() =>
      checkCamera([], 0),
    ),
    [activeCamera, setActiveCamera] = useState<ReturnType<
      typeof cameraDetails
    > | null>(null),
    [exposureNote, setExposureNote] = useState(''),
    [holdNote, setHoldNote] = useState(''),
    [diagnostics, setDiagnostics] = useState<RhrAnalysis | null>(null)
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    wave = useRef<SVGPolylineElement>(null),
    heart = useRef<HTMLSpanElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0),
    frame = useRef(0),
    videoFrame = useRef<number | null>(null),
    observation = useRef<{ id: string; ended: boolean } | null>(null),
    running = useRef(false),
    starting = useRef(false),
    saving = useRef(false),
    cameraChanging = useRef(false),
    deadline = useRef<ReturnType<typeof setTimeout> | null>(null),
    qualityClock = useRef<ReturnType<typeof setInterval> | null>(null),
    lastCapture = useRef<RhrRecord | null>(null),
    compactStream = useRef(false),
    setupSamples = useRef<PpgSample[]>([]),
    exposureAdjustments = useRef<
      (ExposureAdjustment & { stats: ReturnType<typeof frameSummary> })[]
    >([]),
    cameraHold = useRef<CameraHold | null>(null),
    gainAdjustments = useRef<
      (GainAdjustment & {
        stats: ReturnType<typeof frameSummary>
        after?: ReturnType<typeof frameSummary>
        imageResponse?: 'matched' | 'no-response'
      })[]
    >([]),
    captureInfo = useRef<{
      camera: ReturnType<typeof cameraDetails>
      preflight: CameraCheck
      userAgent: string
      lightConfirmed: boolean
      compactStream: boolean
      exposureAdjustments: typeof exposureAdjustments.current
      acquisitionVersion: string
      cameraHold: CameraHold | null
      gainAdjustments: typeof gainAdjustments.current
      settingsTrace: {
        t: number
        settings: ReturnType<typeof cameraDetails>['settings']
      }[]
    } | null>(null),
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
  const reportOutcome = (
    status: 'REPEAT' | 'INTERRUPTED' | 'CAMERA_ERROR' | 'INCOMPLETE',
    reason: string,
  ) => {
    const attempt = observation.current
    if (demo || !attempt || attempt.ended) return
    attempt.ended = true
    const normalized =
      observationReasons.find((r) => r === reason) ?? 'signal-quality'
    // Small operational status only. Never upload diagnostics, images or camera IDs.
    void fetch(`/api/kiosk/${encodeURIComponent(surveyId)}/rhr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        action: 'report',
        eventId: attempt.id,
        playerId,
        questionId: question.id,
        password: suppliedPassword ?? (password || undefined),
        position: position ?? undefined,
        status,
        reason: normalized,
        protocolVersion: RHR_VERSION,
        acquisitionVersion: RHR_ACQUISITION_VERSION,
      }),
    }).catch(() => {})
  }
  const stopCamera = () => {
    running.current = false
    starting.current = false
    saving.current = false
    cameraChanging.current = false
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
    if (video.current) {
      video.current.pause()
      video.current.srcObject = null
    }
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
    reportOutcome('INCOMPLETE', 'cancelled')
    stopCamera()
    setOpen(false)
    setPhase('setup')
    setError('')
    pending.current = null
    setResult(null)
    lastCapture.current = null
    captureInfo.current = null
    setupSamples.current = []
    exposureAdjustments.current = []
    setExposureNote('')
    cameraHold.current = null
    gainAdjustments.current = []
    setHoldNote('')
  }
  const save = async (
    record: RhrRecord,
    ticket: string,
    measuredPosition: RhrPosition,
  ) => {
    if (saving.current) return
    lastCapture.current = record
    stopCamera()
    saving.current = true
    const current = generation.current
    setPhase('saving')
    setError('')
    pending.current = { record, ticket, position: measuredPosition }
    const analysis = analyzeRhrRecord(record)
    setDiagnostics(analysis)
    if (analysis.quality !== 'ACCEPTED') {
      reportOutcome(
        record.interruption ? 'INTERRUPTED' : 'REPEAT',
        record.interruption === 'camera-ended'
          ? 'camera-ended'
          : record.interruption
            ? 'interrupted'
            : analysis.reasons[0] || 'signal-quality',
      )
      setError(captureFailure(analysis, record))
      setPhase('repeat')
      pending.current = null
      saving.current = false
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
        if (current !== generation.current) return
        if (!response.ok)
          throw new Error(
            data.error || 'Unable to save. Retry this measurement.',
          )
        if (!data.accepted) {
          if (observation.current) observation.current.ended = true
          setDiagnostics(data.analysis ?? analysis)
          setError(captureFailure(data.analysis ?? analysis, record))
          setPhase('repeat')
          pending.current = null
          return
        }
        answer = data.result
      }
      if (current !== generation.current) return
      try {
        if (captureInfo.current?.camera.actualId)
          localStorage.setItem(
            'rhr-working-camera-v1',
            captureInfo.current.camera.actualId,
          )
        if (
          captureInfo.current?.camera.actualId &&
          captureInfo.current.compactStream
        )
          localStorage.setItem(
            'rhr-working-stream-v1',
            JSON.stringify({
              deviceId: captureInfo.current.camera.actualId,
              compact: true,
            }),
          )
      } catch {
        /* Optional device preference. */
      }
      if (observation.current) observation.current.ended = true
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
    } finally {
      if (current === generation.current) saving.current = false
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
  // Count distinct real video frames; a polling interval would underreport camera FPS.
  useEffect(() => {
    if (phase !== 'ready') return
    let cancelled = false,
      callback: number | null = null,
      raf = 0,
      lastMedia = -1,
      lastPaint = 0,
      adjusting = false,
      lastAdjustment = -Infinity,
      blocked = exposureAdjustments.current.some(
        (a) => a.status !== 'requested',
      ),
      gainBlocked = gainAdjustments.current.some(
        (a) => a.status !== 'requested' || a.imageResponse === 'no-response',
      )
    const element = video.current
    const started = performance.now(),
      samples: PpgSample[] = []
    setupSamples.current = samples
    setCameraCheck(checkCamera([], 0))
    const android = needsAndroidCameraHold(navigator.userAgent)
    const adjustGain = async (stats: ReturnType<typeof frameSummary>) => {
      const track = stream.current?.getVideoTracks()[0]
      if (!track || adjusting || cancelled) return
      adjusting = true
      cameraChanging.current = true
      setCameraCheck({
        ...checkCamera([], 0),
        code: 'gain-calibration',
        message: 'Optimizing camera sensitivity from real image brightness…',
      })
      setHoldNote('Optimizing camera lighting. Keep your fingertip still…')
      try {
        const adjustment = await adjustAndroidPulseGain(track, stats.red)
        if (cancelled) return
        gainAdjustments.current.push({ ...adjustment, stats })
        gainBlocked = adjustment.status !== 'requested'
        const state =
          (track.getSettings() as MediaTrackSettings & { torch?: boolean })
            .torch === true
            ? 'on'
            : await enableCameraLight(track)
        if (cancelled) return
        setLight(state)
        setLightConfirmed(state === 'on')
        setActiveCamera(cameraDetails(track, camera, state))
        setHoldNote(
          gainBlocked
            ? 'Camera sensitivity could not be confirmed. Checking the image and automatic exposure fallback.'
            : 'Sensitivity adjustment requested. Checking its effect in fresh camera frames…',
        )
      } catch {
        if (cancelled) return
        gainBlocked = true
        gainAdjustments.current.push({
          status: 'unsupported',
          before: null,
          requested: null,
          reported: null,
          stats,
        })
        setHoldNote(
          'This browser could not adjust sensitivity. Checking automatic exposure fallback.',
        )
      } finally {
        if (!cancelled) {
          samples.length = 0
          lastAdjustment = performance.now() - started
          lastPaint = -Infinity
          cameraChanging.current = false
        }
        adjusting = false
      }
    }
    const stabilize = async (releaseExposure = false) => {
      const track = stream.current?.getVideoTracks()[0]
      if (!track || adjusting || cancelled) return
      // Record the one-shot attempt before awaiting, including when modes are ignored.
      if (releaseExposure) {
        if (!cameraHold.current) return
        cameraHold.current.exposureReleased = true
      } else cameraHold.current = { controls: [], exposureReleased: false }
      adjusting = true
      cameraChanging.current = true
      setCameraCheck({
        ...checkCamera([], 0),
        code: 'camera-stabilizing',
        message: 'Stabilizing camera settings before measurement…',
      })
      setHoldNote(
        releaseExposure
          ? 'Restoring automatic exposure and checking the image…'
          : 'Stabilizing camera colors, focus and exposure. Keep your fingertip still…',
      )
      try {
        if (releaseExposure) await releasePulseExposureHold(track)
        else {
          const report = await holdAndroidPulseCamera(
            track,
            navigator.userAgent,
          )
          if (cancelled) return
          cameraHold.current = report
        }
        if (cancelled) return
        const state =
          (track.getSettings() as MediaTrackSettings & { torch?: boolean })
            .torch === true
            ? 'on'
            : await enableCameraLight(track)
        if (cancelled) return
        setLight(state)
        setLightConfirmed(state === 'on')
        setActiveCamera(cameraDetails(track, camera, state))
        setHoldNote(
          'Camera settings checked. Waiting for fresh, stable colors before the 15-second measurement.',
        )
      } catch {
        if (cancelled) return
        setHoldNote(
          'The browser could not confirm stable camera controls. Check the image or download camera diagnostics.',
        )
        setLight('unconfirmed')
        setLightConfirmed(false)
      } finally {
        if (!cancelled) {
          samples.length = 0
          lastAdjustment = performance.now() - started
          lastPaint = -Infinity
          cameraChanging.current = false
        }
        adjusting = false
      }
    }
    const calibrate = async (stats: ReturnType<typeof frameSummary>) => {
      const track = stream.current?.getVideoTracks()[0]
      if (!track || adjusting || blocked || cancelled) return
      adjusting = true
      cameraChanging.current = true
      setExposureNote('Adjusting camera lighting. Keep your fingertip still…')
      try {
        const adjustment = await reducePulseExposure(track)
        if (cancelled) return
        exposureAdjustments.current.push({ ...adjustment, stats })
        blocked = adjustment.status !== 'requested'
        // Do not reconfigure a confirmed light; that can reset exposure on some devices.
        let state: TorchState = 'on'
        if (
          (track.getSettings() as MediaTrackSettings & { torch?: boolean })
            .torch !== true
        )
          state = await enableCameraLight(track)
        if (cancelled) return
        setLight(state)
        setLightConfirmed(state === 'on')
        setActiveCamera(cameraDetails(track, camera, state))
        if (blocked)
          setExposureNote(
            adjustment.status === 'limit'
              ? 'This camera has reached its exposure limit. Try another rear camera or download camera diagnostics.'
              : 'The browser could not confirm an exposure change. Try another rear camera or download camera diagnostics.',
          )
        else
          setExposureNote(
            'Lighting adjustment requested. Checking fresh camera frames…',
          )
      } catch {
        if (cancelled) return
        blocked = true
        setLight('off')
        setLightConfirmed(false)
        exposureAdjustments.current.push({
          status: 'unsupported',
          before: null,
          requested: null,
          reported: null,
          stats,
        })
        setExposureNote(
          'This browser could not adjust camera exposure. Try another rear camera or download camera diagnostics.',
        )
      } finally {
        if (!cancelled) {
          // Discard pre-adjustment frames. Never blend two exposures in a capture.
          samples.length = 0
          lastAdjustment = performance.now() - started
          lastPaint = -Infinity
          cameraChanging.current = false
        }
        adjusting = false
      }
    }
    const paint = () => {
      if (cancelled) return
      const t = performance.now() - started
      if (t - lastPaint >= 250) {
        const manualExposure =
          cameraHold.current &&
          !cameraHold.current.exposureReleased &&
          cameraHold.current.controls.some(
            (c) => c.mode === 'exposureMode' && c.status !== 'unsupported',
          )
        const checked =
          adjusting || t - lastAdjustment < 1500
            ? {
                status: 'checking' as const,
                code: 'exposure-settling',
                message: 'Adjusting lighting and checking fresh frames…',
                stats: frameSummary(samples),
              }
            : checkCamera(samples, t, android, !!manualExposure)
        setCameraCheck(checked)
        const latest = samples.at(-1)
        const covered = !!latest && t - latest.t <= 400 && fingerPresent(latest)
        setContact(covered)
        setHint(checked.message)
        lastPaint = t
        const lastGain = gainAdjustments.current.at(-1)
        if (
          !adjusting &&
          t - lastAdjustment >= 1500 &&
          checked.stats.seconds >= 1.5 &&
          checked.stats.contactFraction >= 0.8 &&
          lastGain &&
          lastGain.status === 'requested' &&
          !lastGain.after
        ) {
          lastGain.after = checked.stats
          const delta = checked.stats.red - lastGain.stats.red
          const increasing = (lastGain.requested ?? 0) > (lastGain.before ?? 0)
          lastGain.imageResponse =
            (increasing ? delta : -delta) >
            Math.max(2, lastGain.stats.red * 0.05)
              ? 'matched'
              : 'no-response'
          if (lastGain.imageResponse === 'no-response') gainBlocked = true
        }
        const needsGain =
          android &&
          manualExposure &&
          lightConfirmed &&
          checked.stats.red >= 35 &&
          checked.stats.contactFraction >= 0.8 &&
          (['weak-light', 'red-ceiling'].includes(checked.code) ||
            (checked.status === 'ready' &&
              checked.stats.red < 140 &&
              checked.stats.green < 20))
        if (
          !adjusting &&
          needsGain &&
          !gainBlocked &&
          gainAdjustments.current.length < 4
        ) {
          void adjustGain(checked.stats)
        } else if (
          !adjusting &&
          checked.status === 'problem' &&
          cameraHold.current &&
          !cameraHold.current.exposureReleased &&
          cameraHold.current.controls.some(
            (c) => c.mode === 'exposureMode' && c.status !== 'unsupported',
          ) &&
          [
            'too-dark',
            'weak-light',
            'too-bright',
            'red-ceiling',
            'slow-frames',
            'no-frames',
            'frame-gaps',
          ].includes(checked.code)
        ) {
          void stabilize(true)
        } else if (
          checked.code === 'red-ceiling' &&
          lightConfirmed &&
          !blocked
        ) {
          if (exposureAdjustments.current.length < 4)
            void calibrate(checked.stats)
          else
            setExposureNote(
              'The image is still almost flat after bounded lighting adjustments. Try another rear camera or download camera diagnostics.',
            )
        } else if (
          checked.status === 'ready' &&
          exposureAdjustments.current.length
        ) {
          setExposureNote(
            'Camera lighting checked after adjustment. Pulse is assessed during the 15-second measurement.',
          )
        }
        if (
          !adjusting &&
          android &&
          lightConfirmed &&
          !cameraHold.current &&
          ['ready', 'settling-colors', 'weak-light'].includes(checked.code)
        )
          void stabilize()
        if (checked.status === 'ready' && cameraHold.current && !adjusting)
          setHoldNote(
            'Camera check complete. Keep the same fingertip contact throughout the 15-second measurement.',
          )
      }
    }
    const schedule = () => {
      if (cancelled) return
      if (element?.requestVideoFrameCallback)
        callback = element.requestVideoFrameCallback(sample)
      else raf = requestAnimationFrame(sample)
    }
    const sample = () => {
      if (cancelled) return
      const v = element,
        t = performance.now() - started
      if (v && canvas.current && v.currentTime !== lastMedia) {
        lastMedia = v.currentTime
        const s = sampleVideo(v, canvas.current, t)
        if (s) samples.push(s)
        while (samples.length && samples[0].t < t - 3000) samples.shift()
      }
      paint()
      schedule()
    }
    const clock = setInterval(paint, 250)
    schedule()
    return () => {
      cancelled = true
      clearInterval(clock)
      cancelAnimationFrame(raf)
      if (callback !== null) element?.cancelVideoFrameCallback?.(callback)
    }
  }, [phase, lightConfirmed, camera])
  const armCameraIdle = () => {
    if (deadline.current) clearTimeout(deadline.current)
    deadline.current = setTimeout(() => {
      reportOutcome('INCOMPLETE', 'setup-timeout')
      stopCamera()
      setPhase('setup')
      setError('Camera stopped after inactivity. Enable it again when ready.')
    }, 30000)
  }
  const enableCamera = async (requestedId = camera) => {
    reportOutcome('INCOMPLETE', 'cancelled')
    stopCamera()
    try {
      observation.current = { id: crypto.randomUUID(), ended: false }
    } catch {
      observation.current = null
    }
    const current = generation.current
    setPhase('opening')
    setError('')
    setContact(false)
    setLight('off')
    setLightConfirmed(false)
    setCameraCheck(checkCamera([], 0))
    setActiveCamera(null)
    setDiagnostics(null)
    lastCapture.current = null
    captureInfo.current = null
    compactStream.current = false
    setupSamples.current = []
    exposureAdjustments.current = []
    setExposureNote('')
    cameraHold.current = null
    gainAdjustments.current = []
    setHoldNote('')
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext)
        throw new Error(
          'Open this page over HTTPS in a phone browser that supports camera access.',
        )
      let media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { exact: 'environment' },
          ...(requestedId ? { deviceId: { exact: requestedId } } : {}),
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
      if (current !== generation.current) {
        media.getTracks().forEach((t) => t.stop())
        return
      }
      setCameras(
        devices.filter(
          (d) =>
            d.kind === 'videoinput' &&
            (!d.label || !/front|user|facetime/i.test(d.label)),
        ),
      )
      let saved = ''
      try {
        saved = localStorage.getItem('rhr-working-camera-v1') || ''
      } catch {
        /* Optional preference. */
      }
      const primary = !requestedId
        ? devices.some((d) => d.kind === 'videoinput' && d.deviceId === saved)
          ? saved
          : primaryRearCamera(devices.filter((d) => d.kind === 'videoinput'))
        : null
      const selected = primary || requestedId
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
      try {
        const savedStream = JSON.parse(
          localStorage.getItem('rhr-working-stream-v1') || 'null',
        )
        if (
          savedStream?.compact === true &&
          savedStream.deviceId === track.getSettings().deviceId
        ) {
          await improveFrameStream(track)
          compactStream.current = true
        }
      } catch {
        /* Fall back to the original stream and measure its actual cadence. */
      }
      if (current !== generation.current) return
      // Verify light after configuring the stream: some engines reset settings.
      const lightState = await enableCameraLight(track)
      if (current !== generation.current) return
      verifySelectedCamera(selected, track.getSettings())
      const details = cameraDetails(track, selected, lightState)
      setActiveCamera(details)
      setCamera(details.actualId || selected)
      setLight(lightState)
      setLightConfirmed(lightState === 'on')
      track.addEventListener(
        'ended',
        () => {
          if (current !== generation.current) return
          if (running.current) finishScan.current('camera-ended')
          else {
            reportOutcome('CAMERA_ERROR', 'camera-ended')
            stopCamera()
            setPhase('setup')
            setError('Camera disconnected. Enable it again to measure.')
          }
        },
        { once: true },
      )
      setPhase('ready')
      armCameraIdle()
    } catch (e) {
      if (current !== generation.current) return
      reportOutcome(
        'CAMERA_ERROR',
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'camera-permission'
          : e instanceof Error && /light/i.test(e.message)
            ? 'camera-light'
            : 'camera-error',
      )
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
  const optimizeCamera = async () => {
    const track = stream.current?.getVideoTracks()[0],
      current = generation.current
    if (!track) return
    setPhase('opening')
    setError('')
    if (deadline.current) clearTimeout(deadline.current)
    let failure = ''
    try {
      await improveFrameStream(track)
      compactStream.current = true
    } catch (e) {
      failure =
        e instanceof Error
          ? e.message
          : 'The camera could not change stream settings.'
    }
    if (current !== generation.current) return
    try {
      const state = await enableCameraLight(track)
      if (current !== generation.current) return
      setLight(state)
      setLightConfirmed(state === 'on')
      setActiveCamera(cameraDetails(track, camera, state))
      setError(failure)
      setPhase('ready')
      armCameraIdle()
    } catch (e) {
      if (current !== generation.current) return
      stopCamera()
      setPhase('setup')
      setError(
        e instanceof Error
          ? e.message
          : 'Reopen the camera and check the rear light.',
      )
    }
  }
  const begin = async () => {
    if (
      !position ||
      phase !== 'ready' ||
      starting.current ||
      running.current ||
      cameraChanging.current ||
      !rested ||
      !stream.current ||
      !lightConfirmed ||
      light === 'off' ||
      cameraCheck.status !== 'ready' ||
      stream.current.getVideoTracks()[0]?.readyState !== 'live'
    )
      return
    starting.current = true
    // Inactivity ends when Start is pressed, not when the network replies.
    if (deadline.current) clearTimeout(deadline.current)
    deadline.current = null
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
              observation: observation.current
                ? {
                    id: observation.current.id,
                    acquisitionVersion: RHR_ACQUISITION_VERSION,
                  }
                : undefined,
              protocolVersion: RHR_VERSION,
            }),
            signal: AbortSignal.timeout(15000),
          },
        )
        const data = await response.json()
        if (current !== generation.current) return
        if (response.status === 401) setNeedsCode(true)
        if (!response.ok) throw new Error(data.error || 'Unable to start.')
        ticket = data.ticket
      }
      if (current !== generation.current) return
      if (stream.current?.getVideoTracks()[0]?.readyState !== 'live')
        throw new Error('Camera disconnected. Enable it again to measure.')
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
      const liveTrack = stream.current?.getVideoTracks()[0]
      if (liveTrack)
        captureInfo.current = {
          camera: cameraDetails(liveTrack, camera, light),
          preflight: cameraCheck,
          userAgent: navigator.userAgent,
          lightConfirmed,
          compactStream: compactStream.current,
          exposureAdjustments: [...exposureAdjustments.current],
          acquisitionVersion: RHR_ACQUISITION_VERSION,
          cameraHold: cameraHold.current,
          gainAdjustments: gainAdjustments.current,
          settingsTrace: [
            {
              t: 0,
              settings: cameraDetails(liveTrack, camera, light).settings,
            },
          ],
        }
      setPhase('scan')
      navigator.wakeLock
        ?.request('screen')
        .then((lock) => {
          if (current !== generation.current || !running.current)
            void lock.release().catch(() => {})
          else wake.current = lock
        })
        .catch(() => {})
      const end = (reason: string | null) => {
        if (current !== generation.current || !running.current) return
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
        if (current !== generation.current || !running.current) return
        const elapsed = Math.min(RHR_MAX_MS, performance.now() - start)
        if (
          liveTrack &&
          captureInfo.current &&
          elapsed - (captureInfo.current.settingsTrace.at(-1)?.t ?? 0) >= 1000
        ) {
          try {
            captureInfo.current.settingsTrace.push({
              t: elapsed,
              settings: cameraDetails(liveTrack, camera, light).settings,
            })
          } catch {
            /* Optical capture remains independent of optional diagnostics. */
          }
        }
        const view = session.advanceTo(elapsed)
        publish(view)
        if (view.stage === 'complete' || view.stage === 'timeout') end(null)
      }, 250)
      deadline.current = setTimeout(() => {
        if (current !== generation.current || !running.current) return
        publish(session.advanceTo(RHR_MAX_MS))
        end(null)
      }, RHR_MAX_MS)
      const sample = () => {
        if (current !== generation.current || !running.current) return
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
            setHint(
              fingerPresent(s)
                ? 'Contact detected · Keep your hand still'
                : 'Cover the active lens completely · Use light pressure',
            )
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
        if (current !== generation.current || !running.current) return
        if (video.current?.requestVideoFrameCallback)
          videoFrame.current = video.current.requestVideoFrameCallback(sample)
        else frame.current = requestAnimationFrame(sample)
      }
      schedule()
    } catch (e) {
      if (current !== generation.current) return
      setError(e instanceof Error ? e.message : 'Unable to start.')
      if (stream.current?.getVideoTracks()[0]?.readyState === 'live') {
        setPhase('ready')
        armCameraIdle()
      } else {
        stopCamera()
        setPhase('setup')
      }
    } finally {
      if (current === generation.current) starting.current = false
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
        <div className="pvt-question-heading">
          <span className="pvt-question-icon"><Heart size={24} /></span>
          <div className="min-w-0 flex-1">
            <p className="pvt-question-title">
              {completed ? <>{completed.bpm}<small>bpm</small></> : '15-second measurement'}
            </p>
            <p className="pvt-question-subtitle">
              {completed ? `${positionLabels[completed.position]} · Ready to submit` : 'Rear camera · At rest'}
            </p>
          </div>
        </div>
        {!completed ? (
          <>
            <p className="pvt-question-description">
              Rest quietly for 5 minutes before measuring.
            </p>
            <TestLaunchButton
              ref={launch}
              icon={Camera}
              onClick={() => setOpen(true)}
            >
              Measure resting HR
            </TestLaunchButton>
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
                            15-second measurement
                          </span>
                          <div className="rhr-live-bpm">
                            <strong data-testid="rhr-countdown">
                              {Math.ceil(progress.remainingMs / 1000)}
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
                            seconds remaining · BPM shown at completion
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
                            {lastCapture.current
                              ? frameSummary(
                                  lastCapture.current.samples,
                                ).fps.toFixed(1)
                              : diagnostics.fps.toFixed(1)}{' '}
                            delivered fps ·{' '}
                            {lastCapture.current?.samples.length ??
                              diagnostics.samples}{' '}
                            captured frames
                          </p>
                          <p>{diagnostics.reasons.join(' · ')}</p>
                          {lastCapture.current && (
                            <button
                              type="button"
                              className="pvt-stop"
                              onClick={() => {
                                const record = lastCapture.current
                                if (!record) return
                                downloadDiagnostics(
                                  {
                                    algorithmVersion: RHR_ALGORITHM_VERSION,
                                    record,
                                    analysis: diagnostics,
                                    capture: captureInfo.current,
                                    deliveredFrames: frameSummary(
                                      record.samples,
                                    ),
                                    analyzedFrames: frameSummary(
                                      record.samples.filter((s) => s.t >= 2000),
                                    ),
                                  },
                                  'resting-hr-signal.json',
                                )
                              }}
                            >
                              Download signal diagnostics
                            </button>
                          )}
                          <p>
                            Diagnostics contain camera identifiers, settings,
                            browser details and averaged colors. No video or
                            player identity. Download only if you want to share
                            them for troubleshooting.
                          </p>
                          <p>
                            Check the actual frame rate and camera setup before
                            repeating. A repeat uses the same camera; use Try
                            another rear camera to request a different one.
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
                          : 'Repeat with this camera'}
                        <RotateCcw size={18} />
                      </button>
                      {phase === 'repeat' &&
                        (nextRearCamera(
                          cameras,
                          activeCamera?.actualId || camera,
                        ) ? (
                          <button
                            type="button"
                            className="pvt-stop"
                            data-testid="rhr-next-camera"
                            onClick={() => {
                              const next = nextRearCamera(
                                cameras,
                                activeCamera?.actualId || camera,
                              )
                              if (next) {
                                setCamera(next)
                                setResult(null)
                                pending.current = null
                                void enableCamera(next)
                              }
                            }}
                          >
                            Try another rear camera
                          </button>
                        ) : (
                          <p className="rhr-lens-note">
                            This browser exposes one rear camera. No alternate
                            rear camera is available here.
                          </p>
                        ))}
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
                      {phase !== 'ready' ? (
                        <>
                          <h2>Measurement setup</h2>
                          <p className="pvt-result-copy">
                            Rest quietly for at least 5 minutes before starting.
                            Cover the active rear camera lens with your
                            fingertip, close to the flash. Let the light
                            illuminate your finger; covering only the flash will
                            not work. Use light pressure and breathe normally.
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
                              One 15-second measurement, including camera
                              settling. The countdown never restarts. Video
                              stays on your phone.
                            </span>
                          </p>
                        </>
                      ) : (
                        <>
                          <h2>Check your camera.</h2>
                          <p className="rhr-lens-note">
                            {position
                              ? positionLabels[position]
                              : 'Position not selected'}{' '}
                            · Rest confirmed · 15-second capture
                          </p>
                          <button
                            type="button"
                            className="pvt-stop"
                            onClick={() => {
                              stopCamera()
                              setPhase('setup')
                            }}
                          >
                            Change position or rest confirmation
                          </button>
                        </>
                      )}
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
                          {activeCamera && (
                            <p
                              className="rhr-active-camera"
                              data-testid="rhr-active-camera"
                            >
                              Active:{' '}
                              {cameraName(
                                cameras,
                                activeCamera.actualId ||
                                  activeCamera.requestedId,
                              )}
                              <br />
                              Cover one lens at a time to confirm the active
                              lens in the preview.
                            </p>
                          )}
                          <p
                            className="rhr-preflight-hint"
                            data-testid="rhr-preflight-hint"
                            data-status={cameraCheck.status}
                          >
                            {cameraCheck.message}
                          </p>
                          <p className="rhr-lens-note">
                            Camera check happens before the 15-second
                            measurement. It does not confirm pulse accuracy.
                          </p>
                          {exposureNote && (
                            <p
                              className="rhr-lens-note"
                              role="status"
                              data-testid="rhr-exposure-note"
                            >
                              {exposureNote}
                            </p>
                          )}
                          {holdNote && (
                            <p
                              className="rhr-lens-note"
                              role="status"
                              data-testid="rhr-hold-note"
                            >
                              {holdNote}
                            </p>
                          )}
                          {cameraCheck.status === 'problem' &&
                            ['slow-frames', 'frame-gaps'].includes(
                              cameraCheck.code,
                            ) && (
                              <button
                                type="button"
                                className="pvt-stop"
                                data-testid="rhr-improve-stream"
                                onClick={() => void optimizeCamera()}
                              >
                                Improve camera stream
                              </button>
                            )}
                          {cameraCheck.status === 'problem' &&
                            ['no-frames', 'frame-gaps'].includes(
                              cameraCheck.code,
                            ) && (
                              <button
                                type="button"
                                className="pvt-stop"
                                onClick={() => void enableCamera(camera)}
                              >
                                Reopen this camera
                              </button>
                            )}
                          {cameraCheck.status === 'problem' &&
                            nextRearCamera(
                              cameras,
                              activeCamera?.actualId || camera,
                            ) && (
                              <button
                                type="button"
                                className="pvt-stop"
                                onClick={() => {
                                  const next = nextRearCamera(
                                    cameras,
                                    activeCamera?.actualId || camera,
                                  )
                                  if (next) void enableCamera(next)
                                }}
                              >
                                Try another rear camera
                              </button>
                            )}
                          {!nextRearCamera(
                            cameras,
                            activeCamera?.actualId || camera,
                          ) && (
                            <p className="rhr-lens-note">
                              No alternate rear camera is exposed by this
                              browser.
                            </p>
                          )}
                          <details className="rhr-diagnostics">
                            <summary>Camera details</summary>
                            <p>
                              {cameraCheck.stats.fps.toFixed(1)} delivered fps ·{' '}
                              {cameraCheck.stats.frames} recent frames
                            </p>
                            <button
                              type="button"
                              className="pvt-stop"
                              onClick={() => {
                                const track =
                                  stream.current?.getVideoTracks()[0]
                                downloadDiagnostics(
                                  {
                                    diagnosticKind: 'camera-setup',
                                    algorithmVersion: RHR_ALGORITHM_VERSION,
                                    camera: track
                                      ? cameraDetails(track, camera, light)
                                      : activeCamera,
                                    check: cameraCheck,
                                    samples: setupSamples.current,
                                    userAgent: navigator.userAgent,
                                    lightConfirmed,
                                    compactStream: compactStream.current,
                                    exposureAdjustments:
                                      exposureAdjustments.current,
                                    acquisitionVersion: RHR_ACQUISITION_VERSION,
                                    cameraHold: cameraHold.current,
                                    gainAdjustments: gainAdjustments.current,
                                  },
                                  'resting-hr-camera.json',
                                )
                              }}
                            >
                              Download camera diagnostics
                            </button>
                            <p>
                              Local download of camera identifiers, settings,
                              browser details and averaged colors. No video or
                              player identity. Nothing is uploaded
                              automatically.
                            </p>
                          </details>
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
                              const id = e.target.value
                              setCamera(id)
                              void enableCamera(id)
                            }}
                          >
                            <option value="">
                              Automatic · last working camera
                            </option>
                            {cameras.map((c, index) => (
                              <option key={c.deviceId} value={c.deviceId}>
                                Camera {index + 1} · {c.label || 'Rear camera'}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {cameras.length > 1 && (
                        <p className="rhr-lens-note">
                          Selecting a camera opens it immediately. Confirm the
                          active lens using the preview; different browser
                          camera entries may use the same physical lens.
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
                            (!lightConfirmed || cameraCheck.status !== 'ready'))
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
                            {cameraCheck.status === 'checking'
                              ? 'Checking camera…'
                              : 'Start measurement'}
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
                  : 'Submit your wellness questionnaire to save this reading. Measurement outcomes and basic device/browser groups help your coach monitor reliability; video stays on your phone.'}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
