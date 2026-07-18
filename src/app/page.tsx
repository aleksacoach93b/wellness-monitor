import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Plus, BarChart3, Users, FileText, Clock, Calendar, ExternalLink } from 'lucide-react'
import DeleteSurveyButton from './DeleteSurveyButton'
import { Survey } from '@prisma/client'
import { formatRecurringInfo } from '@/lib/recurringSurvey'
import CSVLinkModal from './admin/surveys/[id]/results/CSVLinkModal'
import { CANONICAL_PRODUCTION_URL } from '@/lib/productionUrl'
import { getAdminSession } from '@/lib/auth/adminSession'
import AdminChrome from '@/components/admin/AdminChrome'
import { Syne, DM_Sans } from 'next/font/google'
import './admin/admin.css'

export const dynamic = 'force-dynamic'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['500', '600', '700', '800'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
})

const actionLink =
  'admin-btn admin-btn-ghost !px-3 !py-1.5 !text-xs'

export default async function HomePage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  let surveys: (Survey & {
    _count: {
      questions: number
      responses: number
    }
  })[] = []
  let databaseUnavailable = false

  try {
    surveys = await prisma.survey.findMany({
      where: { teamId: session.teamId },
      include: {
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  } catch (error) {
    console.error('Error fetching surveys:', error)
    surveys = []
    databaseUnavailable = true
  }

  const team = await prisma.team.findUnique({
    where: { id: session.teamId },
    select: { name: true },
  })

  const totalResponses = surveys.reduce((sum, survey) => sum + survey._count.responses, 0)
  const activeCount = surveys.filter((s) => s.isActive).length

  return (
    <div className={`${syne.variable} ${dmSans.variable}`}>
      <AdminChrome
        teamName={team?.name || 'Team'}
        email={session.email}
        isSuper={session.role === 'SUPER'}
      >
        <div className="space-y-8">
          {databaseUnavailable ? (
            <div className="admin-panel border-amber-300/60 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Database connection failed</p>
              <p className="mt-1 text-amber-900/90">
                This deployment cannot reach your Postgres database, so surveys show as empty.
                Your data is not deleted — open the working production URL or fix{' '}
                <code className="rounded bg-amber-100 px-1">DATABASE_URL</code> in Vercel. Always
                use:{' '}
                <a
                  className="font-semibold underline underline-offset-2"
                  href={CANONICAL_PRODUCTION_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {CANONICAL_PRODUCTION_URL.replace('https://', '')}
                </a>
              </p>
            </div>
          ) : null}

          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="admin-kicker">Workspace</p>
              <h1 className="admin-title mt-1">Surveys</h1>
              <p className="admin-sub">Create, edit, and open kiosk links for your team.</p>
            </div>
            <Link href="/admin/surveys/new" className="admin-btn admin-btn-primary">
              <Plus className="h-4 w-4" />
              New survey
            </Link>
          </header>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="admin-panel admin-stat">
              <p className="admin-stat-label">Total surveys</p>
              <p className="admin-stat-value">{surveys.length}</p>
              <FileText className="absolute bottom-3 right-4 h-8 w-8 text-teal-700/15" aria-hidden />
            </div>
            <div className="admin-panel admin-stat">
              <p className="admin-stat-label">Responses</p>
              <p className="admin-stat-value">{totalResponses.toLocaleString()}</p>
              <Users className="absolute bottom-3 right-4 h-8 w-8 text-teal-700/15" aria-hidden />
            </div>
            <div className="admin-panel admin-stat">
              <p className="admin-stat-label">Active</p>
              <p className="admin-stat-value">{activeCount}</p>
              <BarChart3 className="absolute bottom-3 right-4 h-8 w-8 text-teal-700/15" aria-hidden />
            </div>
          </section>

          <section className="admin-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[var(--ad-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="admin-display text-lg font-bold">Your surveys</h2>
                <p className="text-sm text-[var(--ad-muted)]">
                  {surveys.length} survey{surveys.length === 1 ? '' : 's'} in workspace
                </p>
              </div>
            </div>

            <div className="divide-y divide-[var(--ad-line)]">
              {surveys.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="admin-tile-icon mx-auto">
                    <FileText className="h-4 w-4" />
                  </div>
                  <h3 className="admin-display mt-4 text-base font-bold">No surveys yet</h3>
                  <p className="mt-2 text-sm text-[var(--ad-muted)]">
                    Create a survey to collect wellness data from players.
                  </p>
                  <Link href="/admin/surveys/new" className="admin-btn admin-btn-primary mt-6">
                    <Plus className="h-4 w-4" />
                    New survey
                  </Link>
                </div>
              ) : (
                surveys.map((survey) => (
                  <article key={survey.id} className="px-5 py-5 transition hover:bg-white/50 sm:px-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="admin-display text-base font-bold text-[var(--ad-ink)]">
                            {survey.title}
                          </h3>
                          {survey.isRecurring ? (
                            <span className="admin-badge admin-badge-accent">
                              <Clock className="mr-1 h-3 w-3" aria-hidden />
                              Recurring
                            </span>
                          ) : null}
                          {survey.isActive ? (
                            <span className="admin-badge admin-badge-ok">Active</span>
                          ) : (
                            <span className="admin-badge admin-badge-soft">Inactive</span>
                          )}
                        </div>
                        {survey.description ? (
                          <p className="text-sm leading-relaxed text-[var(--ad-muted)]">
                            {survey.description}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--ad-muted)]">
                          <span>{survey._count.questions} questions</span>
                          <span>{survey._count.responses} responses</span>
                          <span>Created {new Date(survey.createdAt).toLocaleDateString()}</span>
                        </div>
                        {survey.isRecurring ? (
                          <div className="inline-flex items-start gap-1.5 rounded-lg border border-cyan-200/70 bg-cyan-50/70 px-2.5 py-1.5 text-xs font-medium text-cyan-950">
                            <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700" aria-hidden />
                            <span>{formatRecurringInfo(survey)}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-[var(--ad-line)] pt-4 lg:max-w-xl lg:border-t-0 lg:pt-0">
                        <Link href={`/admin/surveys/${survey.id}/edit`} className={actionLink}>
                          Edit
                        </Link>
                        <CSVLinkModal surveyId={survey.id} surveyTitle={survey.title} />
                        <Link
                          href={`/survey/${survey.id}`}
                          className={actionLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                          <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                        </Link>
                        <Link href={`/admin/surveys/${survey.id}/results`} className={actionLink}>
                          Results
                        </Link>
                        <Link
                          href={`/kiosk/${survey.id}`}
                          className={actionLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Kiosk
                          <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                        </Link>
                        <DeleteSurveyButton surveyId={survey.id} surveyTitle={survey.title} />
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </AdminChrome>
    </div>
  )
}
