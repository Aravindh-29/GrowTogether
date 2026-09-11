import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCall } from '../contexts/CallContext'

interface Room {
  id: string
  name: string
  host: string
  subject: string
  participants: number
  isLive: boolean
}

const DEMO_ROOMS: Room[] = [
  { id: '1', name: 'Calculus Deep Dive', host: 'You', subject: 'Mathematics', participants: 3, isLive: true },
  { id: '2', name: 'React Hooks Masterclass', host: 'Alex K.', subject: 'Web Development', participants: 7, isLive: true },
  { id: '3', name: 'Physics Problem Solving', host: 'Priya M.', subject: 'Physics', participants: 2, isLive: false },
]

export default function LiveClassroomsPage() {
  const navigate = useNavigate()
  const { callState } = useCall()
  const [rooms] = useState<Room[]>(DEMO_ROOMS)
  const [showCreate, setShowCreate] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [subject, setSubject] = useState('Computer Science')

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--cs-bg)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cs-text-1)' }}>Live Classrooms</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--cs-text-2)' }}>Join or host live video study sessions</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#8b5cf6,#0ea5e9)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
            Host Room
          </button>
        </div>

        {/* Tip banner */}
        <div className="flex items-start gap-3 p-4 rounded-2xl mb-5"
          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <svg viewBox="0 0 24 24" fill="#8b5cf6" className="w-5 h-5 flex-shrink-0 mt-0.5">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--cs-text-2)' }}>
            Live Classrooms use video calls — make sure your camera and mic are ready. You can also start a quick 1-on-1 call from the <button onClick={() => navigate('/messages')} className="underline font-medium" style={{ color: '#8b5cf6' }}>Messages</button> page.
          </p>
        </div>

        {/* Create room form */}
        {showCreate && (
          <div className="p-5 rounded-2xl mb-5" style={{ background: 'var(--cs-input-bg)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <p className="text-sm font-bold mb-4" style={{ color: 'var(--cs-text-1)' }}>Create Classroom</p>
            <div className="flex flex-col gap-3">
              <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Room name" maxLength={60}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }}>
                {['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Web Development', 'Data Science', 'English', 'Other'].map(s => <option key={s}>{s}</option>)}
              </select>
              <p className="text-xs px-1" style={{ color: 'var(--cs-text-3)' }}>
                Full classroom support with multiple participants is coming soon. For now, use 1-on-1 video calls from Messages.
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setShowCreate(false); navigate('/messages') }}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#8b5cf6,#0ea5e9)' }}>
                  Go to Messages
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-2)' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Browse rooms */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cs-text-3)' }}>Browse Rooms</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>Preview</span>
          </div>
          <div className="flex flex-col gap-3">
            {rooms.map(r => (
              <div key={r.id} className="flex items-center gap-4 px-4 py-4 rounded-2xl"
                style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)', opacity: r.isLive ? 1 : 0.6 }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: r.isLive ? 'rgba(139,92,246,0.15)' : 'var(--cs-bg)' }}>
                  <svg viewBox="0 0 24 24" fill={r.isLive ? '#8b5cf6' : 'var(--cs-text-3)'} className="w-5 h-5">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--cs-text-1)' }}>{r.name}</p>
                    {r.isLive && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs" style={{ color: '#2dd4bf' }}>{r.subject}</span>
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--cs-text-3)' }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
                      {r.participants}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--cs-text-3)' }}>Host: {r.host}</span>
                  </div>
                </div>
                <button disabled={!r.isLive || callState !== 'idle'}
                  onClick={() => navigate('/messages')}
                  className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-40"
                  style={{ background: r.isLive ? 'rgba(139,92,246,0.15)' : 'var(--cs-bg)', color: r.isLive ? '#8b5cf6' : 'var(--cs-text-3)', border: `1px solid ${r.isLive ? 'rgba(139,92,246,0.3)' : 'var(--cs-border)'}` }}>
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
