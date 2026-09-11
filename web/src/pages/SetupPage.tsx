import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileApi, type EducationDto, type ExperienceDto, type ProjectDto } from '../api/profileApi'
import ConnectionGraphic from '../components/ConnectionGraphic'
import { useAuthStore } from '../store/authStore'
import { COUNTRIES, type Country } from '../data/countries'
import { COMMON_SKILLS } from '../data/skills'

/* ─── Motion variants ─────────────────────────────────────────────────── */
const stepVar = {
  enter:  (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.16,1,0.3,1] } },
  exit:   (d: number) => ({ opacity: 0, x: d > 0 ? -40 : 40, transition: { duration: 0.18 } }),
}

/* ─── Primitives ──────────────────────────────────────────────────────── */
function GlassInput({ value, onChange, placeholder, type = 'text', error }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: string
}) {
  return <>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all duration-200 glass-input"
      style={error ? { borderColor:'rgba(239,68,68,0.75)', boxShadow:'0 0 0 3px rgba(239,68,68,0.15)' } : {}}/>
    {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
  </>
}

function FL({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block text-xs font-semibold mb-1" style={{ color:'rgba(255,255,255,0.5)' }}>
      {children}{optional && <span className="ml-1 font-normal text-white/25">(optional)</span>}
    </label>
  )
}

/* ─── Country picker ──────────────────────────────────────────────────── */
function CountryPicker({ value, onChange }: { value: string; onChange: (c: Country) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const filtered = q ? COUNTRIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : COUNTRIES
  const sel = COUNTRIES.find(c => c.name === value)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(v => !v); setQ('') }}
        className="w-full px-4 py-2.5 rounded-xl text-sm font-medium glass-input flex items-center justify-between" style={{ minHeight:42 }}>
        <span style={{ color: sel ? 'white' : 'rgba(255,255,255,0.28)' }}>{sel ? `${sel.flag} ${sel.name}` : 'Select country'}</span>
        <svg viewBox="0 0 20 20" className="w-4 h-4 flex-shrink-0" style={{ fill:'rgba(255,255,255,0.3)', transform: open ? 'rotate(180deg)':'none', transition:'transform 0.2s' }}><path d="M5 7l5 5 5-5"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden" style={{ background:'rgba(9,22,50,0.98)', border:'1px solid rgba(45,212,191,0.25)', boxShadow:'0 16px 40px rgba(0,0,0,0.6)', maxHeight:260, top:'100%', left:0 }}>
          <div className="p-2" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search country..."
              className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={{ background:'rgba(255,255,255,0.07)', color:'white', border:'1px solid rgba(255,255,255,0.1)' }}/>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight:200 }}>
            {filtered.length === 0 && <p className="text-center text-xs py-4 text-white/30">No results</p>}
            {filtered.map(c => (
              <button key={c.code} type="button" onClick={() => { onChange(c); setOpen(false) }}
                className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors"
                style={{ background: value===c.name ? 'rgba(45,212,191,0.12)':'transparent', color: value===c.name ? '#2dd4bf':'rgba(255,255,255,0.75)' }}>
                <span className="text-base">{c.flag}</span>
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-white/30">{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Phone input ─────────────────────────────────────────────────────── */
function PhoneInput({ dialCode, number, onDialChange, onNumberChange }: {
  dialCode: string; number: string; onDialChange: (d: string) => void; onNumberChange: (n: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const filtered = q ? COUNTRIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.dial.includes(q)) : COUNTRIES
  const sel = COUNTRIES.find(c => c.dial === dialCode)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="flex gap-2">
      <div className="relative flex-shrink-0" style={{ width:108 }}>
        <button type="button" onClick={() => { setOpen(v => !v); setQ('') }}
          className="w-full h-full px-3 py-2.5 rounded-xl text-sm glass-input flex items-center gap-1.5 justify-between" style={{ minHeight:42 }}>
          <span className="text-base">{sel?.flag ?? '🌐'}</span>
          <span className="text-white font-semibold text-xs">{dialCode}</span>
          <svg viewBox="0 0 20 20" className="w-3 h-3" style={{ fill:'rgba(255,255,255,0.3)', transform: open ? 'rotate(180deg)':'none' }}><path d="M5 7l5 5 5-5"/></svg>
        </button>
        {open && (
          <div className="absolute z-50 rounded-xl overflow-hidden" style={{ background:'rgba(9,22,50,0.98)', border:'1px solid rgba(45,212,191,0.25)', boxShadow:'0 -16px 40px rgba(0,0,0,0.6)', width:240, maxHeight:280, bottom:'calc(100% + 6px)', left:0 }}>
            <div className="p-2" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
                className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={{ background:'rgba(255,255,255,0.07)', color:'white', border:'1px solid rgba(255,255,255,0.1)' }}/>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight:220 }}>
              {filtered.map(c => (
                <button key={c.code} type="button" onClick={() => { onDialChange(c.dial); setOpen(false) }}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-colors"
                  style={{ color:'rgba(255,255,255,0.75)' }}
                  onMouseEnter={e => (e.currentTarget.style.background='rgba(45,212,191,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <span className="text-base">{c.flag}</span>
                  <span className="flex-1 text-xs">{c.name}</span>
                  <span className="text-xs font-semibold" style={{ color:'rgba(45,212,191,0.8)' }}>{c.dial}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <input type="tel" value={number} onChange={e => onNumberChange(e.target.value)} placeholder="Phone number"
        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium outline-none glass-input" style={{ minHeight:42 }}/>
    </div>
  )
}

/* ─── Skill tag input with autocomplete ──────────────────────────────── */
function SkillTagInput({ skills, onChange, placeholder, openUpward }: { skills: string[]; onChange: (s: string[]) => void; placeholder?: string; openUpward?: boolean }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateSuggestions = useCallback((val: string) => {
    if (!val.trim()) { setSuggestions([]); return }
    const q = val.toLowerCase()
    setSuggestions(COMMON_SKILLS.filter(s => s.toLowerCase().includes(q) && !skills.includes(s)).slice(0, 8))
  }, [skills])

  const add = (skill: string) => {
    const t = skill.trim()
    if (!t || skills.includes(t)) return
    onChange([...skills, t]); setInput(''); setSuggestions([])
    inputRef.current?.focus()
  }
  const remove = (s: string) => onChange(skills.filter(x => x !== s))
  const clearAll = () => { onChange([]); setInput(''); setSuggestions([]); inputRef.current?.focus() }

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setSuggestions([]); setFocused(false) } }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="flex flex-col gap-2">
      {/* Input row */}
      <div className="relative">
        <input ref={inputRef} value={input}
          onChange={e => { setInput(e.target.value); updateSuggestions(e.target.value) }}
          onFocus={() => { setFocused(true); updateSuggestions(input) }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); if (suggestions.length > 0) add(suggestions[0]); else if (input.trim()) add(input) }
            if (e.key === 'Backspace' && !input && skills.length > 0) remove(skills[skills.length - 1])
            if (e.key === 'Escape') { setSuggestions([]); setFocused(false) }
          }}
          placeholder={placeholder ?? 'Type a skill and press Enter...'}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none glass-input"/>
        {(suggestions.length > 0 || (focused && input.trim())) && (
          <div className="absolute z-40 w-full rounded-xl overflow-hidden"
            style={{
              background:'rgba(9,22,50,0.98)',
              border:'1px solid rgba(45,212,191,0.2)',
              boxShadow: openUpward ? '0 -8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.5)',
              ...(openUpward ? { bottom:'calc(100% + 4px)' } : { top:'calc(100% + 4px)' }),
            }}>
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
                + Add "<span className="font-semibold">{input.trim()}</span>"
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tag container — fixed height, scrollable */}
      {skills.length > 0 && (
        <div style={{ maxHeight:140, overflowY:'auto', scrollbarWidth:'thin', scrollbarColor:'rgba(45,212,191,0.25) transparent', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:10 }}>
          <div className="flex flex-wrap gap-1.5">
            {skills.map(s => (
              <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                style={{ background:'rgba(13,148,136,0.18)', color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.28)' }}>
                {s}
                <button type="button" onClick={() => remove(s)}
                  className="leading-none transition-colors hover:text-white ml-0.5"
                  style={{ fontSize:13, opacity:0.6 }}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/25">
          {skills.length === 0 ? 'Press Enter or click a suggestion to add' : `${skills.length} skill${skills.length !== 1 ? 's' : ''} added`}
        </p>
        {skills.length > 0 && (
          <button type="button" onClick={clearAll}
            className="text-xs transition-colors"
            style={{ color:'rgba(255,100,100,0.5)' }}
            onMouseEnter={e => (e.currentTarget.style.color='rgba(255,100,100,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.color='rgba(255,100,100,0.5)')}>
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Education form ──────────────────────────────────────────────────── */
function EduForm({ items, onChange }: { items: EducationDto[]; onChange: (v: EducationDto[]) => void }) {
  const upd = (i: number, p: Partial<EducationDto>) => { const n=[...items]; n[i]={...n[i],...p}; onChange(n) }
  return (
    <div className="space-y-3">
      {items.map((edu, i) => (
        <div key={i} className="rounded-xl p-3 space-y-2" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/40 font-semibold">Education {i+1}</span>
            <button type="button" onClick={() => onChange(items.filter((_,j)=>j!==i))} className="text-xs text-red-400/60 hover:text-red-400">Remove</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><FL>School / University</FL><GlassInput value={edu.school} onChange={v=>upd(i,{school:v})} placeholder="e.g. MIT"/></div>
            <div><FL optional>Degree</FL><GlassInput value={edu.degree??''} onChange={v=>upd(i,{degree:v})} placeholder="B.Sc."/></div>
            <div><FL optional>Field of Study</FL><GlassInput value={edu.fieldOfStudy??''} onChange={v=>upd(i,{fieldOfStudy:v})} placeholder="Computer Science"/></div>
            <div><FL optional>Start Year</FL><GlassInput type="number" value={edu.startYear?.toString()??''} onChange={v=>upd(i,{startYear:v?parseInt(v):undefined})} placeholder="2018"/></div>
            <div><FL optional>End Year</FL><GlassInput type="number" value={edu.endYear?.toString()??''} onChange={v=>upd(i,{endYear:v?parseInt(v):undefined})} placeholder="2022"/></div>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { school:'', technologies:[] } as any])}
        className="w-full py-2 rounded-xl text-sm font-semibold text-teal-400 active:scale-[0.98]"
        style={{ border:'1px dashed rgba(45,212,191,0.3)', background:'rgba(45,212,191,0.04)' }}>
        + Add Education
      </button>
    </div>
  )
}

/* ─── Experience form ─────────────────────────────────────────────────── */
const EMP_TYPES = ['Full-time','Part-time','Internship','Freelance','Contract','Volunteer']
function ExpForm({ items, onChange }: { items: ExperienceDto[]; onChange: (v: ExperienceDto[]) => void }) {
  const upd = (i: number, p: Partial<ExperienceDto>) => { const n=[...items]; n[i]={...n[i],...p}; onChange(n) }
  return (
    <div className="space-y-3">
      {items.map((exp, i) => (
        <div key={i} className="rounded-xl p-3 space-y-2" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/40 font-semibold">Experience {i+1}</span>
            <button type="button" onClick={() => onChange(items.filter((_,j)=>j!==i))} className="text-xs text-red-400/60 hover:text-red-400">Remove</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><FL>Company</FL><GlassInput value={exp.company} onChange={v=>upd(i,{company:v})} placeholder="Google"/></div>
            <div><FL>Title</FL><GlassInput value={exp.title} onChange={v=>upd(i,{title:v})} placeholder="Software Engineer"/></div>
            <div>
              <FL optional>Type</FL>
              <select value={exp.employmentType??''} onChange={e=>upd(i,{employmentType:e.target.value||undefined})}
                className="w-full px-4 py-2.5 rounded-xl text-sm glass-input outline-none">
                <option value="">Select</option>
                {EMP_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><FL optional>Location</FL><GlassInput value={exp.location??''} onChange={v=>upd(i,{location:v})} placeholder="Remote"/></div>
            <div><FL>Start Year</FL><GlassInput type="number" value={exp.startYear?.toString()??''} onChange={v=>upd(i,{startYear:parseInt(v)||0})} placeholder="2020"/></div>
            <div><FL optional>End Year</FL><GlassInput type="number" value={exp.endYear?.toString()??''} onChange={v=>upd(i,{endYear:v?parseInt(v):undefined})} placeholder="Present"/></div>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { company:'', title:'', startYear: new Date().getFullYear() }])}
        className="w-full py-2 rounded-xl text-sm font-semibold text-teal-400 active:scale-[0.98]"
        style={{ border:'1px dashed rgba(45,212,191,0.3)', background:'rgba(45,212,191,0.04)' }}>
        + Add Experience
      </button>
    </div>
  )
}

/* ─── Project form ────────────────────────────────────────────────────── */
function ProjForm({ items, onChange }: { items: ProjectDto[]; onChange: (v: ProjectDto[]) => void }) {
  const upd = (i: number, p: Partial<ProjectDto>) => { const n=[...items]; n[i]={...n[i],...p}; onChange(n) }
  return (
    <div className="space-y-3">
      {items.map((proj, i) => (
        <div key={i} className="rounded-xl p-3 space-y-2" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/40 font-semibold">Project {i+1}</span>
            <button type="button" onClick={() => onChange(items.filter((_,j)=>j!==i))} className="text-xs text-red-400/60 hover:text-red-400">Remove</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><FL>Name</FL><GlassInput value={proj.name} onChange={v=>upd(i,{name:v})} placeholder="My Awesome Project"/></div>
            <div className="col-span-2"><FL optional>Description</FL><GlassInput value={proj.description??''} onChange={v=>upd(i,{description:v})} placeholder="What did you build?"/></div>
            <div><FL optional>URL</FL><GlassInput value={proj.url??''} onChange={v=>upd(i,{url:v})} placeholder="https://..."/></div>
            <div><FL optional>Tech (comma-sep)</FL><GlassInput value={proj.technologies.join(', ')} onChange={v=>upd(i,{technologies:v.split(',').map(t=>t.trim()).filter(Boolean)})} placeholder="React, Python"/></div>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { name:'', technologies:[] }])}
        className="w-full py-2 rounded-xl text-sm font-semibold text-teal-400 active:scale-[0.98]"
        style={{ border:'1px dashed rgba(45,212,191,0.3)', background:'rgba(45,212,191,0.04)' }}>
        + Add Project
      </button>
    </div>
  )
}

/* ─── Role card ───────────────────────────────────────────────────────── */
const ROLES = [
  { id:'Learner', label:'Learner', desc:'I want to find tutors and learn from peers', icon:'📚' },
  { id:'Tutor',   label:'Tutor',   desc:'I want to teach and help others grow',       icon:'🎓' },
  { id:'Both',    label:'Both',    desc:'I want to both learn and teach',              icon:'⚡' },
]

const GENDERS = ['Male','Female','Non-binary','Prefer not to say']

/* ─── Main page ───────────────────────────────────────────────────────── */
export default function SetupPage() {
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)

  const [step, setStep] = useState(0)
  const [dir,  setDir]  = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  /* Step 0 — Personal */
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [username,  setUsername]  = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'taken'|'invalid'>('idle')
  const usernameTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const [dob,       setDob]       = useState('')
  const [gender,    setGender]    = useState('')
  const [dialCode,  setDialCode]  = useState('+1')
  const [phoneNum,  setPhoneNum]  = useState('')
  const [city,      setCity]      = useState('')
  const [country,   setCountry]   = useState('')
  const [firstErr,  setFirstErr]  = useState('')
  const [lastErr,   setLastErr]   = useState('')
  const [genderErr, setGenderErr] = useState('')
  const [usernameErr, setUsernameErr] = useState('')

  const handleUsernameChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)
    setUsername(cleaned)
    setUsernameErr('')
    if (usernameTimer.current) clearTimeout(usernameTimer.current)
    if (!cleaned) { setUsernameStatus('idle'); return }
    if (cleaned.length < 3) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await profileApi.checkUsername(cleaned)
        setUsernameStatus(res.data.available ? 'available' : 'taken')
      } catch { setUsernameStatus('idle') }
    }, 500)
  }

  /* Step 1 — Picture */
  const [pictureUrl,  setPictureUrl]  = useState('')
  const [pictureFile, setPictureFile] = useState<string>('')  // base64 preview
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* Step 2 — Role */
  const [role, setRole] = useState('')

  /* Step 3 — Professional */
  const [headline,   setHeadline]   = useState('')
  const [about,      setAbout]      = useState('')
  const [website,    setWebsite]    = useState('')
  const [linkedIn,   setLinkedIn]   = useState('')
  const [gitHub,     setGitHub]     = useState('')
  const [twitter,    setTwitter]    = useState('')
  const [openToWork, setOpenToWork] = useState(false)

  /* Steps 4-6 */
  const [educations,  setEducations]  = useState<EducationDto[]>([])
  const [experiences, setExperiences] = useState<ExperienceDto[]>([])
  const [projects,    setProjects]    = useState<ProjectDto[]>([])

  /* Steps 7-8 — Skills */
  const [skillsKnown,  setSkillsKnown]  = useState<string[]>([])
  const [skillsWanted, setSkillsWanted] = useState<string[]>([])

  /* Dynamic step label for step 8 */
  const step8Label = role === 'Tutor' ? 'To Teach' : role === 'Both' ? 'Learn & Teach' : 'To Learn'
  const STEPS = ['Personal Info','Profile Picture','Your Role','Professional','Education','Experience','Projects','Skills',step8Label]

  const totalSteps = STEPS.length

  const go = (next: number) => {
    if (next > step) {
      if (step === 0) {
        let ok = true
        if (!firstName.trim()) { setFirstErr('First name is required'); ok = false }
        if (!lastName.trim())  { setLastErr('Last name is required');   ok = false }
        if (!gender)           { setGenderErr('Please select a gender'); ok = false }
        if (!username || username.length < 3) { setUsernameErr('Username must be at least 3 characters'); ok = false }
        else if (usernameStatus === 'taken') { setUsernameErr('This username is already taken'); ok = false }
        else if (usernameStatus === 'checking') { setUsernameErr('Still checking availability...'); ok = false }
        if (!ok) return
      }
    }
    setFirstErr(''); setLastErr(''); setGenderErr(''); setUsernameErr('')
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  const finalPictureUrl = pictureFile || pictureUrl.trim() || undefined

  const handleFinish = async () => {
    setError('')
    setLoading(true)
    try {
      await profileApi.create({
        personal: {
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          username: username || undefined,
          dateOfBirth: dob || undefined,
          gender: gender || undefined,
          phone: phoneNum.trim() ? `${dialCode} ${phoneNum.trim()}` : undefined,
          profilePictureUrl: finalPictureUrl,
          city: city.trim() || undefined,
          country: country || undefined,
        },
        professional: {
          headline: headline.trim() || undefined,
          about: about.trim() || undefined,
          website: website.trim() || undefined,
          linkedInUrl: linkedIn.trim() || undefined,
          gitHubUrl: gitHub.trim() || undefined,
          twitterUrl: twitter.trim() || undefined,
          isOpenToWork: openToWork,
        },
        skills: {
          subjectsKnown: skillsKnown,
          subjectsWanted: skillsWanted,
          role: role || undefined,
        },
        educations: educations.filter(e => e.school.trim()),
        experiences: experiences.filter(e => e.company.trim() && e.title.trim()),
        projects: projects.filter(p => p.name.trim()),
      })
      navigate('/home')
    } catch (err: unknown) {
      const axErr = err as { response?: { status?: number; data?: unknown } }
      const status = axErr?.response?.status
      console.error('[SetupPage] create failed — status:', status, 'body:', axErr?.response?.data)
      if (status === 409) { navigate('/home'); return }
      if (status === 400) {
        const detail = typeof axErr?.response?.data === 'string' ? axErr.response!.data as string : JSON.stringify(axErr?.response?.data)
        setError(`Validation error: ${detail || 'check your details'}`)
      } else if (status === 401) {
        setError('Session expired. Please log in again.')
      } else if (!status) {
        setError('Cannot reach server — is the backend running?')
      } else {
        setError(`Error ${status} — please try again.`)
      }
    } finally { setLoading(false) }
  }

  const pct = Math.round(((step + 1) / totalSteps) * 100)

  return (
    <div className="relative" style={{ minHeight:'100vh', background:'#020d1f', overflowX:'hidden', overflowY:'auto' }}>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex:0 }}>
        <motion.div className="absolute inset-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.7 } }}
          style={{ filter:'blur(2px)', transform:'scale(1.03)' }}>
          <ConnectionGraphic reduced={false}/>
        </motion.div>
        <div className="absolute inset-0"
          style={{ background:'linear-gradient(135deg,rgba(2,13,31,0.72),rgba(2,13,31,0.52) 50%,rgba(2,13,31,0.78))' }}/>
      </div>

      <div className="relative z-10 flex flex-col items-center" style={{ minHeight:'100vh', paddingTop:'5rem', paddingBottom:'3rem' }}>
        {/* wordmark */}
        <div className="fixed top-0 left-0 z-20 flex items-center gap-2.5 px-10 py-5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:'linear-gradient(135deg,#2dd4bf,#0ea5e9)' }}>
            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-white"><circle cx="10" cy="7" r="3.2"/><path d="M3 17c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-wide">Combined Studies</span>
        </div>

        {/* card */}
        <motion.div className="w-full" style={{ maxWidth:600 }}
          initial={{ opacity:0, y:24, scale:0.97 }}
          animate={{ opacity:1, y:0, scale:1, transition:{ duration:0.5, ease:[0.16,1,0.3,1] } }}>

          <div className="rounded-2xl mx-4"
            style={{ background:'rgba(9,22,50,0.84)', backdropFilter:'blur(28px)', WebkitBackdropFilter:'blur(28px)', border:'1px solid rgba(45,212,191,0.18)', boxShadow:'0 32px 64px rgba(0,0,0,0.5)', position:'relative' }}>

            <div className="p-6">
              {/* header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white/40 text-xs mb-0.5">Welcome, {user?.displayName} 👋</p>
                  <h2 className="text-lg font-bold text-white">{STEPS[step]}</h2>
                  <p className="text-white/30 text-xs mt-0.5">Step {step+1} of {totalSteps}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-1.5">
                    {STEPS.map((_,i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                        style={{ background: i<step ? '#2dd4bf' : i===step ? 'rgba(45,212,191,0.7)' : 'rgba(255,255,255,0.1)' }}/>
                    ))}
                  </div>
                  {step > 0 && (
                    <button type="button" onClick={handleFinish}
                      className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                      style={{ color:'rgba(255,255,255,0.35)', border:'1px solid rgba(255,255,255,0.1)' }}>
                      Save & exit
                    </button>
                  )}
                </div>
              </div>

              {/* progress bar — pill inside card */}
              <div className="rounded-full overflow-hidden mb-5" style={{ height:5, background:'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width:`${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#16a34a,#22c55e,#4ade80)' : 'linear-gradient(90deg,#2dd4bf,#0ea5e9,#6366f1)' }}/>
              </div>

              {/* content */}
              <div style={{ minHeight:300 }} className="relative overflow-hidden">
                <AnimatePresence mode="wait" custom={dir}>

                  {/* ── Step 0: Personal Info ── */}
                  {step === 0 && (
                    <motion.div key="s0" custom={dir} variants={stepVar} initial="enter" animate="center" exit="exit">
                      <div className="grid grid-cols-2 gap-3">
                        <div><FL>First Name</FL><GlassInput value={firstName} onChange={v=>{setFirstName(v);setFirstErr('')}} placeholder="Aravindh" error={firstErr}/></div>
                        <div><FL optional>Middle Name</FL><GlassInput value={middleName} onChange={setMiddleName} placeholder="Kumar"/></div>
                        <div><FL>Last Name</FL><GlassInput value={lastName} onChange={v=>{setLastName(v);setLastErr('')}} placeholder="Narayana" error={lastErr}/></div>
                        <div className="col-span-2">
                          <FL>Username</FL>
                          <div className="relative">
                            <div className="flex items-center">
                              <span className="absolute left-4 text-sm font-semibold select-none" style={{ color:'rgba(45,212,191,0.7)' }}>@</span>
                              <input
                                value={username}
                                onChange={e => handleUsernameChange(e.target.value)}
                                placeholder="your_unique_handle"
                                className="w-full pl-8 pr-10 py-2.5 rounded-xl text-sm font-medium outline-none glass-input transition-all duration-200"
                                style={usernameErr ? { borderColor:'rgba(239,68,68,0.75)', boxShadow:'0 0 0 3px rgba(239,68,68,0.15)' } : usernameStatus==='available' ? { borderColor:'rgba(34,197,94,0.6)', boxShadow:'0 0 0 3px rgba(34,197,94,0.1)' } : {}}
                              />
                              <span className="absolute right-3 flex items-center">
                                {usernameStatus==='checking' && <svg className="animate-spin w-4 h-4" style={{ color:'rgba(255,255,255,0.3)' }} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                                {usernameStatus==='available' && <svg viewBox="0 0 20 20" fill="#22c55e" className="w-4 h-4"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                                {usernameStatus==='taken' && <svg viewBox="0 0 20 20" fill="#ef4444" className="w-4 h-4"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>}
                              </span>
                            </div>
                          </div>
                          {usernameErr && <p className="text-xs text-red-400 mt-0.5">{usernameErr}</p>}
                          {!usernameErr && usernameStatus==='available' && <p className="text-xs mt-0.5" style={{ color:'#22c55e' }}>@{username} is available!</p>}
                          {!usernameErr && usernameStatus==='taken' && <p className="text-xs text-red-400 mt-0.5">@{username} is already taken</p>}
                          {!usernameErr && usernameStatus==='invalid' && <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.35)' }}>Min 3 characters (letters, numbers, _ only)</p>}
                          {usernameStatus==='idle' && !username && <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.3)' }}>This is how others will find you. Only letters, numbers and _</p>}
                        </div>
                        <div>
                          <FL optional>Date of Birth</FL>
                          <input type="date" value={dob} onChange={e=>setDob(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none glass-input" max={new Date().toISOString().split('T')[0]}/>
                        </div>
                        <div className="col-span-2">
                          <FL>Gender</FL>
                          <div className="flex gap-2 flex-wrap">
                            {GENDERS.map(g => (
                              <button key={g} type="button" onClick={() => { setGender(g); setGenderErr('') }}
                                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95"
                                style={gender===g
                                  ? { background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white', border:'1px solid transparent' }
                                  : { background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.55)', border:'1px solid rgba(255,255,255,0.12)' }}>
                                {g}
                              </button>
                            ))}
                          </div>
                          {genderErr && <p className="text-xs text-red-400 mt-1">{genderErr}</p>}
                        </div>
                        <div className="col-span-2">
                          <FL optional>Country</FL>
                          <CountryPicker value={country} onChange={c => { setCountry(c.name); setDialCode(c.dial) }}/>
                        </div>
                        <div className="col-span-2">
                          <FL optional>Phone</FL>
                          <PhoneInput dialCode={dialCode} number={phoneNum} onDialChange={setDialCode} onNumberChange={setPhoneNum}/>
                        </div>
                        <div className="col-span-2">
                          <FL optional>City</FL>
                          <GlassInput value={city} onChange={setCity} placeholder="Chennai"/>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step 1: Profile Picture ── */}
                  {step === 1 && (
                    <motion.div key="s1" custom={dir} variants={stepVar} initial="enter" animate="center" exit="exit">
                      <div className="flex flex-col items-center gap-4 py-2">
                        {/* avatar upload area */}
                        <div
                          className="relative w-32 h-32 rounded-full overflow-hidden cursor-pointer group"
                          style={{ background:'rgba(255,255,255,0.06)', border:'3px dashed rgba(45,212,191,0.35)' }}
                          onClick={() => fileInputRef.current?.click()}>
                          {(pictureFile || pictureUrl) ? (
                            <img src={pictureFile || pictureUrl} alt="Profile" className="w-full h-full object-cover"/>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                              <svg viewBox="0 0 48 48" className="w-12 h-12" style={{ color:'rgba(255,255,255,0.18)' }}>
                                <circle cx="24" cy="17" r="8" fill="currentColor"/>
                                <path d="M8 40c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="currentColor"/>
                              </svg>
                            </div>
                          )}
                          {/* overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="white" strokeWidth="2">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                              <circle cx="12" cy="13" r="4"/>
                            </svg>
                          </div>
                        </div>
                        <p className="text-sm text-white/50">Click the circle to upload a photo</p>

                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const reader = new FileReader()
                            reader.onload = ev => { setPictureFile(ev.target?.result as string); setPictureUrl('') }
                            reader.readAsDataURL(file)
                          }}/>

                        <div className="w-full">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.08)' }}/>
                            <span className="text-xs text-white/25">or paste a URL</span>
                            <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.08)' }}/>
                          </div>
                          <GlassInput value={pictureUrl} onChange={v => { setPictureUrl(v); if (v) setPictureFile('') }} placeholder="https://example.com/photo.jpg"/>
                        </div>
                        {(pictureFile || pictureUrl) && (
                          <button type="button" onClick={() => { setPictureFile(''); setPictureUrl('') }}
                            className="text-xs text-red-400/60 hover:text-red-400">Remove photo</button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step 2: Role ── */}
                  {step === 2 && (
                    <motion.div key="s2" custom={dir} variants={stepVar} initial="enter" animate="center" exit="exit">
                      <p className="text-sm text-white/50 mb-4">What brings you to Combined Studies?</p>
                      <div className="space-y-3">
                        {ROLES.map(r => (
                          <button key={r.id} type="button" onClick={() => setRole(r.id)}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all duration-200 active:scale-[0.99]"
                            style={role===r.id
                              ? { background:'rgba(45,212,191,0.12)', border:'2px solid rgba(45,212,191,0.5)', boxShadow:'0 0 0 4px rgba(45,212,191,0.08)' }
                              : { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)' }}>
                            <span className="text-3xl">{r.icon}</span>
                            <div>
                              <p className="text-sm font-bold" style={{ color: role===r.id ? '#2dd4bf' : 'white' }}>{r.label}</p>
                              <p className="text-xs mt-0.5 text-white/45">{r.desc}</p>
                            </div>
                            <div className="ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: role===r.id ? '#2dd4bf' : 'rgba(255,255,255,0.2)' }}>
                              {role===r.id && <div className="w-2.5 h-2.5 rounded-full" style={{ background:'#2dd4bf' }}/>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step 3: Professional ── */}
                  {step === 3 && (
                    <motion.div key="s3" custom={dir} variants={stepVar} initial="enter" animate="center" exit="exit">
                      <div className="space-y-3">
                        <div><FL optional>Headline</FL><GlassInput value={headline} onChange={setHeadline} placeholder="e.g. Computer Science Student | Python Enthusiast"/></div>
                        <div>
                          <FL optional>About</FL>
                          <textarea value={about} onChange={e=>setAbout(e.target.value)} placeholder="Tell others about yourself..." maxLength={2600} rows={4}
                            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none resize-none glass-input transition-all duration-200"/>
                          <p className="text-right text-xs text-white/20 mt-0.5">{about.length}/2600</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><FL optional>Website</FL><GlassInput value={website} onChange={setWebsite} placeholder="https://..."/></div>
                          <div><FL optional>LinkedIn</FL><GlassInput value={linkedIn} onChange={setLinkedIn} placeholder="linkedin.com/in/..."/></div>
                          <div><FL optional>GitHub</FL><GlassInput value={gitHub} onChange={setGitHub} placeholder="github.com/..."/></div>
                          <div><FL optional>Twitter</FL><GlassInput value={twitter} onChange={setTwitter} placeholder="twitter.com/..."/></div>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer pt-1">
                          <div onClick={() => setOpenToWork(v=>!v)}
                            className="w-9 h-5 rounded-full flex items-center px-0.5 transition-all duration-200"
                            style={{ background: openToWork ? 'linear-gradient(135deg,#0d9488,#0ea5e9)' : 'rgba(255,255,255,0.12)' }}>
                            <div className="w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                              style={{ transform: openToWork ? 'translateX(16px)' : 'none' }}/>
                          </div>
                          <span className="text-sm text-white/60">Open to work / collaborations</span>
                        </label>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step 4: Education ── */}
                  {step === 4 && (
                    <motion.div key="s4" custom={dir} variants={stepVar} initial="enter" animate="center" exit="exit">
                      <div className="overflow-y-auto pr-1" style={{ maxHeight:300 }}>
                        <EduForm items={educations} onChange={setEducations}/>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step 5: Experience ── */}
                  {step === 5 && (
                    <motion.div key="s5" custom={dir} variants={stepVar} initial="enter" animate="center" exit="exit">
                      <div className="overflow-y-auto pr-1" style={{ maxHeight:300 }}>
                        <ExpForm items={experiences} onChange={setExperiences}/>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step 6: Projects ── */}
                  {step === 6 && (
                    <motion.div key="s6" custom={dir} variants={stepVar} initial="enter" animate="center" exit="exit">
                      <div className="overflow-y-auto pr-1" style={{ maxHeight:300 }}>
                        <ProjForm items={projects} onChange={setProjects}/>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step 7: Skills Known ── */}
                  {step === 7 && (
                    <motion.div key="s7" custom={dir} variants={stepVar} initial="enter" animate="center" exit="exit">
                      <p className="text-sm text-white/55 mb-3">What skills, subjects, or tools do you know?</p>
                      <SkillTagInput skills={skillsKnown} onChange={setSkillsKnown} placeholder="Type a skill (e.g. Python, Guitar, Marketing)..."/>
                    </motion.div>
                  )}

                  {/* ── Step 8: Goals (dynamic) ── */}
                  {step === 8 && (
                    <motion.div key="s8" custom={dir} variants={stepVar} initial="enter" animate="center" exit="exit">
                      <div className="space-y-5">
                        {(role === 'Learner' || role === 'Both' || !role) && (
                          <div>
                            <p className="text-sm font-semibold mb-1" style={{ color:'rgba(45,212,191,0.85)' }}>
                              📚 What do you want to <span className="text-sky-400">learn</span>?
                            </p>
                            <p className="text-xs text-white/35 mb-2">Enter skills or subjects you'd like to learn from others.</p>
                            <SkillTagInput skills={role !== 'Tutor' ? skillsWanted : []} onChange={setSkillsWanted} placeholder="e.g. React, Spanish, Photography..."/>
                          </div>
                        )}
                        {(role === 'Tutor' || role === 'Both') && (
                          <div>
                            <p className="text-sm font-semibold mb-1" style={{ color:'rgba(45,212,191,0.85)' }}>
                              🎓 What do you want to <span className="text-teal-400">teach</span>?
                            </p>
                            <p className="text-xs text-white/35 mb-2">Enter skills or subjects you can teach others.</p>
                            <SkillTagInput
                              skills={role === 'Tutor' ? skillsWanted : skillsKnown}
                              onChange={role === 'Tutor' ? setSkillsWanted : setSkillsKnown}
                              placeholder="e.g. Mathematics, Piano, Python..."
                              openUpward={true}/>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {error && (
                <p className="text-sm text-red-300 rounded-xl px-4 py-2 mt-2 mb-1"
                  style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)' }}>
                  {error}
                </p>
              )}

              {/* nav */}
              <div className="flex items-center justify-between mt-5">
                <button type="button" onClick={() => go(step-1)} disabled={step===0}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white/50 disabled:opacity-0 transition-all"
                  style={{ border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)' }}>
                  Back
                </button>
                {step < totalSteps-1 ? (
                  <button type="button" onClick={() => go(step+1)}
                    className="px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
                    style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', boxShadow:'0 6px 20px rgba(13,148,136,0.35)' }}>
                    Next →
                  </button>
                ) : (
                  <button type="button" onClick={handleFinish} disabled={loading}
                    className="px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: loading ? 'rgba(20,184,166,0.5)' : 'linear-gradient(135deg,#0d9488,#0ea5e9)', boxShadow: loading ? 'none' : '0 6px 20px rgba(13,148,136,0.35)' }}>
                    {loading ? 'Saving…' : 'Finish setup ✓'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        .glass-input { background:rgba(255,255,255,0.07)!important; color:white!important; border:1px solid rgba(255,255,255,0.12)!important; }
        .glass-input::placeholder { color:rgba(255,255,255,0.28)!important; }
        .glass-input:focus { background:rgba(255,255,255,0.11)!important; border-color:rgba(45,212,191,0.55)!important; box-shadow:0 0 0 3px rgba(45,212,191,0.12)!important; }
        select.glass-input option { background:#0d1b33; color:white; }
        .overflow-y-auto::-webkit-scrollbar { width:4px; }
        .overflow-y-auto::-webkit-scrollbar-track { background:transparent; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:4px; }
      `}</style>
    </div>
  )
}
