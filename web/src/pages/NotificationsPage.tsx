import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectionApi, type ConnectionWithProfile } from '../api/connectionApi'
import { groupApi } from '../api/groupApi'
import type { GroupInviteDto } from '../api/groupApi'
import { useNotifications } from '../contexts/NotificationContext'
import { useCall } from '../contexts/CallContext'

interface MissedCallRecord {
  callerName: string
  callerUserId: string
  isVideo: boolean
  at: string
}

type ActivityItem =
  | { type: 'accepted'; name: string; userId: string; at: string }
  | { type: 'rejected'; name: string; userId: string; at: string }
  | { type: 'group_deleted'; groupName: string; at: string }

function readActivity(): ActivityItem[] {
  try { return JSON.parse(localStorage.getItem('cs_activity_notifs') || '[]') }
  catch { return [] }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Avatar({ src, name, size = 44 }: { src?: string; name: string; size?: number }) {
  return (
    <div className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 font-bold text-white"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', fontSize: size * 0.38 }}>
      {src
        ? <img src={src} alt={name} className="w-full h-full object-cover" />
        : name[0]?.toUpperCase()}
    </div>
  )
}

function readMissedCalls(): MissedCallRecord[] {
  try { return JSON.parse(localStorage.getItem('cs_missed_calls') || '[]') }
  catch { return [] }
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { refresh, refreshMissedCalls, refreshActivity, clearNotificationBadge } = useNotifications()
  const { startCall } = useCall()
  const [requests, setRequests] = useState<ConnectionWithProfile[]>([])
  const [groupInvites, setGroupInvites] = useState<GroupInviteDto[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [inviteActing, setInviteActing] = useState<string | null>(null)
  const [missedCalls, setMissedCalls] = useState<MissedCallRecord[]>(readMissedCalls)
  const [activity, setActivity] = useState<ActivityItem[]>(readActivity)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, forceUpdate] = useState(0)

  const load = () => {
    setLoading(true)
    Promise.all([
      connectionApi.getRequests(),
      groupApi.getMyInvites(),
    ])
      .then(([connRes, inviteRes]) => {
        setRequests(connRes.data)
        setGroupInvites(inviteRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const dismissActivity = (at: string) => {
    const updated = activity.filter(a => a.at !== at)
    setActivity(updated)
    localStorage.setItem('cs_activity_notifs', JSON.stringify(updated))
    refreshActivity()
  }

  const clearAllActivity = () => {
    setActivity([])
    localStorage.removeItem('cs_activity_notifs')
    refreshActivity()
  }

  useEffect(() => {
    load()
    clearNotificationBadge()
    timerRef.current = setInterval(() => forceUpdate(n => n + 1), 60000)
    const missedHandler = () => setMissedCalls(readMissedCalls())
    const activityHandler = () => setActivity(readActivity())
    window.addEventListener('cs-missed-call-saved', missedHandler)
    window.addEventListener('cs-activity-added', activityHandler)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      window.removeEventListener('cs-missed-call-saved', missedHandler)
      window.removeEventListener('cs-activity-added', activityHandler)
    }
  }, [])

  const accept = async (conn: ConnectionWithProfile) => {
    setActing(conn.connectionId)
    try {
      await connectionApi.accept(conn.connectionId)
      setRequests(prev => prev.filter(r => r.connectionId !== conn.connectionId))
      refresh()
    } catch {}
    setActing(null)
  }

  const reject = async (conn: ConnectionWithProfile) => {
    setActing(conn.connectionId)
    try {
      await connectionApi.reject(conn.connectionId)
      setRequests(prev => prev.filter(r => r.connectionId !== conn.connectionId))
      refresh()
    } catch {}
    setActing(null)
  }

  const dismissMissedCall = (at: string) => {
    const updated = missedCalls.filter(c => c.at !== at)
    setMissedCalls(updated)
    localStorage.setItem('cs_missed_calls', JSON.stringify(updated))
    refreshMissedCalls()
    window.dispatchEvent(new CustomEvent('cs-missed-calls-cleared'))
  }

  const clearAllMissedCalls = () => {
    setMissedCalls([])
    localStorage.removeItem('cs_missed_calls')
    refreshMissedCalls()
    window.dispatchEvent(new CustomEvent('cs-missed-calls-cleared'))
  }

  const callBack = (record: MissedCallRecord) => {
    startCall(record.callerUserId, record.callerName, record.isVideo)
    dismissMissedCall(record.at)
  }

  const respondInvite = async (inviteId: string, accept: boolean) => {
    setInviteActing(inviteId)
    try {
      await groupApi.respondToInvite(inviteId, accept)
      setGroupInvites(prev => prev.filter(i => i.id !== inviteId))
      refresh()
    } catch {}
    setInviteActing(null)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--cs-bg)' }}>
      <div className="max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cs-text-1)' }}>Notifications</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--cs-text-2)' }}>
              Missed calls, connection requests and activity
            </p>
          </div>
          {(missedCalls.length > 0) && (
            <button
              onClick={() => {
                clearAllMissedCalls()
                clearNotificationBadge()
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Clear all
            </button>
          )}
        </div>

        {/* ── Missed Calls section ─────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cs-text-3)' }}>
                Missed Calls
              </span>
              {missedCalls.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                  {missedCalls.length}
                </span>
              )}
            </div>
            {missedCalls.length > 0 && (
              <button
                onClick={clearAllMissedCalls}
                className="text-xs transition-colors"
                style={{ color: 'var(--cs-text-3)' }}>
                Clear all
              </button>
            )}
          </div>

          {missedCalls.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-4 rounded-2xl"
              style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: '#f87171' }}>
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: 'var(--cs-text-2)' }}>No missed calls</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {missedCalls.map(record => (
                <div key={record.at}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl transition-all"
                  style={{ background: 'var(--cs-input-bg)', border: '1px solid rgba(239,68,68,0.2)' }}>

                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.12)' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: '#f87171' }}>
                      {record.isVideo
                        ? <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        : <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                      }
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/profile/view/${record.callerUserId}`)}
                        className="text-sm font-semibold hover:underline truncate"
                        style={{ color: 'var(--cs-text-1)' }}>
                        {record.callerName}
                      </button>
                      <span className="text-[10px] flex-shrink-0" style={{ color: '#f87171' }}>
                        Missed {record.isVideo ? 'video' : 'voice'} call
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--cs-text-3)' }}>{timeAgo(record.at)}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => callBack(record)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg,#0d9488,#22c55e)' }}>
                      Call back
                    </button>
                    <button
                      onClick={() => dismissMissedCall(record.at)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95"
                      style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-3)' }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Group Invites section ────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cs-text-3)' }}>
              Study Group Invites
            </span>
            {groupInvites.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
                {groupInvites.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--cs-input-bg)' }} />
          ) : groupInvites.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-4 rounded-2xl"
              style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.1)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: '#a78bfa' }}>
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: 'var(--cs-text-2)' }}>No pending group invites</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {groupInvites.map(inv => (
                <div key={inv.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl"
                  style={{ background: 'var(--cs-input-bg)', border: `1px solid ${inv.groupColor}33` }}>

                  {/* Clickable left side → navigate to study groups and open the group */}
                  <button
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => navigate('/study-groups', { state: { openGroupId: inv.groupId } })}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
                      style={{ background: inv.groupColor }}>
                      {inv.groupName[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold hover:underline" style={{ color: 'var(--cs-text-1)' }}>
                          {inv.groupName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                          style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                          Study Group
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--cs-text-3)' }}>
                        Invited by <span style={{ color: 'var(--cs-text-2)' }}>{inv.invitedByName}</span>
                        {' · '}{timeAgo(inv.createdAt)}
                      </p>
                    </div>
                  </button>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      disabled={inviteActing === inv.id}
                      onClick={() => respondInvite(inv.id, true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#0d9488,#22c55e)' }}>
                      Accept
                    </button>
                    <button
                      disabled={inviteActing === inv.id}
                      onClick={() => respondInvite(inv.id, false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-2)' }}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Activity section ────────────────────────────────────────── */}
        {activity.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cs-text-3)' }}>
                  Activity
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
                  {activity.length}
                </span>
              </div>
              <button onClick={clearAllActivity} className="text-xs transition-colors" style={{ color: 'var(--cs-text-3)' }}>
                Clear all
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {activity.map(item => {
                const isAccepted = item.type === 'accepted'
                const isRejected = item.type === 'rejected'
                const color = isAccepted ? '#22c55e' : isRejected ? '#f59e0b' : '#f87171'
                const bgColor = isAccepted ? 'rgba(34,197,94,0.1)' : isRejected ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'
                const label = isAccepted
                  ? `${item.name} accepted your connection request`
                  : isRejected
                    ? `${item.name} declined your connection request`
                    : `Your group "${(item as { groupName: string }).groupName}" was deleted`
                const icon = isAccepted
                  ? <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  : isRejected
                    ? <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
                    : <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                return (
                  <div key={item.at}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: 'var(--cs-input-bg)', border: `1px solid ${bgColor}` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: bgColor }}>
                      <svg viewBox="0 0 24 24" fill={color} className="w-5 h-5">{icon}</svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--cs-text-1)' }}>
                        {(item.type === 'accepted' || item.type === 'rejected') && (
                          <button
                            onClick={() => navigate(`/profile/view/${item.userId}`)}
                            className="font-semibold hover:underline mr-1" style={{ color }}>
                            {item.name}
                          </button>
                        )}
                        {isAccepted ? 'accepted your connection request'
                          : isRejected ? 'declined your connection request'
                            : label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--cs-text-3)' }}>{timeAgo(item.at)}</p>
                    </div>
                    <button
                      onClick={() => dismissActivity(item.at)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                      style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-3)' }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Buddy Requests section ───────────────────────────────────── */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cs-text-3)' }}>
              Buddy Requests
            </span>
            {requests.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(45,212,191,0.2)', color: '#2dd4bf' }}>
                {requests.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map(i => (
                <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--cs-input-bg)' }} />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--cs-input-bg)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" style={{ color: 'var(--cs-text-3)' }}>
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--cs-text-2)' }}>All caught up!</p>
              <p className="text-xs text-center" style={{ color: 'var(--cs-text-3)' }}>
                No pending buddy requests right now.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {requests.map(req => (
                <div key={req.connectionId}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl transition-all"
                  style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}>

                  <button onClick={() => navigate(`/profile/view/${req.userId}`)} className="flex-shrink-0">
                    <Avatar src={req.profilePictureUrl} name={req.name} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/profile/view/${req.userId}`)}
                        className="text-sm font-semibold hover:underline truncate"
                        style={{ color: 'var(--cs-text-1)' }}>
                        {req.name}
                      </button>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--cs-text-3)' }}>
                        {timeAgo(req.sentAt)}
                      </span>
                    </div>
                    {req.headline && (
                      <p className="text-xs truncate" style={{ color: 'var(--cs-text-3)' }}>{req.headline}</p>
                    )}
                    {req.note && (
                      <p className="text-xs mt-1 italic truncate" style={{ color: 'var(--cs-text-2)' }}>
                        "{req.note}"
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      disabled={acting === req.connectionId}
                      onClick={() => accept(req)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#0d9488,#22c55e)' }}>
                      Accept
                    </button>
                    <button
                      disabled={acting === req.connectionId}
                      onClick={() => reject(req)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-2)' }}>
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
