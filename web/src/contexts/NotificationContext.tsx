import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { notificationApi } from '../api/notificationApi'

const readLS = (key: string, fallback: number) => {
  try { return parseInt(localStorage.getItem(key) || String(fallback)) } catch { return fallback }
}

const readMissedCallCount = () => {
  try { return (JSON.parse(localStorage.getItem('cs_missed_calls') || '[]') as unknown[]).length }
  catch { return 0 }
}

const readActivityCount = () => {
  try { return (JSON.parse(localStorage.getItem('cs_activity_notifs') || '[]') as unknown[]).length }
  catch { return 0 }
}

interface NotificationState {
  pendingRequests: number
  unreadMessages: number
  unreadDMMessages: number
  unreadGroupMessages: number
  groupUnreadCounts: Record<string, number>
  missedCallCount: number
  pendingGroupInvites: number
  activityCount: number
  notifBadgeCount: number
  markConvRead: (count: number) => void
  incrementUnread: () => void
  incrementGroupUnread: (groupId: string) => void
  markGroupRead: (groupId: string) => void
  clearNotificationBadge: () => void
  refresh: () => void
  refreshMissedCalls: () => void
  refreshActivity: () => void
}

const NotificationContext = createContext<NotificationState>({
  pendingRequests: 0,
  unreadMessages: 0,
  unreadDMMessages: 0,
  unreadGroupMessages: 0,
  groupUnreadCounts: {},
  missedCallCount: 0,
  pendingGroupInvites: 0,
  activityCount: 0,
  notifBadgeCount: 0,
  markConvRead: () => {},
  incrementUnread: () => {},
  incrementGroupUnread: () => {},
  markGroupRead: () => {},
  clearNotificationBadge: () => {},
  refresh: () => {},
  refreshMissedCalls: () => {},
  refreshActivity: () => {},
})

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [pendingRequests, setPendingRequests] = useState(0)
  const [dmUnread, setDmUnread] = useState(0)
  const [groupUnreadCounts, setGroupUnreadCounts] = useState<Record<string, number>>({})
  const [missedCallCount, setMissedCallCount] = useState(readMissedCallCount)
  const [pendingGroupInvites, setPendingGroupInvites] = useState(0)
  const [activityCount, setActivityCount] = useState(readActivityCount)

  const [seenRequests, setSeenRequests] = useState(() => readLS('cs_notif_seen_req', 0))
  const [seenInvites, setSeenInvites]   = useState(() => readLS('cs_notif_seen_inv', 0))
  const [seenMissed, setSeenMissed]     = useState(() => readLS('cs_notif_seen_mis', 0))
  const [seenActivity, setSeenActivity] = useState(() => readLS('cs_notif_seen_act', 0))

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const totalGroupUnread = Object.values(groupUnreadCounts).reduce((a, b) => a + b, 0)

  const notifBadgeCount =
    Math.max(0, pendingRequests - seenRequests) +
    Math.max(0, missedCallCount - seenMissed) +
    Math.max(0, pendingGroupInvites - seenInvites) +
    Math.max(0, activityCount - seenActivity)

  const fetchCounts = () => {
    notificationApi.getCounts()
      .then(res => {
        setPendingRequests(res.data.pendingRequests)
        setDmUnread(res.data.unreadMessages)
        setPendingGroupInvites(res.data.pendingGroupInvites ?? 0)
      })
      .catch(() => {})
  }

  const refreshMissedCalls = () => setMissedCallCount(readMissedCallCount())
  const refreshActivity = () => setActivityCount(readActivityCount())

  const clearNotificationBadge = () => {
    setSeenRequests(pendingRequests)
    setSeenInvites(pendingGroupInvites)
    setSeenMissed(missedCallCount)
    setSeenActivity(activityCount)
    localStorage.setItem('cs_notif_seen_req', String(pendingRequests))
    localStorage.setItem('cs_notif_seen_inv', String(pendingGroupInvites))
    localStorage.setItem('cs_notif_seen_mis', String(missedCallCount))
    localStorage.setItem('cs_notif_seen_act', String(activityCount))
  }

  useEffect(() => {
    fetchCounts()
    pollRef.current = setInterval(fetchCounts, 20000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  useEffect(() => {
    const handler = () => setMissedCallCount(readMissedCallCount())
    window.addEventListener('cs-missed-call-saved', handler)
    return () => window.removeEventListener('cs-missed-call-saved', handler)
  }, [])

  useEffect(() => {
    const handler = () => setActivityCount(readActivityCount())
    window.addEventListener('cs-activity-added', handler)
    return () => window.removeEventListener('cs-activity-added', handler)
  }, [])

  return (
    <NotificationContext.Provider value={{
      pendingRequests,
      unreadMessages: dmUnread + totalGroupUnread,
      unreadDMMessages: dmUnread,
      unreadGroupMessages: totalGroupUnread,
      groupUnreadCounts,
      missedCallCount,
      pendingGroupInvites,
      activityCount,
      notifBadgeCount,
      markConvRead: (count) => setDmUnread(prev => Math.max(0, prev - count)),
      incrementUnread: () => setDmUnread(prev => prev + 1),
      incrementGroupUnread: (groupId) =>
        setGroupUnreadCounts(prev => ({ ...prev, [groupId]: (prev[groupId] || 0) + 1 })),
      markGroupRead: (groupId) =>
        setGroupUnreadCounts(prev => { const n = { ...prev }; delete n[groupId]; return n }),
      clearNotificationBadge,
      refresh: fetchCounts,
      refreshMissedCalls,
      refreshActivity,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)
