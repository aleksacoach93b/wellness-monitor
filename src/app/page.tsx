import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus, BarChart3, Users, FileText, Trash2 } from 'lucide-react'
import DeleteSurveyButton from './DeleteSurveyButton'
import HomeButton from '@/components/HomeButton'
import { Survey } from '@prisma/client'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let surveys: (Survey & {
    _count: {
      questions: number
      responses: number
    }
  })[] = []
  
  try {
    surveys = await prisma.survey.findMany({
      include: {
        _count: {
          select: {
            questions: true,
            responses: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  } catch (error) {
    console.error('Error fetching surveys:', error)
    // Return empty array if database is not available
    surveys = []
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Wellness Monitor</h1>
              <p className="mt-2 text-gray-600">Create and manage wellness surveys for your players</p>
            </div>
            <HomeButton />
          </div>
          
          <div className="mt-6 flex space-x-4">
            <Link
              href="/admin/players"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Players
            </Link>
            <Link
              href="/admin/surveys/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Survey
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Surveys</p>
                <p className="text-2xl font-semibold text-gray-900">{surveys.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Responses</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {surveys.reduce((sum, survey) => sum + survey._count.responses, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Surveys</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {surveys.filter(s => s.isActive).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Your Surveys</h2>
              <Link
                href="/admin/surveys/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Survey
              </Link>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {surveys.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No surveys</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new survey.</p>
                <div className="mt-6">
                  <Link
                    href="/admin/surveys/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Survey
                  </Link>
                </div>
              </div>
            ) : (
              surveys.map((survey) => (
                <div key={survey.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-sm font-medium text-gray-900">{survey.title}</h3>
                        {survey.isActive ? (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </div>
                      {survey.description && (
                        <p className="mt-1 text-sm text-gray-500">{survey.description}</p>
                      )}
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <span>{survey._count.questions} questions</span>
                        <span className="mx-2">•</span>
                        <span>{survey._count.responses} responses</span>
                        <span className="mx-2">•</span>
                        <span>Created {new Date(survey.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/admin/surveys/${survey.id}/edit`}
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/survey/${survey.id}`}
                        className="text-green-600 hover:text-green-900 text-sm font-medium"
                        target="_blank"
                      >
                        View
                      </Link>
                      <Link
                        href={`/admin/surveys/${survey.id}/results`}
                        className="text-purple-600 hover:text-purple-900 text-sm font-medium"
                      >
                        Results
                      </Link>
                      <Link
                        href={`/kiosk/${survey.id}`}
                        className="text-orange-600 hover:text-orange-900 text-sm font-medium"
                        target="_blank"
                      >
                        Kiosk
                      </Link>
                      <DeleteSurveyButton surveyId={survey.id} surveyTitle={survey.title} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}