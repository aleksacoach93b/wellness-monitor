import { Suspense } from 'react'
import type { Metadata } from 'next'
import PvtPlayer from '@/components/pvt/PvtPlayer'

export const metadata: Metadata = { title: 'Focus check · Wellness', description: 'Your daily moment of focus.' }

export default async function PvtPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params
  return <main className="min-h-screen"><Suspense fallback={<p className="pvt-loading">Getting your session ready…</p>}><PvtPlayer surveyId={surveyId} /></Suspense></main>
}
