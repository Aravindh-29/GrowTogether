import { useEffect, useRef, useState } from 'react'
import { useGroupCall } from '../contexts/GroupCallContext'
import type { GroupCallParticipant, GroupCallLayout } from '../contexts/GroupCallContext'

// ── Icons (inline SVG helpers) ────────────────────────────────────────────────

const MicIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
const MicOffIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" /></svg>
const CamIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
const CamOffIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M21 6.5l-4-4-9.96 9.96-2.5-2.46L3.12 11.42l4 3.92L21 6.5zm-11 7.5c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm7.5-3.5L21 14v-4l-3.5 3z" /><path d="M3.27 2L2 3.27l4.22 4.22-3.72 3.73 1.41 1.41 3.73-3.72L21 22.73 22.27 21.46 3.27 2z" /></svg>
const ScreenShareIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78.48-4.34 1.71-5.5 3.72.13-1.32.53-4.14 3.53-5.77V8l4 4-2.03 2.47z" /></svg>
const HandIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M21 7c0-1.38-1.12-2.5-2.5-2.5-.07 0-.13.01-.2.01C17.96 3.52 17.08 3 16 3c-.4 0-.77.09-1.1.24C14.5 2.48 13.56 2 12.5 2c-.88 0-1.65.4-2.17 1.03C10.1 2.99 9.85 3 9.5 3 8.12 3 7 4.12 7 5.5V11c-.43-.3-1.35-.52-2 .13L4 12c-.33.33-.5.76-.5 1.21C3.5 14.24 4 15 5.03 15.73l2.5 1.98C8.32 18.38 9.25 19 10 19h7c1.65 0 3-1.35 3-3v-6c0-1.38-1.12-2.5-2.5-2.5-.17 0-.34.02-.5.06z" /></svg>
const LeaveIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.38c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" /></svg>
const PeopleIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
const ChatIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
const LockIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" /></svg>
const UnlockIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z" /></svg>
const CloseIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
const PinIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" /></svg>

// AVATAR COLORS
const COLORS = ['#6366f1','#0ea5e9','#22c55e','#f59e0b','#ec4899','#14b8a6','#8b5cf6','#f97316']
const avatarBg = (name: string) => COLORS[(name.charCodeAt(0) || 0) % COLORS.length]

// ── Participant tile ───────────────────────────────────────────────────────────

function ParticipantTile({
  participant, isSpeaking, isPinned, onPin,
}: {
  participant: GroupCallParticipant
  isSpeaking: boolean
  isPinned: boolean
  onPin: (uid: string | null) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = participant.stream
  }, [participant.stream])

  const hasVideo = !participant.videoMuted && !!(participant.stream?.getVideoTracks().some(t => t.readyState !== 'ended'))

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex items-center justify-center transition-all"
      style={{
        background: '#1a1a2e',
        minHeight: 140,
        aspectRatio: '16/9',
        border: isSpeaking ? '2px solid #22c55e' : isPinned ? '2px solid #2dd4bf' : '2px solid transparent',
        boxShadow: isSpeaking ? '0 0 0 2px rgba(34,197,94,0.3)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <video ref={videoRef} autoPlay playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: hasVideo ? 'block' : 'none' }} />

      {!hasVideo && (
        <div className="flex flex-col items-center gap-2 z-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl"
            style={{ background: avatarBg(participant.name) }}>
            {participant.name[0]?.toUpperCase() ?? '?'}
          </div>
        </div>
      )}

      {/* Speaking pulse overlay */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ border: '2px solid rgba(34,197,94,0.6)', animation: 'pulse 1s infinite' }} />
      )}

      {/* Raised-hand badge — top-left, prominent, visible to everyone */}
      {participant.handRaised && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
          style={{ background: 'rgba(251,191,36,0.92)', color: '#1a1a1a', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          <span className="text-sm leading-none">✋</span>
          <span>Raised hand</span>
        </div>
      )}

      {/* Bottom bar: name + status */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 z-10 flex items-center gap-1.5"
        style={{ background: 'linear-gradient(transparent,rgba(0,0,0,0.7))' }}>
        <span className="text-[11px] font-semibold text-white flex-1 truncate">{participant.name}</span>
        {participant.audioMuted && (
          <span className="text-white opacity-60"><MicOffIcon /></span>
        )}
        {isSpeaking && !participant.audioMuted && (
          <span style={{ color: '#22c55e' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            </svg>
          </span>
        )}
      </div>

      {/* Hover controls — pin only (mute/remove are in the People panel) */}
      {hovered && (
        <div className="absolute top-2 right-2 z-20 flex gap-1">
          <button onClick={() => onPin(isPinned ? null : participant.userId)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
            style={{ background: isPinned ? 'rgba(45,212,191,0.7)' : 'rgba(0,0,0,0.55)' }}
            title={isPinned ? 'Unpin' : 'Pin'}>
            <PinIcon />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Local tile ────────────────────────────────────────────────────────────────

function LocalTile({ stream, screenStream, isScreenSharing, name, isAudioMuted, isVideoMuted, isSpeaking }: {
  stream: MediaStream | null
  screenStream: MediaStream | null
  isScreenSharing: boolean
  name: string
  isAudioMuted: boolean
  isVideoMuted: boolean
  isSpeaking: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const screenRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  useEffect(() => {
    if (screenRef.current) screenRef.current.srcObject = screenStream
  }, [screenStream])

  const hasVideo = !isVideoMuted && !!(stream?.getVideoTracks().some(t => t.readyState !== 'ended'))

  return (
    <div className="relative rounded-xl overflow-hidden flex items-center justify-center"
      style={{
        width: 200, height: 130, background: '#1a1a2e', flexShrink: 0,
        border: isSpeaking ? '2px solid #22c55e' : '2px solid rgba(45,212,191,0.4)',
      }}>
      {isScreenSharing && screenStream ? (
        <video ref={screenRef} autoPlay playsInline muted className="w-full h-full object-contain" />
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ display: hasVideo ? 'block' : 'none' }} />
          {!hasVideo && (
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base"
                style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
                {name[0]?.toUpperCase() ?? 'Y'}
              </div>
            </div>
          )}
        </>
      )}
      <div className="absolute bottom-1 left-0 right-0 px-2 flex items-center gap-1"
        style={{ background: 'linear-gradient(transparent,rgba(0,0,0,0.6))' }}>
        <span className="text-[10px] font-semibold text-white flex-1 truncate">You ({name})</span>
        {isAudioMuted && <span className="text-white opacity-60" style={{ transform: 'scale(0.7)' }}><MicOffIcon /></span>}
      </div>
    </div>
  )
}

// ── People panel ──────────────────────────────────────────────────────────────

function PeoplePanel({ myName, myId }: { myName: string; myId: string }) {
  const {
    participants, isOwnerOrAdmin, isCallHost, raisedHands, speakingParticipants,
    localAudioMuted, muteParticipant, removeParticipant, muteAll, lowerParticipantHand,
    isLocked, lockCall, unlockCall,
  } = useGroupCall()

  const allCount = participants.length + 1
  const canManage = isOwnerOrAdmin || isCallHost
  // Sort: raised hands first, then alphabetical
  const sorted = [...participants].sort((a, b) => {
    const aR = raisedHands.has(a.userId) ? 0 : 1
    const bR = raisedHands.has(b.userId) ? 0 : 1
    return aR - bR || a.name.localeCompare(b.name)
  })
  const raisedCount = raisedHands.size

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">People ({allCount})</span>
          {raisedCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>
              ✋ {raisedCount} raised
            </span>
          )}
        </div>
        {canManage && (
          <div className="flex gap-1.5">
            <button onClick={isLocked ? unlockCall : lockCall}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
              style={{ background: isLocked ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)', color: isLocked ? '#f87171' : '#9ca3af' }}
              title={isLocked ? 'Unlock meeting' : 'Lock meeting'}>
              {isLocked ? <LockIcon /> : <UnlockIcon />}
              {isLocked ? 'Locked' : 'Lock'}
            </button>
            {participants.length > 0 && (
              <button onClick={muteAll}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                Mute All
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1 min-h-0">
        {/* Me */}
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl"
          style={{ background: 'rgba(45,212,191,0.08)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
            {myName[0]?.toUpperCase()}
          </div>
          <span className="text-sm text-white flex-1 truncate">{myName} <span className="text-[10px] opacity-40">(You)</span></span>
          {localAudioMuted && <span className="text-white opacity-40 flex-shrink-0" style={{ transform: 'scale(0.8)' }}><MicOffIcon /></span>}
        </div>

        {/* Others — raised hands first */}
        {sorted.map(p => {
          const hasRaisedHand = raisedHands.has(p.userId)
          return (
          <div key={p.userId}
            className="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all"
            style={{ background: hasRaisedHand ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)',
              border: hasRaisedHand ? '1px solid rgba(251,191,36,0.25)' : '1px solid transparent' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 relative"
              style={{ background: avatarBg(p.name) }}>
              {p.name[0]?.toUpperCase()}
              {speakingParticipants.has(p.userId) && (
                <span className="absolute inset-0 rounded-full border-2 animate-ping" style={{ borderColor: '#22c55e' }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm text-white truncate">{p.name}</span>
              </div>
              {hasRaisedHand && (
                <span className="text-[10px] font-semibold" style={{ color: '#fbbf24' }}>✋ Raised hand</span>
              )}
            </div>
            {/* Lower hand button — visible to host/admin only when hand is raised */}
            {hasRaisedHand && canManage && (
              <button onClick={() => lowerParticipantHand(p.userId)}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all hover:opacity-90 flex-shrink-0"
                style={{ background: 'rgba(251,191,36,0.25)', color: '#fbbf24' }}
                title="Lower hand">
                Lower
              </button>
            )}
            {p.audioMuted && <span className="text-white opacity-40 flex-shrink-0" style={{ transform: 'scale(0.8)' }}><MicOffIcon /></span>}
            {canManage && (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => muteParticipant(p.userId)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white opacity-60 hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(245,158,11,0.3)', transform: 'scale(0.85)' }} title="Mute">
                  <MicOffIcon />
                </button>
                <button onClick={() => removeParticipant(p.userId)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white opacity-60 hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(239,68,68,0.3)', transform: 'scale(0.85)' }} title="Remove">
                  <CloseIcon />
                </button>
              </div>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Chat panel ────────────────────────────────────────────────────────────────

function ChatPanel({ myId }: { myId: string }) {
  const { callMessages, sendCallMessage } = useGroupCall()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [callMessages])

  const send = () => {
    if (!text.trim()) return
    sendCallMessage(text)
    setText('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <span className="text-sm font-semibold text-white">In-call chat</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
        {callMessages.length === 0 && (
          <p className="text-center text-xs text-white opacity-30 mt-6">No messages yet</p>
        )}
        {callMessages.map(m => {
          const isMe = m.userId === myId
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && <span className="text-[10px] text-white opacity-40 px-1">{m.name}</span>}
              <div className="max-w-[90%] px-3 py-1.5 rounded-2xl text-xs text-white break-words"
                style={{
                  background: isMe ? 'linear-gradient(135deg,#0d9488,#0ea5e9)' : 'rgba(255,255,255,0.1)',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                }}>
                {m.message}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Type a message..."
          className="flex-1 text-xs text-white bg-transparent border rounded-full px-3 py-1.5 outline-none"
          style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <button onClick={send} disabled={!text.trim()}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30"
          style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
          <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
      </div>
    </div>
  )
}

// ── Reactions overlay ─────────────────────────────────────────────────────────

function ReactionsOverlay() {
  const { reactions } = useGroupCall()
  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {reactions.map(r => (
        <div key={r.id} className="absolute flex flex-col items-center gap-1"
          style={{
            bottom: 80,
            left: `${15 + (r.userId.charCodeAt(0) % 70)}%`,
            animation: 'floatUp 4s ease-out forwards',
          }}>
          <span className="text-4xl">{r.emoji}</span>
          <span className="text-[10px] text-white opacity-60 bg-black bg-opacity-40 px-2 py-0.5 rounded-full">{r.name}</span>
        </div>
      ))}
    </div>
  )
}

// ── Control button ────────────────────────────────────────────────────────────

function CtrlBtn({ onClick, active = false, red = false, amber = false, title, children, badge }: {
  onClick: () => void; active?: boolean; red?: boolean; amber?: boolean; title: string
  children: React.ReactNode; badge?: number
}) {
  return (
    <div className="relative flex-shrink-0">
      <button onClick={onClick} title={title}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 hover:scale-105"
        style={{
          background: red ? '#ef4444' : amber ? 'rgba(245,158,11,0.25)' : active ? 'rgba(45,212,191,0.25)' : 'rgba(255,255,255,0.12)',
          border: red ? '1.5px solid transparent' : amber ? '1.5px solid rgba(245,158,11,0.5)' : active ? '1.5px solid #2dd4bf' : '1.5px solid rgba(255,255,255,0.15)',
          color: red ? 'white' : amber ? '#fbbf24' : active ? '#2dd4bf' : 'white',
        }}>
        {children}
      </button>
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center pointer-events-none"
          style={{ background: '#ef4444', lineHeight: 1 }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </div>
  )
}

// Google Meet-style button: circular + label underneath
function MeetBtn({ onClick, muted = false, active = false, amber = false, badgeAmber = false, label, children, badge }: {
  onClick: () => void; muted?: boolean; active?: boolean; amber?: boolean; badgeAmber?: boolean; label: string
  children: React.ReactNode; badge?: number
}) {
  const bg = muted ? '#ea4335' : active ? 'rgba(255,255,255,0.9)' : amber ? 'rgba(251,191,36,0.18)' : '#3c4043'
  const color = active ? '#202124' : amber ? '#fbbf24' : 'white'
  return (
    <div className="relative flex flex-col items-center gap-1 flex-shrink-0">
      <button onClick={onClick}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90"
        style={{ background: bg, color }}>
        {children}
      </button>
      {badge != null && badge > 0 && (
        <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center pointer-events-none"
          style={{ background: badgeAmber ? '#f59e0b' : '#ea4335' }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <span className="text-[11px] leading-none select-none" style={{ color: '#9aa0a6' }}>{label}</span>
    </div>
  )
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function fmt(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

// ── Main overlay ──────────────────────────────────────────────────────────────

type PanelTab = 'people' | 'chat' | null

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '👏']

export default function GroupCallOverlay() {
  const {
    status, groupName, callerName, participants, localStream, screenStream,
    isVideo, localAudioMuted, localVideoMuted, isScreenSharing,
    isOwnerOrAdmin, isCallHost, isLocked, myHandRaised, raisedHands, unreadChatCount,
    pinnedParticipant, layout, speakingParticipants,
    joinGroupCall, declineGroupCall, leaveGroupCall, endCallForAll,
    toggleLocalAudio, toggleLocalVideo, toggleScreenShare,
    muteParticipant, removeParticipant,
    raiseHand, lowerHand, sendReaction, pinParticipant, setLayout, markChatRead,
    lockCall, unlockCall,
  } = useGroupCall()

  const myUser = (() => {
    try { return JSON.parse(localStorage.getItem('cs_user') || '{}') } catch { return {} }
  })()
  const myName: string = myUser.displayName || 'You'
  const myId: string = myUser.userId || ''

  const [duration, setDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [panelTab, setPanelTab] = useState<PanelTab>(null)
  // Badge counts only OTHER people's raised hands — your own raise shows via button active state
  const othersRaisedCount = [...raisedHands].filter(uid => uid !== myId).length

  const [showReactions, setShowReactions] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showLeaveMenu, setShowLeaveMenu] = useState(false)
  const [removedToast, setRemovedToast] = useState(false)
  const [lockedToast, setLockedToast] = useState(false)
  const reactionsRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const leaveMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'active') {
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setDuration(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status])

  // Listen for removed-from-call / join-denied toasts
  useEffect(() => {
    const onRemoved = () => { setRemovedToast(true); setTimeout(() => setRemovedToast(false), 4000) }
    const onDenied = () => { setLockedToast(true); setTimeout(() => setLockedToast(false), 4000) }
    window.addEventListener('cs-removed-from-call', onRemoved)
    window.addEventListener('cs-call-join-denied', onDenied)
    return () => {
      window.removeEventListener('cs-removed-from-call', onRemoved)
      window.removeEventListener('cs-call-join-denied', onDenied)
    }
  }, [])

  // Close popups when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (reactionsRef.current && !reactionsRef.current.contains(e.target as Node))
        setShowReactions(false)
      if (moreRef.current && !moreRef.current.contains(e.target as Node))
        setShowMore(false)
      if (leaveMenuRef.current && !leaveMenuRef.current.contains(e.target as Node))
        setShowLeaveMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const togglePanel = (tab: PanelTab) => {
    if (tab === 'chat') markChatRead()
    setPanelTab(prev => prev === tab ? null : tab)
  }

  // ── Video layout helpers ──────────────────────────────────────────────────

  const activePinned = pinnedParticipant ? participants.find(p => p.userId === pinnedParticipant) : null
  const spotlightParticipant = activePinned || (speakingParticipants.size > 0
    ? participants.find(p => speakingParticipants.has(p.userId))
    : null) || participants[0] || null

  const gridCols = (count: number) => {
    if (count === 1) return 1
    if (count <= 4) return 2
    if (count <= 9) return 3
    return 4
  }

  if (status === 'idle') {
    // Toasts visible even when idle
    return (
      <>
        {removedToast && (
          <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm text-white font-semibold shadow-xl"
            style={{ background: 'rgba(239,68,68,0.9)' }}>
            You were removed from the call
          </div>
        )}
        {lockedToast && (
          <div className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl text-sm text-white font-semibold shadow-xl"
            style={{ background: 'rgba(239,68,68,0.9)' }}>
            This call is locked by the host
          </div>
        )}
      </>
    )
  }

  // ── INCOMING (top-right toast) ─────────────────────────────────────────────
  if (status === 'incoming') {
    return (
      <div className="fixed top-6 right-6 z-50 flex items-start gap-4 rounded-2xl px-5 py-4 shadow-2xl"
        style={{ background: '#1e1e2e', border: '1px solid rgba(45,212,191,0.3)', minWidth: 300, maxWidth: 340, boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}>

        <div className="relative flex-shrink-0 mt-1">
          <div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: '#0d9488' }} />
          <div className="w-10 h-10 rounded-full flex items-center justify-center relative z-10"
            style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
            <PeopleIcon />
          </div>
        </div>

        <div className="flex-1">
          <p className="font-bold text-sm text-white">{groupName || 'Group Call'}</p>
          <p className="text-xs mt-0.5" style={{ color: '#2dd4bf' }}>{callerName} is calling…</p>
          <div className="flex gap-2 mt-3">
            <button onClick={joinGroupCall}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#0d9488,#22c55e)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
              Join
            </button>
            <button onClick={declineGroupCall}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition-all active:scale-95"
              style={{ background: '#ef4444' }}>
              <CloseIcon /> Decline
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── ACTIVE call ────────────────────────────────────────────────────────────
  const cols = gridCols(participants.length)
  // raisedHandCount is unused — replaced by othersRaisedCount above

  return (
    <>
      <ReactionsOverlay />

      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0d0d1a' }}>

        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-2.5"
          style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: '#22c55e' }} />
            <span className="text-white text-sm font-semibold">{groupName || 'Group Call'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
              style={{ background: 'rgba(13,148,136,0.25)', color: '#2dd4bf' }}>
              {participants.length + 1} {participants.length === 0 ? 'participant' : 'participants'}
            </span>
            <span className="text-xs font-mono text-white opacity-50 flex-shrink-0">{fmt(duration)}</span>
            {isLocked && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                <LockIcon /> Locked
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Layout switcher */}
            <div className="flex items-center rounded-lg overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {(['tiled', 'spotlight', 'sidebar'] as GroupCallLayout[]).map(l => (
                <button key={l} onClick={() => setLayout(l)}
                  className="px-2.5 py-1.5 text-[10px] font-semibold transition-all"
                  style={{
                    background: layout === l ? 'rgba(45,212,191,0.2)' : 'transparent',
                    color: layout === l ? '#2dd4bf' : '#6b7280',
                  }}>
                  {l === 'tiled' ? '⊞' : l === 'spotlight' ? '⬜' : '◫'}
                </button>
              ))}
            </div>

            <button onClick={leaveGroupCall}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white transition-all active:scale-95"
              style={{ background: '#ef4444' }}>
              <LeaveIcon /> Leave
            </button>
          </div>
        </div>

        {/* ── MAIN AREA ────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* Video area */}
          <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden p-3 gap-3">

            {participants.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(45,212,191,0.1)', border: '2px solid rgba(45,212,191,0.3)' }}>
                  <PeopleIcon />
                </div>
                <p className="text-sm text-white opacity-60">Waiting for others to join…</p>
              </div>
            ) : layout === 'tiled' ? (
              // TILED: all equal
              <div className="flex-1 overflow-y-auto"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, alignContent: 'start' }}>
                {participants.map(p => (
                  <ParticipantTile key={p.userId} participant={p}
                    isSpeaking={speakingParticipants.has(p.userId)}
                    isPinned={pinnedParticipant === p.userId}
                    onPin={pinParticipant}
                  />
                ))}
              </div>
            ) : layout === 'spotlight' ? (
              // SPOTLIGHT: big focused tile + strip at bottom
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                {spotlightParticipant && (
                  <div className="flex-1 min-h-0">
                    <ParticipantTile participant={spotlightParticipant}
                      isSpeaking={speakingParticipants.has(spotlightParticipant.userId)}
                      isPinned={pinnedParticipant === spotlightParticipant.userId}
                      onPin={pinParticipant}
                    />
                  </div>
                )}
                <div className="flex gap-2 overflow-x-auto flex-shrink-0" style={{ height: 100 }}>
                  {participants.filter(p => p.userId !== spotlightParticipant?.userId).map(p => (
                    <div key={p.userId} className="flex-shrink-0" style={{ width: 140 }}>
                      <ParticipantTile participant={p}
                        isSpeaking={speakingParticipants.has(p.userId)}
                        isPinned={pinnedParticipant === p.userId}
                        onPin={pinParticipant}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // SIDEBAR: big left + scrollable column right
              <div className="flex-1 flex gap-3 min-h-0">
                {spotlightParticipant && (
                  <div className="flex-1 min-h-0">
                    <ParticipantTile participant={spotlightParticipant}
                      isSpeaking={speakingParticipants.has(spotlightParticipant.userId)}
                      isPinned={pinnedParticipant === spotlightParticipant.userId}
                      onPin={pinParticipant}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-2 overflow-y-auto flex-shrink-0" style={{ width: 180 }}>
                  {participants.filter(p => p.userId !== spotlightParticipant?.userId).map(p => (
                    <ParticipantTile key={p.userId} participant={p}
                      isSpeaking={speakingParticipants.has(p.userId)}
                      isPinned={pinnedParticipant === p.userId}
                      onPin={pinParticipant}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Local tile — fixed bottom-left */}
            <div className="absolute bottom-4 left-4 z-10">
              <LocalTile
                stream={localStream}
                screenStream={screenStream}
                isScreenSharing={isScreenSharing}
                name={myName}
                isAudioMuted={localAudioMuted}
                isVideoMuted={localVideoMuted}
                isSpeaking={false}
              />
            </div>
          </div>

          {/* Side panel */}
          {panelTab && (
            <div className="flex-shrink-0 flex flex-col"
              style={{ width: 320, background: '#0f0f1e', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
              {/* Panel tab bar */}
              <div className="flex items-center border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <button onClick={() => togglePanel('people')}
                  className="flex-1 py-3 text-xs font-semibold transition-all"
                  style={{ color: panelTab === 'people' ? '#2dd4bf' : '#6b7280', borderBottom: panelTab === 'people' ? '2px solid #2dd4bf' : '2px solid transparent' }}>
                  People
                </button>
                <button onClick={() => togglePanel('chat')}
                  className="flex-1 py-3 text-xs font-semibold transition-all relative"
                  style={{ color: panelTab === 'chat' ? '#2dd4bf' : '#6b7280', borderBottom: panelTab === 'chat' ? '2px solid #2dd4bf' : '2px solid transparent' }}>
                  Chat
                  {unreadChatCount > 0 && panelTab !== 'chat' && (
                    <span className="absolute top-1.5 right-4 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                      style={{ background: '#ef4444' }}>
                      {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                  )}
                </button>
                <button onClick={() => setPanelTab(null)} className="px-3 py-3 text-white opacity-40 hover:opacity-80">
                  <CloseIcon />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {panelTab === 'people' ? <PeoplePanel myName={myName} myId={myId} /> : <ChatPanel myId={myId} />}
              </div>
            </div>
          )}
        </div>

        {/* ── CONTROL BAR (Google Meet style) ─────────────────────────────── */}
        <div className="flex-shrink-0 flex items-end justify-center gap-1 px-6 py-4"
          style={{ background: '#202124', borderTop: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Group 1 — Media */}
          <MeetBtn onClick={toggleLocalAudio} muted={localAudioMuted}
            label={localAudioMuted ? 'Unmute' : 'Mute'}>
            {localAudioMuted ? <MicOffIcon /> : <MicIcon />}
          </MeetBtn>

          {(() => {
            const hasCamTrack = (localStream?.getVideoTracks()?.length ?? 0) > 0
            const camMuted = !hasCamTrack || localVideoMuted
            return (
              <MeetBtn onClick={toggleLocalVideo} muted={camMuted}
                label={!hasCamTrack ? 'Camera' : localVideoMuted ? 'Camera' : 'Camera'}>
                {hasCamTrack && !localVideoMuted ? <CamIcon /> : <CamOffIcon />}
              </MeetBtn>
            )
          })()}

          <MeetBtn onClick={toggleScreenShare} active={isScreenSharing}
            label={isScreenSharing ? 'Stop' : 'Present'}>
            <ScreenShareIcon />
          </MeetBtn>

          {/* Divider */}
          <div className="self-stretch flex items-center mx-2">
            <div className="w-px h-8 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
          </div>

          {/* Group 2 — Interactions */}
          <MeetBtn onClick={myHandRaised ? lowerHand : raiseHand}
            amber={myHandRaised} label={myHandRaised ? 'Lower hand' : 'Raise hand'}>
            <span className="text-xl leading-none">✋</span>
          </MeetBtn>

          <div className="relative flex flex-col items-center" ref={reactionsRef}>
            <MeetBtn onClick={() => setShowReactions(o => !o)} active={showReactions} label="React">
              <span className="text-xl leading-none">😊</span>
            </MeetBtn>
            {showReactions && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-2.5 rounded-2xl shadow-2xl z-20"
                style={{ background: '#303134', border: '1px solid rgba(255,255,255,0.1)' }}>
                {REACTION_EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => { sendReaction(emoji); setShowReactions(false) }}
                    className="text-2xl transition-transform hover:scale-125 active:scale-90">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex flex-col items-center" ref={moreRef}>
            <MeetBtn onClick={() => setShowMore(o => !o)} active={showMore} label="More">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </MeetBtn>
            {showMore && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 py-1 rounded-xl shadow-2xl z-20 min-w-[190px]"
                style={{ background: '#303134', border: '1px solid rgba(255,255,255,0.1)' }}>
                {(isOwnerOrAdmin || isCallHost) && (
                  <button onClick={() => { isLocked ? unlockCall() : lockCall(); setShowMore(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-all text-left">
                    {isLocked ? <><UnlockIcon /> Unlock meeting</> : <><LockIcon /> Lock meeting</>}
                  </button>
                )}
                <button onClick={() => { document.documentElement.requestFullscreen?.(); setShowMore(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-all text-left">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                  Full screen
                </button>
                {(['tiled', 'spotlight', 'sidebar'] as GroupCallLayout[]).map(l => (
                  <button key={l} onClick={() => { setLayout(l); setShowMore(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-all text-left"
                    style={{ color: layout === l ? '#8ab4f8' : 'white' }}>
                    <span className="text-base">{l === 'tiled' ? '⊞' : l === 'spotlight' ? '⬜' : '◫'}</span>
                    {l.charAt(0).toUpperCase() + l.slice(1)} layout
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="self-stretch flex items-center mx-2">
            <div className="w-px h-8 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
          </div>

          {/* Group 3 — Panels */}
          <MeetBtn onClick={() => togglePanel('people')} active={panelTab === 'people'}
            label="People" badge={othersRaisedCount > 0 ? othersRaisedCount : undefined} badgeAmber>
            <PeopleIcon />
          </MeetBtn>

          <MeetBtn onClick={() => togglePanel('chat')} active={panelTab === 'chat'}
            label="Chat" badge={unreadChatCount}>
            <ChatIcon />
          </MeetBtn>

          {/* Divider */}
          <div className="self-stretch flex items-center mx-2">
            <div className="w-px h-8 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
          </div>

          {/* Group 4 — Leave / End call */}
          {(isOwnerOrAdmin || isCallHost) ? (
            <div className="relative flex flex-col items-center" ref={leaveMenuRef}>
              {/* Split button: [Leave | ▾] */}
              <div className="flex items-center rounded-full overflow-hidden" style={{ background: '#ea4335' }}>
                <button onClick={leaveGroupCall}
                  className="flex items-center gap-2 pl-5 pr-3 h-12 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95">
                  <LeaveIcon /> Leave
                </button>
                <div className="w-px h-6 bg-white/30" />
                <button onClick={() => setShowLeaveMenu(o => !o)}
                  className="px-3 h-12 text-white transition-all hover:brightness-110 active:scale-95"
                  title="More leave options">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M7 10l5 5 5-5z" /></svg>
                </button>
              </div>
              <span className="mt-1 text-[11px] leading-none select-none" style={{ color: '#9aa0a6' }}>Leave</span>
              {showLeaveMenu && (
                <div className="absolute bottom-16 right-0 py-1 rounded-xl shadow-2xl z-20 min-w-[220px]"
                  style={{ background: '#303134', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button onClick={() => { leaveGroupCall(); setShowLeaveMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/5 transition-all text-left">
                    <LeaveIcon /> Leave call
                    <span className="ml-auto text-xs text-gray-400">Others stay</span>
                  </button>
                  <div className="mx-4 border-t border-white/10" />
                  <button onClick={() => { endCallForAll(); setShowLeaveMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-all text-left"
                    style={{ color: '#f28b82' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.38c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" /></svg>
                    End call for everyone
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button onClick={leaveGroupCall}
                className="flex items-center gap-2 px-5 h-12 rounded-full text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
                style={{ background: '#ea4335' }}>
                <LeaveIcon /> Leave
              </button>
              <span className="text-[11px] leading-none select-none" style={{ color: '#9aa0a6' }}>Leave</span>
            </div>
          )}
        </div>
      </div>

      {/* Global CSS for float-up animation */}
      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          80%  { opacity: 0.8; transform: translateY(-160px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-200px) scale(0.8); }
        }
      `}</style>
    </>
  )
}
