import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  profileApi,
  type EducationDto, type ExperienceDto, type ProfileResponse, type ProjectDto,
} from '../api/profileApi'
import { useAuthStore } from '../store/authStore'
import { COUNTRIES } from '../data/countries'
import { COMMON_SKILLS } from '../data/skills'

/* ─── Completion ring ────────────────────────────────────────────────── */
function CompletionRing({ pct }: { pct: number }) {
  const r = 26, circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct === 100 ? '#22c55e' : '#2dd4bf'
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5"/>
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 32 32)" style={{ transition:'stroke-dashoffset 0.8s ease' }}/>
      <text x="32" y="37" textAnchor="middle" fontSize="12" fontWeight="700" fill="white">{pct}%</text>
    </svg>
  )
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
const gi: React.CSSProperties = {
  background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
  color:'white', outline:'none', borderRadius:10, padding:'9px 13px', fontSize:13, width:'100%',
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium mb-1" style={{ color:'rgba(255,255,255,0.4)' }}>{children}</p>
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Edit"
      className="p-1.5 rounded-lg transition-all flex-shrink-0"
      style={{ color:'rgba(255,255,255,0.3)', border:'1px solid rgba(255,255,255,0.1)' }}
      onMouseEnter={e => { e.currentTarget.style.color='#2dd4bf'; e.currentTarget.style.borderColor='rgba(45,212,191,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)' }}>
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
      </svg>
    </button>
  )
}

function SaveCancel({ saving, onSave, onCancel, error }: { saving:boolean; onSave:()=>void; onCancel:()=>void; error?:string }) {
  return (
    <div className="mt-4">
      {error && <p className="text-xs mb-2" style={{ color:'#f87171' }}>{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={saving}
          className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={{ color:'rgba(255,255,255,0.45)', border:'1px solid rgba(255,255,255,0.1)' }}>
          Cancel
        </button>
        <button onClick={onSave} disabled={saving}
          className="px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
          style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', boxShadow:'0 4px 14px rgba(13,148,136,0.25)' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

/* ─── Card wrapper ───────────────────────────────────────────────────── */
function Card({ title, icon, onEdit, editing, children }: {
  title:string; icon:string; onEdit?:()=>void; editing?:boolean; children:React.ReactNode
}) {
  return (
    <div className="rounded-2xl p-6 mb-4"
      style={{ background:'rgba(9,22,50,0.72)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(16px)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="font-semibold text-white text-sm tracking-wide">{title}</h3>
        </div>
        {onEdit && !editing && <EditBtn onClick={onEdit}/>}
      </div>
      {children}
    </div>
  )
}

/* ─── SkillTagInput ──────────────────────────────────────────────────── */
function SkillTagInput({ skills, onChange, placeholder }: {
  skills:string[]; onChange:(s:string[])=>void; placeholder?:string
}) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const iRef = useRef<HTMLInputElement>(null)

  const suggest = useCallback((val: string) => {
    if (!val.trim()) { setSuggestions([]); return }
    const q = val.toLowerCase()
    setSuggestions(COMMON_SKILLS.filter(s => s.toLowerCase().includes(q) && !skills.includes(s)).slice(0, 8))
  }, [skills])

  const add = (s: string) => {
    const t = s.trim(); if (!t || skills.includes(t)) return
    onChange([...skills, t]); setInput(''); setSuggestions([]); iRef.current?.focus()
  }
  const remove = (s: string) => onChange(skills.filter(x => x !== s))

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setSuggestions([]); setFocused(false) } }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <div className="relative">
        <input ref={iRef} value={input}
          style={gi}
          placeholder={placeholder ?? 'Type and press Enter…'}
          onChange={e => { setInput(e.target.value); suggest(e.target.value) }}
          onFocus={() => { setFocused(true); suggest(input) }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); suggestions.length > 0 ? add(suggestions[0]) : add(input) }
            if (e.key === 'Backspace' && !input && skills.length > 0) remove(skills[skills.length - 1])
            if (e.key === 'Escape') { setSuggestions([]); setFocused(false) }
          }}/>
        {(suggestions.length > 0 || (focused && input.trim())) && (
          <div className="absolute z-40 w-full rounded-xl overflow-hidden"
            style={{ background:'rgba(9,22,50,0.98)', border:'1px solid rgba(45,212,191,0.2)',
              boxShadow:'0 8px 24px rgba(0,0,0,0.5)', top:'calc(100% + 4px)' }}>
            {suggestions.map(s => (
              <button key={s} type="button" onClick={() => add(s)}
                className="w-full px-4 py-2 text-left text-sm transition-colors"
                style={{ color:'rgba(255,255,255,0.8)' }}
                onMouseEnter={e => (e.currentTarget.style.background='rgba(45,212,191,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                {s}
              </button>
            ))}
            {input.trim() && !COMMON_SKILLS.some(s => s.toLowerCase() === input.trim().toLowerCase()) && (
              <button type="button" onClick={() => add(input)}
                className="w-full px-4 py-2 text-left text-sm"
                style={{ color:'#2dd4bf', borderTop:'1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => (e.currentTarget.style.background='rgba(45,212,191,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                + Add "<strong>{input.trim()}</strong>"
              </button>
            )}
          </div>
        )}
      </div>
      {skills.length > 0 && (
        <div style={{ maxHeight:120, overflowY:'auto', scrollbarWidth:'thin',
          scrollbarColor:'rgba(45,212,191,0.2) transparent',
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:10, padding:10 }}>
          <div className="flex flex-wrap gap-1.5">
            {skills.map(s => (
              <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                style={{ background:'rgba(13,148,136,0.18)', color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.28)' }}>
                {s}
                <button type="button" onClick={() => remove(s)}
                  style={{ opacity:0.55, fontSize:13, lineHeight:1 }}
                  className="ml-0.5 hover:opacity-100">×</button>
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs" style={{ color:'rgba(255,255,255,0.22)' }}>
        {skills.length === 0 ? 'Type and press Enter to add' : `${skills.length} added`}
      </p>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [err, setErr] = useState('')

  // personal
  const [eFirst, setEFirst] = useState(''); const [eMid, setEMid] = useState(''); const [eLast, setELast] = useState('')
  const [eDob, setEDob] = useState(''); const [eGender, setEGender] = useState('')
  const [eCity, setECity] = useState(''); const [eCountry, setECountry] = useState('')
  const [eDial, setEDial] = useState('+1'); const [ePhone, setEPhone] = useState('')
  const [ePicFile, setEPicFile] = useState<string|undefined>(); const [ePicUrl, setEPicUrl] = useState('')
  const picRef = useRef<HTMLInputElement>(null)

  // professional
  const [eHeadline, setEHeadline] = useState(''); const [eAbout, setEAbout] = useState('')
  const [eWebsite, setEWebsite] = useState(''); const [eLinkedIn, setELinkedIn] = useState('')
  const [eGitHub, setEGitHub] = useState(''); const [eTwitter, setETwitter] = useState('')
  const [eOtw, setEOtw] = useState(false)

  // skills
  const [eRole, setERole] = useState(''); const [eKnown, setEKnown] = useState<string[]>([]); const [eWanted, setEWanted] = useState<string[]>([])

  // sections
  const [eEdus, setEEdus] = useState<EducationDto[]>([])
  const [eExps, setEExps] = useState<ExperienceDto[]>([])
  const [eProjs, setEProjs] = useState<ProjectDto[]>([])

  useEffect(() => {
    profileApi.getMe()
      .then(r => { setProfile(r.data); setLoading(false) })
      .catch(e => { if (e.response?.status === 404) navigate('/setup', { replace: true }); else setLoading(false) })
  }, [navigate])

  const startEdit = (section: string) => {
    if (!profile) return
    setErr(''); setEditing(section)
    const p = profile
    if (section === 'personal') {
      setEFirst(p.firstName); setEMid(p.middleName ?? ''); setELast(p.lastName)
      setEDob(p.dateOfBirth ?? ''); setEGender(p.gender ?? '')
      setECity(p.city ?? ''); setECountry(p.country ?? '')
      const m = (p.phone ?? '').match(/^(\+\d{1,4})\s?(.*)$/)
      if (m) { setEDial(m[1]); setEPhone(m[2]) } else { setEDial('+1'); setEPhone(p.phone ?? '') }
      setEPicUrl(p.profilePictureUrl ?? ''); setEPicFile(undefined)
    }
    if (section === 'professional') {
      setEHeadline(p.headline ?? ''); setEAbout(p.about ?? '')
      setEWebsite(p.website ?? ''); setELinkedIn(p.linkedInUrl ?? '')
      setEGitHub(p.gitHubUrl ?? ''); setETwitter(p.twitterUrl ?? '')
      setEOtw(p.isOpenToWork)
    }
    if (section === 'skills') {
      setERole(p.role ?? ''); setEKnown([...p.subjectsKnown]); setEWanted([...p.subjectsWanted])
    }
    if (section === 'educations') setEEdus(p.educations.map(e => ({ school:e.school, degree:e.degree, fieldOfStudy:e.fieldOfStudy, startYear:e.startYear, endYear:e.endYear, description:e.description })))
    if (section === 'experiences') setEExps(p.experiences.map(e => ({ company:e.company, title:e.title, employmentType:e.employmentType, location:e.location, startYear:e.startYear, startMonth:e.startMonth, endYear:e.endYear, endMonth:e.endMonth, description:e.description })))
    if (section === 'projects') setEProjs(p.projects.map(pr => ({ name:pr.name, description:pr.description, url:pr.url, technologies:[...pr.technologies] })))
  }

  const cancel = () => { setEditing(null); setErr('') }

  const save = async (fn: () => Promise<ProfileResponse>) => {
    setSaving(true); setErr('')
    try { setProfile(await fn()); setEditing(null) }
    catch { setErr('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background:'#020d1f' }}>
      <svg className="animate-spin w-6 h-6" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  )

  const p = profile!
  const pct = p.completionPercent

  const wantedLabel = p.role === 'Tutor' ? 'TO TEACH' : p.role === 'Both' ? 'TO LEARN / TEACH' : 'TO LEARN'
  const eWantedLabel = eRole === 'Tutor' ? 'Skills to Teach' : eRole === 'Both' ? 'Skills to Learn / Teach' : 'Skills to Learn'

  const PROFILE_NAV = [
    { label: 'Home', path: '/home' as string | null,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg> },
    { label: 'Find Partners', path: null as string | null,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg> },
    { label: 'Study Groups', path: null as string | null,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 17.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM9.5 8c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5S9.5 9.38 9.5 8zm6.5 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> },
    { label: 'Messages', path: null as string | null,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg> },
    { label: 'Notifications', path: null as string | null,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg> },
    { label: 'Progress', path: null as string | null,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 17v-5h2v5H7zm4-7v7h2v-7h-2zm4 3v4h2v-4h-2z"/></svg> },
    { label: 'Settings', path: '/profile' as string | null,
      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.04 7.04 0 00-1.62-.94l-.36-2.54A.484.484 0 0014 2h-4c-.25 0-.46.18-.49.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 00-.59.22L2.74 8.87a.47.47 0 00.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.49.42h4c.25 0 .46-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 00-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg> },
  ]

  return (
    <div className="flex h-screen overflow-hidden" style={{ background:'#020d1f', color:'white' }}>

      {/* ── LEFT SIDEBAR ────────────────────────────────────────── */}
      <aside className="flex flex-col h-screen overflow-y-auto flex-shrink-0"
        style={{ width:220, background:'rgba(9,22,50,0.95)', borderRight:'1px solid rgba(255,255,255,0.08)' }}>

        {/* Logo */}
        <button onClick={() => navigate('/home')} className="flex items-center gap-2.5 px-5 py-5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#2dd4bf,#0ea5e9)' }}>
            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-white"><circle cx="10" cy="7" r="3.2"/><path d="M3 17c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg>
          </div>
          <span className="font-bold text-sm leading-tight text-white">Combined<br/>Studies</span>
        </button>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-3">
          {PROFILE_NAV.map(item => {
            const isActive = item.label === 'Settings'
            return (
              <button key={item.label}
                onClick={() => { if (item.path) navigate(item.path) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-left transition-all"
                style={{
                  background: isActive ? 'rgba(45,212,191,0.15)' : 'transparent',
                  color: isActive ? '#2dd4bf' : 'rgba(255,255,255,0.55)',
                  border: isActive ? '1px solid rgba(45,212,191,0.2)' : '1px solid transparent',
                }}>
                <span style={{ color: isActive ? '#2dd4bf' : 'rgba(255,255,255,0.4)' }}>{item.icon}</span>
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {('badge' in item) && (item as { badge?: string }).badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background:'rgba(45,212,191,0.2)', color:'#2dd4bf' }}>
                    {(item as { badge?: string }).badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Premium Card */}
        <div className="mx-3 mb-4 p-4 rounded-2xl flex-shrink-0"
          style={{ background:'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(14,165,233,0.15))', border:'1px solid rgba(99,102,241,0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" fill="#f59e0b" className="w-4 h-4"><path d="M5 16L3 5l5.5 5L12 2l3.5 8L21 5l-2 11H5zm2 2h10v2H7v-2z"/></svg>
            <span className="text-xs font-bold text-white">Go Premium</span>
          </div>
          <p className="text-xs mb-3" style={{ color:'rgba(255,255,255,0.55)' }}>Unlock unlimited matches, recordings &amp; more</p>
          <button className="w-full py-2 rounded-xl text-xs font-bold text-white"
            style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>Upgrade Now</button>
        </div>

        {/* Sign out */}
        <button onClick={() => { clearAuth(); navigate('/login') }}
          className="mx-3 mb-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ color:'rgba(255,255,255,0.3)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          Sign out
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── PERSONAL / HEADER ──────────────────────────────────────── */}
        <Card title="Profile" icon="👤" editing={editing === 'personal'} onEdit={() => startEdit('personal')}>
          {editing === 'personal' ? (
            <div className="flex flex-col gap-4">
              {/* picture */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden cursor-pointer flex-shrink-0"
                  style={{ border:'2px solid rgba(45,212,191,0.4)', background:'rgba(255,255,255,0.07)' }}
                  onClick={() => picRef.current?.click()}>
                  {(ePicFile || ePicUrl)
                    ? <img src={ePicFile || ePicUrl} alt="" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ color:'#2dd4bf' }}>{p.firstName[0]}</div>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button type="button" onClick={() => picRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background:'rgba(45,212,191,0.1)', color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.2)' }}>
                    Change photo
                  </button>
                  {(ePicFile || ePicUrl) && (
                    <button type="button" onClick={() => { setEPicFile(undefined); setEPicUrl('') }}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ color:'rgba(255,100,100,0.7)', border:'1px solid rgba(255,100,100,0.2)' }}>
                      Remove
                    </button>
                  )}
                </div>
                <input ref={picRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return
                    const r = new FileReader(); r.onload = ev => { setEPicFile(ev.target?.result as string); setEPicUrl('') }; r.readAsDataURL(f)
                  }}/>
              </div>
              {/* name */}
              <div className="grid grid-cols-3 gap-2">
                <div><Lbl>First name *</Lbl><input value={eFirst} onChange={e => setEFirst(e.target.value)} style={gi}/></div>
                <div><Lbl>Middle name</Lbl><input value={eMid} onChange={e => setEMid(e.target.value)} style={gi}/></div>
                <div><Lbl>Last name *</Lbl><input value={eLast} onChange={e => setELast(e.target.value)} style={gi}/></div>
              </div>
              {/* gender */}
              <div>
                <Lbl>Gender</Lbl>
                <div className="flex gap-2 flex-wrap">
                  {['Male','Female','Non-binary','Prefer not to say'].map(g => (
                    <button key={g} type="button" onClick={() => setEGender(g === eGender ? '' : g)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: eGender===g ? 'rgba(45,212,191,0.18)' : 'rgba(255,255,255,0.05)',
                        border: eGender===g ? '1px solid rgba(45,212,191,0.45)' : '1px solid rgba(255,255,255,0.1)',
                        color: eGender===g ? '#2dd4bf' : 'rgba(255,255,255,0.45)',
                      }}>{g}</button>
                  ))}
                </div>
              </div>
              {/* dob */}
              <div><Lbl>Date of birth</Lbl><input type="date" value={eDob} onChange={e => setEDob(e.target.value)} style={{ ...gi, colorScheme:'dark' }}/></div>
              {/* city + country */}
              <div className="grid grid-cols-2 gap-2">
                <div><Lbl>City</Lbl><input value={eCity} onChange={e => setECity(e.target.value)} placeholder="City" style={gi}/></div>
                <div>
                  <Lbl>Country</Lbl>
                  <select value={eCountry} onChange={e => setECountry(e.target.value)} style={{ ...gi, cursor:'pointer' }}>
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
                  </select>
                </div>
              </div>
              {/* phone */}
              <div>
                <Lbl>Phone</Lbl>
                <div className="flex gap-2">
                  <select value={eDial} onChange={e => setEDial(e.target.value)} style={{ ...gi, width:110, flexShrink:0, cursor:'pointer' }}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>)}
                  </select>
                  <input type="tel" value={ePhone} onChange={e => setEPhone(e.target.value)} placeholder="Phone number" style={gi}/>
                </div>
              </div>
              <SaveCancel saving={saving} error={err} onCancel={cancel} onSave={() => save(() =>
                profileApi.updatePersonal({
                  firstName: eFirst.trim(), middleName: eMid.trim() || undefined, lastName: eLast.trim(),
                  dateOfBirth: eDob || undefined, gender: eGender || undefined,
                  phone: ePhone.trim() ? `${eDial} ${ePhone.trim()}` : undefined,
                  profilePictureUrl: ePicFile || ePicUrl.trim() || undefined,
                  city: eCity.trim() || undefined, country: eCountry || undefined,
                }).then(r => r.data)
              )}/>
            </div>
          ) : (
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0"
                style={{ border:'2px solid rgba(45,212,191,0.3)', background:'rgba(255,255,255,0.07)' }}>
                {p.profilePictureUrl
                  ? <img src={p.profilePictureUrl} alt="" className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ color:'#2dd4bf' }}>{p.firstName[0]}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white leading-tight">
                  {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')}
                </h2>
                {p.headline && <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,0.55)' }}>{p.headline}</p>}
                {(p.city || p.country) && <p className="text-xs mt-1" style={{ color:'rgba(255,255,255,0.35)' }}>{[p.city, p.country].filter(Boolean).join(', ')}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {p.gender && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.08)' }}>{p.gender}</span>}
                  {p.role && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background:'rgba(13,148,136,0.15)', color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.2)' }}>{p.role}</span>}
                  {p.isOpenToWork && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.2)' }}>Open to work</span>}
                </div>
                {p.phone && <p className="text-xs mt-1.5" style={{ color:'rgba(255,255,255,0.3)' }}>{p.phone}</p>}
                {p.dateOfBirth && <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.3)' }}>{new Date(p.dateOfBirth).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p>}
              </div>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <CompletionRing pct={pct}/>
                <p className="text-xs" style={{ color: pct===100 ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>complete</p>
              </div>
            </div>
          )}
        </Card>

        {/* ── PROFESSIONAL ──────────────────────────────────────────── */}
        <Card title="About & Links" icon="💡" editing={editing==='professional'} onEdit={() => startEdit('professional')}>
          {editing === 'professional' ? (
            <div className="flex flex-col gap-3">
              <div><Lbl>Headline</Lbl><input value={eHeadline} onChange={e => setEHeadline(e.target.value)} placeholder="e.g. DevOps Engineer · Open Source Contributor" style={gi}/></div>
              <div>
                <Lbl>About ({eAbout.length}/2600)</Lbl>
                <textarea value={eAbout} onChange={e => setEAbout(e.target.value.slice(0,2600))} rows={5}
                  placeholder="Write a short bio about yourself…"
                  style={{ ...gi, resize:'vertical', lineHeight:1.6 }}/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Lbl>Website</Lbl><input value={eWebsite} onChange={e => setEWebsite(e.target.value)} placeholder="https://…" style={gi}/></div>
                <div><Lbl>LinkedIn</Lbl><input value={eLinkedIn} onChange={e => setELinkedIn(e.target.value)} placeholder="linkedin.com/in/…" style={gi}/></div>
                <div><Lbl>GitHub</Lbl><input value={eGitHub} onChange={e => setEGitHub(e.target.value)} placeholder="github.com/…" style={gi}/></div>
                <div><Lbl>Twitter / X</Lbl><input value={eTwitter} onChange={e => setETwitter(e.target.value)} placeholder="twitter.com/…" style={gi}/></div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => setEOtw(v => !v)}>
                <div className="relative w-9 h-5 rounded-full transition-colors" style={{ background:eOtw ? '#0d9488' : 'rgba(255,255,255,0.1)' }}>
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: eOtw ? 'translateX(16px)' : 'none' }}/>
                </div>
                <span className="text-xs" style={{ color:'rgba(255,255,255,0.5)' }}>Open to work</span>
              </label>
              <SaveCancel saving={saving} error={err} onCancel={cancel} onSave={() => save(() =>
                profileApi.updateProfessional({
                  headline: eHeadline.trim() || undefined, about: eAbout.trim() || undefined,
                  website: eWebsite.trim() || undefined, linkedInUrl: eLinkedIn.trim() || undefined,
                  gitHubUrl: eGitHub.trim() || undefined, twitterUrl: eTwitter.trim() || undefined,
                  isOpenToWork: eOtw,
                }).then(r => r.data)
              )}/>
            </div>
          ) : (
            <div>
              {p.about
                ? <p className="text-sm leading-relaxed" style={{ color:'rgba(255,255,255,0.68)' }}>{p.about}</p>
                : <p className="text-sm" style={{ color:'rgba(255,255,255,0.22)' }}>No bio yet — add one to stand out.</p>}
              {(p.website || p.linkedInUrl || p.gitHubUrl || p.twitterUrl) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {([['🌐','Website',p.website],['💼','LinkedIn',p.linkedInUrl],['🐙','GitHub',p.gitHubUrl],['🐦','Twitter',p.twitterUrl]] as [string,string,string|undefined][])
                    .filter(([,,v]) => v)
                    .map(([icon,label,url]) => (
                      <span key={label} className="text-xs px-2.5 py-1 rounded-lg"
                        style={{ background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.5)', border:'1px solid rgba(255,255,255,0.08)' }}>
                        {icon} {label}
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── SKILLS ───────────────────────────────────────────────── */}
        <Card title="Skills" icon="⚡" editing={editing==='skills'} onEdit={() => startEdit('skills')}>
          {editing === 'skills' ? (
            <div className="flex flex-col gap-4">
              <div>
                <Lbl>Your role</Lbl>
                <div className="flex gap-2">
                  {['Learner','Tutor','Both'].map(r => (
                    <button key={r} type="button" onClick={() => setERole(r === eRole ? '' : r)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: eRole===r ? 'rgba(45,212,191,0.15)' : 'rgba(255,255,255,0.04)',
                        border: eRole===r ? '1px solid rgba(45,212,191,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        color: eRole===r ? '#2dd4bf' : 'rgba(255,255,255,0.45)',
                      }}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <Lbl>Skills I Know</Lbl>
                <SkillTagInput skills={eKnown} onChange={setEKnown} placeholder="e.g. React, Python, Docker…"/>
              </div>
              <div>
                <Lbl>{eWantedLabel}</Lbl>
                <SkillTagInput skills={eWanted} onChange={setEWanted} placeholder="e.g. Machine Learning, Spanish…"/>
              </div>
              <SaveCancel saving={saving} error={err} onCancel={cancel} onSave={() => save(() =>
                profileApi.updateSkills({ subjectsKnown:eKnown, subjectsWanted:eWanted, role:eRole||undefined }).then(r => r.data)
              )}/>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {p.subjectsKnown.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 tracking-wider" style={{ color:'rgba(255,255,255,0.35)' }}>KNOWS</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.subjectsKnown.map(s => (
                      <span key={s} className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background:'rgba(13,148,136,0.18)', color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.25)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {p.subjectsWanted.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 tracking-wider" style={{ color:'rgba(255,255,255,0.35)' }}>{wantedLabel}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.subjectsWanted.map(s => (
                      <span key={s} className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background:'rgba(99,102,241,0.15)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.25)' }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {!p.subjectsKnown.length && !p.subjectsWanted.length && (
                <p className="text-sm" style={{ color:'rgba(255,255,255,0.22)' }}>No skills added yet.</p>
              )}
            </div>
          )}
        </Card>

        {/* ── EDUCATION ────────────────────────────────────────────── */}
        <Card title="Education" icon="🎓" editing={editing==='educations'} onEdit={() => startEdit('educations')}>
          {editing === 'educations' ? (
            <div className="flex flex-col gap-4">
              {eEdus.map((edu, i) => (
                <div key={i} className="p-4 rounded-xl relative"
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)' }}>
                  <button type="button" onClick={() => setEEdus(prev => prev.filter((_,j) => j!==i))}
                    className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-lg"
                    style={{ color:'rgba(255,100,100,0.65)', border:'1px solid rgba(255,100,100,0.15)' }}>Remove</button>
                  <div className="grid grid-cols-2 gap-2 pr-16">
                    <div className="col-span-2"><Lbl>School *</Lbl><input value={edu.school} onChange={e => setEEdus(prev => prev.map((x,j) => j===i?{...x,school:e.target.value}:x))} style={gi}/></div>
                    <div><Lbl>Degree</Lbl><input value={edu.degree??''} onChange={e => setEEdus(prev => prev.map((x,j) => j===i?{...x,degree:e.target.value}:x))} style={gi}/></div>
                    <div><Lbl>Field of study</Lbl><input value={edu.fieldOfStudy??''} onChange={e => setEEdus(prev => prev.map((x,j) => j===i?{...x,fieldOfStudy:e.target.value}:x))} style={gi}/></div>
                    <div><Lbl>Start year</Lbl><input type="number" value={edu.startYear??''} onChange={e => setEEdus(prev => prev.map((x,j) => j===i?{...x,startYear:+e.target.value||undefined}:x))} style={gi}/></div>
                    <div><Lbl>End year</Lbl><input type="number" value={edu.endYear??''} onChange={e => setEEdus(prev => prev.map((x,j) => j===i?{...x,endYear:+e.target.value||undefined}:x))} placeholder="Leave blank if ongoing" style={gi}/></div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setEEdus(prev => [...prev, { school:'' }])}
                className="text-xs px-4 py-2 rounded-xl"
                style={{ color:'#2dd4bf', border:'1px dashed rgba(45,212,191,0.3)' }}>+ Add education</button>
              <SaveCancel saving={saving} error={err} onCancel={cancel} onSave={() => save(() =>
                profileApi.updateEducations(eEdus.filter(e => e.school.trim())).then(r => r.data)
              )}/>
            </div>
          ) : (
            <div>
              {p.educations.length > 0 ? p.educations.map(e => (
                <div key={e.id} className="mb-4 last:mb-0 flex gap-3">
                  <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-base"
                    style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.15)' }}>🎓</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{e.school}</p>
                    {(e.degree||e.fieldOfStudy) && <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.5)' }}>{[e.degree,e.fieldOfStudy].filter(Boolean).join(' · ')}</p>}
                    {(e.startYear||e.endYear) && <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.3)' }}>{e.startYear} – {e.endYear??'Present'}</p>}
                  </div>
                </div>
              )) : <p className="text-sm" style={{ color:'rgba(255,255,255,0.22)' }}>No education added yet.</p>}
            </div>
          )}
        </Card>

        {/* ── EXPERIENCE ───────────────────────────────────────────── */}
        <Card title="Experience" icon="💼" editing={editing==='experiences'} onEdit={() => startEdit('experiences')}>
          {editing === 'experiences' ? (
            <div className="flex flex-col gap-4">
              {eExps.map((exp, i) => (
                <div key={i} className="p-4 rounded-xl relative"
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)' }}>
                  <button type="button" onClick={() => setEExps(prev => prev.filter((_,j) => j!==i))}
                    className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-lg"
                    style={{ color:'rgba(255,100,100,0.65)', border:'1px solid rgba(255,100,100,0.15)' }}>Remove</button>
                  <div className="grid grid-cols-2 gap-2 pr-16">
                    <div><Lbl>Company *</Lbl><input value={exp.company} onChange={e => setEExps(prev => prev.map((x,j) => j===i?{...x,company:e.target.value}:x))} style={gi}/></div>
                    <div><Lbl>Title *</Lbl><input value={exp.title} onChange={e => setEExps(prev => prev.map((x,j) => j===i?{...x,title:e.target.value}:x))} style={gi}/></div>
                    <div><Lbl>Type</Lbl><input value={exp.employmentType??''} onChange={e => setEExps(prev => prev.map((x,j) => j===i?{...x,employmentType:e.target.value}:x))} placeholder="Full-time, Part-time…" style={gi}/></div>
                    <div><Lbl>Location</Lbl><input value={exp.location??''} onChange={e => setEExps(prev => prev.map((x,j) => j===i?{...x,location:e.target.value}:x))} style={gi}/></div>
                    <div><Lbl>Start year *</Lbl><input type="number" value={exp.startYear} onChange={e => setEExps(prev => prev.map((x,j) => j===i?{...x,startYear:+e.target.value}:x))} style={gi}/></div>
                    <div><Lbl>End year</Lbl><input type="number" value={exp.endYear??''} onChange={e => setEExps(prev => prev.map((x,j) => j===i?{...x,endYear:+e.target.value||undefined}:x))} placeholder="Blank if current" style={gi}/></div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setEExps(prev => [...prev, { company:'', title:'', startYear:new Date().getFullYear() }])}
                className="text-xs px-4 py-2 rounded-xl"
                style={{ color:'#2dd4bf', border:'1px dashed rgba(45,212,191,0.3)' }}>+ Add experience</button>
              <SaveCancel saving={saving} error={err} onCancel={cancel} onSave={() => save(() =>
                profileApi.updateExperiences(eExps.filter(e => e.company.trim()&&e.title.trim())).then(r => r.data)
              )}/>
            </div>
          ) : (
            <div>
              {p.experiences.length > 0 ? p.experiences.map(e => (
                <div key={e.id} className="mb-4 last:mb-0 flex gap-3">
                  <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-base"
                    style={{ background:'rgba(14,165,233,0.1)', border:'1px solid rgba(14,165,233,0.15)' }}>💼</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{e.title}</p>
                    <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.5)' }}>{e.company}{e.employmentType?` · ${e.employmentType}`:''}</p>
                    <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.3)' }}>{e.startYear} – {e.endYear??'Present'}{e.location?` · ${e.location}`:''}</p>
                  </div>
                </div>
              )) : <p className="text-sm" style={{ color:'rgba(255,255,255,0.22)' }}>No experience added yet.</p>}
            </div>
          )}
        </Card>

        {/* ── PROJECTS ─────────────────────────────────────────────── */}
        <Card title="Projects" icon="🚀" editing={editing==='projects'} onEdit={() => startEdit('projects')}>
          {editing === 'projects' ? (
            <div className="flex flex-col gap-4">
              {eProjs.map((proj, i) => (
                <div key={i} className="p-4 rounded-xl relative"
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)' }}>
                  <button type="button" onClick={() => setEProjs(prev => prev.filter((_,j) => j!==i))}
                    className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-lg"
                    style={{ color:'rgba(255,100,100,0.65)', border:'1px solid rgba(255,100,100,0.15)' }}>Remove</button>
                  <div className="flex flex-col gap-2 pr-16">
                    <div><Lbl>Name *</Lbl><input value={proj.name} onChange={e => setEProjs(prev => prev.map((x,j) => j===i?{...x,name:e.target.value}:x))} style={gi}/></div>
                    <div><Lbl>Description</Lbl><textarea value={proj.description??''} onChange={e => setEProjs(prev => prev.map((x,j) => j===i?{...x,description:e.target.value}:x))} rows={2} style={{ ...gi, resize:'vertical' }}/></div>
                    <div><Lbl>URL</Lbl><input value={proj.url??''} onChange={e => setEProjs(prev => prev.map((x,j) => j===i?{...x,url:e.target.value}:x))} placeholder="https://…" style={gi}/></div>
                    <div><Lbl>Technologies (comma-separated)</Lbl><input value={proj.technologies.join(', ')} onChange={e => setEProjs(prev => prev.map((x,j) => j===i?{...x,technologies:e.target.value.split(',').map(t=>t.trim()).filter(Boolean)}:x))} placeholder="React, Node.js, PostgreSQL…" style={gi}/></div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setEProjs(prev => [...prev, { name:'', technologies:[] }])}
                className="text-xs px-4 py-2 rounded-xl"
                style={{ color:'#2dd4bf', border:'1px dashed rgba(45,212,191,0.3)' }}>+ Add project</button>
              <SaveCancel saving={saving} error={err} onCancel={cancel} onSave={() => save(() =>
                profileApi.updateProjects(eProjs.filter(pr => pr.name.trim())).then(r => r.data)
              )}/>
            </div>
          ) : (
            <div>
              {p.projects.length > 0 ? p.projects.map(proj => (
                <div key={proj.id} className="mb-4 last:mb-0 flex gap-3">
                  <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-base"
                    style={{ background:'rgba(45,212,191,0.08)', border:'1px solid rgba(45,212,191,0.12)' }}>🚀</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{proj.name}</p>
                    {proj.description && <p className="text-xs mt-0.5 leading-relaxed" style={{ color:'rgba(255,255,255,0.5)' }}>{proj.description}</p>}
                    {proj.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {proj.technologies.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded" style={{ background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.07)' }}>{t}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              )) : <p className="text-sm" style={{ color:'rgba(255,255,255,0.22)' }}>No projects added yet.</p>}
            </div>
          )}
        </Card>

        </div></main>
    </div>
  )
}
