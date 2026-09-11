import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatApi } from '../api/chatApi'
import { connectionApi, type ConnStatus } from '../api/connectionApi'
import { profileApi, type SuggestedProfile, type ProfileResponse } from '../api/profileApi'

type SuggestedResult = SuggestedProfile & { connectionStatus: ConnStatus }
type Tab = 'all' | 'teach' | 'learn' | 'study'

const PAGE_SIZE = 12

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

function SkillPill({ label, variant }: { label: string; variant: 'learn' | 'teach' }) {
  const s = variant === 'learn'
    ? { background:'rgba(99,102,241,0.12)', color:'#6366f1', border:'1px solid rgba(99,102,241,0.25)' }
    : { background:'rgba(13,148,136,0.12)', color:'#0d9488', border:'1px solid rgba(13,148,136,0.25)' }
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={s}>{label}</span>
}

function SendRequestModal({ target, onClose, onSent }: {
  target: SuggestedResult; onClose: () => void; onSent: (id: string) => void
}) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const fullName = [target.firstName, target.middleName, target.lastName].filter(Boolean).join(' ')

  const send = async () => {
    setSending(true)
    try {
      const r = await connectionApi.sendRequest(target.userId, note.trim() || undefined)
      onSent(r.data.id)
    } catch { /* ignore */ }
    finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl flex flex-col"
        style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid var(--cs-border)' }}>
          <h3 className="font-bold text-sm" style={{ color:'var(--cs-text-1)' }}>Send Connection Request</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color:'var(--cs-text-3)', background:'var(--cs-input-bg)' }}>
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'var(--cs-input-bg)' }}>
            <Avatar url={target.profilePictureUrl} name={fullName} size={40}/>
            <div>
              <p className="font-semibold text-sm" style={{ color:'var(--cs-text-1)' }}>{fullName}</p>
              {target.username && <p className="text-xs font-semibold" style={{ color:'#2dd4bf' }}>@{target.username}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color:'var(--cs-text-3)' }}>Add a note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={3}
              placeholder="Hi! I'd love to connect and learn together..."
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
              style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)', color:'var(--cs-text-1)' }}/>
            <p className="text-right text-[10px] mt-1" style={{ color:'var(--cs-text-3)' }}>{note.length}/300</p>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4" style={{ borderTop:'1px solid var(--cs-border)' }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}>Cancel</button>
          <button onClick={send} disabled={sending}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
            style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', opacity: sending ? 0.7 : 1 }}>
            {sending && <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            {sending ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PersonCard({ p, onConnect, onMessage, onViewProfile }: {
  p: SuggestedResult; onConnect: () => void; onMessage: () => void; onViewProfile: () => void
}) {
  const fullName = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')

  const teachChips = p.matchReasons.filter(r => r.toLowerCase().startsWith('teaches')).map(r => r.replace(/^teaches\s+/i, ''))
  const wantChips  = p.matchReasons.filter(r => r.toLowerCase().startsWith('wants')).map(r => r.replace(/^wants\s+/i, ''))
  const studyChips = p.matchReasons.filter(r => r.toLowerCase().startsWith('also learning')).map(r => r.replace(/^also learning\s+/i, ''))

  const actionBtn = () => {
    if (p.connectionStatus === 'Accepted')
      return <button onClick={onMessage} className="flex-1 py-2 rounded-xl text-xs font-semibold"
        style={{ background:'rgba(34,197,94,0.12)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)' }}>Connected · Message</button>
    if (p.connectionStatus === 'Pending' && p.isSender)
      return <button disabled className="flex-1 py-2 rounded-xl text-xs font-semibold"
        style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-3)', border:'1px solid var(--cs-border)' }}>Request Sent</button>
    if (p.connectionStatus === 'Pending' && !p.isSender)
      return <button onClick={onConnect} className="flex-1 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all"
        style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)' }}>Respond</button>
    return <button onClick={onConnect} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white active:scale-95 transition-all"
      style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', boxShadow:'0 2px 8px rgba(13,148,136,0.25)' }}>Connect</button>
  }

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3 transition-all"
      style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', boxShadow:'0 1px 4px var(--cs-shadow)' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 20px var(--cs-shadow)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='0 1px 4px var(--cs-shadow)'}>

      <div className="flex items-start gap-3">
        <Avatar url={p.profilePictureUrl} name={fullName} size={44}/>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight" style={{ color:'var(--cs-text-1)' }}>{fullName}</p>
          {p.username && <p className="text-xs font-semibold mt-0.5" style={{ color:'#2dd4bf' }}>@{p.username}</p>}
          {(p.city || p.country) && (
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color:'var(--cs-text-3)' }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/></svg>
              {[p.city, p.country].filter(Boolean).join(', ')}
            </p>
          )}
          {p.headline && <p className="text-xs mt-1 line-clamp-1" style={{ color:'var(--cs-text-2)' }}>{p.headline}</p>}
        </div>
      </div>

      {/* Match reasons */}
      <div className="space-y-1.5">
        {teachChips.length > 0 && (
          <div className="rounded-xl px-3 py-2" style={{ background:'rgba(13,148,136,0.07)', border:'1px solid rgba(13,148,136,0.18)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color:'#0d9488' }}>Can teach you</p>
            <div className="flex flex-wrap gap-1">
              {teachChips.map((s, i) => <span key={i} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:'rgba(13,148,136,0.12)', color:'#0d9488', border:'1px solid rgba(13,148,136,0.2)' }}>{s}</span>)}
            </div>
          </div>
        )}
        {wantChips.length > 0 && (
          <div className="rounded-xl px-3 py-2" style={{ background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.18)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color:'#6366f1' }}>Wants to learn from you</p>
            <div className="flex flex-wrap gap-1">
              {wantChips.map((s, i) => <span key={i} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:'rgba(99,102,241,0.12)', color:'#6366f1', border:'1px solid rgba(99,102,241,0.2)' }}>{s}</span>)}
            </div>
          </div>
        )}
        {studyChips.length > 0 && (
          <div className="rounded-xl px-3 py-2" style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.18)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color:'#f59e0b' }}>Learning together</p>
            <div className="flex flex-wrap gap-1">
              {studyChips.map((s, i) => <span key={i} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.2)' }}>{s}</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-auto">
        {actionBtn()}
        <button onClick={onViewProfile} className="py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}>
          Profile
        </button>
      </div>
    </div>
  )
}

export default function SuggestedBuddiesPage() {
  const navigate = useNavigate()
  const [myProfile, setMyProfile] = useState<ProfileResponse | null>(null)
  const [items, setItems] = useState<SuggestedResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [skillFilter, setSkillFilter] = useState<string | null>(null)
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set())
  const [countriesOpen, setCountriesOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [modalTarget, setModalTarget] = useState<SuggestedResult | null>(null)

  // Counts per tab (loaded from a quick all-tab fetch)
  const [counts, setCounts] = useState<Record<Tab, number>>({ all: 0, teach: 0, learn: 0, study: 0 })

  const fetchPage = useCallback(async (tab: Tab, skill: string | null, pg: number, append: boolean) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true)
    try {
      const r = await profileApi.getSuggested({ page: pg, pageSize: PAGE_SIZE, tab: tab === 'all' ? undefined : tab, skill: skill ?? undefined })
      const newItems = r.data.items.map(p => ({ ...p, connectionStatus: (p.connectionStatus ?? 'None') as ConnStatus }))
      setItems(prev => append ? [...prev, ...newItems] : newItems)
      setTotal(r.data.total)
      setHasMore((pg * PAGE_SIZE) < r.data.total)
      setPage(pg)
    } catch { /* ignore */ }
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  // Load profile + first page + tab counts on mount
  useEffect(() => {
    profileApi.getMe().then(r => setMyProfile(r.data)).catch(() => {})

    // Fetch counts for all tabs in parallel
    Promise.all([
      profileApi.getSuggested({ page: 1, pageSize: 1 }),
      profileApi.getSuggested({ page: 1, pageSize: 1, tab: 'teach' }),
      profileApi.getSuggested({ page: 1, pageSize: 1, tab: 'learn' }),
      profileApi.getSuggested({ page: 1, pageSize: 1, tab: 'study' }),
    ]).then(([all, teach, learn, study]) => {
      setCounts({ all: all.data.total, teach: teach.data.total, learn: learn.data.total, study: study.data.total })
    }).catch(() => {})

    fetchPage('all', null, 1, false)
  }, [fetchPage])

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    setSkillFilter(null)
    fetchPage(tab, null, 1, false)
  }

  const handleSkillFilter = (skill: string | null) => {
    setSkillFilter(skill)
    fetchPage(activeTab, skill, 1, false)
  }

  const handleLoadMore = () => fetchPage(activeTab, skillFilter, page + 1, true)

  const handleRequestSent = (connectionId: string) => {
    setItems(ss => ss.map(s => s.userId === modalTarget?.userId
      ? { ...s, connectionStatus: 'Pending' as ConnStatus, connectionId, isSender: true }
      : s))
    setModalTarget(null)
  }

  const handleMessage = async (p: SuggestedResult) => {
    try {
      const r = await chatApi.startConversation(p.userId)
      navigate('/messages', { state: { convId: r.data.id } })
    } catch { navigate('/messages') }
  }


  // Countries derived from loaded items
  const availableCountries = Array.from(
    new Set(items.map(p => p.country).filter(Boolean) as string[])
  ).sort()

  const toggleCountry = (c: string) =>
    setSelectedCountries(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })

  const filteredItems = selectedCountries.size === 0
    ? items
    : items.filter(p => p.country && selectedCountries.has(p.country))

  const myWants   = myProfile?.subjectsWanted ?? []
  const myTeaches = [...(myProfile?.subjectsCanTeach ?? []), ...(myProfile?.subjectsKnown ?? [])].filter((v, i, a) => a.indexOf(v) === i)

  // Skill filter chips — YOUR own skills, relevant to the active tab
  const allSkills = activeTab === 'learn'  ? myWants
                  : activeTab === 'teach'  ? myTeaches
                  : activeTab === 'study'  ? myWants
                  : [...new Set([...myWants, ...myTeaches])]

  const TABS: { key: Tab; label: string; color: string }[] = [
    { key: 'all',   label: 'All',                color: '#2dd4bf' },
    { key: 'learn', label: 'Can teach you',       color: '#6366f1' },
    { key: 'teach', label: 'Want to learn from you', color: '#0d9488' },
    { key: 'study', label: 'Study together',      color: '#f59e0b' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background:'var(--cs-bg)', color:'var(--cs-text-1)' }}>

      {/* ── Header: my skills ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-8 pt-5 pb-4"
        style={{ borderBottom:'1px solid var(--cs-border)', background:'var(--cs-bg-nav)' }}>
        <h1 className="text-xl font-extrabold mb-3" style={{ color:'var(--cs-text-1)' }}>Suggested Friends</h1>

        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[180px] rounded-xl px-4 py-2.5"
            style={{ background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.18)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:'#6366f1' }}>I want to learn</p>
            {myWants.length > 0
              ? <div className="flex flex-wrap gap-1">{myWants.map(s => <SkillPill key={s} label={s} variant="learn"/>)}</div>
              : <p className="text-xs" style={{ color:'var(--cs-text-3)' }}>
                  <button onClick={() => navigate('/profile')} className="underline" style={{ color:'#6366f1' }}>Add skills</button>
                </p>
            }
          </div>
          <div className="flex-1 min-w-[180px] rounded-xl px-4 py-2.5"
            style={{ background:'rgba(13,148,136,0.07)', border:'1px solid rgba(13,148,136,0.18)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color:'#0d9488' }}>I can teach</p>
            {myTeaches.length > 0
              ? <div className="flex flex-wrap gap-1">{myTeaches.map(s => <SkillPill key={s} label={s} variant="teach"/>)}</div>
              : <p className="text-xs" style={{ color:'var(--cs-text-3)' }}>
                  <button onClick={() => navigate('/profile')} className="underline" style={{ color:'#0d9488' }}>Add skills</button>
                </p>
            }
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
          style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border)' }}>
          {TABS.map(t => {
            const count = counts[t.key]
            const isActive = activeTab === t.key
            return (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={isActive
                  ? { background: t.key === 'all' ? 'linear-gradient(135deg,#0d9488,#0ea5e9)' : `${t.color}22`, color: t.key === 'all' ? 'white' : t.color, border: `1px solid ${t.color}44` }
                  : { color:'var(--cs-text-2)', background:'transparent', border:'1px solid transparent' }}>
                {t.label}
                {count > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                    style={{ background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--cs-input-bg)', color: isActive ? 'white' : 'var(--cs-text-3)' }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Skill + Country filter bar ─────────────────────────────────── */}
      {!loading && (allSkills.length > 0 || availableCountries.length > 0) && (
        <div className="flex-shrink-0 flex items-center gap-3 px-8 py-3"
          style={{ borderBottom:'1px solid var(--cs-border)', background:'var(--cs-bg-nav)' }}>

          {/* Skills — scrollable left section */}
          {allSkills.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color:'var(--cs-text-3)' }}>Skill:</span>
              <button
                onClick={() => handleSkillFilter(null)}
                className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={skillFilter === null
                  ? { background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white' }
                  : { background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}>
                All
              </button>
              {allSkills.map(s => (
                <button key={s} onClick={() => handleSkillFilter(skillFilter === s ? null : s)}
                  className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                  style={skillFilter === s
                    ? { background:'rgba(45,212,191,0.2)', color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.4)' }
                    : { background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Country filter — always fixed right, NOT inside overflow-x-auto */}
          {availableCountries.length > 0 && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setCountriesOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={selectedCountries.size > 0
                  ? { background:'rgba(14,165,233,0.15)', color:'#0ea5e9', border:'1px solid rgba(14,165,233,0.4)' }
                  : { background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                {selectedCountries.size > 0
                  ? `${selectedCountries.size} ${selectedCountries.size === 1 ? 'Country' : 'Countries'}`
                  : 'All Countries'}
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 transition-transform"
                  style={{ transform: countriesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                </svg>
              </button>

              {countriesOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => { setCountriesOpen(false); setCountrySearch('') }}/>
                  <div className="absolute top-full right-0 mt-1.5 z-30 rounded-2xl min-w-[220px]"
                    style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
                    <div className="p-2 border-b" style={{ borderColor:'var(--cs-border)' }}>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
                        style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 flex-shrink-0" style={{ color:'var(--cs-text-3)' }}>
                          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search countries..."
                          value={countrySearch}
                          onChange={e => setCountrySearch(e.target.value)}
                          className="flex-1 bg-transparent text-xs outline-none"
                          style={{ color:'var(--cs-text-1)' }}
                        />
                        {countrySearch && (
                          <button onClick={() => setCountrySearch('')} style={{ color:'var(--cs-text-3)' }}>
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-2 max-h-52 overflow-y-auto">
                      {selectedCountries.size > 0 && !countrySearch && (
                        <button
                          onClick={() => { setSelectedCountries(new Set()); setCountriesOpen(false); setCountrySearch('') }}
                          className="w-full text-left text-xs px-2 py-1.5 rounded-lg mb-1 font-semibold"
                          style={{ color:'#0ea5e9', background:'rgba(14,165,233,0.08)' }}>
                          Clear all ({selectedCountries.size})
                        </button>
                      )}
                      {(() => {
                        const filtered = availableCountries.filter(c =>
                          c.toLowerCase().includes(countrySearch.toLowerCase())
                        )
                        return filtered.length === 0 ? (
                          <p className="text-xs px-2 py-2 text-center" style={{ color:'var(--cs-text-3)' }}>No matches</p>
                        ) : filtered.map(c => (
                          <label key={c}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer"
                            style={{ color:'var(--cs-text-1)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--cs-input-bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <input type="checkbox" checked={selectedCountries.has(c)} onChange={() => toggleCountry(c)}
                              style={{ accentColor:'#0ea5e9', width:14, height:14 }}/>
                            <span className="text-xs">{c}</span>
                          </label>
                        ))
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

        {loading && (
          <div className="flex justify-center py-20">
            <svg className="animate-spin w-6 h-6" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-60 gap-4">
            <span className="text-5xl">🎯</span>
            <p className="font-bold text-lg" style={{ color:'var(--cs-text-1)' }}>No matches yet</p>
            <p className="text-sm text-center" style={{ color:'var(--cs-text-3)', maxWidth:320 }}>
              Add skills to your profile to see personalized matches here.
            </p>
            <button onClick={() => navigate('/profile')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
              style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
              Update My Skills
            </button>
          </div>
        )}

        {!loading && filteredItems.length > 0 && (
          <>
            {/* Count bar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold" style={{ color:'var(--cs-text-3)' }}>
                Showing {filteredItems.length} of {selectedCountries.size > 0 ? items.length : total} matches
                {skillFilter && <span> for <span style={{ color:'#2dd4bf' }}>{skillFilter}</span></span>}
                {selectedCountries.size > 0 && <span> in <span style={{ color:'#0ea5e9' }}>{[...selectedCountries].join(', ')}</span></span>}
              </p>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))' }}>
              {filteredItems.map(p => (
                <PersonCard key={p.userId} p={p}
                  onConnect={() => setModalTarget(p)}
                  onMessage={() => handleMessage(p)}
                  onViewProfile={() => navigate(`/profile/view/${p.userId}`)}/>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button onClick={handleLoadMore} disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background:'var(--cs-bg-card)', color:'var(--cs-text-1)', border:'1px solid var(--cs-border)', opacity: loadingMore ? 0.7 : 1 }}>
                  {loadingMore
                    ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Loading...</>
                    : `Load more (${total - items.length} remaining)`
                  }
                </button>
              </div>
            )}

            {!hasMore && filteredItems.length > 0 && (
              <p className="text-center text-xs mt-8" style={{ color:'var(--cs-text-3)' }}>
                All {selectedCountries.size > 0 ? filteredItems.length : total} matches shown
              </p>
            )}
          </>
        )}
      </div>

      {modalTarget && (
        <SendRequestModal
          target={modalTarget}
          onClose={() => setModalTarget(null)}
          onSent={handleRequestSent}/>
      )}
    </div>
  )
}
