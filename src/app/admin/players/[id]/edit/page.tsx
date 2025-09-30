'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, Trash2, Upload, RefreshCw, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { Player } from '@prisma/client'
import HomeButton from '@/components/HomeButton'
import { generatePlayerPassword } from '@/lib/passwordUtils'

export default function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [player, setPlayer] = useState<Player | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    image: '',
    isActive: true
  })
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const response = await fetch(`/api/players/${id}`)
        if (response.ok) {
          const playerData = await response.json()
          setPlayer(playerData)
          setFormData({
            firstName: playerData.firstName,
            lastName: playerData.lastName,
            dateOfBirth: playerData.dateOfBirth ? new Date(playerData.dateOfBirth).toISOString().split('T')[0] : '',
            email: playerData.email || '',
            phone: playerData.phone || '',
            image: playerData.image || '',
            isActive: playerData.isActive
          })
          setPassword(playerData.password || '')
        }
      } catch (error) {
        console.error('Error fetching player:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPlayer()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/players/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString() : null,
          email: formData.email || null,
          phone: formData.phone || null,
          image: formData.image || null,
          password: password || null
        })
      })

      if (response.ok) {
        router.push('/admin/players')
      } else {
        const errorData = await response.json()
        alert(`Failed to update player: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error updating player:', error)
      alert('Failed to update player')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleResetPassword = () => {
    const newPassword = generatePlayerPassword(formData.firstName, formData.lastName)
    setPassword(newPassword)
    setMessage('Password reset to initials')
    setTimeout(() => setMessage(''), 3000)
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Create a preview URL
      const previewUrl = URL.createObjectURL(file)
      setImagePreview(previewUrl)
      
      // Convert to base64 for storage
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        setFormData(prev => ({
          ...prev,
          image: base64
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${player?.firstName} ${player?.lastName}? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/players/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push('/admin/players')
      } else {
        const errorData = await response.json()
        alert(`Failed to delete player: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting player:', error)
      alert('Failed to delete player')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading player...</p>
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Player Not Found</h1>
          <p className="text-gray-600">The requested player could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <button
                onClick={() => router.push('/admin/players')}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Players
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Edit Player</h1>
            </div>
            <HomeButton />
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Player Password
                </label>
                <div className="mt-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value.toUpperCase())}
                        className="block w-full pr-10 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono tracking-widest text-center"
                        placeholder="AB"
                        maxLength={10}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      title="Reset to initials"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Custom password for kiosk mode. Click refresh to reset to initials ({generatePlayerPassword(formData.firstName, formData.lastName)})
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="image" className="block text-sm font-medium text-gray-700">
                  Player Photo
                </label>
                
                {/* Image Preview */}
                {(imagePreview || formData.image) && (
                  <div className="mt-2 mb-3">
                    <Image
                      src={imagePreview || formData.image}
                      alt="Player preview"
                      width={96}
                      height={96}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-300"
                    />
                  </div>
                )}
                
                {/* File Upload */}
                <div className="mt-1">
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center w-full h-10 border-2 border-dashed border-gray-300 rounded-md hover:border-gray-400 transition-colors">
                      <Upload className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-600">Upload Photo</span>
                    </div>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                
                {/* URL Input (Alternative) */}
                <div className="mt-2">
                  <input
                    type="url"
                    value={formData.image.startsWith('data:') ? '' : formData.image}
                    onChange={(e) => handleInputChange('image', e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Or enter image URL"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Active Player
              </label>
            </div>

            {/* Message */}
            {message && (
              <div className="p-3 rounded-lg bg-green-50 text-green-700 border border-green-200">
                {message}
              </div>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete Player'}
              </button>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => router.push('/admin/players')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Updating...' : 'Update Player'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
