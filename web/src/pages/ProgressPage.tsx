import { useEffect, useState } from 'react'
import { profileApi, type ProfileResponse } from '../api/profileApi'
import { connectionApi, type ConnectionWithProfile } from '../api/connectionApi'

function motivationalMessage(pct: number): string {
  if (pct === 0) return "Welcome! Complete your profile to start connecting with study buddies."
  if (pct < 25) return "Great start! A fuller profile helps you find the perfect study partners."
  if (pct < 50) return "You're making progress! Keep going — more profile detail means better matches."
  if (pct < 75) return "Looking good! You're over halfway — just a bit more to unlock your full potential."
  if (pct < 100) return "Almost there! Finish your profile to get the most out of Learn & Grow."
  return "Your profile is complete! You're fully set up to learn and grow together."
}

// ── Circular Progress Ring ────────────────────────────────────────────────────

function ProgressRing({ pct, size = 88, stroke = 7 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(pct, 100) / 100) * circ
  const cx = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke="url(#pg-ring-grad)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.9s ease' }}
      />
      <defs>
        <linearGradient id="pg-ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <text x={cx} y={cx + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#2dd4bf">
        {pct}%
      </text>
    </svg>
  )
}

// ── Mini Progress Bar ─────────────────────────────────────────────────────────

function MiniBar({ value, max, color = '#2dd4bf' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--cs-border)' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, sub, bar, accentColor = '#2dd4bf',
}: {
  icon: React.ReactNode
  value: string | number
  label: string
  sub?: string
  bar?: { value: number; max: number; color?: string }
  accentColor?: string
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: 'var(--cs-bg-elevated)', border: '1px solid var(--cs-border)' }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `${accentColor}1a`,
            border: `1px solid ${accentColor}40`,
          }}
        >
          {icon}
        </div>
        {sub && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'var(--cs-input-bg)', color: 'var(--cs-text-3)' }}>
            {sub}
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-extrabold leading-none" style={{ color: accentColor }}>
          {value}
        </p>
        <p className="text-xs mt-1 font-medium" style={{ color: 'var(--cs-text-2)' }}>
          {label}
        </p>
      </div>
      {bar && (
        <MiniBar {...bar} />
      )}
    </div>
  )
}

// ── Timeline Item ─────────────────────────────────────────────────────────────

function TimelineItem({
  label, done, isLast,
}: {
  label: string
  done: boolean
  isLast: boolean
}) {
  return (
    <div className="relative flex items-start gap-4 pl-10">
      {/* Connector line */}
      {!isLast && (
        <div
          className="absolute left-[15px] top-8 bottom-0 w-0.5"
          style={{ background: done ? 'rgba(45,212,191,0.3)' : 'var(--cs-border)' }}
        />
      )}
      {/* Dot */}
      <div
        className="absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
        style={{
          background: done
            ? 'linear-gradient(135deg,#0d9488,#0ea5e9)'
            : 'var(--cs-input-bg)',
          border: `2px solid ${done ? 'transparent' : 'var(--cs-border)'}`,
          boxShadow: done ? '0 2px 8px rgba(13,148,136,0.4)' : 'none',
        }}
      >
        {done ? (
          <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        ) : (
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--cs-border)' }} />
        )}
      </div>
      {/* Text */}
      <div className="pt-1 pb-5">
        <p
          className="text-sm font-medium"
          style={{ color: done ? 'var(--cs-text-1)' : 'var(--cs-text-3)' }}
        >
          {label}
        </p>
        {!done && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--cs-text-3)' }}>
            Not yet reached
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [connections, setConnections] = useState<ConnectionWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      profileApi.getMe(),
      connectionApi.getConnections(),
    ]).then(([pRes, cRes]) => {
      if (pRes.status === 'fulfilled') setProfile(pRes.value.data)
      if (cRes.status === 'fulfilled') setConnections(cRes.value.data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--cs-bg)' }}>
        <svg className="animate-spin w-6 h-6" style={{ color: '#2dd4bf' }} viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  // Derived stats
  const pct = profile?.completionPercent ?? 0
  const acceptedConnections = connections.filter(c => c.status === 'Accepted').length
  const subjectsKnown = profile?.subjectsKnown?.length ?? 0
  const subjectsWanted = profile?.subjectsWanted?.length ?? 0

  // Timeline milestone states
  const hasProfile = profile !== null
  const hasConnected = acceptedConnections > 0
  const hasSubjects = subjectsKnown > 0 || subjectsWanted > 0

  const timelineItems = [
    { label: 'Joined Learn & Grow', done: true },
    { label: 'Created your profile', done: hasProfile },
    { label: 'Added study subjects', done: hasSubjects },
    { label: 'Connected with your first study friend', done: hasConnected },
  ]

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--cs-bg)' }}>

      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 px-6 py-4"
        style={{
          background: 'var(--cs-bg-nav)',
          borderBottom: '1px solid var(--cs-border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <h1 className="text-xl font-bold" style={{ color: 'var(--cs-text-1)' }}>Progress</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--cs-text-3)' }}>
          Track your study journey and personal growth
        </p>
      </div>

      <div className="px-6 py-6 max-w-4xl space-y-6">

        {/* ── Motivational Banner ── */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center gap-5"
          style={{
            background: 'linear-gradient(135deg,rgba(13,148,136,0.18),rgba(14,165,233,0.12))',
            border: '1px solid rgba(45,212,191,0.25)',
          }}
        >
          <ProgressRing pct={pct} size={80} stroke={7} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--cs-text-1)' }}>
              Profile Completion
            </p>
            <p className="text-xs mt-1.5 max-w-sm leading-relaxed" style={{ color: 'var(--cs-text-2)' }}>
              {motivationalMessage(pct)}
            </p>
            {pct < 100 && (
              <div className="mt-3 w-48">
                <MiniBar value={pct} max={100} color="#2dd4bf" />
              </div>
            )}
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Friends Connected */}
          <StatCard
            icon={
              <svg viewBox="0 0 24 24" fill="#2dd4bf" className="w-5 h-5">
                <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            }
            value={acceptedConnections}
            label="Friends Connected"
            sub={acceptedConnections === 1 ? 'friend' : 'friends'}
            accentColor="#2dd4bf"
          />

          {/* Subjects Known */}
          <StatCard
            icon={
              <svg viewBox="0 0 24 24" fill="#0ea5e9" className="w-5 h-5">
                <path d="M12 3L1 9l4 2.18V17c0 1.1.9 2 2 2h2c0 .55.45 1 1 1h4c.55 0 1-.45 1-1h2c1.1 0 2-.9 2-2v-5.82L21 9l-9-6zm6 14H6v-4.36l4.73 2.55L12 15.87l1.27-.68L17 12.64V17z" />
              </svg>
            }
            value={subjectsKnown}
            label="Subjects Known"
            sub={subjectsKnown === 1 ? 'skill' : 'skills'}
            accentColor="#0ea5e9"
          />

          {/* Subjects Learning */}
          <StatCard
            icon={
              <svg viewBox="0 0 24 24" fill="#a78bfa" className="w-5 h-5">
                <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
              </svg>
            }
            value={subjectsWanted}
            label="Subjects Learning"
            sub={subjectsWanted === 1 ? 'topic' : 'topics'}
            accentColor="#a78bfa"
          />
        </div>

        {/* ── Learning Journey Timeline ── */}
        <div
          className="rounded-2xl p-6"
          style={{ background: 'var(--cs-bg-elevated)', border: '1px solid var(--cs-border)' }}
        >
          <div className="flex items-center gap-2.5 mb-6">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)' }}
            >
              <svg viewBox="0 0 24 24" fill="#2dd4bf" className="w-4 h-4">
                <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
              </svg>
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--cs-text-1)' }}>
              Your Learning Journey
            </h2>
          </div>

          <div>
            {timelineItems.map((item, i) => (
              <TimelineItem
                key={item.label}
                label={item.label}
                done={item.done}
                isLast={i === timelineItems.length - 1}
              />
            ))}
          </div>

          {/* Progress summary */}
          <div
            className="mt-2 px-4 py-3 rounded-xl flex items-center justify-between"
            style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--cs-text-2)' }}>
              Milestones reached
            </span>
            <span className="text-sm font-bold" style={{ color: '#2dd4bf' }}>
              {timelineItems.filter(t => t.done).length} / {timelineItems.length}
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
