import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileApi, type AvailabilitySlot, type EducationDto, type ExperienceDto, type ProfileResponse, type ProjectDto } from '../api/profileApi'
import { authApi } from '../api/authApi'

const COUNTRIES = [
  { name:'Afghanistan', dial:'+93' }, { name:'Algeria', dial:'+213' }, { name:'Argentina', dial:'+54' },
  { name:'Australia', dial:'+61' }, { name:'Austria', dial:'+43' }, { name:'Bangladesh', dial:'+880' },
  { name:'Belgium', dial:'+32' }, { name:'Brazil', dial:'+55' }, { name:'Canada', dial:'+1' },
  { name:'Chile', dial:'+56' }, { name:'China', dial:'+86' }, { name:'Colombia', dial:'+57' },
  { name:'Denmark', dial:'+45' }, { name:'Egypt', dial:'+20' }, { name:'Ethiopia', dial:'+251' },
  { name:'Finland', dial:'+358' }, { name:'France', dial:'+33' }, { name:'Germany', dial:'+49' },
  { name:'Ghana', dial:'+233' }, { name:'Greece', dial:'+30' }, { name:'Hong Kong', dial:'+852' },
  { name:'Hungary', dial:'+36' }, { name:'India', dial:'+91' }, { name:'Indonesia', dial:'+62' },
  { name:'Iran', dial:'+98' }, { name:'Iraq', dial:'+964' }, { name:'Ireland', dial:'+353' },
  { name:'Israel', dial:'+972' }, { name:'Italy', dial:'+39' }, { name:'Japan', dial:'+81' },
  { name:'Jordan', dial:'+962' }, { name:'Kenya', dial:'+254' }, { name:'Kuwait', dial:'+965' },
  { name:'Malaysia', dial:'+60' }, { name:'Mexico', dial:'+52' }, { name:'Morocco', dial:'+212' },
  { name:'Myanmar', dial:'+95' }, { name:'Nepal', dial:'+977' }, { name:'Netherlands', dial:'+31' },
  { name:'New Zealand', dial:'+64' }, { name:'Nigeria', dial:'+234' }, { name:'Norway', dial:'+47' },
  { name:'Oman', dial:'+968' }, { name:'Pakistan', dial:'+92' }, { name:'Peru', dial:'+51' },
  { name:'Philippines', dial:'+63' }, { name:'Poland', dial:'+48' }, { name:'Portugal', dial:'+351' },
  { name:'Qatar', dial:'+974' }, { name:'Romania', dial:'+40' }, { name:'Russia', dial:'+7' },
  { name:'Saudi Arabia', dial:'+966' }, { name:'Singapore', dial:'+65' }, { name:'South Africa', dial:'+27' },
  { name:'South Korea', dial:'+82' }, { name:'Spain', dial:'+34' }, { name:'Sri Lanka', dial:'+94' },
  { name:'Sweden', dial:'+46' }, { name:'Switzerland', dial:'+41' }, { name:'Taiwan', dial:'+886' },
  { name:'Tanzania', dial:'+255' }, { name:'Thailand', dial:'+66' }, { name:'Turkey', dial:'+90' },
  { name:'UAE', dial:'+971' }, { name:'Uganda', dial:'+256' }, { name:'Ukraine', dial:'+380' },
  { name:'United Kingdom', dial:'+44' }, { name:'United States', dial:'+1' },
  { name:'Venezuela', dial:'+58' }, { name:'Vietnam', dial:'+84' }, { name:'Yemen', dial:'+967' },
]

const card: React.CSSProperties = { background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', borderRadius:10, boxShadow:'0 1px 4px var(--cs-shadow)', marginBottom:8, overflow:'hidden' }
const t1: React.CSSProperties = { color:'var(--cs-text-1)' }
const t2: React.CSSProperties = { color:'var(--cs-text-2)' }
const t3: React.CSSProperties = { color:'var(--cs-text-3)' }
const inp: React.CSSProperties = { width:'100%', padding:'8px 12px', borderRadius:10, fontSize:14, outline:'none', background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)', color:'var(--cs-text-1)' }

function Chip({ label, variant='teal' }: { label:string; variant?:'teal'|'indigo'|'purple'|'gray' }) {
  const s: Record<string,React.CSSProperties> = {
    teal:  { background:'rgba(13,148,136,0.12)', color:'#0d9488', border:'1px solid rgba(13,148,136,0.25)' },
    indigo:{ background:'rgba(99,102,241,0.12)',  color:'#6366f1', border:'1px solid rgba(99,102,241,0.25)' },
    purple:{ background:'rgba(168,85,247,0.12)',  color:'#a855f7', border:'1px solid rgba(168,85,247,0.25)' },
    gray:  { background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' },
  }
  return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={s[variant]}>{label}</span>
}

function SectionHead({ title, onEdit, action }: { title:string; onEdit?:()=>void; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom:'1px solid var(--cs-border)' }}>
      <h3 className="font-bold text-base" style={t1}>{title}</h3>
      <div className="flex items-center gap-2">
        {action}
        {onEdit && (
          <button onClick={onEdit} className="p-1.5 rounded-lg transition-all"
            style={{ color:'var(--cs-text-3)', border:'1px solid var(--cs-border)' }}
            onMouseEnter={e=>{e.currentTarget.style.color='#2dd4bf';e.currentTarget.style.borderColor='rgba(45,212,191,0.4)'}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--cs-text-3)';e.currentTarget.style.borderColor='var(--cs-border)'}}>
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
          </button>
        )}
      </div>
    </div>
  )
}

function ModalShell({ title, onClose, onSave, saving, children }: { title:string; onClose:()=>void; onSave:()=>void; saving:boolean; children:React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh]"
        style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom:'1px solid var(--cs-border)' }}>
          <h3 className="font-bold text-base" style={t1}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color:'var(--cs-text-3)', background:'var(--cs-input-bg)' }}>
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">{children}</div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop:'1px solid var(--cs-border)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background:'var(--cs-input-bg)', color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}>Cancel</button>
          <button onClick={onSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 active:scale-95 transition-all"
            style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', opacity:saving?0.7:1 }}>
            {saving && <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return <div><label className="block text-xs font-semibold mb-1.5" style={t3}>{label}</label>{children}</div>
}

const COMPANY_COLORS = ['#0ea5e9','#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4']

function CompanyBox({ name, color, icon }: { name:string; color:string; icon?:string }) {
  return (
    <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-bold text-white"
      style={{ background:color }}>
      {icon ?? name[0]?.toUpperCase()}
    </div>
  )
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDuration(startYear?: number, endYear?: number, startMonth?: number, endMonth?: number): string {
  if (!startYear) return ''
  const now = new Date()
  const eY = endYear ?? now.getFullYear()
  const eM = endMonth ?? (endYear ? 12 : now.getMonth() + 1)
  const sM = startMonth ?? 1
  const totalMonths = (eY - startYear) * 12 + (eM - sM)
  const yrs = Math.floor(totalMonths / 12)
  const mos = totalMonths % 12
  const startLabel = startMonth ? `${MONTHS[startMonth-1]} ${startYear}` : `${startYear}`
  const endLabel   = endYear
    ? (endMonth ? `${MONTHS[endMonth-1]} ${endYear}` : `${endYear}`)
    : 'Present'
  const dur = yrs > 0 && mos > 0 ? `${yrs} yr${yrs>1?'s':''} ${mos} mo${mos>1?'s':''}`
    : yrs > 0 ? `${yrs} yr${yrs>1?'s':''}`
    : mos > 0 ? `${mos} mo${mos>1?'s':''}`
    : ''
  return `${startLabel} – ${endLabel}${dur ? ' · ' + dur : ''}`
}

type ModalId = 'personal'|'about'|'skills'|'exp'|'edu'|'proj'|'availability'|null

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const FULL_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function ProfilePreviewPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileResponse|null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalId>(null)
  const [saving, setSaving] = useState(false)
  const [avatarHover, setAvatarHover] = useState(false)
  const [rolePickerOpen, setRolePickerOpen] = useState(false)
  const [rolePickerPos, setRolePickerPos] = useState({ top:0, left:0 })
  const [roleToast, setRoleToast] = useState<string|null>(null)
  const rolePickerRef = useRef<HTMLButtonElement>(null)
  const [editMenuOpen, setEditMenuOpen] = useState(false)
  const [editMenuPos, setEditMenuPos] = useState({ top:0, left:0 })
  const editMenuRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [pForm, setPForm] = useState({ firstName:'', middleName:'', lastName:'', username:'', city:'', country:'', dialCode:'+91', phoneNumber:'', altPhone:'', altPhoneDialCode:'+91', altEmail:'', gender:'', dateOfBirth:'', profilePictureUrl:'' })
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'taken'|'invalid'>('idle')
  const usernameTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const [countrySearch, setCountrySearch] = useState('')
  const [countryDropOpen, setCountryDropOpen] = useState(false)
  const [aForm, setAForm] = useState({ headline:'', about:'', website:'', linkedInUrl:'', gitHubUrl:'', twitterUrl:'', isOpenToWork:false })
  const [sForm, setSForm] = useState({ knownRaw:'', wantedRaw:'', teachRaw:'', role:'' })
  const [exps, setExps] = useState<ExperienceDto[]>([])
  const [edus, setEdus] = useState<EducationDto[]>([])
  const [projs, setProjs] = useState<ProjectDto[]>([])
  const [projTechRaw, setProjTechRaw] = useState<string[]>([])
  const [teachSkills, setTeachSkills] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cs_teach_skills') || '[]') } catch { return [] }
  })
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSaving, setPwdSaving] = useState(false)
  // Availability stored locally (backend endpoint TBD)
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(() => {
    try { return JSON.parse(localStorage.getItem('cs_availability') || '[]') } catch { return [] }
  })
  const [avForm, setAvForm] = useState<AvailabilitySlot[]>([])

  const blankExp = (): ExperienceDto => ({ company:'', title:'', employmentType:'', location:'', startYear:new Date().getFullYear(), description:'' })
  const blankEdu = (): EducationDto => ({ school:'', degree:'', fieldOfStudy:'', startYear:new Date().getFullYear() })
  const blankProj = (): ProjectDto => ({ name:'', description:'', url:'', technologies:[] })

  useEffect(() => {
    profileApi.getMe()
      .then(r => {
        setProfile(r.data)
        setLoading(false)
        if (r.data.subjectsCanTeach?.length) setTeachSkills(r.data.subjectsCanTeach)
      })
      .catch(e => { if (e.response?.status===404) navigate('/setup',{replace:true}); else setLoading(false) })
  }, [navigate])

  const openModal = (id: ModalId) => {
    if (!profile) return
    if (id==='personal') {
      // Split stored phone (e.g. "+91 7093619098") into dialCode + number
      const rawPhone = profile.phone ?? ''
      const dialMatch = COUNTRIES.find(c => rawPhone.startsWith(c.dial))
      const dialCode  = dialMatch ? dialMatch.dial : (rawPhone.startsWith('+') ? rawPhone.split(' ')[0] : '+91')
      const phoneNumber = dialMatch ? rawPhone.slice(dialCode.length).trim() : (rawPhone.startsWith('+') ? rawPhone.split(' ').slice(1).join(' ') : rawPhone)
      const rawAlt = profile.alternatePhone ?? ''
      const altMatch = COUNTRIES.find(c => rawAlt.startsWith(c.dial))
      const altPhoneDialCode = altMatch ? altMatch.dial : '+91'
      const altPhoneNum = altMatch ? rawAlt.slice(altMatch.dial.length).trim() : rawAlt
      setUsernameStatus('idle')
      setPForm({ firstName:profile.firstName, middleName:profile.middleName??'', lastName:profile.lastName, username:profile.username??'', city:profile.city??'', country:profile.country??'', dialCode, phoneNumber, altPhone:altPhoneNum, altPhoneDialCode, altEmail:profile.alternateEmail??'', gender:profile.gender??'', dateOfBirth:profile.dateOfBirth?profile.dateOfBirth.slice(0,10):'', profilePictureUrl:profile.profilePictureUrl??'' })
    } else if (id==='about') {
      setAForm({ headline:profile.headline??'', about:profile.about??'', website:profile.website??'', linkedInUrl:profile.linkedInUrl??'', gitHubUrl:profile.gitHubUrl??'', twitterUrl:profile.twitterUrl??'', isOpenToWork:profile.isOpenToWork })
    } else if (id==='skills') {
      setSForm({ knownRaw:profile.subjectsKnown.join(', '), wantedRaw:profile.subjectsWanted.join(', '), teachRaw:teachSkills.join(', '), role:profile.role??'' })
    } else if (id==='exp') {
      setExps(profile.experiences.map(({ id:_,...r })=>r))
    } else if (id==='edu') {
      setEdus(profile.educations.map(({ id:_,...r })=>r))
    } else if (id==='proj') {
      const ps = profile.projects.map(({ id:_,...r })=>r)
      setProjs(ps); setProjTechRaw(ps.map(p=>p.technologies.join(', ')))
    } else if (id==='availability') {
      setAvForm([...availability])
    }
    setModal(id)
  }

  const closeModal = () => setModal(null)

  const save = async (fn: ()=>Promise<ProfileResponse>) => {
    setSaving(true)
    try { const updated = await fn(); setProfile(updated); closeModal() }
    catch(e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleAvatarFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => setPForm(f=>({...f, profilePictureUrl:e.target?.result as string}))
    reader.readAsDataURL(file)
  }

  const handleUsernameEdit = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)
    setPForm(f=>({...f, username: cleaned}))
    if (usernameTimer.current) clearTimeout(usernameTimer.current)
    if (!cleaned || cleaned === profile?.username) { setUsernameStatus('idle'); return }
    if (cleaned.length < 3) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await profileApi.checkUsername(cleaned)
        setUsernameStatus(res.data.available ? 'available' : 'taken')
      } catch { setUsernameStatus('idle') }
    }, 500)
  }

  const changeRole = (newRole: string) => {
    if (!profile) return
    setRolePickerOpen(false)
    // Pre-fill skills form with current values + the newly selected role, then open the modal
    setSForm({
      knownRaw: profile.subjectsKnown.join(', '),
      wantedRaw: profile.subjectsWanted.join(', '),
      teachRaw: teachSkills.join(', '),
      role: newRole,
    })
    setModal('skills')
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background:'var(--cs-bg)' }}>
      <svg className="animate-spin w-6 h-6" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  )

  if (!profile) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background:'var(--cs-bg)' }}>
      <p className="text-sm font-semibold" style={{ color:'var(--cs-text-2)' }}>Could not load profile — is the backend running?</p>
      <button onClick={()=>window.location.reload()} className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
        style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>Retry</button>
    </div>
  )

  const p = profile!
  const pct = p.completionPercent
  const fullName = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')


  const socialLinks = [
    { key:'website',  label:'Website',  url:p.website,    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>, color:'#0ea5e9' },
    { key:'linkedin', label:'LinkedIn',  url:p.linkedInUrl, icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>, color:'#0a66c2' },
    { key:'github',   label:'GitHub',   url:p.gitHubUrl,   icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>, color:'#333' },
    { key:'twitter',  label:'Twitter',  url:p.twitterUrl,  icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/></svg>, color:'#1da1f2' },
  ].filter(s => s.url)

  return (
    <div className="flex-1 overflow-y-auto" style={{ background:'var(--cs-bg)' }}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e=>{ if(e.target.files?.[0]) handleAvatarFile(e.target.files[0]) }}/>

      <div className="pl-7 pr-5 max-w-[1100px]">
        {/* Back to Dashboard */}
        <div className="py-3">
          <button onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-sm font-medium transition-all hover:gap-3"
            style={{ color: 'var(--cs-text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#2dd4bf')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--cs-text-3)')}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/>
            </svg>
            Back to Dashboard
          </button>
        </div>
        <div className="flex gap-5 items-start">

          {/* ── MAIN COLUMN ── */}
          <div className="flex-1 min-w-0">

            {/* ── HERO CARD ── */}
            <div style={card}>
              {/* Cover */}
              <div style={{ height:140, background:'linear-gradient(135deg,#4f46e5 0%,#2dd4bf 55%,#0ea5e9 100%)', position:'relative', overflow:'hidden' }}>
                {[...Array(14)].map((_,i)=>(
                  <div key={i} style={{ position:'absolute', borderRadius:'50%', width:6+(i%4)*5, height:6+(i%4)*5, background:'rgba(255,255,255,0.12)', left:`${5+i*7}%`, top:`${15+(i%5)*16}%` }}/>
                ))}
              </div>

              <div className="px-6 pb-5">
                {/* Avatar row */}
                <div className="flex items-end justify-between" style={{ marginTop:-52 }}>
                  <div className="relative cursor-pointer flex-shrink-0"
                    onClick={()=>openModal('personal')}
                    onMouseEnter={()=>setAvatarHover(true)}
                    onMouseLeave={()=>setAvatarHover(false)}>
                    <div className="w-28 h-28 rounded-full overflow-hidden"
                      style={{ border:'4px solid var(--cs-bg-card)', background:'var(--cs-bg-elevated)' }}>
                      {p.profilePictureUrl
                        ? <img src={p.profilePictureUrl} alt="" className="w-full h-full object-cover"/>
                        : <div className="w-full h-full flex items-center justify-center text-4xl font-bold" style={{ background:'linear-gradient(135deg,#2dd4bf,#6366f1)', color:'white' }}>{p.firstName[0]}</div>}
                    </div>
                    <div className="absolute inset-0 rounded-full flex items-center justify-center transition-opacity"
                      style={{ background:'rgba(0,0,0,0.5)', opacity: avatarHover ? 1 : 0 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-7 h-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex gap-2 pb-1">
                    <button ref={editMenuRef}
                      onClick={() => {
                        const rect = editMenuRef.current?.getBoundingClientRect()
                        if (rect) setEditMenuPos({ top: rect.bottom + 6, left: rect.left })
                        setEditMenuOpen(o => !o)
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                      style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', boxShadow:'0 4px 12px rgba(13,148,136,0.3)' }}>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                      Edit Profile
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 opacity-70"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                    </button>
                    <button className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                      style={{ border:'1.5px solid #2dd4bf', color:'#2dd4bf' }}>Share</button>
                  </div>
                </div>

                {/* Name + info */}
                <div className="mt-3 relative">
                  <div className="absolute top-0 right-0 flex flex-col items-end gap-2">
                    {(() => {
                      const r = 18, circ = 2 * Math.PI * r
                      const offset = circ - (pct / 100) * circ
                      const color = pct===100?'#22c55e':pct>=70?'#2dd4bf':pct>=40?'#0ea5e9':'#f59e0b'
                      const label = pct===100?'Complete!':pct>=70?'Strong':pct>=40?'Intermediate':'Getting started'
                      return (
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                          <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0">
                            <circle cx="22" cy="22" r={r} fill="none" stroke="var(--cs-border)" strokeWidth="4"/>
                            <circle cx="22" cy="22" r={r} fill="none"
                              stroke={color} strokeWidth="4" strokeLinecap="round"
                              strokeDasharray={circ} strokeDashoffset={offset}
                              transform="rotate(-90 22 22)"
                              style={{ transition:'stroke-dashoffset 0.8s ease' }}/>
                            <text x="22" y="26" textAnchor="middle" fontSize="9" fontWeight="800" fill={color}>{pct}%</text>
                          </svg>
                          <div>
                            <p className="text-xs font-bold" style={{ color }}>{label}</p>
                            <p className="text-[10px]" style={t3}>Profile strength</p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  <h1 className="text-2xl font-extrabold leading-tight pr-36" style={t1}>{fullName}</h1>
                  {p.username && (
                    <p className="text-sm mt-0.5 flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color:'var(--cs-text-3)' }}>unique username:</span>
                      <span className="font-bold" style={{ color:'#2dd4bf' }}>@{p.username}</span>
                    </p>
                  )}
                  {p.headline
                    ? <button onClick={()=>openModal('about')} className="text-base mt-0.5 font-medium text-left transition-all hover:underline" style={t2}>{p.headline}</button>
                    : <button onClick={()=>openModal('about')} className="text-sm mt-0.5 italic transition-all hover:underline" style={t3}>+ Add headline</button>}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {(p.city||p.country) ? (
                      <button onClick={()=>openModal('personal')} className="text-sm flex items-center gap-1 transition-all hover:underline" style={t3}>
                        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                        {[p.city,p.country].filter(Boolean).join(', ')}
                      </button>
                    ) : (
                      <button onClick={()=>openModal('personal')} className="text-sm flex items-center gap-1 transition-all hover:underline" style={t3}>
                        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                        + Add location
                      </button>
                    )}
                    {/* Role selector */}
                    <button ref={rolePickerRef}
                      onClick={() => {
                        const rect = rolePickerRef.current?.getBoundingClientRect()
                        if (rect) setRolePickerPos({ top: rect.bottom + 6, left: rect.left })
                        setRolePickerOpen(o => !o)
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
                      style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}
                      title="Click to change your role">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--cs-text-3)' }}>Role</span>
                      <span className="w-px h-3" style={{ background:'var(--cs-border)' }}/>
                      <span className="text-xs font-semibold" style={{ color: p.role==='Tutor'?'#a855f7':p.role==='Both'?'#6366f1':'#6366f1' }}>
                        {p.role === 'Both' ? 'Learner & Tutor' : p.role}
                      </span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 ml-0.5" style={{ color:'var(--cs-text-3)' }}><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                    </button>
                    <button onClick={()=>openModal('about')}
                      className="text-xs px-3 py-1 rounded-full font-semibold transition-all"
                      style={{ background: p.isOpenToWork ? 'rgba(34,197,94,0.12)' : 'var(--cs-input-bg)', color: p.isOpenToWork ? '#16a34a' : 'var(--cs-text-3)', border: p.isOpenToWork ? '1px solid rgba(34,197,94,0.25)' : '1px dashed var(--cs-border)' }}
                      title={p.isOpenToWork ? 'Open to Work — click to edit' : 'Not open to work — click to change'}>
                      {p.isOpenToWork ? '#OpenToWork' : '+ Open to Work?'}
                    </button>
                  </div>

                  {/* Contact row — each item clicks to open personal modal */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop:'1px solid var(--cs-border)' }}>
                    {/* Email — always visible, read-only (login account) */}
                    <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ color:'var(--cs-text-2)', background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color:'#6366f1' }}><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                      {p.email}
                    </span>
                    {p.phone ? (
                      <button onClick={()=>openModal('personal')}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color:'var(--cs-text-2)', background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(45,212,191,0.4)';e.currentTarget.style.color='#2dd4bf'}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--cs-border)';e.currentTarget.style.color='var(--cs-text-2)'}}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color:'#2dd4bf' }}><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                        {p.phone}
                      </button>
                    ) : (
                      <button onClick={()=>openModal('personal')}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color:'var(--cs-text-3)', background:'var(--cs-input-bg)', border:'1px dashed var(--cs-border)' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                        + Phone
                      </button>
                    )}
                    {p.gender ? (
                      <button onClick={()=>openModal('personal')}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color:'var(--cs-text-2)', background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(99,102,241,0.4)';e.currentTarget.style.color='#6366f1'}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--cs-border)';e.currentTarget.style.color='var(--cs-text-2)'}}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color:'#6366f1' }}><path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                        {p.gender}
                      </button>
                    ) : (
                      <button onClick={()=>openModal('personal')}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color:'var(--cs-text-3)', background:'var(--cs-input-bg)', border:'1px dashed var(--cs-border)' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
                        + Gender
                      </button>
                    )}
                    {p.dateOfBirth ? (
                      <button onClick={()=>openModal('personal')}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color:'var(--cs-text-2)', background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(245,158,11,0.4)';e.currentTarget.style.color='#f59e0b'}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--cs-border)';e.currentTarget.style.color='var(--cs-text-2)'}}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color:'#f59e0b' }}><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>
                        {new Date(p.dateOfBirth + 'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
                      </button>
                    ) : (
                      <button onClick={()=>openModal('personal')}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color:'var(--cs-text-3)', background:'var(--cs-input-bg)', border:'1px dashed var(--cs-border)' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>
                        + Date of Birth
                      </button>
                    )}
                    {/* Alternate phone */}
                    {p.alternatePhone && (
                      <button onClick={()=>openModal('personal')}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color:'var(--cs-text-2)', background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(45,212,191,0.4)';e.currentTarget.style.color='#2dd4bf'}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--cs-border)';e.currentTarget.style.color='var(--cs-text-2)'}}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color:'#2dd4bf', opacity:0.6 }}><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                        {p.alternatePhone}
                        <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ background:'var(--cs-border)', color:'var(--cs-text-3)' }}>alt</span>
                      </button>
                    )}
                    {/* Alternate email */}
                    {p.alternateEmail && (
                      <button onClick={()=>openModal('personal')}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ color:'var(--cs-text-2)', background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(99,102,241,0.4)';e.currentTarget.style.color='#6366f1'}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--cs-border)';e.currentTarget.style.color='var(--cs-text-2)'}}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color:'#6366f1', opacity:0.6 }}><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                        {p.alternateEmail}
                        <span className="text-[10px] font-bold px-1 py-0.5 rounded" style={{ background:'var(--cs-border)', color:'var(--cs-text-3)' }}>alt</span>
                      </button>
                    )}
                  </div>

                  {/* Social links — actual clickable <a> tags */}
                  {socialLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {socialLinks.map(s => (
                        <a key={s.key} href={s.url!} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                          style={{ background:'var(--cs-input-bg)', color:s.color, border:`1px solid ${s.color}30` }}>
                          {s.icon}
                          {s.label}
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5 opacity-60"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm6.75-3a.75.75 0 010-1.5h5.5a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0V3.56l-4.72 4.72a.75.75 0 01-1.06-1.06l4.72-4.72H11z" clipRule="evenodd"/></svg>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── ABOUT ── */}
            <div style={card}>
              <SectionHead title="About" onEdit={()=>openModal('about')}/>
              <div className="px-6 py-4">
                {p.about
                  ? <p className="text-sm leading-7 whitespace-pre-line" style={{ ...t2, maxWidth:680 }}>{p.about}</p>
                  : <p className="text-sm italic" style={t3}>No bio yet — click ✏️ to add one.</p>}
              </div>
            </div>

            {/* ── SKILLS ── */}
            <div style={card}>
              <SectionHead title={`Skills${p.subjectsKnown.length + p.subjectsWanted.length > 0 ? ` (${p.subjectsKnown.length + p.subjectsWanted.length})` : ''}`} onEdit={()=>openModal('skills')}/>
              <div className="px-6 py-4">
                {p.subjectsKnown.length === 0 && p.subjectsWanted.length === 0
                  ? (
                    <div className="flex flex-col items-center py-6 gap-2">
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-10 h-10 opacity-40"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                      <p className="text-sm" style={t3}>No skills added yet</p>
                    </div>
                  )
                  : (
                    <div className="space-y-5">

                      {/* ── Learner: Skills I Know ── */}
                      {p.role !== 'Tutor' && p.subjectsKnown.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full" style={{ background:'#0d9488' }}/>
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'#0d9488' }}>Skills I Know</p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:'rgba(13,148,136,0.12)', color:'#0d9488' }}>{p.subjectsKnown.length}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {p.subjectsKnown.map(s => <Chip key={s} label={s} variant="teal"/>)}
                          </div>
                        </div>
                      )}

                      {/* ── Both/Tutor: Skills I Can Teach ── */}
                      {(p.role === 'Tutor' || p.role === 'Both') && (() => {
                        const src = p.role === 'Tutor' ? p.subjectsKnown : (p.subjectsCanTeach?.length ? p.subjectsCanTeach : teachSkills)
                        if (!src.length) return null
                        return (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="w-2 h-2 rounded-full" style={{ background:'#a855f7' }}/>
                              <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'#a855f7' }}>Skills I Can Teach</p>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:'rgba(168,85,247,0.12)', color:'#a855f7' }}>{src.length}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {src.map(s => <Chip key={s} label={s} variant="purple"/>)}
                            </div>
                          </div>
                        )
                      })()}

                      {/* ── Learner/Both: Skills I Want to Learn ── */}
                      {p.role !== 'Tutor' && p.subjectsWanted.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full" style={{ background:'#6366f1' }}/>
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'#6366f1' }}>Skills I Want to Learn</p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:'rgba(99,102,241,0.12)', color:'#6366f1' }}>{p.subjectsWanted.length}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {p.subjectsWanted.map(s => <Chip key={s} label={s} variant="indigo"/>)}
                          </div>
                        </div>
                      )}

                      {/* ── Tutor: Also Learning ── */}
                      {p.role === 'Tutor' && p.subjectsWanted.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full" style={{ background:'#6366f1' }}/>
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'#6366f1' }}>Also Learning</p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:'rgba(99,102,241,0.12)', color:'#6366f1' }}>{p.subjectsWanted.length}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {p.subjectsWanted.map(s => <Chip key={s} label={s} variant="indigo"/>)}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
              </div>
            </div>

            {/* ── AVAILABILITY ── */}
            <div style={card}>
              <SectionHead title="Availability" onEdit={()=>openModal('availability')}
                action={
                  <button onClick={()=>openModal('availability')}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                    style={{ color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.06)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
                    Set
                  </button>
                }/>
              <div className="px-6 py-4">
                {availability.length === 0 ? (
                  <div className="flex flex-col items-center py-5 gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-10 h-10 opacity-40">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                    </svg>
                    <p className="text-sm font-medium" style={{ color:'var(--cs-text-3)' }}>No availability set yet</p>
                    <p className="text-xs text-center" style={{ color:'var(--cs-text-3)', maxWidth:280 }}>
                      Set your weekly schedule so others know when you're free to teach or learn.
                    </p>
                    <button onClick={()=>openModal('availability')}
                      className="mt-1 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{ background:'linear-gradient(135deg,#f59e0b,#f97316)' }}>
                      Set Availability
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {DAYS.map((d,i) => {
                      const slots = availability.filter(s => s.dayOfWeek === i)
                      if (!slots.length) return null
                      return (
                        <div key={d} className="rounded-xl px-3 py-2.5" style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)', minWidth:130 }}>
                          <p className="text-xs font-bold mb-1.5" style={{ color:'#f59e0b' }}>{FULL_DAYS[i]}</p>
                          {slots.map((s,j) => (
                            <p key={j} className="text-xs flex items-center gap-1" style={{ color:'var(--cs-text-2)' }}>
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0" style={{ color:'#f59e0b' }}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd"/></svg>
                              {s.startTime} – {s.endTime}
                            </p>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── EXPERIENCE ── */}
            <div style={card}>
              <SectionHead title="Experience" onEdit={()=>openModal('exp')}
                action={
                  <button onClick={()=>openModal('exp')}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                    style={{ color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.3)', background:'rgba(45,212,191,0.06)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
                    Add
                  </button>
                }/>
              <div className="px-6 py-4">
                {p.experiences.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-10 h-10 opacity-40"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
                    <p className="text-sm" style={t3}>No experience added yet</p>
                  </div>
                ) : (
                  <div className="relative" style={{ paddingLeft: 28 }}>
                    {/* Vertical timeline line */}
                    <div className="absolute top-2 bottom-2 left-[9px]" style={{ width: 2, background:'linear-gradient(to bottom, #2dd4bf, #6366f1)', borderRadius: 2 }}/>
                    {p.experiences.map((e, i) => (
                      <div key={e.id} className="relative mb-6 last:mb-0">
                        {/* Timeline dot */}
                        <div className="absolute flex items-center justify-center" style={{ left: -28, top: 10, width: 20, height: 20 }}>
                          <div className="w-3 h-3 rounded-full border-2" style={{ background: COMPANY_COLORS[i % COMPANY_COLORS.length], borderColor:'var(--cs-bg-card)', boxShadow:`0 0 0 3px ${COMPANY_COLORS[i % COMPANY_COLORS.length]}33` }}/>
                        </div>
                        {/* Card */}
                        <div className="rounded-xl p-4" style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                          <div className="flex gap-3">
                            <CompanyBox name={e.company} color={COMPANY_COLORS[i % COMPANY_COLORS.length]}/>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm leading-snug" style={t1}>{e.title}</p>
                              <p className="text-sm mt-0.5" style={t2}>
                                {e.company}
                                {e.employmentType && <span className="text-xs font-medium ml-1.5 px-2 py-0.5 rounded-full" style={{ background:'rgba(14,165,233,0.1)', color:'#0ea5e9' }}>{e.employmentType}</span>}
                              </p>
                              <p className="text-xs mt-1 flex items-center gap-1.5" style={t3}>
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd"/></svg>
                                {formatDuration(e.startYear, e.endYear, e.startMonth, e.endMonth)}
                                {e.location && <><span>·</span><svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd"/></svg>{e.location}</>}
                              </p>
                              {e.description && (
                                <p className="text-xs mt-2 leading-relaxed" style={{ ...t3, borderLeft:'2px solid var(--cs-border)', paddingLeft:10 }}>{e.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── EDUCATION ── */}
            <div style={card}>
              <SectionHead title="Education" onEdit={()=>openModal('edu')}
                action={
                  <button onClick={()=>openModal('edu')}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                    style={{ color:'#6366f1', border:'1px solid rgba(99,102,241,0.3)', background:'rgba(99,102,241,0.06)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
                    Add
                  </button>
                }/>
              <div className="px-6 py-4">
                {p.educations.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-10 h-10 opacity-40"><path d="M12 3L2 9l10 6 10-6-10-6zM2 17l10 6 10-6M2 12l10 6 10-6"/></svg>
                    <p className="text-sm" style={t3}>No education added yet</p>
                  </div>
                ) : (
                  <div className="relative" style={{ paddingLeft: 28 }}>
                    {/* Vertical timeline line */}
                    <div className="absolute top-2 bottom-2 left-[9px]" style={{ width: 2, background:'linear-gradient(to bottom, #6366f1, #a855f7)', borderRadius: 2 }}/>
                    {p.educations.map((e, i) => {
                      const eduColors = ['#6366f1','#8b5cf6','#a855f7']
                      const col = eduColors[i % eduColors.length]
                      return (
                        <div key={e.id} className="relative mb-6 last:mb-0">
                          {/* Timeline dot */}
                          <div className="absolute flex items-center justify-center" style={{ left: -28, top: 10, width: 20, height: 20 }}>
                            <div className="w-3 h-3 rounded-full border-2" style={{ background: col, borderColor:'var(--cs-bg-card)', boxShadow:`0 0 0 3px ${col}33` }}/>
                          </div>
                          {/* Card */}
                          <div className="rounded-xl p-4" style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                            <div className="flex gap-3">
                              <CompanyBox name={e.school} color={col} icon="🎓"/>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm leading-snug" style={t1}>{e.school}</p>
                                {(e.degree||e.fieldOfStudy) && (
                                  <p className="text-sm mt-0.5" style={t2}>{[e.degree, e.fieldOfStudy].filter(Boolean).join(' · ')}</p>
                                )}
                                {(e.startYear||e.endYear) && (
                                  <p className="text-xs mt-1 flex items-center gap-1.5" style={t3}>
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd"/></svg>
                                    {e.startYear} – {e.endYear ?? 'Present'}
                                  </p>
                                )}
                                {(e as any).description && (
                                  <p className="text-xs mt-2 leading-relaxed" style={{ ...t3, borderLeft:'2px solid var(--cs-border)', paddingLeft:10 }}>{(e as any).description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── PROJECTS ── */}
            {p.projects.length > 0 && (
              <div style={card}>
                <SectionHead title="Projects" onEdit={()=>openModal('proj')}
                  action={
                    <button onClick={()=>openModal('proj')}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                      style={{ color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.3)', background:'rgba(45,212,191,0.06)' }}>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
                      Add
                    </button>
                  }/>
                <div className="px-6 py-4 grid gap-4" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))' }}>
                  {p.projects.map(proj => (
                    <div key={proj.id} className="rounded-xl p-4 flex flex-col gap-3 h-full"
                      style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-base"
                          style={{ background:'linear-gradient(135deg,rgba(45,212,191,0.2),rgba(99,102,241,0.2))', border:'1px solid rgba(45,212,191,0.2)' }}>🚀</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm" style={t1}>{proj.name}</p>
                          {proj.url && (
                            <a href={proj.url} target="_blank" rel="noreferrer"
                              className="text-[11px] flex items-center gap-1 mt-0.5 hover:underline"
                              style={{ color:'#2dd4bf' }}>
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm6.75-3a.75.75 0 010-1.5h5.5a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0V3.56l-4.72 4.72a.75.75 0 01-1.06-1.06l4.72-4.72H11z" clipRule="evenodd"/></svg>
                              View project
                            </a>
                          )}
                        </div>
                      </div>
                      {proj.description && <p className="text-xs leading-relaxed" style={t2}>{proj.description}</p>}
                      {proj.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-auto">
                          {proj.technologies.map(t => <Chip key={t} label={t} variant="gray"/>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {p.projects.length === 0 && (
                  <div className="px-6 pb-5">
                    <button onClick={()=>openModal('proj')} className="w-full py-3 rounded-xl text-sm font-semibold"
                      style={{ color:'#2dd4bf', border:'1px dashed rgba(45,212,191,0.4)', background:'rgba(45,212,191,0.04)' }}>
                      + Add a project
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Projects add CTA (when empty) */}
            {p.projects.length === 0 && (
              <div style={card}>
                <SectionHead title="Projects" onEdit={()=>openModal('proj')}/>
                <div className="px-6 pb-5">
                  <button onClick={()=>openModal('proj')} className="w-full py-3 rounded-xl text-sm font-semibold"
                    style={{ color:'#2dd4bf', border:'1px dashed rgba(45,212,191,0.4)', background:'rgba(45,212,191,0.04)' }}>
                    + Add a project
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{ width:280, flexShrink:0 }} className="hidden lg:flex flex-col gap-4">

            {/* Profile strength */}
            <div style={card}>
              <div className="px-5 pt-5 pb-5">
                <h4 className="font-bold text-sm mb-4" style={t1}>Profile Strength</h4>
                <div className="flex items-center gap-4">
                  {(() => {
                    const rc = pct===100?'#22c55e':pct>=70?'#2dd4bf':pct>=40?'#0ea5e9':'#f59e0b'
                    return (
                      <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink:0 }}>
                        <circle cx="36" cy="36" r="30" fill="none" stroke="var(--cs-border)" strokeWidth="6"/>
                        <circle cx="36" cy="36" r="30" fill="none" stroke={rc} strokeWidth="6"
                          strokeLinecap="round" strokeDasharray={2*Math.PI*30}
                          strokeDashoffset={2*Math.PI*30-(pct/100)*2*Math.PI*30}
                          transform="rotate(-90 36 36)" style={{ transition:'stroke-dashoffset 0.8s ease' }}/>
                        <text x="36" y="41" textAnchor="middle" fontSize="13" fontWeight="700" fill={rc}>{pct}%</text>
                      </svg>
                    )
                  })()}
                  <div>
                    <p className="text-sm font-bold" style={{ color:pct===100?'#22c55e':pct>=70?'#2dd4bf':pct>=40?'#0ea5e9':'#f59e0b' }}>
                      {pct===100?'All Star!':pct>=70?'Strong':pct>=40?'Intermediate':'Getting started'}
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={t3}>
                      {pct < 100 ? 'Complete your profile to attract the best matches.' : 'Your profile is fully complete!'}
                    </p>
                  </div>
                </div>

                {/* Progress checklist */}
                <div className="mt-4 space-y-2">
                  {[
                    { label:'Name & photo',     done: !!(p.firstName && p.lastName && p.profilePictureUrl) },
                    { label:'Location & role',  done: !!(p.city || p.country) && !!p.role },
                    { label:'Headline & bio',   done: !!(p.headline && p.about && p.about.length >= 50) },
                    { label:'Social links',     done: !!(p.website || p.linkedInUrl || p.gitHubUrl || p.twitterUrl) },
                    { label:'Skills added',     done: p.subjectsKnown.length >= 2 || p.subjectsWanted.length >= 2 },
                    { label:'Experience',       done: p.experiences.length > 0 },
                    { label:'Education',        done: p.educations.length > 0 },
                    { label:'Projects',         done: p.projects.length > 0 },
                    { label:'Availability',     done: availability.length > 0, bonus: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: item.done ? 'rgba(34,197,94,0.15)' : 'var(--cs-input-bg)', border: `1.5px solid ${item.done ? '#22c55e' : 'var(--cs-border)'}` }}>
                        {item.done && <svg viewBox="0 0 20 20" fill="#22c55e" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                      </div>
                      <span className="text-xs flex-1" style={{ color: item.done ? 'var(--cs-text-2)' : 'var(--cs-text-3)' }}>{item.label}</span>
                      {(item as any).bonus && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>bonus</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* At a glance stats */}
            <div style={card}>
              <div className="px-5 pt-5 pb-4">
                <h4 className="font-bold text-sm mb-4" style={t1}>At a glance</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'Skills',       val: p.subjectsKnown.length,   color:'#2dd4bf', icon:'🎯' },
                    { label:'Learning',     val: p.subjectsWanted.length,   color:'#6366f1', icon:'📚' },
                    { label:'Can Teach',    val: p.subjectsCanTeach?.length ?? teachSkills.length, color:'#a855f7', icon:'🧑‍🏫' },
                    { label:'Experience',   val: p.experiences.length,       color:'#0ea5e9', icon:'💼' },
                    { label:'Education',    val: p.educations.length,        color:'#f59e0b', icon:'🎓' },
                    { label:'Projects',     val: p.projects.length,          color:'#22c55e', icon:'🚀' },
                    { label:'Availability', val: availability.length > 0 ? `${availability.length} slot${availability.length>1?'s':''}` : '—', color: availability.length > 0 ? '#f59e0b' : 'var(--cs-text-3)', icon:'📅' },
                    { label:'Completion',   val: `${pct}%`,                  color: pct===100?'#22c55e':pct>=70?'#2dd4bf':pct>=40?'#0ea5e9':'#f59e0b', icon:'⭐' },
                  ].map(s=>(
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                      <div className="text-sm mb-0.5">{s.icon}</div>
                      <p className="text-xl font-extrabold" style={{ color:s.color }}>{s.val}</p>
                      <p className="text-[10px] mt-0.5 font-medium" style={t3}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-xl p-5 text-center"
              style={{ background:'linear-gradient(135deg,rgba(45,212,191,0.12),rgba(99,102,241,0.12))', border:'1px solid rgba(45,212,191,0.2)' }}>
              <div className="text-3xl mb-2">🎯</div>
              <p className="font-bold text-sm mb-1" style={t1}>Ready to grow together?</p>
              <p className="text-xs mb-3 leading-relaxed" style={t3}>Find peers, join classrooms and start learning.</p>
              <button onClick={()=>navigate('/home')} className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', boxShadow:'0 4px 12px rgba(13,148,136,0.3)' }}>
                Explore Dashboard
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── ROLE CHANGED TOAST ── */}
      {roleToast && (
        <div className="fixed z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl transition-all"
          style={{
            bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg,#0d9488,#0ea5e9)',
            color: 'white', boxShadow: '0 8px 30px rgba(13,148,136,0.45)',
            pointerEvents: 'none',
          }}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
          </svg>
          <span className="text-sm font-semibold">{roleToast} ✓</span>
        </div>
      )}

      {/* ── EDIT PROFILE DROPDOWN ── */}
      {editMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEditMenuOpen(false)}/>
          <div className="fixed z-50 rounded-xl py-1.5 shadow-2xl"
            style={{ top: editMenuPos.top, left: editMenuPos.left, background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', minWidth:210, boxShadow:'0 8px 30px rgba(0,0,0,0.3)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest px-3 pt-2 pb-1.5" style={{ color:'var(--cs-text-3)' }}>Edit Profile</p>
            {([
              { label:'Personal Info',    sub:'Name, photo, contact details', icon:'👤', modal:'personal' as ModalId },
              { label:'Headline & Bio',   sub:'Title, about, social links',    icon:'✏️', modal:'about'    as ModalId },
              { label:'Skills & Role',    sub:'Skills, learning goals',        icon:'🎯', modal:'skills'   as ModalId },
              { label:'Experience',       sub:'Work history',                  icon:'💼', modal:'exp'      as ModalId },
              { label:'Education',        sub:'Schools, degrees',              icon:'🎓', modal:'edu'      as ModalId },
              { label:'Projects',         sub:'Portfolio projects',            icon:'🚀', modal:'proj'     as ModalId },
              { label:'Availability',     sub:'Weekly schedule',               icon:'📅', modal:'availability' as ModalId },
            ]).map(item => (
              <button key={item.label}
                onClick={() => { setEditMenuOpen(false); openModal(item.modal) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all"
                style={{ color:'var(--cs-text-1)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--cs-input-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span className="text-base w-5 flex-shrink-0 text-center">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color:'var(--cs-text-1)' }}>{item.label}</p>
                  <p className="text-[11px] leading-tight mt-0.5" style={{ color:'var(--cs-text-3)' }}>{item.sub}</p>
                </div>
              </button>
            ))}
            <div style={{ borderTop:'1px solid var(--cs-border)', margin:'4px 0' }}/>
            <button
              onClick={() => { setEditMenuOpen(false); setPwdForm({ currentPassword:'', newPassword:'', confirm:'' }); setPwdError(null); setChangePwdOpen(true) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all"
              style={{ color:'var(--cs-text-1)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--cs-input-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="text-base w-5 flex-shrink-0 text-center">🔑</span>
              <div>
                <p className="text-sm font-semibold leading-tight" style={{ color:'var(--cs-text-1)' }}>Change Password</p>
                <p className="text-[11px] leading-tight mt-0.5" style={{ color:'var(--cs-text-3)' }}>Update your account password</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* ── ROLE PICKER (fixed, escapes overflow:hidden) ── */}
      {rolePickerOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRolePickerOpen(false)}/>
          <div className="fixed z-50 rounded-xl py-1 shadow-2xl"
            style={{ top: rolePickerPos.top, left: rolePickerPos.left, background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', minWidth:170, boxShadow:'0 8px 30px rgba(0,0,0,0.3)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest px-3 pt-2 pb-1" style={{ color:'var(--cs-text-3)' }}>Change Role</p>
            {(['Learner','Tutor','Both'] as const).map(opt => (
              <button key={opt} onClick={() => changeRole(opt)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-left transition-all"
                style={{
                  background: p.role === opt ? 'rgba(45,212,191,0.08)' : 'transparent',
                  color: p.role === opt ? '#2dd4bf' : 'var(--cs-text-2)',
                }}>
                <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: opt==='Tutor'?'rgba(168,85,247,0.15)':opt==='Learner'?'rgba(99,102,241,0.15)':'rgba(45,212,191,0.15)' }}>
                  <span className="w-2 h-2 rounded-full"
                    style={{ background: opt==='Tutor'?'#a855f7':opt==='Learner'?'#6366f1':'#2dd4bf' }}/>
                </span>
                {opt === 'Both' ? 'Learner + Tutor' : opt}
                {p.role === opt && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color:'#2dd4bf' }}><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── MODALS ── */}

      {modal==='personal' && (
        <ModalShell title="Edit Personal Info" onClose={closeModal} saving={saving}
          onSave={()=>save(async()=>{
            const phone = pForm.phoneNumber ? `${pForm.dialCode} ${pForm.phoneNumber}` : undefined
            const altPhone = pForm.altPhone ? `${pForm.altPhoneDialCode} ${pForm.altPhone}` : undefined
            const r = await profileApi.updatePersonal({
              firstName: pForm.firstName, middleName: pForm.middleName||undefined, lastName: pForm.lastName,
              username: pForm.username||undefined,
              dateOfBirth: pForm.dateOfBirth||undefined, gender: pForm.gender||undefined,
              phone, alternatePhone: altPhone, alternateEmail: pForm.altEmail||undefined,
              profilePictureUrl: pForm.profilePictureUrl||undefined,
              city: pForm.city||undefined, country: pForm.country||undefined,
            })
            return r.data
          })}>
          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden" style={{ border:'3px solid var(--cs-border)', background:'var(--cs-input-bg)' }}>
                {pForm.profilePictureUrl
                  ? <img src={pForm.profilePictureUrl} alt="" className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ color:'#2dd4bf' }}>{pForm.firstName[0]||'?'}</div>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold" style={t1}>Profile Photo</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={()=>fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                  style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                  </svg>
                  {pForm.profilePictureUrl ? 'Change' : 'Upload'}
                </button>
                {pForm.profilePictureUrl && (
                  <button type="button" onClick={()=>setPForm(f=>({...f, profilePictureUrl:''}))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                    style={{ color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.06)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px]" style={t3}>JPG or PNG · changes save immediately on Save</p>
            </div>
          </div>
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name"><input style={inp} value={pForm.firstName} onChange={e=>setPForm(f=>({...f,firstName:e.target.value}))}/></Field>
            <Field label="Middle Name"><input style={inp} value={pForm.middleName} onChange={e=>setPForm(f=>({...f,middleName:e.target.value}))}/></Field>
          </div>
          <Field label="Last Name"><input style={inp} value={pForm.lastName} onChange={e=>setPForm(f=>({...f,lastName:e.target.value}))}/></Field>
          <Field label="Username">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold select-none" style={{ color:'#2dd4bf' }}>@</span>
              <input style={{ ...inp, paddingLeft:26 }} value={pForm.username} placeholder="your_handle"
                onChange={e=>handleUsernameEdit(e.target.value)}/>
              {usernameStatus === 'checking' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin w-4 h-4" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                </span>
              )}
              {usernameStatus === 'available' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/></svg>
                </span>
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/></svg>
                </span>
              )}
            </div>
            {usernameStatus === 'taken' && <p className="text-xs mt-1" style={{ color:'#f87171' }}>Username already taken</p>}
            {usernameStatus === 'invalid' && <p className="text-xs mt-1" style={{ color:'#f87171' }}>At least 3 characters required</p>}
            {usernameStatus === 'available' && <p className="text-xs mt-1" style={{ color:'#4ade80' }}>Username available!</p>}
          </Field>
          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><input style={inp} value={pForm.city} onChange={e=>setPForm(f=>({...f,city:e.target.value}))}/></Field>
            <Field label="Country">
              <div className="relative">
                <input style={inp}
                  value={countryDropOpen ? countrySearch : pForm.country}
                  placeholder="Search country…"
                  onFocus={() => { setCountrySearch(''); setCountryDropOpen(true) }}
                  onChange={e => setCountrySearch(e.target.value)}
                  onBlur={() => setTimeout(() => setCountryDropOpen(false), 150)}
                />
                {countryDropOpen && (
                  <div className="absolute left-0 right-0 z-50 overflow-y-auto rounded-xl"
                    style={{ top:'calc(100% + 4px)', maxHeight:200, background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', boxShadow:'0 8px 28px rgba(0,0,0,0.3)' }}>
                    {(() => {
                      const filtered = COUNTRIES.filter(c => !countrySearch || c.name.toLowerCase().includes(countrySearch.toLowerCase()))
                      if (!filtered.length) return <p className="px-3 py-2.5 text-sm" style={{ color:'var(--cs-text-3)' }}>No results</p>
                      return filtered.map(c => (
                        <button key={c.name} onMouseDown={() => { setPForm(f=>({...f, country:c.name})); setCountrySearch(''); setCountryDropOpen(false) }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-all"
                          style={{ background: pForm.country===c.name ? 'rgba(45,212,191,0.08)' : 'transparent', color: pForm.country===c.name ? '#2dd4bf' : 'var(--cs-text-1)' }}
                          onMouseEnter={e=>{ if(pForm.country!==c.name) e.currentTarget.style.background='var(--cs-input-bg)' }}
                          onMouseLeave={e=>{ if(pForm.country!==c.name) e.currentTarget.style.background='transparent' }}>
                          <span>{c.name}</span>
                          <span style={{ color:'var(--cs-text-3)', fontSize:11 }}>{c.dial}</span>
                        </button>
                      ))
                    })()}
                  </div>
                )}
              </div>
            </Field>
          </div>
          {/* Gender + DOB */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender">
              <select style={inp} value={pForm.gender} onChange={e=>setPForm(f=>({...f,gender:e.target.value}))}>
                <option value="">—</option><option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
              </select>
            </Field>
            <Field label="Date of Birth"><input type="date" style={inp} value={pForm.dateOfBirth} onChange={e=>setPForm(f=>({...f,dateOfBirth:e.target.value}))}/></Field>
          </div>
          {/* Primary phone */}
          <Field label="Phone">
            <div className="flex gap-2">
              <input style={{ ...inp, width:72, flexShrink:0 }} value={pForm.dialCode} placeholder="+91"
                onChange={e=>setPForm(f=>({...f,dialCode:e.target.value}))}/>
              <input style={inp} value={pForm.phoneNumber} placeholder="Phone number"
                onChange={e=>setPForm(f=>({...f,phoneNumber:e.target.value}))}/>
            </div>
          </Field>
          {/* Alternate phone */}
          <Field label="Alternate Phone (optional)">
            <div className="flex gap-2">
              <input style={{ ...inp, width:72, flexShrink:0 }} value={pForm.altPhoneDialCode} placeholder="+91"
                onChange={e=>setPForm(f=>({...f,altPhoneDialCode:e.target.value}))}/>
              <input style={inp} value={pForm.altPhone} placeholder="Alternate number"
                onChange={e=>setPForm(f=>({...f,altPhone:e.target.value}))}/>
            </div>
          </Field>
          {/* Alternate email */}
          <Field label="Alternate Email (optional)">
            <input type="email" style={inp} value={pForm.altEmail} placeholder="alt@example.com"
              onChange={e=>setPForm(f=>({...f,altEmail:e.target.value}))}/>
          </Field>
        </ModalShell>
      )}

      {modal==='about' && (
        <ModalShell title="About & Links" onClose={closeModal} saving={saving}
          onSave={()=>save(async()=>{
            const r = await profileApi.updateProfessional({ headline:aForm.headline||undefined, about:aForm.about||undefined, website:aForm.website||undefined, linkedInUrl:aForm.linkedInUrl||undefined, gitHubUrl:aForm.gitHubUrl||undefined, twitterUrl:aForm.twitterUrl||undefined, isOpenToWork:aForm.isOpenToWork })
            return r.data
          })}>
          <Field label="Headline"><input style={inp} value={aForm.headline} onChange={e=>setAForm(f=>({...f,headline:e.target.value}))} placeholder="e.g. Full Stack Developer · AWS Certified"/></Field>
          <Field label="Bio">
            <textarea rows={5} style={{ ...inp, resize:'vertical' }} value={aForm.about} onChange={e=>setAForm(f=>({...f,about:e.target.value}))} placeholder="Tell the community about yourself..."/>
          </Field>
          <Field label="Website"><input style={inp} value={aForm.website} onChange={e=>setAForm(f=>({...f,website:e.target.value}))} placeholder="https://..."/></Field>
          <Field label="LinkedIn URL"><input style={inp} value={aForm.linkedInUrl} onChange={e=>setAForm(f=>({...f,linkedInUrl:e.target.value}))} placeholder="https://linkedin.com/in/..."/></Field>
          <Field label="GitHub URL"><input style={inp} value={aForm.gitHubUrl} onChange={e=>setAForm(f=>({...f,gitHubUrl:e.target.value}))} placeholder="https://github.com/..."/></Field>
          <Field label="Twitter URL"><input style={inp} value={aForm.twitterUrl} onChange={e=>setAForm(f=>({...f,twitterUrl:e.target.value}))} placeholder="https://twitter.com/..."/></Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={aForm.isOpenToWork} onChange={e=>setAForm(f=>({...f,isOpenToWork:e.target.checked}))} className="rounded"/>
            <span className="text-sm" style={t2}>Open to Work</span>
          </label>
        </ModalShell>
      )}

      {modal==='skills' && (
        <ModalShell title="Skills & Role" onClose={closeModal} saving={saving}
          onSave={()=>save(async()=>{
            const parse = (r:string)=>r.split(',').map(s=>s.trim()).filter(Boolean)
            const canTeach = sForm.role === 'Both' ? parse(sForm.teachRaw)
              : sForm.role === 'Tutor' ? parse(sForm.knownRaw)
              : []
            if (canTeach.length || sForm.role === 'Both') {
              setTeachSkills(canTeach)
              localStorage.setItem('cs_teach_skills', JSON.stringify(canTeach))
            }
            const res = await profileApi.updateSkills({
              subjectsKnown: parse(sForm.knownRaw),
              subjectsWanted: parse(sForm.wantedRaw),
              role: sForm.role || undefined,
              subjectsCanTeach: canTeach.length > 0 ? canTeach : undefined,
            })
            const label = sForm.role === 'Both' ? 'Learner + Tutor' : sForm.role
            setRoleToast(`Role & skills saved as ${label}`)
            setTimeout(() => setRoleToast(null), 3000)
            return res.data
          })}>
          <Field label="Role">
            <select style={inp} value={sForm.role} onChange={e=>setSForm(f=>({...f,role:e.target.value}))}>
              <option value="">—</option><option>Learner</option><option>Tutor</option><option>Both</option>
            </select>
          </Field>

          {/* ── LEARNER ── */}
          {sForm.role === 'Learner' && (<>
            <Field label="Skills I Know — comma separated">
              <textarea rows={3} style={{ ...inp, resize:'vertical' }} value={sForm.knownRaw}
                onChange={e=>setSForm(f=>({...f,knownRaw:e.target.value}))}
                placeholder="JavaScript, React, Docker..."/>
            </Field>
            <Field label="Skills I Want to Learn — comma separated">
              <textarea rows={3} style={{ ...inp, resize:'vertical' }} value={sForm.wantedRaw}
                onChange={e=>setSForm(f=>({...f,wantedRaw:e.target.value}))}
                placeholder="Kubernetes, Machine Learning..."/>
            </Field>
          </>)}

          {/* ── TUTOR ── */}
          {sForm.role === 'Tutor' && (<>
            <Field label="Skills I Can Teach — comma separated">
              <textarea rows={3} style={{ ...inp, resize:'vertical' }} value={sForm.knownRaw}
                onChange={e=>setSForm(f=>({...f,knownRaw:e.target.value}))}
                placeholder="DevOps, Terraform, AWS, Docker..."/>
            </Field>
            <Field label="Additional Skills I Want to Learn — comma separated">
              <textarea rows={3} style={{ ...inp, resize:'vertical' }} value={sForm.wantedRaw}
                onChange={e=>setSForm(f=>({...f,wantedRaw:e.target.value}))}
                placeholder="Kubernetes, Machine Learning..."/>
            </Field>
          </>)}

          {/* ── BOTH (Learner + Tutor) — 3 separate boxes ── */}
          {sForm.role === 'Both' && (<>
            <div className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2"
              style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', color:'#6366f1' }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:'#6366f1' }}/>
              Learner side
            </div>
            <Field label="Skills I Know — comma separated">
              <textarea rows={3} style={{ ...inp, resize:'vertical' }} value={sForm.knownRaw}
                onChange={e=>setSForm(f=>({...f,knownRaw:e.target.value}))}
                placeholder="JavaScript, React, AWS..."/>
            </Field>
            <Field label="Skills I Want to Learn — comma separated">
              <textarea rows={3} style={{ ...inp, resize:'vertical' }} value={sForm.wantedRaw}
                onChange={e=>setSForm(f=>({...f,wantedRaw:e.target.value}))}
                placeholder="Kubernetes, Machine Learning..."/>
            </Field>
            <div className="rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 mt-1"
              style={{ background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.2)', color:'#a855f7' }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:'#a855f7' }}/>
              Tutor side
            </div>
            <Field label="Skills I Can Teach — comma separated">
              <textarea rows={3} style={{ ...inp, resize:'vertical' }} value={sForm.teachRaw}
                onChange={e=>setSForm(f=>({...f,teachRaw:e.target.value}))}
                placeholder="DevOps, Terraform, Docker..."/>
            </Field>
          </>)}

          {sForm.role && (
            <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background:'rgba(45,212,191,0.07)', border:'1px solid rgba(45,212,191,0.2)', color:'#0d9488' }}>
              {sForm.role === 'Tutor'   ? '💡 As a Tutor — others will find you by Skills I Can Teach.'
               : sForm.role === 'Learner' ? '💡 As a Learner — we\'ll match you with tutors for your Skills I Want to Learn.'
               : '💡 As Learner & Tutor — fill both sections. Your tutor skills are listed separately so others can find you.'}
            </div>
          )}
        </ModalShell>
      )}

      {modal==='exp' && (
        <ModalShell title="Experience" onClose={closeModal} saving={saving}
          onSave={()=>save(async()=>{ const r=await profileApi.updateExperiences(exps); return r.data })}>
          <div className="space-y-4">
            {exps.map((e,i)=>(
              <div key={i} className="p-4 rounded-xl space-y-3" style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={t3}>Entry {i+1}</span>
                  <button onClick={()=>setExps(ex=>ex.filter((_,j)=>j!==i))} className="text-xs px-2 py-1 rounded-lg" style={{ color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)' }}>Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Company"><input style={inp} value={e.company} onChange={ev=>setExps(ex=>ex.map((x,j)=>j===i?{...x,company:ev.target.value}:x))}/></Field>
                  <Field label="Title"><input style={inp} value={e.title} onChange={ev=>setExps(ex=>ex.map((x,j)=>j===i?{...x,title:ev.target.value}:x))}/></Field>
                  <Field label="Type"><input style={inp} value={e.employmentType??''} placeholder="Full-time" onChange={ev=>setExps(ex=>ex.map((x,j)=>j===i?{...x,employmentType:ev.target.value}:x))}/></Field>
                  <Field label="Location"><input style={inp} value={e.location??''} onChange={ev=>setExps(ex=>ex.map((x,j)=>j===i?{...x,location:ev.target.value}:x))}/></Field>
                  <Field label="Start Date">
                    <input type="month" style={inp}
                      value={e.startYear && e.startMonth ? `${e.startYear}-${String(e.startMonth).padStart(2,'0')}` : e.startYear ? `${e.startYear}-01` : ''}
                      onChange={ev=>{
                        const [y,m] = ev.target.value.split('-')
                        setExps(ex=>ex.map((x,j)=>j===i?{...x,startYear:+y,startMonth:+m}:x))
                      }}/>
                  </Field>
                  <Field label="End Date">
                    <div className="space-y-1.5">
                      <input type="month" style={{ ...inp, opacity: e.endYear ? 1 : 0.4 }}
                        value={e.endYear && e.endMonth ? `${e.endYear}-${String(e.endMonth).padStart(2,'0')}` : e.endYear ? `${e.endYear}-01` : ''}
                        disabled={!e.endYear && e.endYear !== 0}
                        onChange={ev=>{
                          const [y,m] = ev.target.value.split('-')
                          setExps(ex=>ex.map((x,j)=>j===i?{...x,endYear:+y,endMonth:+m}:x))
                        }}/>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!e.endYear}
                          onChange={ev=>setExps(ex=>ex.map((x,j)=>j===i?{...x,endYear:ev.target.checked?undefined:new Date().getFullYear(),endMonth:ev.target.checked?undefined:new Date().getMonth()+1}:x))}
                          className="w-3.5 h-3.5 rounded"/>
                        <span className="text-xs font-medium" style={{ color:'#2dd4bf' }}>Currently working here</span>
                      </label>
                    </div>
                  </Field>
                </div>
                <Field label="Description"><textarea rows={2} style={{ ...inp, resize:'vertical' }} value={e.description??''} onChange={ev=>setExps(ex=>ex.map((x,j)=>j===i?{...x,description:ev.target.value}:x))}/></Field>
              </div>
            ))}
            <button onClick={()=>setExps(ex=>[...ex,blankExp()])} className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ color:'#2dd4bf', border:'1px dashed rgba(45,212,191,0.4)', background:'rgba(45,212,191,0.06)' }}>+ Add Experience</button>
          </div>
        </ModalShell>
      )}

      {modal==='edu' && (
        <ModalShell title="Education" onClose={closeModal} saving={saving}
          onSave={()=>save(async()=>{ const r=await profileApi.updateEducations(edus); return r.data })}>
          <div className="space-y-4">
            {edus.map((e,i)=>(
              <div key={i} className="p-4 rounded-xl space-y-3" style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={t3}>Entry {i+1}</span>
                  <button onClick={()=>setEdus(ed=>ed.filter((_,j)=>j!==i))} className="text-xs px-2 py-1 rounded-lg" style={{ color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)' }}>Remove</button>
                </div>
                <Field label="School / Institution"><input style={inp} value={e.school} onChange={ev=>setEdus(ed=>ed.map((x,j)=>j===i?{...x,school:ev.target.value}:x))}/></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Degree"><input style={inp} value={e.degree??''} onChange={ev=>setEdus(ed=>ed.map((x,j)=>j===i?{...x,degree:ev.target.value}:x))}/></Field>
                  <Field label="Field of Study"><input style={inp} value={e.fieldOfStudy??''} onChange={ev=>setEdus(ed=>ed.map((x,j)=>j===i?{...x,fieldOfStudy:ev.target.value}:x))}/></Field>
                  <Field label="Start Date">
                    <input type="month" style={inp}
                      value={e.startYear ? `${e.startYear}-01` : ''}
                      onChange={ev=>{
                        const [y] = ev.target.value.split('-')
                        setEdus(ed=>ed.map((x,j)=>j===i?{...x,startYear:+y}:x))
                      }}/>
                  </Field>
                  <Field label="End Date">
                    <div className="space-y-1.5">
                      <input type="month" style={{ ...inp, opacity: e.endYear ? 1 : 0.4 }}
                        value={e.endYear ? `${e.endYear}-06` : ''}
                        disabled={!e.endYear}
                        onChange={ev=>{
                          const [y] = ev.target.value.split('-')
                          setEdus(ed=>ed.map((x,j)=>j===i?{...x,endYear:+y}:x))
                        }}/>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!e.endYear}
                          onChange={ev=>setEdus(ed=>ed.map((x,j)=>j===i?{...x,endYear:ev.target.checked?undefined:new Date().getFullYear()}:x))}
                          className="w-3.5 h-3.5 rounded"/>
                        <span className="text-xs font-medium" style={{ color:'#6366f1' }}>Currently studying here</span>
                      </label>
                    </div>
                  </Field>
                </div>
                <Field label="Description"><textarea rows={2} style={{ ...inp, resize:'vertical' }} value={e.description??''} onChange={ev=>setEdus(ed=>ed.map((x,j)=>j===i?{...x,description:ev.target.value}:x))}/></Field>
              </div>
            ))}
            <button onClick={()=>setEdus(ed=>[...ed,blankEdu()])} className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ color:'#6366f1', border:'1px dashed rgba(99,102,241,0.4)', background:'rgba(99,102,241,0.06)' }}>+ Add Education</button>
          </div>
        </ModalShell>
      )}

      {modal==='proj' && (
        <ModalShell title="Projects" onClose={closeModal} saving={saving}
          onSave={()=>save(async()=>{
            const withTech = projs.map((proj,i)=>({ ...proj, technologies:(projTechRaw[i]??'').split(',').map(s=>s.trim()).filter(Boolean) }))
            const r = await profileApi.updateProjects(withTech); return r.data
          })}>
          <div className="space-y-4">
            {projs.map((proj,i)=>(
              <div key={i} className="p-4 rounded-xl space-y-3" style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={t3}>Project {i+1}</span>
                  <button onClick={()=>{ setProjs(ps=>ps.filter((_,j)=>j!==i)); setProjTechRaw(rs=>rs.filter((_,j)=>j!==i)) }} className="text-xs px-2 py-1 rounded-lg" style={{ color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)' }}>Remove</button>
                </div>
                <Field label="Project Name"><input style={inp} value={proj.name} onChange={ev=>setProjs(ps=>ps.map((x,j)=>j===i?{...x,name:ev.target.value}:x))}/></Field>
                <Field label="Description"><textarea rows={2} style={{ ...inp, resize:'vertical' }} value={proj.description??''} onChange={ev=>setProjs(ps=>ps.map((x,j)=>j===i?{...x,description:ev.target.value}:x))}/></Field>
                <Field label="URL"><input style={inp} value={proj.url??''} placeholder="https://..." onChange={ev=>setProjs(ps=>ps.map((x,j)=>j===i?{...x,url:ev.target.value}:x))}/></Field>
                <Field label="Technologies (comma separated)">
                  <input style={inp} value={projTechRaw[i]??''} onChange={ev=>setProjTechRaw(rs=>rs.map((r,j)=>j===i?ev.target.value:r))} placeholder="React, TypeScript, AWS..."/>
                </Field>
              </div>
            ))}
            <button onClick={()=>{ setProjs(ps=>[...ps,blankProj()]); setProjTechRaw(rs=>[...rs,'']) }} className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ color:'#2dd4bf', border:'1px dashed rgba(45,212,191,0.4)', background:'rgba(45,212,191,0.06)' }}>+ Add Project</button>
          </div>
        </ModalShell>
      )}

      {modal==='availability' && (
        <ModalShell title="Set Weekly Availability" onClose={closeModal} saving={false}
          onSave={() => {
            localStorage.setItem('cs_availability', JSON.stringify(avForm))
            setAvailability(avForm)
            closeModal()
          }}>
          <p className="text-xs leading-relaxed" style={t3}>
            Select the days you're available and set your time slots. Others will see this when browsing your profile.
          </p>
          <div className="space-y-3">
            {DAYS.map((d, i) => {
              const daySlots = avForm.filter(s => s.dayOfWeek === i)
              const isActive = daySlots.length > 0
              return (
                <div key={d} className="rounded-xl overflow-hidden" style={{ border:`1px solid ${isActive ? 'rgba(245,158,11,0.35)' : 'var(--cs-border)'}`, background: isActive ? 'rgba(245,158,11,0.04)' : 'var(--cs-input-bg)' }}>
                  {/* Day toggle header */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        onClick={() => {
                          if (isActive) {
                            setAvForm(f => f.filter(s => s.dayOfWeek !== i))
                          } else {
                            setAvForm(f => [...f, { dayOfWeek: i, startTime: '09:00', endTime: '17:00' }])
                          }
                        }}
                        className="relative w-10 h-5 rounded-full transition-all cursor-pointer flex-shrink-0"
                        style={{ background: isActive ? '#f59e0b' : 'var(--cs-border)' }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                          style={{ left: isActive ? '22px' : '2px' }}/>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: isActive ? '#f59e0b' : 'var(--cs-text-2)' }}>
                        {FULL_DAYS[i]}
                      </span>
                    </label>
                    {isActive && (
                      <button
                        onClick={() => setAvForm(f => [...f, { dayOfWeek: i, startTime: '09:00', endTime: '17:00' }])}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1"
                        style={{ color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.06)' }}>
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
                        Add slot
                      </button>
                    )}
                  </div>
                  {/* Time slots */}
                  {isActive && (
                    <div className="px-4 pb-3 space-y-2">
                      {daySlots.map((slot, si) => {
                        const globalIdx = avForm.indexOf(slot)
                        return (
                          <div key={si} className="flex items-center gap-2">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color:'#f59e0b' }}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd"/></svg>
                            <input type="time" value={slot.startTime}
                              onChange={ev => setAvForm(f => f.map((s,idx) => idx === globalIdx ? { ...s, startTime: ev.target.value } : s))}
                              className="rounded-lg px-2 py-1 text-xs outline-none"
                              style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border)', color:'var(--cs-text-1)', width:100 }}/>
                            <span className="text-xs font-medium" style={t3}>to</span>
                            <input type="time" value={slot.endTime}
                              onChange={ev => setAvForm(f => f.map((s,idx) => idx === globalIdx ? { ...s, endTime: ev.target.value } : s))}
                              className="rounded-lg px-2 py-1 text-xs outline-none"
                              style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border)', color:'var(--cs-text-1)', width:100 }}/>
                            <button onClick={() => setAvForm(f => f.filter((_,idx) => idx !== globalIdx))}
                              className="ml-auto p-1 rounded-lg flex-shrink-0"
                              style={{ color:'#ef4444', background:'rgba(239,68,68,0.08)' }}>
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', color:'#b45309' }}>
            📅 Your availability is saved locally and visible on your profile. Backend sync coming soon.
          </div>
        </ModalShell>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {changePwdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl flex flex-col"
            style={{ background:'var(--cs-bg-card)', border:'1px solid var(--cs-border-card)', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom:'1px solid var(--cs-border)' }}>
              <h3 className="font-bold text-base" style={t1}>Change Password</h3>
              <button onClick={() => setChangePwdOpen(false)} className="p-1.5 rounded-lg" style={{ color:'var(--cs-text-3)', background:'var(--cs-input-bg)' }}>
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={t2}>Current Password</label>
                <input type="password" style={inp} placeholder="Enter current password"
                  value={pwdForm.currentPassword}
                  onChange={e => setPwdForm(f => ({ ...f, currentPassword: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={t2}>New Password</label>
                <input type="password" style={inp} placeholder="At least 8 characters"
                  value={pwdForm.newPassword}
                  onChange={e => setPwdForm(f => ({ ...f, newPassword: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={t2}>Confirm New Password</label>
                <input type="password" style={inp} placeholder="Repeat new password"
                  value={pwdForm.confirm}
                  onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} />
              </div>
              {pwdError && (
                <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171' }}>
                  {pwdError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop:'1px solid var(--cs-border)' }}>
              <button onClick={() => setChangePwdOpen(false)} className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ color:'var(--cs-text-2)', border:'1px solid var(--cs-border)' }}>
                Cancel
              </button>
              <button
                disabled={pwdSaving}
                onClick={async () => {
                  setPwdError(null)
                  if (pwdForm.newPassword !== pwdForm.confirm) { setPwdError('New passwords do not match.'); return }
                  if (pwdForm.newPassword.length < 8) { setPwdError('New password must be at least 8 characters.'); return }
                  setPwdSaving(true)
                  try {
                    await authApi.changePassword(pwdForm.currentPassword, pwdForm.newPassword)
                    setChangePwdOpen(false)
                  } catch (err: unknown) {
                    const e = err as { response?: { data?: { error?: string } } }
                    setPwdError(e?.response?.data?.error ?? 'Failed to change password.')
                  } finally {
                    setPwdSaving(false)
                  }
                }}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]"
                style={{ background: pwdSaving ? 'rgba(13,148,136,0.5)' : 'linear-gradient(135deg,#0d9488,#0ea5e9)', opacity: pwdSaving ? 0.7 : 1 }}>
                {pwdSaving ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
