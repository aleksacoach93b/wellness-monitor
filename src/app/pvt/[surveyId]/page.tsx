import { Suspense } from 'react'
import type { Metadata } from 'next'
import PvtPlayer from '@/components/pvt/PvtPlayer'
import '../pvt.css'

export const metadata: Metadata = { title: 'Focus check · Wellness', description: 'Your daily moment of focus.' }

export default async function PvtPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params
  return <main className="pvt-page"><Suspense fallback={<p className="pvt-loading">Getting your session ready…</p>}><PvtPlayer surveyId={surveyId} /></Suspense></main>
}
