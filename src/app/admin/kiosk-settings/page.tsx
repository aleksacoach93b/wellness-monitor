'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  RefreshCw,
  Palette,
  Building2,
  Upload,
  Trash2,
} from 'lucide-react'
import { compressClubLogo } from '@/lib/compressClubLogo'

interface KioskSettings {
  id: string
  password: string
  coachPassword: string
  isEnabled: boolean
  theme: KioskTheme
  clubName?: string
  clubLogo?: string | null
  showClubBranding?: boolean
  createdAt: string
  updatedAt: string
}

type KioskTheme = 'dark' | 'light' | 'red' | 'green' | 'sky' | 'graphite' | 'sand' | 'violet'

const themeOptions: Array<{
  value: KioskTheme
  label: string
  description: string
  preview: string
}> = [
  {
    value: 'dark',
    label: 'Dark Mode',
    description: 'Original neon blue & purple look',
    preview: 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800',
  },
  {
    value: 'light',
    label: 'Light Steel',
    description: 'Softer neutral background with cool glow',
    preview: 'bg-gradient-to-br from-slate-500 via-slate-400 to-slate-500',
  },
  {
    value: 'red',
    label: 'Red Pulse',
    description: 'High-energy red & magenta atmosphere',
    preview: 'bg-gradient-to-br from-rose-900 via-rose-800 to-rose-900',
  },
  {
    value: 'green',
    label: 'Green Focus',
    description: 'Emerald palette with calm highlights',
    preview: 'bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900',
  },
  {
    value: 'sky',
    label: 'Sky Blue',
    description: 'Bright sky & cyan accents on a deep blue base',
    preview: 'bg-gradient-to-br from-sky-700 via-blue-900 to-slate-900',
  },
  {
    value: 'graphite',
    label: 'Graphite',
    description: 'Dark neutral gray with crisp light accents',
    preview: 'bg-gradient-to-br from-zinc-800 via-neutral-900 to-zinc-950',
  },
  {
    value: 'sand',
    label: 'Daylight',
    description: 'Clean white & sky-blue light theme with dark text',
    preview: 'bg-gradient-to-br from-sky-50 via-white to-blue-50',
  },
  {
    value: 'violet',
    label: 'Violet Night',
    description: 'Rich violet & fuchsia with electric highlights',
    preview: 'bg-gradient-to-br from-violet-900 via-purple-900 to-fuchsia-900',
  },
]

export default function KioskSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<KioskSettings | null>(null)
  const [password, setPassword] = useState('')
  const [coachPassword, setCoachPassword] = useState('')
  const [theme, setTheme] = useState<KioskTheme>('dark')
  const [clubName, setClubName] = useState('')
  const [clubLogo, setClubLogo] = useState<string | null>(null)
  const [showClubBranding, setShowClubBranding] = useState(true)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showCoachPassword, setShowCoachPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [updating, setUpdating] = useState(false)
  const [compressingLogo, setCompressingLogo] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const applySettings = (data: KioskSettings) => {
    setSettings(data)
    setPassword(data.password)
    setCoachPassword(data.coachPassword ?? '')
    setTheme(data.theme ?? 'dark')
    setClubName(data.clubName ?? '')
    setClubLogo(data.clubLogo ?? null)
    setLogoPreview(data.clubLogo ?? null)
    setShowClubBranding(data.showClubBranding ?? true)
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/kiosk-settings')
      if (response.ok) {
        applySettings(await response.json())
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePayload = () => ({
    password: password.trim(),
    coachPassword: coachPassword.trim(),
    isEnabled: password.trim() !== '',
    theme,
    clubName: clubName.trim(),
    clubLogo,
    showClubBranding,
  })

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/kiosk-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload()),
      })

      if (response.ok) {
        applySettings(await response.json())
        setMessage('Kiosk settings saved successfully!')
      } else {
        let detail = 'Failed to save settings'
        try {
          const err = await response.json()
          if (err?.error) detail = err.error
          else if (err?.details) detail = String(err.details)
        } catch {
          /* ignore */
        }
        setMessage(detail)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!password.trim()) {
      setMessage('Password is required')
      return
    }

    setUpdating(true)
    setMessage('')

    try {
      const response = await fetch('/api/kiosk-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload()),
      })

      if (response.ok) {
        applySettings(await response.json())
        setMessage('Password updated successfully!')
      } else {
        setMessage('Failed to update password')
      }
    } catch (error) {
      console.error('Error updating password:', error)
      setMessage('Failed to update password')
    } finally {
      setUpdating(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('Please choose an image file')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage('Image is too large (max 8MB)')
      return
    }

    setCompressingLogo(true)
    setMessage('')
    try {
      const dataUrl = await compressClubLogo(file)
      setClubLogo(dataUrl)
      setLogoPreview(dataUrl)
    } catch (error) {
      console.error('Logo compress failed:', error)
      setMessage('Failed to process logo image')
    } finally {
      setCompressingLogo(false)
      event.target.value = ''
    }
  }

  const clearLogo = () => {
    setClubLogo(null)
    setLogoPreview(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading kiosk settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <Lock className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Kiosk Settings</h1>
              <p className="text-gray-600">Club branding, passwords, and kiosk appearance</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-8">
            {/* Club Branding */}
            <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Club Branding</h2>
                  <p className="text-sm text-gray-600">
                    Shown on the kiosk header and access screen for your club identity.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Club name</label>
                  <input
                    type="text"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    maxLength={120}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. FC Example"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Club logo / image</label>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-white">
                      {logoPreview ? (
                        <Image
                          src={logoPreview}
                          alt="Club logo preview"
                          width={112}
                          height={112}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="px-3 text-center text-xs text-gray-400">No logo</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                        <Upload className="h-4 w-4" />
                        {compressingLogo ? 'Processing…' : 'Upload image'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                          disabled={compressingLogo}
                        />
                      </label>
                      {logoPreview ? (
                        <button
                          type="button"
                          onClick={clearLogo}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Square logo works best. Image is compressed automatically for fast kiosk loading.
                  </p>
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showClubBranding}
                    onChange={(e) => setShowClubBranding(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-800">Show club branding on kiosk</span>
                </label>
              </div>
            </section>

            {/* Password Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kiosk Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter kiosk password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Players will need to enter this password to access kiosk mode. Leave empty to disable.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Coach Mode Password</label>
              <div className="relative">
                <input
                  type={showCoachPassword ? 'text' : 'password'}
                  value={coachPassword}
                  onChange={(e) => setCoachPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave empty to allow open access"
                />
                <button
                  type="button"
                  onClick={() => setShowCoachPassword(!showCoachPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCoachPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Required to enter Coach Mode on the kiosk. Leave empty to allow anyone to switch.
              </p>
            </div>

            {settings && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Current Status</h3>
                <div className="flex items-center gap-2">
                  {settings.isEnabled ? (
                    <>
                      <Lock className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">Password protection is enabled</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Password protection is disabled</span>
                    </>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <Palette className="w-4 h-4 text-indigo-500" />
                  <span>
                    Theme: <strong className="text-gray-800 uppercase">{settings.theme}</strong>
                  </span>
                </div>
                {(settings.clubName || settings.clubLogo) && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    <span>
                      Branding:{' '}
                      <strong className="text-gray-800">
                        {settings.showClubBranding === false ? 'Hidden' : settings.clubName || 'Logo only'}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kiosk Theme</label>
              <p className="text-sm text-gray-500 mb-4">
                Choose the color palette for kiosk mode. Changes apply after saving.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {themeOptions.map((option) => {
                  const isActive = theme === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      className={`text-left rounded-xl border p-4 transition-all duration-200 focus:outline-none ${
                        isActive
                          ? 'border-blue-500 shadow-lg ring-2 ring-blue-100 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-14 h-14 rounded-lg ${option.preview} shadow-inner`}></div>
                        <div>
                          <p className="text-base font-semibold text-gray-900">{option.label}</p>
                          <p className="text-sm text-gray-500">{option.description}</p>
                        </div>
                      </div>
                      {isActive && (
                        <p className="mt-3 text-xs font-medium text-blue-600 uppercase tracking-wide">
                          Selected
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.includes('success')
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={handleUpdatePassword}
                disabled={updating || !password.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 ${updating ? 'animate-spin' : ''}`} />
                {updating ? 'Updating...' : 'Update Password'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || compressingLogo}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-3">How it works:</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• Club name + logo appear in the kiosk header and on the access password screen</li>
            <li>• Toggle “Show club branding” if you want a clean kiosk without club identity</li>
            <li>• Password protection is optional — leave blank to keep kiosk open</li>
            <li>• Theme and branding apply after you click Save Settings</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
