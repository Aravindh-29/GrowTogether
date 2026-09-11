import { useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import * as signalR from '@microsoft/signalr'
import { getChatHub } from '../api/chatApi'
import { useNotifications } from '../contexts/NotificationContext'
import { useAuthStore } from '../store/authStore'
import { GroupCallProvider } from '../contexts/GroupCallContext'
import GroupCallOverlay from '../components/GroupCallOverlay'

const BASE_NAV_ITEMS = [
  {
    label: 'Home', path: '/home',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>,
  },
  {
    label: 'Find Friends', path: '/partners',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>,
  },
  {
    label: 'Suggested Buddies', path: '/suggested-buddies',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M11 7H13V9H11V7M11 11H13V17H11V11M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20Z" /></svg>,
  },
  {
    label: 'Friends', path: '/buddies',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
  },
  {
    label: 'Study Groups', path: '/study-groups',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 17.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM9.5 8c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5S9.5 9.38 9.5 8zm6.5 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>,
  },
  {
    label: 'Messages', path: '/messages',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>,
  },
  {
    label: 'Notifications', path: '/notifications',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>,
  },
  {
    label: 'Progress', path: '/progress',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 17v-5h2v5H7zm4-7v7h2v-7h-2zm4 3v4h2v-4h-2z" /></svg>,
  },
  {
    label: 'Settings', path: '/settings',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.04 7.04 0 00-1.62-.94l-.36-2.54A.484.484 0 0014 2h-4c-.25 0-.46.18-.49.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 00-.59.22L2.74 8.87a.47.47 0 00.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.49.42h4c.25 0 .46-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 00-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>,
  },
]

function notify(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/vite.svg' })
  }
}

type ActivityItem =
  | { type: 'accepted'; name: string; userId: string; at: string }
  | { type: 'rejected'; name: string; userId: string; at: string }
  | { type: 'group_deleted'; groupName: string; at: string }

function saveActivity(item: ActivityItem) {
  try {
    const existing: ActivityItem[] = JSON.parse(localStorage.getItem('cs_activity_notifs') || '[]')
    const updated = [item, ...existing].slice(0, 30)
    localStorage.setItem('cs_activity_notifs', JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('cs-activity-added'))
  } catch {}
}

export default function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { clearAuth } = useAuthStore()
  const { pendingRequests, unreadMessages, notifBadgeCount, refresh, incrementUnread, incrementGroupUnread, refreshActivity } = useNotifications()

  // Keep a ref to location so SignalR handlers (created once) always see the current path
  const locationRef = useRef(location)
  useEffect(() => {
    locationRef.current = location
  }, [location.pathname])

  // SignalR: connection request / accepted / new message events
  useEffect(() => {
    const token = localStorage.getItem('cs_token')
    if (!token) return
    const hub = getChatHub(token)

    const onNewRequest = (data: { senderName: string }) => {
      refresh()
      notify('New Connection Request', `${data.senderName} wants to connect with you`)
    }
    const onAccepted = (data: { acceptorName: string; acceptorId: string }) => {
      refresh()
      notify('Connection Accepted!', `${data.acceptorName} accepted your request`)
      saveActivity({ type: 'accepted', name: data.acceptorName, userId: data.acceptorId, at: new Date().toISOString() })
      refreshActivity()
    }
    const onRejected = (data: { rejectorName: string; rejectorId: string }) => {
      notify('Connection Declined', `${data.rejectorName} declined your request`)
      saveActivity({ type: 'rejected', name: data.rejectorName, userId: data.rejectorId, at: new Date().toISOString() })
      refreshActivity()
    }
    const onGroupDeleted = (data: { groupName: string }) => {
      notify('Study Group Deleted', `"${data.groupName}" has been deleted`)
      saveActivity({ type: 'group_deleted', groupName: data.groupName, at: new Date().toISOString() })
      refreshActivity()
    }
    const onGroupInvite = (data: { groupName: string; invitedByName: string }) => {
      refresh()
      notify('Study Group Invite', `${data.invitedByName} invited you to "${data.groupName}"`)
    }
    const onReceiveMessage = () => {
      if (!locationRef.current.pathname.startsWith('/messages')) {
        incrementUnread()
      }
    }
    const onReceiveGroupMessage = (msg: { groupId?: string; isSystem?: boolean }) => {
      if (!locationRef.current.pathname.startsWith('/messages') && !msg.isSystem && msg.groupId) {
        incrementGroupUnread(msg.groupId)
      }
    }

    hub.on('NewConnectionRequest', onNewRequest)
    hub.on('ConnectionAccepted', onAccepted)
    hub.on('ConnectionRejected', onRejected)
    hub.on('GroupInviteReceived', onGroupInvite)
    hub.on('GroupDeleted', onGroupDeleted)
    hub.on('ReceiveMessage', onReceiveMessage)
    hub.on('ReceiveGroupMessage', onReceiveGroupMessage)

    if (hub.state === signalR.HubConnectionState.Disconnected) {
      hub.start().catch(() => {})
    }

    return () => {
      hub.off('NewConnectionRequest', onNewRequest)
      hub.off('ConnectionAccepted', onAccepted)
      hub.off('ConnectionRejected', onRejected)
      hub.off('GroupInviteReceived', onGroupInvite)
      hub.off('GroupDeleted', onGroupDeleted)
      hub.off('ReceiveMessage', onReceiveMessage)
      hub.off('ReceiveGroupMessage', onReceiveGroupMessage)
    }
  }, [])

  const activeNav = BASE_NAV_ITEMS.find(item => item.path === location.pathname)?.label ?? 'Home'

  const SIDEBAR_BG = 'var(--cs-bg-nav)'
  const BORDER = '1px solid var(--cs-border)'
  const TEXT_MUTED = 'var(--cs-text-2)'

  return (
    <GroupCallProvider>
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--cs-bg)', color: 'var(--cs-text-1)' }}>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
      <aside className="flex flex-col h-screen overflow-y-auto flex-shrink-0"
        style={{ width: 220, background: SIDEBAR_BG, borderRight: BORDER }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#2dd4bf,#0ea5e9)', boxShadow:'0 4px 12px rgba(13,148,136,0.4)' }}>
            <svg viewBox="0 0 22 22" className="w-5 h-5" fill="none">
              <path d="M11 2L3 7l8 5 8-5-8-5z" fill="white" fillOpacity="0.95"/>
              <path d="M3 12l8 5 8-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7"/>
              <path d="M3 9.5l8 5 8-5" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.45"/>
            </svg>
          </div>
          <div className="leading-tight">
            <span className="font-extrabold text-sm block" style={{ background:'linear-gradient(135deg,#2dd4bf,#0ea5e9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Learn &amp; Grow
            </span>
            <span className="text-[10px] font-medium" style={{ color:'var(--cs-text-3)' }}>Study Together</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-3">
          {BASE_NAV_ITEMS.map(item => {
            const isActive = activeNav === item.label
            const badge = item.label === 'Buddies' && pendingRequests > 0
              ? String(pendingRequests)
              : item.label === 'Messages' && unreadMessages > 0
                ? String(unreadMessages)
                : item.label === 'Notifications' && notifBadgeCount > 0
                  ? String(notifBadgeCount)
                  : (item as { badge?: string }).badge
            return (
              <button key={item.label}
                onClick={() => item.path ? navigate(item.path) : undefined}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-left transition-all"
                style={{
                  background: isActive ? 'rgba(45,212,191,0.15)' : 'transparent',
                  color: isActive ? '#2dd4bf' : TEXT_MUTED,
                  border: isActive ? '1px solid rgba(45,212,191,0.2)' : '1px solid transparent',
                  cursor: 'pointer',
                }}>
                <span style={{ color: isActive ? '#2dd4bf' : 'var(--cs-text-3)' }}>{item.icon}</span>
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(45,212,191,0.2)', color: '#2dd4bf' }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Premium Card */}
        <div className="mx-3 mb-4 p-4 rounded-2xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(14,165,233,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" fill="#f59e0b" className="w-4 h-4">
              <path d="M5 16L3 5l5.5 5L12 2l3.5 8L21 5l-2 11H5zm2 2h10v2H7v-2z" />
            </svg>
            <span className="text-xs font-bold" style={{ color: 'var(--cs-text-1)' }}>Go Premium</span>
          </div>
          <p className="text-xs mb-3" style={{ color: TEXT_MUTED }}>Unlock unlimited matches, recordings & more</p>
          <button className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', boxShadow: '0 4px 12px rgba(13,148,136,0.4)' }}>
            Upgrade Now
          </button>
        </div>

        {/* Sign out */}
        <button onClick={() => { clearAuth(); navigate('/login') }}
          className="mx-3 mb-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
          style={{ color: 'var(--cs-text-3)', border: '1px solid var(--cs-border)' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
          </svg>
          Sign out
        </button>
      </aside>

      {/* ── PAGE CONTENT ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
    <GroupCallOverlay />
    </GroupCallProvider>
  )
}
