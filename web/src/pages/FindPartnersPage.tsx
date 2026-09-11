import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { chatApi } from '../api/chatApi'
import { connectionApi, type ConnStatus } from '../api/connectionApi'
import { profileApi, type ProfileSearchResult } from '../api/profileApi'

type SearchResult = ProfileSearchResult & {
  connectionStatus: ConnStatus
  connectionId?: string
  isSender: boolean
}

const ROLE_COLORS: Record<string, React.CSSProperties> = {
  Tutor:   { background:'rgba(168,85,247,0.12)', color:'#a855f7', border:'1px solid rgba(168,85,247,0.25)' },
  Learner: { background:'rgba(99,102,241,0.12)',  color:'#6366f1', border:'1px solid rgba(99,102,241,0.25)' },
  Both:    { background:'rgba(14,165,233,0.12)',  color:'#0ea5e9', border:'1px solid rgba(14,165,233,0.25)' },
}

function Avatar({ url, name, size = 48 }: { url?: string; name: string; size?: number }) {
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

function SkillChip({ label, variant }: { label: string; variant: 'teal' | 'indigo' }) {
  const s = variant === 'teal'
    ? { background:'rgba(13,148,136,0.12)', color:'#0d9488', border:'1px solid rgba(13,148,136,0.2)' }
    : { background:'rgba(99,102,241,0.12)', color:'#6366f1', border:'1px solid rgba(99,102,241,0.2)' }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={s}>{label}</span>
}

function SendRequestModal({ target, onClose, onSent }: {
  target: SearchResult
  onClose: () => void
  onSent: (id: string) => void
}) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    setSending(true)
    try {
      const r = await connectionApi.sendRequest(target.userId, note.trim() || undefined)
      onSent(r.data.id)
    } catch { /* ignore */ }
    finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}>
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
            <Avatar url={target.profilePictureUrl} name={`${target.firstName} ${target.lastName}`} size={40}/>
            <div>
              <p className="font-semibold text-sm" style={{ color:'var(--cs-text-1)' }}>{target.firstName} {target.middleName} {target.lastName}</p>
              {target.username && <p className="text-xs font-semibold" style={{ color:'#2dd4bf' }}>@{target.username}</p>}
              {target.headline && <p className="text-xs" style={{ color:'var(--cs-text-3)' }}>{target.headline}</p>}
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

function PartnerCard({ p, onSendRequest, onMessage, onViewProfile }: {
  p: SearchResult
  onSendRequest: () => void
  onMessage: () => void
  onViewProfile: () => void
}) {
  const fullName = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')

  const connectButton = () => {
    if (p.connectionStatus === 'Accepted')
      return (
        <button onClick={onMessage} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{ background:'rgba(34,197,94,0.12)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)' }}>
          Connected
        </button>
      )
    if (p.connectionStatus === 'Pending' && p.isSender)
      return (
        <button disabled className="flex-1 py-2 rounded-xl text-xs font-semibold"
          style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-3)', border:'1px solid var(--cs-border)' }}>
          Request Sent
        </button>
      )
    if (p.connectionStatus === 'Pending' && !p.isSender)
      return (
        <button onClick={onSendRequest} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)' }}>
          Respond
        </button>
      )
    return (
      <button onClick={onSendRequest} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
        style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white', boxShadow:'0 2px 8px rgba(13,148,136,0.25)' }}>
        Connect
      </button>
    )
  }

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 transition-all"
      style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', boxShadow:'0 1px 4px var(--cs-shadow)' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px var(--cs-shadow)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px var(--cs-shadow)'}>
      <div className="flex items-start gap-3">
        <Avatar url={p.profilePictureUrl} name={fullName} size={48}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm" style={{ color:'var(--cs-text-1)' }}>{fullName}</p>
            {p.username && <span className="text-xs font-semibold" style={{ color:'#2dd4bf' }}>@{p.username}</span>}
            {p.role && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={ROLE_COLORS[p.role]}>{p.role}</span>}
          </div>
          {p.headline && <p className="text-xs mt-0.5 line-clamp-1" style={{ color:'var(--cs-text-2)' }}>{p.headline}</p>}
          {(p.city || p.country) && (
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color:'var(--cs-text-3)' }}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
              {[p.city, p.country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      {p.subjectsKnown.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color:'var(--cs-text-3)' }}>Knows</p>
          <div className="flex flex-wrap gap-1.5">
            {p.subjectsKnown.slice(0, 3).map(s => <SkillChip key={s} label={s} variant="teal"/>)}
            {p.subjectsKnown.length > 3 && <span className="text-xs" style={{ color:'var(--cs-text-3)' }}>+{p.subjectsKnown.length - 3}</span>}
          </div>
        </div>
      )}
      {p.subjectsWanted.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color:'var(--cs-text-3)' }}>Learning</p>
          <div className="flex flex-wrap gap-1.5">
            {p.subjectsWanted.slice(0, 3).map(s => <SkillChip key={s} label={s} variant="indigo"/>)}
            {p.subjectsWanted.length > 3 && <span className="text-xs" style={{ color:'var(--cs-text-3)' }}>+{p.subjectsWanted.length - 3}</span>}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-auto pt-1">
        {connectButton()}
        <button onClick={onMessage} className="py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{ border:'1.5px solid #2dd4bf', color:'#2dd4bf', background:'rgba(45,212,191,0.05)' }}>
          Message
        </button>
        <button onClick={onViewProfile} className="py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}>
          Profile
        </button>
      </div>
    </div>
  )
}

const PAGE_SIZE = 20

export default function FindPartnersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialSearch = (location.state as { initialSearch?: string } | null)?.initialSearch ?? ''
  const [search, setSearch] = useState(initialSearch)
  const [roleFilter, setRoleFilter] = useState<'All' | 'Learner' | 'Tutor' | 'Both'>('All')
  const [skillInput, setSkillInput] = useState('')
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set())
  const [availableCountries, setAvailableCountries] = useState<string[]>([])
  const [countriesOpen, setCountriesOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [modalTarget, setModalTarget] = useState<SearchResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable array for dep comparison — Set identity changes on every render
  const selectedCountriesArr = useMemo(() => [...selectedCountries].sort(), [selectedCountries])

  const applyRaw = (raw: Array<ProfileSearchResult & { connectionStatus?: string; connectionId?: string; isSender?: boolean }>): SearchResult[] =>
    raw.map(p => ({
      ...p,
      connectionStatus: (p.connectionStatus ?? 'None') as ConnStatus,
      connectionId: p.connectionId,
      isSender: p.isSender ?? false,
    }))

  const doSearch = useCallback(async (q: string, role: string, skill: string, countries: string[]) => {
    setLoading(true)
    setResults([])
    setNextCursor(null)
    setHasMore(false)
    try {
      const r = await profileApi.searchProfiles(
        q || undefined,
        role === 'All' ? undefined : role,
        skill || undefined,
        countries.length > 0 ? countries : undefined,
        undefined,
        PAGE_SIZE
      )
      setResults(applyRaw(r.data.items))
      setHasMore(r.data.hasMore)
      setNextCursor(r.data.nextCursor)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const r = await profileApi.searchProfiles(
        search || undefined,
        roleFilter === 'All' ? undefined : roleFilter,
        skillInput || undefined,
        selectedCountriesArr.length > 0 ? selectedCountriesArr : undefined,
        nextCursor,
        PAGE_SIZE
      )
      setResults(prev => [...prev, ...applyRaw(r.data.items)])
      setHasMore(r.data.hasMore)
      setNextCursor(r.data.nextCursor)
    } catch { /* ignore */ }
    finally { setLoadingMore(false) }
  }

  // Fetch available countries once on mount
  useEffect(() => {
    profileApi.getCountries().then(r => setAvailableCountries(r.data)).catch(() => {})
  }, [])

  // Debounced incremental search — fires 350 ms after any filter change (including per-keystroke skill input)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(
      () => doSearch(search, roleFilter, skillInput, selectedCountriesArr),
      350
    )
  }, [search, roleFilter, skillInput, selectedCountriesArr, doSearch])

  const toggleCountry = (c: string) => {
    setSelectedCountries(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const handleRequestSent = (connectionId: string) => {
    setResults(rs => rs.map(r => r.userId === modalTarget?.userId
      ? { ...r, connectionStatus: 'Pending', connectionId, isSender: true }
      : r))
    setModalTarget(null)
  }

  const handleMessage = async (p: SearchResult) => {
    try {
      const r = await chatApi.startConversation(p.userId)
      navigate('/messages', { state: { convId: r.data.id } })
    } catch { navigate('/messages') }
  }

  const ROLES = ['All', 'Learner', 'Tutor', 'Both'] as const
  const hasFilters = !!search.trim() || !!skillInput.trim() || selectedCountriesArr.length > 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background:'var(--cs-bg)', color:'var(--cs-text-1)' }}>

      {/* Sticky header */}
      <div className="flex-shrink-0" style={{ borderBottom:'1px solid var(--cs-border)', background:'var(--cs-bg-nav)' }}>
        <div className="px-6 pt-4 pb-3">
          <h1 className="text-2xl font-extrabold" style={{ color:'var(--cs-text-1)' }}>Find Study Friends</h1>
          <p className="text-sm mt-0.5" style={{ color:'var(--cs-text-2)' }}>Search by name, @username, email, or skill</p>
        </div>

        {/* Row 1: search + role tabs + count */}
        <div className="flex items-center gap-3 flex-wrap px-6 pb-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-1"
            style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border)', minWidth:220, maxWidth:440 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, @username, email..."
              className="flex-1 bg-transparent outline-none text-sm" style={{ color:'var(--cs-text-1)' }}/>
            {search && (
              <button onClick={() => setSearch('')} style={{ color:'var(--cs-text-3)' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border)' }}>
            {ROLES.map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={roleFilter === r
                  ? { background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white' }
                  : { color:'var(--cs-text-2)', background:'transparent' }}>
                {r}
              </button>
            ))}
          </div>

          {!loading && results.length > 0 && (
            <span className="text-xs font-semibold ml-auto" style={{ color:'var(--cs-text-3)' }}>
              {results.length} loaded{hasMore ? ' · more available' : ''}
            </span>
          )}
          {loading && (
            <span className="text-xs font-semibold ml-auto flex items-center gap-1.5" style={{ color:'#2dd4bf' }}>
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Searching...
            </span>
          )}
        </div>

        {/* Row 2: skill filter (incremental) + country filter */}
        <div className="flex items-center gap-3 flex-wrap px-6 pb-3">
          {/* Skill filter — incremental: fires 350ms after every keystroke */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: skillInput ? 'rgba(45,212,191,0.08)' : 'var(--cs-bg-card)',
              border: skillInput ? '1px solid rgba(45,212,191,0.4)' : '1px solid var(--cs-border)',
              minWidth: 220, maxWidth: 280
            }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={skillInput ? '#2dd4bf' : 'var(--cs-text-3)'} strokeWidth="2" className="w-3.5 h-3.5 flex-shrink-0">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.42 2 2 0 0 1 3.64 1.25h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.9-1.9a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <input
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              placeholder="Filter by skill (e.g. React, ansible...)..."
              className="flex-1 bg-transparent outline-none text-xs"
              style={{ color: skillInput ? '#2dd4bf' : 'var(--cs-text-1)' }}
            />
            {skillInput && (
              <button onClick={() => setSkillInput('')} style={{ color:'#2dd4bf' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            )}
          </div>

          {/* Country filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setCountriesOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: selectedCountries.size > 0 ? 'rgba(14,165,233,0.1)' : 'var(--cs-bg-card)',
                border: selectedCountries.size > 0 ? '1px solid rgba(14,165,233,0.45)' : '1px solid var(--cs-border)',
                color: selectedCountries.size > 0 ? '#0ea5e9' : 'var(--cs-text-2)',
              }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
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
                {/* Backdrop */}
                <div className="fixed inset-0 z-20" onClick={() => { setCountriesOpen(false); setCountrySearch('') }}/>
                {/* Panel */}
                <div className="absolute top-full left-0 mt-1.5 z-30 rounded-2xl min-w-[220px]"
                  style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
                  {/* Search input */}
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
                  {/* List */}
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
                          <input
                            type="checkbox"
                            checked={selectedCountries.has(c)}
                            onChange={() => toggleCountry(c)}
                            style={{ accentColor:'#0ea5e9', width:14, height:14 }}
                          />
                          <span className="text-xs">{c}</span>
                        </label>
                      ))
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Active filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {skillInput && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background:'rgba(45,212,191,0.12)', color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.3)' }}>
                Skill: {skillInput}
              </span>
            )}
            {selectedCountriesArr.map(c => (
              <span key={c} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background:'rgba(14,165,233,0.12)', color:'#0ea5e9', border:'1px solid rgba(14,165,233,0.3)' }}>
                {c}
                <button onClick={() => toggleCountry(c)} className="ml-0.5 hover:opacity-70">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

        {/* Empty: no filters active */}
        {!loading && results.length === 0 && !hasFilters && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-14 h-14 opacity-30">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <p className="font-semibold" style={{ color:'var(--cs-text-2)' }}>Find your study friends</p>
            <p className="text-sm text-center" style={{ color:'var(--cs-text-3)', maxWidth:340 }}>
              Search by name or filter by skill — typos are fine, fuzzy matching handles them
            </p>
          </div>
        )}

        {/* Empty: filters active but no results */}
        {!loading && results.length === 0 && hasFilters && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="text-5xl">🔍</div>
            <p className="font-semibold text-lg" style={{ color:'var(--cs-text-1)' }}>No results found</p>
            <p className="text-sm" style={{ color:'var(--cs-text-3)' }}>Try adjusting your filters or clearing the country selection</p>
          </div>
        )}

        {/* Loading spinner (first page) */}
        {loading && (
          <div className="flex justify-center py-20">
            <svg className="animate-spin w-6 h-6" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        )}

        {/* Results grid */}
        {!loading && results.length > 0 && (
          <>
            <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))' }}>
              {results.map(p => (
                <PartnerCard key={p.userId} p={p}
                  onSendRequest={() => setModalTarget(p)}
                  onMessage={() => handleMessage(p)}
                  onViewProfile={() => navigate(`/profile/view/${p.userId}`)}/>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button onClick={loadMore} disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background:'var(--cs-bg-card)', color:'var(--cs-text-1)', border:'1px solid var(--cs-border)', opacity: loadingMore ? 0.7 : 1 }}>
                  {loadingMore
                    ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Loading...</>
                    : 'Load more people'
                  }
                </button>
              </div>
            )}

            {!hasMore && results.length > 0 && (
              <p className="text-center text-xs mt-8" style={{ color:'var(--cs-text-3)' }}>
                All {results.length} results shown
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
