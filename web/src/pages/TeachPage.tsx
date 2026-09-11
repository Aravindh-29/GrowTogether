import { useEffect, useState } from 'react'
import { profileApi, type ProfileResponse } from '../api/profileApi'

interface Session {
  id: string
  topic: string
  subject: string
  description: string
  scheduledAt: string
  duration: number
  maxStudents: number
}

const load = (): Session[] => {
  try { return JSON.parse(localStorage.getItem('cs_teach_sessions') || '[]') }
  catch { return [] }
}
const persist = (s: Session[]) => localStorage.setItem('cs_teach_sessions', JSON.stringify(s))

export default function TeachPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [sessions, setSessions] = useState<Session[]>(load)
  const [showCreate, setShowCreate] = useState(false)
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration] = useState(60)
  const [maxStudents, setMaxStudents] = useState(5)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    profileApi.getMe().then(r => {
      setProfile(r.data)
      if (r.data.subjectsCanTeach?.length) setSubject(r.data.subjectsCanTeach[0])
    }).catch(() => {})
  }, [])

  const create = async () => {
    if (!topic.trim() || !subject) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 400))
    const s: Session = { id: Date.now().toString(), topic: topic.trim(), subject, description: description.trim(), scheduledAt, duration, maxStudents }
    const updated = [s, ...sessions]
    setSessions(updated); persist(updated)
    setTopic(''); setDescription(''); setShowCreate(false); setSaving(false)
  }

  const remove = (id: string) => {
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated); persist(updated)
  }

  const canTeach = profile?.subjectsCanTeach ?? []
  const allSubjects = canTeach.length ? canTeach : ['General']

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--cs-bg)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cs-text-1)' }}>Teach</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--cs-text-2)' }}>Share your knowledge and host study sessions</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
            New Session
          </button>
        </div>

        {/* Subjects I can teach */}
        {canTeach.length > 0 && (
          <div className="p-4 rounded-2xl mb-5" style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--cs-text-3)' }}>Subjects you can teach</p>
            <div className="flex flex-wrap gap-2">
              {canTeach.map(s => (
                <span key={s} className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }}>
                  {s}
                </span>
              ))}
            </div>
            {canTeach.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--cs-text-3)' }}>Add subjects you can teach in your profile settings.</p>
            )}
          </div>
        )}

        {/* Create session form */}
        {showCreate && (
          <div className="p-5 rounded-2xl mb-5" style={{ background: 'var(--cs-input-bg)', border: '1px solid rgba(45,212,191,0.3)' }}>
            <p className="text-sm font-bold mb-4" style={{ color: 'var(--cs-text-1)' }}>Create Session</p>
            <div className="flex flex-col gap-3">
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Session topic" maxLength={80}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }}>
                {allSubjects.map(s => <option key={s}>{s}</option>)}
              </select>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What will you cover? (optional)" maxLength={300} rows={2}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--cs-text-3)' }}>Date & Time</label>
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--cs-text-3)' }}>Duration (min)</label>
                  <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }}>
                    {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={create} disabled={saving || !topic.trim()}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0d9488,#22c55e)' }}>
                  {saving ? 'Creating…' : 'Create Session'}
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-2)' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Sessions list */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cs-text-3)' }}>My Sessions</span>
            {sessions.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(45,212,191,0.2)', color: '#2dd4bf' }}>{sessions.length}</span>
            )}
          </div>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--cs-input-bg)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" style={{ color: 'var(--cs-text-3)' }}>
                  <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--cs-text-2)' }}>No sessions yet</p>
              <p className="text-xs text-center" style={{ color: 'var(--cs-text-3)' }}>Create a session to start teaching</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map(s => (
                <div key={s.id} className="px-4 py-4 rounded-2xl" style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--cs-text-1)' }}>{s.topic}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-medium" style={{ color: '#2dd4bf' }}>{s.subject}</span>
                        <span className="text-xs" style={{ color: 'var(--cs-text-3)' }}>{s.duration} min</span>
                        {s.scheduledAt && (
                          <span className="text-xs" style={{ color: 'var(--cs-text-3)' }}>
                            {new Date(s.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {s.description && <p className="text-xs mt-1.5" style={{ color: 'var(--cs-text-3)' }}>{s.description}</p>}
                    </div>
                    <button onClick={() => remove(s.id)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ color: 'var(--cs-text-3)' }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
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
