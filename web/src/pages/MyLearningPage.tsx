import { useEffect, useRef, useState } from 'react'

interface Goal {
  id: string
  title: string
  subject: string
  done: boolean
  createdAt: string
}

const SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'Data Science', 'Machine Learning', 'Web Development', 'Mobile Development',
  'English', 'History', 'Economics', 'Psychology', 'Design', 'Other',
]

const load = (): Goal[] => {
  try { return JSON.parse(localStorage.getItem('cs_learning_goals') || '[]') }
  catch { return [] }
}
const save = (goals: Goal[]) => localStorage.setItem('cs_learning_goals', JSON.stringify(goals))

export default function MyLearningPage() {
  const [goals, setGoals] = useState<Goal[]>(load)
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (showAdd) inputRef.current?.focus() }, [showAdd])

  const addGoal = () => {
    if (!title.trim()) return
    const updated = [{ id: Date.now().toString(), title: title.trim(), subject, done: false, createdAt: new Date().toISOString() }, ...goals]
    setGoals(updated); save(updated)
    setTitle(''); setShowAdd(false)
  }

  const toggle = (id: string) => {
    const updated = goals.map(g => g.id === id ? { ...g, done: !g.done } : g)
    setGoals(updated); save(updated)
  }

  const remove = (id: string) => {
    const updated = goals.filter(g => g.id !== id)
    setGoals(updated); save(updated)
  }

  const visible = goals.filter(g => filter === 'all' ? true : filter === 'done' ? g.done : !g.done)
  const doneCount = goals.filter(g => g.done).length
  const pct = goals.length ? Math.round((doneCount / goals.length) * 100) : 0

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--cs-bg)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cs-text-1)' }}>My Learning</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--cs-text-2)' }}>Track your study goals and progress</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
            Add Goal
          </button>
        </div>

        {/* Progress summary */}
        {goals.length > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-2xl mb-5"
            style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}>
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="var(--cs-border)" strokeWidth="5" />
                <circle cx="28" cy="28" r="22" fill="none" stroke="#0d9488" strokeWidth="5"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: '#2dd4bf' }}>{pct}%</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--cs-text-1)' }}>{doneCount} of {goals.length} goals completed</p>
              <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'var(--cs-border)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#0d9488,#0ea5e9)' }} />
              </div>
            </div>
          </div>
        )}

        {/* Add goal form */}
        {showAdd && (
          <div className="p-4 rounded-2xl mb-4" style={{ background: 'var(--cs-input-bg)', border: '1px solid rgba(45,212,191,0.3)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--cs-text-1)' }}>New Goal</p>
            <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGoal(); if (e.key === 'Escape') setShowAdd(false) }}
              placeholder="What do you want to learn?" maxLength={120}
              className="w-full px-3 py-2.5 rounded-xl text-sm mb-3 outline-none"
              style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
            <div className="flex gap-3">
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }}>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={addGoal}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg,#0d9488,#22c55e)' }}>Add</button>
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-2)' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(['all', 'active', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all"
              style={{
                background: filter === f ? 'rgba(45,212,191,0.15)' : 'var(--cs-input-bg)',
                color: filter === f ? '#2dd4bf' : 'var(--cs-text-2)',
                border: filter === f ? '1px solid rgba(45,212,191,0.3)' : '1px solid var(--cs-border)',
              }}>
              {f} {f === 'all' ? `(${goals.length})` : f === 'done' ? `(${doneCount})` : `(${goals.length - doneCount})`}
            </button>
          ))}
        </div>

        {/* Goals list */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--cs-input-bg)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" style={{ color: 'var(--cs-text-3)' }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--cs-text-2)' }}>
              {filter === 'all' ? 'No goals yet — add your first!' : filter === 'done' ? 'No completed goals yet' : 'All goals completed!'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map(g => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
                style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)', opacity: g.done ? 0.7 : 1 }}>
                <button onClick={() => toggle(g.id)}
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ borderColor: g.done ? '#0d9488' : 'var(--cs-text-3)', background: g.done ? '#0d9488' : 'transparent' }}>
                  {g.done && <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--cs-text-1)', textDecoration: g.done ? 'line-through' : 'none' }}>{g.title}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(45,212,191,0.1)', color: '#2dd4bf' }}>{g.subject}</span>
                </div>
                <button onClick={() => remove(g.id)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ color: 'var(--cs-text-3)' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
