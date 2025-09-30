import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Users, BarChart3 } from 'lucide-react'
import ResultsTable from './ResultsTable'
import HomeButton from '@/components/HomeButton'
import PowerBILink from '@/components/PowerBILink'
import { format } from 'date-fns'
import CSVLinkModal from './CSVLinkModal'


interface SurveyResultsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SurveyResultsPage({ params }: SurveyResultsPageProps) {
  const { id } = await params
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: 'asc' }
      },
      responses: {
        include: {
          answers: {
            include: {
              question: true
            }
          }
        },
        orderBy: { submittedAt: 'desc' }
      }
    }
  })

  if (!survey) {
    notFound()
  }

  // Get all valid player IDs to filter responses
  const players = await prisma.player.findMany({
    select: { id: true }
  })
  const validPlayerIds = new Set(players.map(p => p.id))
  
  // Filter responses to only include players that exist in the players table
  const filteredResponses = survey.responses.filter(response => 
    response.playerId && validPlayerIds.has(response.playerId)
  )
  
  // Update survey object with filtered responses
  survey.responses = filteredResponses

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <HomeButton />
        </div>

        {/* Header */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Created {format(new Date(survey.createdAt), 'MMMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-1" />
                    {survey.responses.length} responses
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mt-1">
                    <BarChart3 className="h-4 w-4 mr-1" />
                    {survey.questions.length} questions
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Survey Responses</h2>
              <div className="flex space-x-3">
                <CSVLinkModal surveyId={survey.id} surveyTitle={survey.title} />
                <PowerBILink surveyId={survey.id} surveyTitle={survey.title} />
              </div>
            </div>
          </div>
          <ResultsTable responses={survey.responses} />
        </div>
      </div>
    </div>
  )
}
