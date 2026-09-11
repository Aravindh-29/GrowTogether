import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

function isBookmarked(userId: string): boolean {
  try { return (JSON.parse(localStorage.getItem('cs_bookmarks') || '[]') as { userId: string }[]).some(b => b.userId === userId) }
  catch { return false }
}
function toggleBookmark(profile: { userId: string; firstName: string; lastName: string; headline?: string; profilePictureUrl?: string; city?: string; country?: string }) {
  try {
    const stored = JSON.parse(localStorage.getItem('cs_bookmarks') || '[]') as { userId: string }[]
    const exists = stored.some(b => b.userId === profile.userId)
    const updated = exists ? stored.filter(b => b.userId !== profile.userId)
      : [...stored, { userId: profile.userId, name: `${profile.firstName} ${profile.lastName}`, headline: profile.headline, profilePictureUrl: profile.profilePictureUrl, city: profile.city, country: profile.country }]
    localStorage.setItem('cs_bookmarks', JSON.stringify(updated))
    return !exists
  } catch { return false }
}
import { chatApi } from '../api/chatApi'
import { connectionApi } from '../api/connectionApi'
import { profileApi, type PublicProfileResponse } from '../api/profileApi'

const card: React.CSSProperties = { background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', borderRadius:12, boxShadow:'0 1px 4px var(--cs-shadow)', marginBottom:12, overflow:'hidden' }
const t1: React.CSSProperties  = { color:'var(--cs-text-1)' }
const t2: React.CSSProperties  = { color:'var(--cs-text-2)' }
const t3: React.CSSProperties  = { color:'var(--cs-text-3)' }

function Avatar({ url, name, size = 80 }: { url?: string; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#6366f1','#0ea5e9','#22c55e','#f59e0b','#ec4899','#14b8a6','#8b5cf6']
  const bg = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="rounded-full overflow-hidden flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.32 }}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover"/> : initials}
    </div>
  )
}

function Chip({ label, variant='teal' }: { label:string; variant?:'teal'|'indigo'|'gray' }) {
  const s: Record<string,React.CSSProperties> = {
    teal:  { background:'rgba(13,148,136,0.12)', color:'#0d9488', border:'1px solid rgba(13,148,136,0.25)' },
    indigo:{ background:'rgba(99,102,241,0.12)',  color:'#6366f1', border:'1px solid rgba(99,102,241,0.25)' },
    gray:  { background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' },
  }
  return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={s[variant]}>{label}</span>
}

function SocialLink({ href, icon }: { href: string; icon: React.ReactNode }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
      style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}
      onMouseEnter={e=>{e.currentTarget.style.color='#2dd4bf';e.currentTarget.style.borderColor='rgba(45,212,191,0.4)'}}
      onMouseLeave={e=>{e.currentTarget.style.color='var(--cs-text-2)';e.currentTarget.style.borderColor='var(--cs-border)'}}>
      {icon}
    </a>
  )
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate   = useNavigate()
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [actionBusy, setActionBusy] = useState(false)
  const [noteModal, setNoteModal] = useState(false)
  const [note, setNote] = useState('')
  const [bookmarked, setBookmarked] = useState(false)
  useEffect(() => { if (userId) setBookmarked(isBookmarked(userId)) }, [userId])

  useEffect(() => {
    if (!userId) return
    profileApi.getProfile(userId)
      .then(r => setProfile(r.data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [userId])

  const sendRequest = async () => {
    if (!profile) return
    setNoteModal(false)
    setActionBusy(true)
    try {
      const r = await connectionApi.sendRequest(profile.userId, note.trim() || undefined)
      setProfile(p => p ? { ...p, connectionStatus: 'Pending', connectionId: r.data.id, isSender: true } : p)
      setNote('')
    } finally { setActionBusy(false) }
  }

  const handleMessage = async () => {
    if (!profile) return
    setActionBusy(true)
    try {
      const r = await chatApi.startConversation(profile.userId)
      navigate('/messages', { state: { convId: r.data.id } })
    } finally { setActionBusy(false) }
  }

  const cancelRequest = async () => {
    if (!profile?.connectionId) return
    setActionBusy(true)
    try {
      await connectionApi.cancel(profile.connectionId)
      setProfile(p => p ? { ...p, connectionStatus: 'None', connectionId: undefined, isSender: false } : p)
    } finally { setActionBusy(false) }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background:'var(--cs-bg)' }}>
        <svg className="animate-spin w-6 h-6" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background:'var(--cs-bg)' }}>
        <p className="font-semibold" style={t2}>Profile not found.</p>
        <button onClick={() => navigate(-1)} className="text-sm px-4 py-2 rounded-xl"
          style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)', ...t2 }}>Go back</button>
      </div>
    )
  }

  const fullName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ')
  const cs = profile.connectionStatus

  const connectionActions = () => {
    if (cs === 'Accepted')
      return (
        <button onClick={handleMessage} disabled={actionBusy}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 active:scale-95 transition-all"
          style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          {actionBusy ? 'Opening…' : 'Message'}
        </button>
      )
    if (cs === 'Pending' && profile.isSender)
      return (
        <button onClick={cancelRequest} disabled={actionBusy}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)', ...t2 }}>
          {actionBusy ? '…' : 'Cancel Request'}
        </button>
      )
    if (cs === 'Pending' && !profile.isSender)
      return (
        <span className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background:'rgba(245,158,11,0.1)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)' }}>
          Request Received — go to Buddies to respond
        </span>
      )
    // None / Rejected / Cancelled
    return (
      <button onClick={() => setNoteModal(true)} disabled={actionBusy}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
        style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
        {actionBusy ? '…' : 'Send Connection Request'}
      </button>
    )
  }

  const ROLE_COLORS: Record<string,React.CSSProperties> = {
    Tutor:   { background:'rgba(168,85,247,0.12)', color:'#a855f7', border:'1px solid rgba(168,85,247,0.25)' },
    Learner: { background:'rgba(99,102,241,0.12)',  color:'#6366f1', border:'1px solid rgba(99,102,241,0.25)' },
    Both:    { background:'rgba(14,165,233,0.12)',  color:'#0ea5e9', border:'1px solid rgba(14,165,233,0.25)' },
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background:'var(--cs-bg)' }}>
      <div className="max-w-2xl px-4 py-6 space-y-3">

        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm mb-2"
          style={t3}
          onMouseEnter={e=>e.currentTarget.style.color='#2dd4bf'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--cs-text-3)'}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          Back
        </button>

        {/* Hero card */}
        <div style={card}>
          <div className="h-24 w-full" style={{ background:'linear-gradient(135deg,#0d9488 0%,#0ea5e9 100%)' }}/>
          <div className="px-6 pb-6">
            {/* Avatar row — avatar overlaps banner, actions float right */}
            <div className="flex items-end justify-between -mt-9 mb-4">
              <div style={{ border:'3px solid var(--cs-bg-card)', borderRadius:'50%', lineHeight:0 }}>
                <Avatar url={profile.profilePictureUrl} name={fullName} size={72}/>
              </div>
              <div className="flex items-center gap-1.5 pb-1">
                {profile.website && <SocialLink href={profile.website} icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
                }/>}
                {profile.linkedInUrl && <SocialLink href={profile.linkedInUrl} icon={
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                }/>}
                {profile.gitHubUrl && <SocialLink href={profile.gitHubUrl} icon={
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                }/>}
                {profile.twitterUrl && <SocialLink href={profile.twitterUrl} icon={
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                }/>}
              </div>
            </div>

            {/* Name block — entirely below the avatar row */}
            <div className="mb-4">
              <h1 className="text-xl font-extrabold leading-tight" style={t1}>{fullName}</h1>
              {profile.username && (
                <p className="text-sm font-semibold mt-0.5" style={{ color:'#2dd4bf' }}>@{profile.username}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {profile.role && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={ROLE_COLORS[profile.role] ?? { background:'var(--cs-input-bg)', ...t2 }}>{profile.role}</span>
                )}
                {profile.isOpenToWork && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background:'rgba(34,197,94,0.12)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.25)' }}>
                    Open to Opportunities
                  </span>
                )}
              </div>
              {profile.headline && <p className="text-sm mt-1.5" style={t2}>{profile.headline}</p>}
              {(profile.city || profile.country) && (
                <p className="text-xs mt-1 flex items-center gap-1" style={t3}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                  </svg>
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {connectionActions()}
              <button
                onClick={() => { if (profile) setBookmarked(toggleBookmark(profile)) }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: bookmarked ? 'rgba(245,158,11,0.12)' : 'var(--cs-input-bg)', color: bookmarked ? '#f59e0b' : 'var(--cs-text-2)', border: `1px solid ${bookmarked ? 'rgba(245,158,11,0.3)' : 'var(--cs-border)'}` }}
                title={bookmarked ? 'Remove bookmark' : 'Bookmark'}>
                <svg viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {bookmarked ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {/* About */}
        {profile.about && (
          <div style={card}>
            <div className="px-6 py-5">
              <h3 className="font-bold text-sm mb-3" style={t1}>About</h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={t2}>{profile.about}</p>
            </div>
          </div>
        )}

        {/* Skills */}
        {(profile.subjectsKnown.length > 0 || profile.subjectsWanted.length > 0) && (
          <div style={card}>
            <div className="px-6 py-5 space-y-4">
              <h3 className="font-bold text-sm" style={t1}>Skills & Interests</h3>
              {profile.subjectsKnown.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={t3}>Knows</p>
                  <div className="flex flex-wrap gap-2">{profile.subjectsKnown.map(s => <Chip key={s} label={s} variant="teal"/>)}</div>
                </div>
              )}
              {profile.subjectsWanted.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={t3}>Wants to learn</p>
                  <div className="flex flex-wrap gap-2">{profile.subjectsWanted.map(s => <Chip key={s} label={s} variant="indigo"/>)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Education */}
        {profile.educations.length > 0 && (
          <div style={card}>
            <div className="px-6 pt-5 pb-2">
              <h3 className="font-bold text-sm mb-4" style={t1}>Education</h3>
              <div className="space-y-4">
                {profile.educations.map(e => (
                  <div key={e.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background:'rgba(99,102,241,0.1)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" className="w-4 h-4">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={t1}>{e.school}</p>
                      {(e.degree || e.fieldOfStudy) && (
                        <p className="text-xs" style={t2}>{[e.degree, e.fieldOfStudy].filter(Boolean).join(' · ')}</p>
                      )}
                      {(e.startYear || e.endYear) && (
                        <p className="text-xs mt-0.5" style={t3}>{e.startYear}{e.endYear ? ` – ${e.endYear}` : ''}</p>
                      )}
                      {e.description && <p className="text-xs mt-1" style={t3}>{e.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-4"/>
          </div>
        )}

        {/* Experience */}
        {profile.experiences.length > 0 && (
          <div style={card}>
            <div className="px-6 pt-5 pb-2">
              <h3 className="font-bold text-sm mb-4" style={t1}>Experience</h3>
              <div className="space-y-4">
                {profile.experiences.map(e => (
                  <div key={e.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background:'rgba(14,165,233,0.1)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" className="w-4 h-4">
                        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={t1}>{e.title}</p>
                      <p className="text-xs" style={t2}>{e.company}{e.employmentType ? ` · ${e.employmentType}` : ''}</p>
                      {e.location && <p className="text-xs" style={t3}>{e.location}</p>}
                      <p className="text-xs mt-0.5" style={t3}>
                        {e.startYear}{e.startMonth ? `/${e.startMonth}` : ''} – {e.endYear ? `${e.endYear}${e.endMonth ? `/${e.endMonth}` : ''}` : 'Present'}
                      </p>
                      {e.description && <p className="text-xs mt-1" style={t3}>{e.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-4"/>
          </div>
        )}

        {/* Projects */}
        {profile.projects.length > 0 && (
          <div style={card}>
            <div className="px-6 pt-5 pb-2">
              <h3 className="font-bold text-sm mb-4" style={t1}>Projects</h3>
              <div className="space-y-4">
                {profile.projects.map(p => (
                  <div key={p.id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm" style={t1}>{p.name}</p>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 flex-shrink-0"
                          style={{ color:'#2dd4bf' }}>
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg>
                          View
                        </a>
                      )}
                    </div>
                    {p.description && <p className="text-xs mt-0.5" style={t2}>{p.description}</p>}
                    {p.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.technologies.map(t => <Chip key={t} label={t} variant="gray"/>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="h-4"/>
          </div>
        )}

      </div>

      {/* Send Request note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl flex flex-col"
            style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid var(--cs-border)' }}>
              <h3 className="font-bold text-sm" style={t1}>Send Connection Request</h3>
              <button onClick={() => setNoteModal(false)} className="p-1.5 rounded-lg" style={{ color:'var(--cs-text-3)', background:'var(--cs-input-bg)' }}>
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'var(--cs-input-bg)' }}>
                <Avatar url={profile.profilePictureUrl} name={fullName} size={36}/>
                <div>
                  <p className="font-semibold text-sm" style={t1}>{fullName}</p>
                  {profile.username && <p className="text-xs font-semibold" style={{ color:'#2dd4bf' }}>@{profile.username}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={t3}>Add a note (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={3}
                  placeholder="Hi! I'd love to connect and learn together…"
                  className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
                  style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)', ...t1 }}/>
                <p className="text-right text-[10px] mt-0.5" style={t3}>{note.length}/300</p>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4" style={{ borderTop:'1px solid var(--cs-border)' }}>
              <button onClick={() => setNoteModal(false)} className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)', ...t2 }}>Cancel</button>
              <button onClick={sendRequest}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
                style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
