'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Eye, EyeOff, Lock, Unlock, RefreshCw, Palette } from 'lucide-react'

interface KioskSettings {
  id: string
  password: string
  isEnabled: boolean
  theme: KioskTheme
  createdAt: string
  updatedAt: string
}

type KioskTheme = 'dark' | 'light' | 'red' | 'green'

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
    preview: 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800'
  },
  {
    value: 'light',
    label: 'Light Steel',
    description: 'Softer neutral background with cool glow',
    preview: 'bg-gradient-to-br from-slate-500 via-slate-400 to-slate-500'
  },
  {
    value: 'red',
    label: 'Red Pulse',
    description: 'High-energy red & magenta atmosphere',
    preview: 'bg-gradient-to-br from-rose-900 via-rose-800 to-rose-900'
  },
  {
    value: 'green',
    label: 'Green Focus',
    description: 'Emerald palette with calm highlights',
    preview: 'bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900'
  },
]

export default function KioskSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<KioskSettings | null>(null)
  const [password, setPassword] = useState('')
  const [theme, setTheme] = useState<KioskTheme>('dark')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/kiosk-settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        setPassword(data.password)
        setTheme(data.theme ?? 'dark')
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!password.trim()) {
      setMessage('Password is required')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/kiosk-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: password.trim(),
          isEnabled: password.trim() !== '',
          theme
        }),
      })

      if (response.ok) {
        const updatedSettings = await response.json()
        setSettings(updatedSettings)
        setPassword(updatedSettings.password)
        setTheme(updatedSettings.theme ?? 'dark')
        setMessage('Kiosk settings saved successfully!')
      } else {
        setMessage('Failed to save settings')
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: password.trim(),
          isEnabled: password.trim() !== '',
          theme
        }),
      })

      if (response.ok) {
        const updatedSettings = await response.json()
        setSettings(updatedSettings)
        setPassword(updatedSettings.password)
        setTheme(updatedSettings.theme ?? 'dark')
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
        {/* Header */}
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
              <p className="text-gray-600">Configure password protection for kiosk mode</p>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-6">
            {/* Password Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kiosk Password
              </label>
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
                Players will need to enter this password to access kiosk mode
              </p>
            </div>

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Password Protection Active
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    Once a password is set, it will be required for all kiosk mode access. 
                    Leave the password field empty to disable protection.
                  </p>
                </div>
              </div>
            </div>

            {/* Status Display */}
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
                {settings.isEnabled && settings.password && (
                  <p className="text-sm text-gray-500 mt-1">
                    Password: {showPassword ? settings.password : '••••••••'}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <Palette className="w-4 h-4 text-indigo-500" />
                  <span>
                    Theme: <strong className="text-gray-800 uppercase">{settings.theme}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kiosk Theme
              </label>
              <p className="text-sm text-gray-500 mb-4">
                Choose the color palette for kiosk mode. Changes apply instantly after saving.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {themeOptions.map(option => {
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

            {/* Message */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.includes('success') 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            {/* Action Buttons */}
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
                disabled={saving || !password.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-3">How it works:</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• When enabled, players must enter the password before accessing kiosk mode</li>
            <li>• The password is required for both the main kiosk link and individual survey links</li>
            <li>• You can share the password with your players verbally or via other secure means</li>
            <li>• Use &quot;Update Password&quot; to change the password without affecting other settings</li>
            <li>• Use &quot;Save Settings&quot; to save any changes to the configuration</li>
            <li>• Disable password protection to make kiosk mode completely open</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
