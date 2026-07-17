'use client'

import { useRouter } from 'next/navigation'

export default function AdminLogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={logout}
      className={
        className ||
        'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
      }
    >
      Log out
    </button>
  )
}
