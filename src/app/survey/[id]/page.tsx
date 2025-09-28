import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SurveyForm from './SurveyForm'
import BackButton from '@/components/BackButton'
import { Heart, Activity, User, Clock, Calendar } from 'lucide-react'
import { isRecurringSurveyActive } from '@/lib/recurringSurvey'

// Force dynamic rendering to avoid build-time database calls
export const dynamic = 'force-dynamic'

interface SurveyPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    playerId?: string
  }>
}

export default async function SurveyPage({ params, searchParams }: SurveyPageProps) {
  const { id } = await params
  const { playerId } = await searchParams
  
  let survey = null
  
  try {
    survey = await prisma.survey.findUnique({
      where: {
        id: id
      },
      include: {
        questions: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching survey:', error)
    notFound()
  }

  if (!survey) {
    notFound()
  }

  // Fetch player data if playerId is provided
  let player = null
  if (playerId) {
    player = await prisma.player.findUnique({
      where: {
        id: playerId
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-200/50">
          {/* Enhanced Header */}
          <div className="relative px-6 py-8 border-b border-gray-200/50">
            {/* Back Button */}
            <BackButton surveyId={survey.id} />
            
            {/* Title Section */}
            <div className="text-center pt-8">
              {/* Player Image or Wellness Icon */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  {player && player.image ? (
                    <img
                      src={player.image}
                      alt={`${player.firstName} ${player.lastName}`}
                      className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Heart className="w-8 h-8 text-white" />
                    </div>
                  )}
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center shadow-md">
                    <Activity className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
              
              {/* Enhanced Title */}
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-3 tracking-tight">
                {survey.title}
              </h1>
              
              {survey.description && (
                <p className="text-gray-600 text-lg font-medium max-w-md mx-auto leading-relaxed">
                  {survey.description}
                </p>
              )}
              
              {/* Recurring Survey Status */}
              {survey.isRecurring && (
                <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
                  <Clock className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">
                    {isRecurringSurveyActive(survey).statusMessage}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Survey Form */}
          <div className="px-6 py-6">
            <SurveyForm survey={survey} player={player} />
          </div>
        </div>
      </div>
    </div>
  )
}
