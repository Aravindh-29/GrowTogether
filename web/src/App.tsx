import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import BuddiesPage from './pages/BuddiesPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import FindPartnersPage from './pages/FindPartnersPage'
import SuggestedBuddiesPage from './pages/SuggestedBuddiesPage'
import MessagesPage from './pages/MessagesPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePreviewPage from './pages/ProfilePreviewPage'
import UserProfilePage from './pages/UserProfilePage'
import RegisterPage from './pages/RegisterPage'
import SetupPage from './pages/SetupPage'
import SettingsPage from './pages/SettingsPage'
import ProgressPage from './pages/ProgressPage'
import StudyGroupsPage from './pages/StudyGroupsPage'
import { NotificationProvider } from './contexts/NotificationContext'
import { CallProvider } from './contexts/CallContext'
import CallOverlay from './components/CallOverlay'
import { useThemeStore } from './store/themeStore'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.startsWith('REPLACE_')
  ? ''
  : (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')

export default function App() {
  const { theme } = useThemeStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/setup" element={<ProtectedRoute><SetupPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        {/* Dashboard routes share the persistent sidebar layout */}
        <Route element={<ProtectedRoute><NotificationProvider><CallProvider><CallOverlay /><DashboardLayout /></CallProvider></NotificationProvider></ProtectedRoute>}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/partners" element={<FindPartnersPage />} />
          <Route path="/suggested-buddies" element={<SuggestedBuddiesPage />} />
          <Route path="/buddies" element={<BuddiesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/study-groups" element={<StudyGroupsPage />} />
          <Route path="/profile/preview" element={<ProfilePreviewPage />} />
          <Route path="/profile/view/:userId" element={<UserProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </GoogleOAuthProvider>
  )
}
