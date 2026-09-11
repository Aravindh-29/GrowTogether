import { useEffect, useRef, useState } from 'react'
import { useCall } from '../contexts/CallContext'
import { chatApi, getChatHub, type ChatMessage } from '../api/chatApi'
import { connectionApi, type ConnectionWithProfile } from '../api/connectionApi'

// hasVideo is computed in parent (where forceUpdate runs) and passed as prop
// so VideoTile always reflects the latest track state without its own event listeners
function VideoTile({ stream, muted = false, label, small = false, hasVideo = false }: {
  stream: MediaStream | null; muted?: boolean; label: string; small?: boolean; hasVideo?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])

  return (
    <div className="relative rounded-2xl overflow-hidden flex items-center justify-center"
      style={{ background: '#1a1a2e', ...(small ? { width: 160, height: 112 } : { flex: 1, minHeight: 0 }) }}>
      <video ref={ref} autoPlay playsInline muted={muted}
        className="w-full h-full object-cover"
        style={{ display: hasVideo ? 'block' : 'none' }} />
      {!hasVideo && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
            {label[0]?.toUpperCase()}
          </div>
          <p className="text-xs text-white opacity-60">{stream ? 'Camera off' : 'Connecting...'}</p>
        </div>
      )}
      <div className="absolute bottom-2 left-3">
        <span className="text-[10px] font-semibold text-white opacity-70 bg-black bg-opacity-40 px-2 py-0.5 rounded-full">{label}</span>
      </div>
    </div>
  )
}

function CtrlBtn({ onClick, active = false, red = false, title, children }: {
  onClick: () => void; active?: boolean; red?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} title={title}
      className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 hover:scale-105"
      style={{
        background: red ? '#ef4444' : active ? 'rgba(45,212,191,0.25)' : 'rgba(255,255,255,0.12)',
        border: active ? '1.5px solid #2dd4bf' : '1.5px solid rgba(255,255,255,0.15)',
        color: 'white',
      }}>
      {children}
    </button>
  )
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function CallOverlay() {
  const {
    callState, isVideo, remoteUserName, remoteUserId,
    localStream, remoteStream,
    isMuted, isCameraOff, isScreenSharing,
    missedCall, clearMissedCall,
    acceptCall, rejectCall, endCall,
    toggleMute, toggleCamera, toggleScreenShare,
    upgradeBuddyCall,
  } = useCall()

  // Add Person modal state
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [buddies, setBuddies] = useState<ConnectionWithProfile[]>([])
  const [buddySearch, setBuddySearch] = useState('')

  const audioRef = useRef<HTMLAudioElement>(null)
  const [updateTick, forceUpdate] = useState(0)

  // Ringtone: 440+480 Hz telephone ring on receiver's device ('ringing')
  // ringback dial tone on caller's device ('calling').
  // Must resume AudioContext — Chrome suspends it until a user gesture has occurred on the page.
  useEffect(() => {
    if (callState !== 'ringing' && callState !== 'calling') return
    let ctx: AudioContext | null = null
    let stopped = false
    let tid: ReturnType<typeof setTimeout> | null = null
    const activeOscs: OscillatorNode[] = []

    const stopAll = () => {
      if (tid) { clearTimeout(tid); tid = null }
      // Stop all scheduled oscillators immediately (osc.stop(0) overrides their scheduled stop time)
      activeOscs.forEach(osc => { try { osc.stop(0); osc.disconnect() } catch {} })
      activeOscs.length = 0
      ctx?.close().catch(() => {})
    }

    const playBurst = () => {
      if (stopped || !ctx || ctx.state === 'closed') return
      const t = ctx.currentTime
      const dur = callState === 'ringing' ? 1.5 : 1.0
      const gap = callState === 'ringing' ? 2.5 : 4.0

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.3, t + 0.03)
      gain.gain.setValueAtTime(0.3, t + dur - 0.05)
      gain.gain.linearRampToValueAtTime(0, t + dur)
      gain.connect(ctx.destination)

      // Incoming ring: 440+480 Hz blend. Outgoing ringback: 440+480 Hz (standard ringback)
      ;[440, 480].forEach(freq => {
        const osc = ctx!.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.connect(gain)
        osc.start(t)
        osc.stop(t + dur)
        activeOscs.push(osc)
      })

      tid = setTimeout(playBurst, (dur + gap) * 1000)
    }

    const start = async () => {
      try {
        ctx = new AudioContext()
        // Resume is required on receiver side where no prior user gesture exists in this call
        if (ctx.state === 'suspended') await ctx.resume()
        // Cleanup may have run while we were awaiting resume — bail out if so
        if (stopped) { ctx.close().catch(() => {}); return }
        playBurst()
      } catch {}
    }

    start()
    return () => {
      stopped = true
      stopAll()
    }
  }, [callState])

  // Computed here (not inside VideoTile) so forceUpdate re-evaluates them on every addtrack event.
  // readyState check intentionally omitted — remote tracks are 'live' when added but checking it
  // caused the video tile to stay stuck on the avatar when tracks arrived slightly before 'live'.
  const remoteHasVideo = !!remoteStream?.getVideoTracks().some(t => t.readyState !== 'ended')
  const localHasVideo = !isCameraOff && !!localStream?.getVideoTracks().some(t => t.readyState !== 'ended')

  // call duration
  const [duration, setDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // in-call chat
  const [chatOpen, setChatOpen] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [msgText, setMsgText] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)

  const myName = (() => {
    try { return JSON.parse(localStorage.getItem('cs_user') || '{}').displayName || 'You' } catch { return 'You' }
  })()

  // Remote audio
  useEffect(() => {
    if (audioRef.current && remoteStream) audioRef.current.srcObject = remoteStream
  }, [remoteStream, callState])

  // Force re-render when tracks arrive/leave so remoteHasVideo/localHasVideo recompute
  useEffect(() => {
    if (!remoteStream) return
    const refresh = () => forceUpdate(n => n + 1)
    remoteStream.addEventListener('addtrack', refresh)
    remoteStream.addEventListener('removetrack', refresh)
    return () => {
      remoteStream.removeEventListener('addtrack', refresh)
      remoteStream.removeEventListener('removetrack', refresh)
    }
  }, [remoteStream])

  useEffect(() => {
    if (!localStream) return
    const refresh = () => forceUpdate(n => n + 1)
    localStream.addEventListener('addtrack', refresh)
    localStream.addEventListener('removetrack', refresh)
    return () => {
      localStream.removeEventListener('addtrack', refresh)
      localStream.removeEventListener('removetrack', refresh)
    }
  }, [localStream])

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected') {
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      setDuration(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [callState])

  // Load conversation + messages when chat opens
  useEffect(() => {
    if (!chatOpen || !remoteUserId) return
    let cancelled = false

    chatApi.startConversation(remoteUserId)
      .then(res => {
        if (cancelled) return
        const id = res.data.id
        setConvId(id)
        return chatApi.getMessages(id)
      })
      .then(res => {
        if (cancelled || !res) return
        setMessages(res.data)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [chatOpen, remoteUserId])

  // Real-time chat messages via SignalR
  useEffect(() => {
    if (!chatOpen || !convId) return
    const token = localStorage.getItem('cs_token') || ''
    const hub = getChatHub(token)

    const onMsg = (msg: ChatMessage) => {
      if (msg.conversationId === convId) {
        setMessages(prev => [...prev, msg])
        if (!chatOpen) setUnreadCount(n => n + 1)
      }
    }
    hub.on('ReceiveMessage', onMsg)
    return () => hub.off('ReceiveMessage', onMsg)
  }, [chatOpen, convId])

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const sendMessage = async () => {
    if (!msgText.trim() || !convId) return
    const text = msgText.trim()
    setMsgText('')
    try {
      const res = await chatApi.sendMessage(convId, text)
      setMessages(prev => [...prev, res.data])
    } catch {}
  }

  // Load buddies when Add Person modal opens
  useEffect(() => {
    if (!showAddPerson) return
    connectionApi.getConnections()
      .then(res => setBuddies(res.data.filter(c => c.status === 'Accepted')))
      .catch(() => {})
  }, [showAddPerson])

  // Auto-dismiss missed call toast after 8 seconds
  useEffect(() => {
    if (!missedCall) return
    const t = setTimeout(clearMissedCall, 8000)
    return () => clearTimeout(t)
  }, [missedCall])

  if (callState === 'idle') {
    if (!missedCall) return null
    // Missed call toast
    return (
      <div className="fixed top-6 right-6 z-50 flex items-start gap-4 rounded-2xl px-5 py-4 shadow-2xl"
        style={{ background: '#1e1e2e', border: '1px solid rgba(239,68,68,0.4)', minWidth: 300, boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(239,68,68,0.15)' }}>
          <svg viewBox="0 0 24 24" fill="#ef4444" className="w-5 h-5">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-white">Missed {missedCall.isVideo ? 'video' : 'voice'} call</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(239,68,68,0.9)' }}>from {missedCall.callerName}</p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--cs-text-3, #6b7280)' }}>
            {missedCall.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={clearMissedCall} className="text-white opacity-40 hover:opacity-80 mt-0.5">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
    )
  }

  /* ── INCOMING CALL TOAST ─────────────────────────────────────────────────── */
  if (callState === 'ringing') {
    return (
      <div className="fixed top-6 right-6 z-50 flex items-start gap-4 rounded-2xl px-5 py-4 shadow-2xl"
        style={{ background: '#1e1e2e', border: '1px solid rgba(45,212,191,0.3)', minWidth: 300, boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}>
        <div className="relative flex-shrink-0 mt-1">
          <div className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: isVideo ? '#6366f1' : '#0d9488' }} />
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm relative z-10"
            style={{ background: isVideo ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
            {remoteUserName[0]?.toUpperCase()}
          </div>
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-white">{remoteUserName}</p>
          <p className="text-xs mt-0.5" style={{ color: '#2dd4bf' }}>
            Incoming {isVideo ? 'Video' : 'Audio'} Call...
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={acceptCall}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#0d9488,#22c55e)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
              </svg>
              Accept
            </button>
            <button onClick={rejectCall}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition-all active:scale-95"
              style={{ background: '#ef4444' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M20 5.41L18.59 4 12 10.59 5.41 4 4 5.41 10.59 12 4 18.59 5.41 20 12 13.41 18.59 20 20 18.59 13.41 12z" />
              </svg>
              Reject
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── CALLING (waiting for answer) ────────────────────────────────────────── */
  if (callState === 'calling') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full animate-ping opacity-20 scale-150"
              style={{ background: isVideo ? '#6366f1' : '#0d9488' }} />
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl relative z-10"
              style={{ background: isVideo ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
              {remoteUserName[0]?.toUpperCase()}
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-xl">{remoteUserName}</p>
            <p className="text-sm mt-1 animate-pulse" style={{ color: '#2dd4bf' }}>
              Calling {isVideo ? 'video' : 'audio'}...
            </p>
          </div>
          <button onClick={endCall}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white"
            style={{ background: '#ef4444' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.38c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  /* ── CONNECTED ───────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0d0d1a' }}>
      {/* Hidden audio — plays remote audio for both call types */}
      <audio ref={audioRef} autoPlay style={{ display: 'none' }} />

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
          <span className="text-white text-sm font-semibold">{remoteUserName}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: isVideo ? 'rgba(99,102,241,0.25)' : 'rgba(13,148,136,0.25)',
              color: isVideo ? '#818cf8' : '#2dd4bf'
            }}>
            {isVideo ? 'Video Call' : 'Audio Call'}
          </span>
          {isScreenSharing && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24' }}>
              Sharing Screen
            </span>
          )}
          {/* Call duration */}
          <span className="text-xs font-mono text-white opacity-50">{fmt(duration)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Participants count */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white opacity-60"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
            2
          </div>
          <button onClick={endCall}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white"
            style={{ background: '#ef4444' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.38c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
            End Call
          </button>
        </div>
      </div>

      {/* Main content: video + optional chat panel */}
      <div className="flex flex-1 min-h-0">
        {/* Video / audio area */}
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex-1 flex p-4 gap-4 min-h-0 relative">
            {isVideo ? (
              <>
                <VideoTile stream={remoteStream} label={remoteUserName} hasVideo={remoteHasVideo} />
                <div className="absolute bottom-8 right-8">
                  <VideoTile stream={localStream} muted label={myName} small hasVideo={localHasVideo} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-28 h-28 rounded-full flex items-center justify-center text-white font-bold text-4xl"
                  style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', boxShadow: '0 0 0 16px rgba(13,148,136,0.15)' }}>
                  {remoteUserName[0]?.toUpperCase()}
                </div>
                <p className="text-white text-xl font-bold">{remoteUserName}</p>
                <p className="text-sm font-mono" style={{ color: '#2dd4bf' }}>{fmt(duration)}</p>
              </div>
            )}
          </div>

          {/* Mic blocked warning */}
          {!localStream?.getAudioTracks().length && (
            <div className="flex-shrink-0 flex justify-center pb-2">
              <div className="px-4 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ background: 'rgba(239,68,68,0.85)' }}>
                Microphone blocked — others can't hear you
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex-shrink-0 flex items-center justify-center gap-3 py-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}>

            {/* Mute */}
            <CtrlBtn onClick={toggleMute} active={isMuted} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted
                ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" /></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
              }
            </CtrlBtn>

            {/* Camera (video calls only) */}
            {isVideo && (
              <CtrlBtn onClick={toggleCamera} active={isCameraOff} title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}>
                {isCameraOff
                  ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M21 6.5l-4-4-9.96 9.96-2.5-2.46L3.12 11.42l4 3.92L21 6.5zm-11 7.5c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm7.5-3.5L21 14v-4l-3.5 3z" /><path d="M3.27 2L2 3.27l4.22 4.22-3.72 3.73 1.41 1.41 3.73-3.72L21 22.73 22.27 21.46 3.27 2z" /></svg>
                  : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
                }
              </CtrlBtn>
            )}

            {/* Screen share (video calls only) */}
            {isVideo && (
              <CtrlBtn onClick={toggleScreenShare} active={isScreenSharing} title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78.48-4.34 1.71-5.5 3.72.13-1.32.53-4.14 3.53-5.77V8l4 4-2.03 2.47z" />
                </svg>
              </CtrlBtn>
            )}

            {/* Chat */}
            <div className="relative">
              <CtrlBtn onClick={() => { setChatOpen(o => !o); setUnreadCount(0) }} active={chatOpen} title={chatOpen ? 'Close Chat' : 'Open Chat'}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                </svg>
              </CtrlBtn>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center pointer-events-none"
                  style={{ background: '#ef4444', lineHeight: 1 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>

            {/* Add Person (only when connected) */}
            <CtrlBtn onClick={() => setShowAddPerson(true)} active={showAddPerson} title="Add person to call">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </CtrlBtn>

            {/* Fullscreen */}
            <CtrlBtn onClick={toggleFullscreen} active={isFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
              {isFullscreen
                ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
              }
            </CtrlBtn>

            {/* End call */}
            <CtrlBtn onClick={endCall} red title="End Call">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.38c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
              </svg>
            </CtrlBtn>
          </div>
        </div>

        {/* Add Person modal */}
        {showAddPerson && (
          <div className="absolute inset-0 z-20 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="rounded-2xl p-5 w-80"
              style={{ background: '#1e1e2e', border: '1px solid rgba(45,212,191,0.3)', boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-sm text-white">Add a buddy to this call</p>
                <button onClick={() => { setShowAddPerson(false); setBuddySearch('') }}
                  className="text-white opacity-50 hover:opacity-100">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
              <input value={buddySearch} onChange={e => setBuddySearch(e.target.value)}
                placeholder="Search buddies..."
                className="w-full text-xs text-white bg-transparent border rounded-full px-3 py-1.5 outline-none mb-3"
                style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                {buddies
                  .filter(b => !buddySearch || b.name.toLowerCase().includes(buddySearch.toLowerCase()))
                  .map(b => (
                    <button key={b.userId} onClick={() => {
                      upgradeBuddyCall(b.userId)
                      setShowAddPerson(false)
                      setBuddySearch('')
                    }}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white hover:bg-opacity-5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
                        {b.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-white">{b.name}</span>
                    </button>
                  ))}
                {buddies.length === 0 && (
                  <p className="text-center text-xs text-white opacity-40 py-3">No buddies found</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat panel */}
        {chatOpen && (
          <div className="flex-shrink-0 flex flex-col w-80 border-l"
            style={{ background: '#0f0f1e', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <span className="text-white text-sm font-semibold">In-call chat</span>
              <button onClick={() => setChatOpen(false)}
                className="text-white opacity-50 hover:opacity-100 transition-opacity">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
              {messages.length === 0 && (
                <p className="text-center text-xs text-white opacity-30 mt-4">No messages yet</p>
              )}
              {messages.map(m => {
                const isMe = m.senderId !== remoteUserId
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="max-w-[90%] px-3 py-1.5 rounded-2xl text-xs text-white break-words"
                      style={{
                        background: isMe ? 'linear-gradient(135deg,#0d9488,#0ea5e9)' : 'rgba(255,255,255,0.1)',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      }}>
                      {m.text}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-3 border-t"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <input
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 text-xs text-white bg-transparent border rounded-full px-3 py-1.5 outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
              />
              <button onClick={sendMessage} disabled={!msgText.trim()}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-opacity"
                style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
