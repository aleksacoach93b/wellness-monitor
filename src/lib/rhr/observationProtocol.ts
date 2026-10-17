import { z } from 'zod'
import {
  RHR_VERSION,
  RHR_LEGACY_VERSION,
  RHR_FIXED_VERSION,
  RHR_RESTORED_VERSION,
} from './protocol'
export const observationMeta = z
  .object({
    id: z.string().uuid(),
    acquisitionVersion: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
  })
  .strict()
export const observationReasons = [
  'camera-permission',
  'camera-light',
  'camera-error',
  'setup-timeout',
  'cancelled',
  'interrupted',
  'camera-ended',
  'weak-or-irregular-pulse',
  'unstable-pulse',
  'finger-contact',
  'low-frame-rate',
  'frame-gaps',
  'movement-or-exposure',
  'incomplete-signal',
  'too-few-frames',
  'incomplete-scan',
  'channel-disagreement',
  'invalid-record',
  'signal-quality',
] as const
export const observationReport = z
  .object({
    action: z.literal('report'),
    eventId: z.string().uuid(),
    playerId: z.string().min(1).max(100),
    questionId: z.string().min(1).max(100),
    password: z.string().max(100).optional(),
    position: z.enum(['seated', 'standing', 'lying', 'reclined']).optional(),
    status: z.enum(['REPEAT', 'INTERRUPTED', 'CAMERA_ERROR', 'INCOMPLETE']),
    reason: z.enum(observationReasons),
    protocolVersion: z.enum([
      RHR_VERSION,
      RHR_LEGACY_VERSION,
      RHR_FIXED_VERSION,
      RHR_RESTORED_VERSION,
    ]),
    acquisitionVersion: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
  })
  .strict()
