'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface DeleteSurveyButtonProps {
  surveyId: string
  surveyTitle: string
}

export default function DeleteSurveyButton({ surveyId, surveyTitle }: DeleteSurveyButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.refresh()
        setShowConfirm(false)
      } else {
        alert('Failed to delete survey')
      }
    } catch (error) {
      console.error('Error deleting survey:', error)
      alert('Failed to delete survey')
    } finally {
      setIsDeleting(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Survey</h3>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete "{surveyTitle}"? This action cannot be undone and will also delete all responses.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="text-red-600 hover:text-red-900 text-sm font-medium"
    >
      Delete
    </button>
  )
}
