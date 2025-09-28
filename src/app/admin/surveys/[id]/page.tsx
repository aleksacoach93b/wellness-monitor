import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft, Edit, BarChart3, Eye, Trash2, Clock, Calendar, Users, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { isRecurringSurveyActive, formatRecurringInfo } from '@/lib/recurringSurvey'
import DeleteSurveyButton from '@/components/DeleteSurveyButton'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

interface SurveyPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SurveyPage({ params }: SurveyPageProps) {
  const { id } = await params
  
  let survey = null
  let questionsCount = 0
  let responsesCount = 0
  
  try {
    survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            questions: true,
            responses: true
          }
        }
      }
    })
    
    if (survey) {
      questionsCount = survey._count.questions
      responsesCount = survey._count.responses
    }
  } catch (error) {
    console.error('Error fetching survey:', error)
    notFound()
  }

  if (!survey) {
    notFound()
  }

  const recurringStatus = survey.isRecurring ? isRecurringSurveyActive(survey) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/admin"
                className="inline-flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href={`/admin/surveys/${survey.id}/edit`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Survey
              </Link>
              <DeleteSurveyButton surveyId={survey.id} surveyTitle={survey.title} />
            </div>
          </div>
        </div>

        {/* Survey Details */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
                {survey.description && (
                  <p className="mt-1 text-gray-600">{survey.description}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {survey.isRecurring && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <Clock className="h-3 w-3 mr-1" />
                    Recurring
                  </span>
                )}
                {survey.isActive ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Questions</p>
                  <p className="text-2xl font-semibold text-gray-900">{questionsCount}</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Responses</p>
                  <p className="text-2xl font-semibold text-gray-900">{responsesCount}</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Created</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {format(new Date(survey.createdAt), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
            </div>

            {/* Survey Schedule Info */}
            <div className={`${survey.isRecurring ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4 mb-6`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-medium ${survey.isRecurring ? 'text-blue-900' : 'text-gray-900'}`}>
                  {survey.isRecurring ? 'Recurring Survey Schedule' : 'Survey Schedule'}
                </h3>
                <Link
                  href={`/admin/surveys/${survey.id}/edit-schedule`}
                  className={`inline-flex items-center px-3 py-1 border rounded-md text-xs font-medium bg-white hover:bg-gray-50 ${
                    survey.isRecurring 
                      ? 'border-blue-300 text-blue-700 hover:bg-blue-50' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {survey.isRecurring ? 'Edit Schedule' : 'Set Schedule'}
                </Link>
              </div>
              <div className={`text-sm ${survey.isRecurring ? 'text-blue-800' : 'text-gray-700'}`}>
                {survey.isRecurring ? (
                  <>
                    <p className="mb-1">{formatRecurringInfo(survey)}</p>
                    {recurringStatus && (
                      <p className="font-medium">
                        Status: {recurringStatus.statusMessage}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mb-1">
                    This survey is not set as recurring. Click &quot;Set Schedule&quot; to configure recurring times.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/survey/${survey.id}`}
                target="_blank"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Survey
              </Link>
              <Link
                href={`/admin/surveys/${survey.id}/results`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Results
              </Link>
              <Link
                href={`/kiosk/${survey.id}`}
                target="_blank"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                Kiosk Mode
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
