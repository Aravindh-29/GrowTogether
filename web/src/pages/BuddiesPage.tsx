import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatApi } from '../api/chatApi'
import { connectionApi, type ConnectionWithProfile } from '../api/connectionApi'

function Avatar({ url, name, size = 44 }: { url?: string; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#6366f1','#0ea5e9','#22c55e','#f59e0b','#ec4899','#14b8a6','#8b5cf6']
  const bg = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.32 }}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover"/> : initials}
    </div>
  )
}

type Tab = 'buddies' | 'requests' | 'sent'

export default function BuddiesPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('buddies')
  const [buddies, setBuddies] = useState<ConnectionWithProfile[]>([])
  const [requests, setRequests] = useState<ConnectionWithProfile[]>([])
  const [sent, setSent] = useState<ConnectionWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [b, r, s] = await Promise.all([
        connectionApi.getConnections(),
        connectionApi.getRequests(),
        connectionApi.getSent(),
      ])
      setBuddies(b.data)
      setRequests(r.data)
      setSent(s.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAccept = async (c: ConnectionWithProfile) => {
    setActionId(c.connectionId)
    try {
      await connectionApi.accept(c.connectionId)
      setRequests(rs => rs.filter(r => r.connectionId !== c.connectionId))
      setBuddies(bs => [...bs, { ...c, status: 'Accepted' }])
    } finally { setActionId(null) }
  }

  const handleReject = async (c: ConnectionWithProfile) => {
    setActionId(c.connectionId)
    try {
      await connectionApi.reject(c.connectionId)
      setRequests(rs => rs.filter(r => r.connectionId !== c.connectionId))
    } finally { setActionId(null) }
  }

  const handleCancel = async (c: ConnectionWithProfile) => {
    setActionId(c.connectionId)
    try {
      await connectionApi.cancel(c.connectionId)
      setSent(ss => ss.filter(s => s.connectionId !== c.connectionId))
    } finally { setActionId(null) }
  }

  const handleRemove = async (c: ConnectionWithProfile) => {
    setActionId(c.connectionId)
    try {
      await connectionApi.cancel(c.connectionId)
      setBuddies(bs => bs.filter(b => b.connectionId !== c.connectionId))
    } finally { setActionId(null) }
  }

  const handleMessage = async (c: ConnectionWithProfile) => {
    try {
      const r = await chatApi.startConversation(c.userId)
      navigate('/messages', { state: { convId: r.data.id } })
    } catch { navigate('/messages') }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'buddies',  label: 'All Friends',       count: buddies.length },
    { id: 'requests', label: 'Requests',           count: requests.length },
    { id: 'sent',     label: 'Sent',               count: sent.length },
  ]

  const renderList = (list: ConnectionWithProfile[], type: Tab) => {
    if (list.length === 0) return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-12 h-12 opacity-30">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
        <p className="text-sm font-medium" style={{ color:'var(--cs-text-3)' }}>
          {type === 'buddies' ? 'No friends yet — find someone to connect with!'
            : type === 'requests' ? 'No incoming requests'
            : 'No sent requests'}
        </p>
        {type === 'buddies' && (
          <button onClick={() => navigate('/partners')} className="mt-1 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
            Find Friends
          </button>
        )}
      </div>
    )

    return (
      <div className="space-y-3">
        {list.map(c => {
          const busy = actionId === c.connectionId
          const timeSince = new Date(c.sentAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
          return (
            <div key={c.connectionId} className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)' }}>
              <Avatar url={c.profilePictureUrl} name={c.name} size={44}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm" style={{ color:'var(--cs-text-1)' }}>{c.name}</p>
                  {c.username && <span className="text-xs font-semibold" style={{ color:'#2dd4bf' }}>@{c.username}</span>}
                  {c.role && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background:'rgba(99,102,241,0.1)', color:'#6366f1' }}>{c.role}</span>
                  )}
                </div>
                {c.headline && <p className="text-xs mt-0.5 line-clamp-1" style={{ color:'var(--cs-text-2)' }}>{c.headline}</p>}
                {(c.city || c.country) && (
                  <p className="text-xs mt-0.5" style={{ color:'var(--cs-text-3)' }}>{[c.city, c.country].filter(Boolean).join(', ')}</p>
                )}
                {c.note && type === 'requests' && (
                  <p className="text-xs mt-1 px-2.5 py-1.5 rounded-lg italic" style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-2)' }}>"{c.note}"</p>
                )}
                <p className="text-[10px] mt-1" style={{ color:'var(--cs-text-3)' }}>{timeSince}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => navigate(`/profile/view/${c.userId}`)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}>
                  Profile
                </button>
                {type === 'buddies' && (
                  <>
                    <button onClick={() => handleMessage(c)} disabled={busy}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                      style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white' }}>
                      Message
                    </button>
                    <button onClick={() => handleRemove(c)} disabled={busy}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-3)', border:'1px solid var(--cs-border)' }}>
                      {busy ? '…' : 'Remove'}
                    </button>
                  </>
                )}
                {type === 'requests' && (
                  <>
                    <button onClick={() => handleAccept(c)} disabled={busy}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                      style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white' }}>
                      {busy ? '…' : 'Accept'}
                    </button>
                    <button onClick={() => handleReject(c)} disabled={busy}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)' }}>
                      {busy ? '…' : 'Decline'}
                    </button>
                  </>
                )}
                {type === 'sent' && (
                  <button onClick={() => handleCancel(c)} disabled={busy}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-3)', border:'1px solid var(--cs-border)' }}>
                    {busy ? '…' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background:'var(--cs-bg)' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-4 pb-0" style={{ borderBottom:'1px solid var(--cs-border)', background:'var(--cs-bg-nav)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color:'var(--cs-text-1)' }}>My Friends</h1>
            <p className="text-sm mt-0.5" style={{ color:'var(--cs-text-2)' }}>Manage your study connections</p>
          </div>
          <button onClick={() => navigate('/partners')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
            style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
            Find Friends
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all relative"
              style={{ color: tab === t.id ? '#2dd4bf' : 'var(--cs-text-3)', background:'transparent' }}>
              {t.label}
              {t.count > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: tab === t.id ? 'rgba(45,212,191,0.15)' : 'var(--cs-input-bg)', color: tab === t.id ? '#2dd4bf' : 'var(--cs-text-3)' }}>
                  {t.count}
                </span>
              )}
              {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background:'#2dd4bf' }}/>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin w-6 h-6" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : (
          <>
            {tab === 'buddies'  && renderList(buddies,  'buddies')}
            {tab === 'requests' && renderList(requests, 'requests')}
            {tab === 'sent'     && renderList(sent,     'sent')}
          </>
        )}
      </div>
    </div>
  )
}
