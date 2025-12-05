'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

interface KioskPasswordPromptProps {
  onPasswordCorrect: () => void
  onCancel?: () => void
}

export default function KioskPasswordPrompt({ onPasswordCorrect, onCancel }: KioskPasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password.trim()) {
      setError('Please enter the password')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/kiosk-settings')
      if (response.ok) {
        const settings = await response.json()
        
        if (password.trim() === settings.password) {
          // Password is correct
          onPasswordCorrect()
        } else {
          setError('Incorrect password. Please try again.')
        }
      } else {
        setError('Unable to verify password. Please try again.')
      }
    } catch (error) {
      console.error('Error verifying password:', error)
      setError('Unable to verify password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Survey Access</h1>
          <p className="text-gray-600 text-lg">Please, enter the password to access the survey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-3">
              Access Code
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 pr-14 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                placeholder="Enter access code"
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Verifying Access...
                </>
              ) : (
                <>
                  <Lock className="w-6 h-6" />
                  Start Survey
                </>
              )}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-200 text-gray-700 text-lg font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Contact your coach if you don&apos;t have the access code
          </p>
        </div>
      </div>
    </div>
  )
}
