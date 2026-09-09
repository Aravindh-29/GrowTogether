import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function HomePage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900 dark:text-white">Combined Studies</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">{user?.displayName}</span>
          <button onClick={handleLogout} className="btn-secondary text-sm py-1.5 px-3">
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12 text-center">
        <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
          Welcome, {user?.displayName}!
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Stage 1 complete — identity and auth working. Profile setup coming next.
        </p>
      </main>
    </div>
  )
}
