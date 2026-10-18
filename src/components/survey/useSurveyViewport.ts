'use client'
import { useEffect, useRef } from 'react'

/** Follow the visible viewport, including mobile browser chrome and the keyboard. */
export function useSurveyViewport() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    let frame = 0
    const update = () => {
      if (!root.current || (viewport && Math.abs(viewport.scale - 1) > 0.01))
        return
      root.current.style.setProperty(
        '--sj-viewport-height',
        `${viewport?.height ?? window.innerHeight}px`,
      )
      root.current.style.setProperty(
        '--sj-viewport-top',
        `${viewport?.offsetTop ?? 0}px`,
      )
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('resize', schedule)
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
    }
  }, [])
  return root
}
