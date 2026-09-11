import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileApi, type ProfileResponse, type SuggestedProfile } from '../api/profileApi'
import { notificationApi } from '../api/notificationApi'
import { connectionApi, type ConnectionWithProfile } from '../api/connectionApi'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { useNotifications } from '../contexts/NotificationContext'

// ── Completion Ring ──────────────────────────────────────────────────────────
function CompletionRing({ pct }: { pct: number }) {
  const r = 38, circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
      <circle cx="48" cy="48" r={r} fill="none"
        stroke="url(#ring-grad)" strokeWidth="7"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 48 48)" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <text x="48" y="53" textAnchor="middle" fontSize="17" fontWeight="700" fill="#2dd4bf">{pct}%</text>
    </svg>
  )
}

// ── Static Data ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

const LEARNING_PATH_CARDS = [
  {
    title: 'Find Study Friend',
    desc: 'Match with peers learning the same tech stack',
    iconBg: '#7C3AED',
    icon: <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>,
  },
  {
    title: 'Join Study Group',
    desc: 'Collaborate in topic-focused learning circles',
    iconBg: '#16a34a',
    icon: <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 17.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM9.5 8c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5S9.5 9.38 9.5 8zm6.5 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>,
  },
]

// ── Sidebar styles (CSS variables → light/dark aware) ────────────────────────
const SIDEBAR_BG = 'var(--cs-bg-nav)'
const CARD_BG = 'var(--cs-bg-card)'
const CARD_BG_SOLID = 'var(--cs-bg-elevated)'
const BORDER = '1px solid var(--cs-border)'
const TEXT_MUTED = 'var(--cs-text-2)'
const TEXT_DIM = 'var(--cs-text-3)'

// ── Main Component ───────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { theme, toggle: toggleTheme } = useThemeStore()
  const [checking, setChecking] = useState(true)
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [suggested, setSuggested] = useState<SuggestedProfile[]>([])
  const [friends, setFriends] = useState<ConnectionWithProfile[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [topSearch, setTopSearch] = useState('')
  const { notifBadgeCount } = useNotifications()

  useEffect(() => {
    profileApi.getMe()
      .then(res => { setProfile(res.data); setChecking(false) })
      .catch((err: { response?: { status?: number } }) => {
        if (err.response?.status === 404) navigate('/setup', { replace: true })
        else setChecking(false)
      })
    profileApi.getSuggested()
      .then(res => setSuggested(res.data.items))
      .catch(() => {})
    notificationApi.getCounts()
      .then(res => { setUnreadMessages(res.data.unreadMessages); setPendingRequests(res.data.pendingRequests) })
      .catch(() => {})
    connectionApi.getConnections()
      .then(res => setFriends(res.data))
      .catch(() => {})
  }, [navigate])

  if (checking) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--cs-bg)' }}>
        <svg className="animate-spin w-6 h-6" style={{ color: '#2dd4bf' }} viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  const handleTopSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && topSearch.trim()) {
      navigate('/partners', { state: { initialSearch: topSearch.trim() } })
    }
  }

  const pct = profile?.completionPercent ?? 0
  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : (user?.displayName ?? '')
  const avatarLetter = profile?.firstName?.[0]?.toUpperCase() ?? user?.displayName?.[0]?.toUpperCase() ?? '?'
  const skillsCount = (profile?.subjectsKnown?.length ?? 0)
  const friendsCount = friends.length

  return (
    <div className="flex flex-1 overflow-hidden">
    <main className="flex-1 overflow-y-auto">

        {/* Sticky Top Bar */}
        <div className="sticky top-0 z-10 flex items-center gap-4 px-6 py-3"
          style={{ background: 'var(--cs-bg-nav)', backdropFilter: 'blur(16px)', borderBottom: BORDER }}>

          {/* Search */}
          <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{ background: 'var(--cs-input-bg)', border: '1.5px solid var(--cs-border)', maxWidth: 460, boxShadow: '0 1px 4px var(--cs-shadow)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={topSearch}
              onChange={e => setTopSearch(e.target.value)}
              onKeyDown={handleTopSearch}
              placeholder="Search skills, people… press Enter"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--cs-text-1)' }}
            />
            {topSearch && (
              <button onClick={() => navigate('/partners', { state: { initialSearch: topSearch.trim() } })}
                className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white' }}>
                Search →
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Bell */}
          <button onClick={() => navigate('/notifications')}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: 'var(--cs-input-bg)', border: '1.5px solid var(--cs-border)' }}>
            <svg viewBox="0 0 24 24" fill="var(--cs-text-2)" className="w-5 h-5">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </svg>
            {notifBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background: '#ef4444' }}>
                {notifBadgeCount > 9 ? '9+' : notifBadgeCount}
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{ background: 'var(--cs-input-bg)', border: '1.5px solid var(--cs-border)', color: 'var(--cs-text-2)' }}>
            {theme === 'dark'
              ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>
            }
          </button>

          {/* User */}
          <button
            onClick={() => navigate('/profile/preview')}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all"
            style={{ background: 'var(--cs-input-bg)', border: '1.5px solid var(--cs-border)' }}>
            <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#2dd4bf,#0ea5e9)', border: '2.5px solid rgba(45,212,191,0.5)' }}>
              {profile?.profilePictureUrl
                ? <img src={profile.profilePictureUrl} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-base font-bold text-white">{avatarLetter}</span>
              }
            </div>
            <span className="text-sm font-medium max-w-[120px] truncate" style={{ color: 'var(--cs-text-1)' }}>
              {displayName}
            </span>
            <svg viewBox="0 0 24 24" fill="var(--cs-text-3)" className="w-4 h-4 flex-shrink-0">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="px-6 py-6 space-y-8">

          {/* ── HERO BANNER ─────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden relative flex items-center"
            style={{
              minHeight: 200,
              background: 'linear-gradient(135deg, #4F46E5 0%, #2563eb 45%, #0ea5e9 80%, #2dd4bf 100%)',
              boxShadow: '0 8px 32px rgba(79,70,229,0.35)',
            }}>
            {/* Decorative blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-20"
                style={{ background: 'rgba(255,255,255,0.15)' }} />
              <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full opacity-10"
                style={{ background: 'rgba(255,255,255,0.2)' }} />
            </div>

            {/* Left text */}
            <div className="relative z-10 flex-1 px-8 py-8">
              <h1 className="text-3xl font-extrabold text-white leading-tight mb-2">
                Learn Together.<br />Grow Together.
              </h1>
              <p className="text-sm mb-6 max-w-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Connect with peers, collaborate in study groups, and accelerate your tech career together.
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => navigate('/partners')}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#1e40af] transition-all active:scale-[0.97]"
                  style={{ background: 'white', boxShadow: '0 4px 14px rgba(255,255,255,0.3)' }}>
                  Find Study Friend →
                </button>
                <button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.97]"
                  style={{ border: '1.5px solid rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.08)' }}>
                  ▶ How it works
                </button>
              </div>
            </div>

            {/* Right SVG illustration */}
            <div className="relative z-10 pr-8 hidden md:flex items-center">
              <svg width="160" height="140" viewBox="0 0 160 140" fill="none">
                {/* Graduation cap */}
                <polygon points="80,10 110,24 80,38 50,24" fill="rgba(255,255,255,0.9)" />
                <rect x="105" y="24" width="3" height="18" fill="rgba(255,255,255,0.7)" rx="1" />
                <circle cx="106.5" cy="44" r="4" fill="rgba(255,255,255,0.7)" />
                {/* Connection lines */}
                <line x1="52" y1="72" x2="80" y2="72" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
                <line x1="80" y1="72" x2="108" y2="72" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
                <line x1="52" y1="72" x2="52" y2="108" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
                <line x1="108" y1="72" x2="108" y2="108" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
                <line x1="52" y1="108" x2="80" y2="108" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
                <line x1="80" y1="108" x2="108" y2="108" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
                {/* Video boxes (rounded rects) */}
                {[
                  { x: 24, y: 52, bg: 'rgba(255,255,255,0.18)' },
                  { x: 88, y: 52, bg: 'rgba(255,255,255,0.15)' },
                  { x: 24, y: 90, bg: 'rgba(255,255,255,0.15)' },
                  { x: 88, y: 90, bg: 'rgba(255,255,255,0.18)' },
                ].map((box, i) => (
                  <g key={i}>
                    <rect x={box.x} y={box.y} width="48" height="36" rx="8" fill={box.bg} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                    <circle cx={box.x + 24} cy={box.y + 14} r="7" fill="rgba(255,255,255,0.5)" />
                    <path d={`M${box.x + 13} ${box.y + 30} q11-8 22 0`} stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
                  </g>
                ))}
                {/* Live dot */}
                <circle cx="30" cy="58" r="4" fill="#ef4444" />
                <circle cx="30" cy="58" r="7" fill="rgba(239,68,68,0.25)" />
              </svg>
            </div>
          </div>

          {/* ── LEARNING PATH CARDS ──────────────────────────────────── */}
          <section>
            <h2 className="text-base font-bold mb-4" style={{ color: 'var(--cs-text-1)' }}>Find your learning path</h2>
            <div className="grid grid-cols-4 gap-4">
              {LEARNING_PATH_CARDS.map(card => (
                <div key={card.title}
                  onClick={() => card.title === 'Find Study Friend' ? navigate('/partners') : card.title === 'Join Study Group' ? navigate('/study-groups') : undefined}
                  className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all hover:scale-[1.02]"
                  style={{ background: CARD_BG_SOLID, border: BORDER }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: card.iconBg }}>
                    {card.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-1" style={{ color: 'var(--cs-text-1)' }}>{card.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: TEXT_MUTED }}>{card.desc}</p>
                  </div>
                  <div className="flex justify-end">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)', border: BORDER }}>
                      <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)" className="w-4 h-4">
                        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── STUDY PARTNERS ───────────────────────────────────────── */}
          <section className="pb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold" style={{ color: 'var(--cs-text-1)' }}>Study Friends for You</h2>
              <button onClick={() => navigate('/partners')} className="text-xs font-semibold transition-colors" style={{ color: '#2dd4bf' }}>View all →</button>
            </div>
            {suggested.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: CARD_BG_SOLID, border: BORDER }}>
                <p className="text-sm" style={{ color: TEXT_MUTED }}>No suggestions yet — add skills to your profile to get matched with friends!</p>
                <button onClick={() => navigate('/profile')} className="mt-3 text-xs font-semibold" style={{ color: '#2dd4bf' }}>Update Profile →</button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {suggested.slice(0, 4).map((p, i) => {
                  const name = [p.firstName, p.lastName].filter(Boolean).join(' ')
                  const initials = (p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')
                  const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
                  const topSkill = p.subjectsKnown[0] ?? p.role ?? 'Learner'
                  return (
                    <div key={p.userId} className="rounded-2xl p-4 flex flex-col items-center text-center gap-3 transition-all hover:scale-[1.02] cursor-pointer"
                      style={{ background: CARD_BG_SOLID, border: BORDER }}
                      onClick={() => navigate(`/profile/view/${p.userId}`)}>
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold text-white"
                          style={{ background: avatarColor }}>
                          {p.profilePictureUrl
                            ? <img src={p.profilePictureUrl} alt={name} className="w-full h-full object-cover" />
                            : initials || '?'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold truncate max-w-[120px]" style={{ color: 'var(--cs-text-1)' }}>{name}</p>
                        {(p.city || p.country) && (
                          <p className="text-xs" style={{ color: TEXT_DIM }}>{[p.city, p.country].filter(Boolean).join(', ')}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 justify-center">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.3)' }}>
                          {topSkill}
                        </span>
                        {p.isOpenToWork && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                            Open to learn
                          </span>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/profile/view/${p.userId}`) }}
                        className="w-full py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.97]"
                        style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
                        View Profile
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        </div>
      </main>

      {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────── */}
      <aside
        className="overflow-y-auto flex-shrink-0 px-4 py-5 space-y-5"
        style={{ width: 300, borderLeft: BORDER, background: SIDEBAR_BG }}>

        {/* My Friends */}
        <div className="rounded-2xl p-4" style={{ background: CARD_BG, border: BORDER }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--cs-text-1)' }}>My Friends</h3>
            <button onClick={() => navigate('/buddies')} className="text-xs font-semibold" style={{ color: '#2dd4bf' }}>View all</button>
          </div>
          {friends.length === 0 ? (
            <div className="flex flex-col items-center py-4 gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-8 h-8 opacity-30">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <p className="text-xs text-center" style={{ color: TEXT_DIM }}>No friends yet</p>
              <button onClick={() => navigate('/partners')} className="mt-1 text-xs font-semibold" style={{ color: '#2dd4bf' }}>Find Friends →</button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {friends.slice(0, 4).map((f, i) => {
                const initials = f.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                const color = AVATAR_COLORS[f.name.charCodeAt(0) % AVATAR_COLORS.length]
                return (
                  <div key={f.connectionId} className="flex items-center gap-3 cursor-pointer"
                    onClick={() => navigate(`/profile/view/${f.userId}`)}>
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                      style={{ background: color }}>
                      {f.profilePictureUrl ? <img src={f.profilePictureUrl} alt="" className="w-full h-full object-cover"/> : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--cs-text-1)' }}>{f.name}</p>
                      {f.headline && <p className="text-[10px] truncate" style={{ color: TEXT_DIM }}>{f.headline}</p>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); navigate('/messages') }}
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ background: 'rgba(45,212,191,0.1)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.25)' }}>
                      Msg
                    </button>
                  </div>
                )
              })}
              {friends.length > 4 && (
                <p className="text-[10px] text-center mt-1" style={{ color: TEXT_DIM }}>+{friends.length - 4} more friends</p>
              )}
            </div>
          )}
        </div>

        {/* Learning Journey Stats */}
        <div className="rounded-2xl p-4" style={{ background: CARD_BG, border: BORDER }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--cs-text-1)' }}>Your Journey</h3>
            <CompletionRing pct={pct} />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: 'Friends', value: friendsCount },
              { label: 'Unread Messages', value: unreadMessages },
              { label: 'Pending Requests', value: pendingRequests },
              { label: 'Skills Known', value: skillsCount },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl p-2.5 text-center"
                style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}>
                <p className="text-lg font-extrabold" style={{ color: '#2dd4bf' }}>{stat.value}</p>
                <p className="text-[10px] leading-tight mt-0.5" style={{ color: TEXT_DIM }}>{stat.label}</p>
              </div>
            ))}
          </div>
          {pct < 100 && (
            <button
              onClick={() => navigate('/profile')}
              className="w-full py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
              style={{ background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)', color: '#2dd4bf' }}>
              Complete Profile ({pct}% done)
            </button>
          )}
        </div>

        {/* Quote */}
        <div className="rounded-2xl p-4" style={{ background: CARD_BG, border: BORDER }}>
          <svg viewBox="0 0 24 24" fill="rgba(45,212,191,0.3)" className="w-6 h-6 mb-2">
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
          </svg>
          <p className="text-xs italic leading-relaxed" style={{ color: TEXT_MUTED }}>
            "The beautiful thing about learning is that no one can take it away from you."
          </p>
          <p className="text-xs mt-2 font-semibold" style={{ color: TEXT_DIM }}>— B.B. King</p>
        </div>


      </aside>
    </div>
  )
}
