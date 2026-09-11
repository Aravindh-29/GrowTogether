import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { getChatHub } from '../api/chatApi'

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected'

export interface MissedCall {
  callerName: string
  isVideo: boolean
  at: Date
}

interface CallCtx {
  callState: CallState
  isVideo: boolean
  remoteUserId: string | null
  remoteUserName: string
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  missedCall: MissedCall | null
  startCall: (targetUserId: string, targetName: string, video: boolean) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => void
  endCall: () => void
  toggleMute: () => void
  toggleCamera: () => void | Promise<void>
  toggleScreenShare: () => Promise<void>
  clearMissedCall: () => void
  upgradeBuddyCall: (inviteeUserId: string) => void
}

const CallContext = createContext<CallCtx | null>(null)
export const useCall = () => useContext(CallContext)!

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export function CallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState]           = useState<CallState>('idle')
  const [isVideo, setIsVideo]               = useState(false)
  const [remoteUserId, setRemoteUserId]     = useState<string | null>(null)
  const [remoteUserName, setRemoteUserName] = useState('')
  const [localStream, setLocalStream]       = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream]     = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted]               = useState(false)
  const [isCameraOff, setIsCameraOff]       = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [missedCall, setMissedCall]         = useState<MissedCall | null>(null)

  const pcRef             = useRef<RTCPeerConnection | null>(null)
  const localRef          = useRef<MediaStream | null>(null)
  const screenTrackRef    = useRef<MediaStreamTrack | null>(null)
  const remoteIdRef       = useRef<string | null>(null)
  const isVideoRef        = useRef(false)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
  // Stores the in-progress pre-warm getUserMedia Promise so acceptCall() can await it
  const prewarmRef        = useRef<Promise<MediaStream | null> | null>(null)
  // Refs for values needed inside stale SignalR closures
  const callStateRef      = useRef<CallState>('idle')
  const remoteNameRef     = useRef('')
  const isVideoCallRef    = useRef(false)

  useEffect(() => { remoteIdRef.current = remoteUserId }, [remoteUserId])
  useEffect(() => { isVideoRef.current = isVideo }, [isVideo])
  useEffect(() => { callStateRef.current = callState }, [callState])
  useEffect(() => { remoteNameRef.current = remoteUserName }, [remoteUserName])
  useEffect(() => { isVideoCallRef.current = isVideo }, [isVideo])

  const hub = () => {
    const token = localStorage.getItem('cs_token') || ''
    return getChatHub(token)
  }

  const myName = () => {
    try { return JSON.parse(localStorage.getItem('cs_user') || '{}').displayName || 'User' } catch { return 'User' }
  }

  const createPC = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = e => {
      if (e.candidate && remoteIdRef.current) {
        hub().invoke('SendIceCandidate', remoteIdRef.current, JSON.stringify(e.candidate))
          .catch(() => {})
      }
    }

    const rs = new MediaStream()
    setRemoteStream(rs)
    pc.ontrack = e => { rs.addTrack(e.track) }

    pcRef.current = pc
    return pc
  }

  const getMedia = async (video: boolean) => {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    } catch (err) {
      if (video) {
        // Camera blocked or unavailable — fall back to audio-only so mic still works
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      } else {
        throw err
      }
    }
    localRef.current = stream
    setLocalStream(stream)
    return stream
  }

  const cleanUp = () => {
    callStateRef.current = 'idle'
    remoteNameRef.current = ''
    // Stop any in-flight pre-warm stream to release mic/camera
    prewarmRef.current
      ?.then(s => { if (s && s !== localRef.current) s.getTracks().forEach(t => t.stop()) })
      .catch(() => {})
    prewarmRef.current = null

    // Stop all tracks being transmitted before closing the PC
    pcRef.current?.getSenders().forEach(s => s.track?.stop())
    pcRef.current?.close()
    pcRef.current = null
    localRef.current?.getTracks().forEach(t => t.stop())
    localRef.current = null
    screenTrackRef.current?.stop()
    screenTrackRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setCallState('idle')
    setRemoteUserId(null)
    setRemoteUserName('')
    setIsMuted(false)
    setIsCameraOff(false)
    setIsScreenSharing(false)
    pendingCandidates.current = []
  }

  // ── SignalR listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('cs_token') || ''
    if (!token) return
    const h = getChatHub(token)

    const onIncomingCall = (data: { callerId: string; callerName: string; isVideo: boolean }) => {
      if (callStateRef.current !== 'idle') {
        h.invoke('RejectCall', data.callerId).catch(() => {})
        return
      }
      // Update refs immediately — don't wait for useEffect so onCallEnded
      // always sees 'ringing' even if the caller cancels before React re-renders.
      callStateRef.current = 'ringing'
      remoteNameRef.current = data.callerName
      isVideoCallRef.current = data.isVideo
      remoteIdRef.current = data.callerId
      setRemoteUserId(data.callerId)
      setRemoteUserName(data.callerName)
      setIsVideo(data.isVideo)
      setCallState('ringing')
      // Start pre-warming media immediately so the permission prompt shows during ringing.
      // Store as a Promise — acceptCall() will await it to avoid the race condition where
      // two getUserMedia calls overlap and localRef ends up pointing to the wrong stream.
      // If video+audio fails (camera blocked), fall back to audio-only.
      prewarmRef.current = navigator.mediaDevices
        .getUserMedia({ audio: true, video: data.isVideo })
        .catch(() =>
          data.isVideo
            ? navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => null)
            : null
        )
    }

    const onCallAccepted = async () => {
      try {
        let stream: MediaStream | null = null
        try {
          stream = await getMedia(isVideoRef.current)
        } catch (mediaErr) {
          console.warn('Caller media not available:', mediaErr)
        }
        const pc = createPC()
        if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream!))
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: isVideoRef.current,
        })
        await pc.setLocalDescription(offer)
        await h.invoke('SendOffer', remoteIdRef.current!, JSON.stringify(offer))
        setCallState('connected')
      } catch (err) {
        console.error('onCallAccepted failed:', err)
        cleanUp()
      }
    }

    const onReceiveOffer = async (data: { sdp: string }) => {
      try {
        const pc = pcRef.current
        if (!pc) return
        const offer: RTCSessionDescriptionInit = JSON.parse(data.sdp)
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        for (const c of pendingCandidates.current) await pc.addIceCandidate(new RTCIceCandidate(c))
        pendingCandidates.current = []
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await h.invoke('SendAnswer', remoteIdRef.current!, JSON.stringify(answer))
      } catch (err) {
        console.error('onReceiveOffer error:', err)
      }
    }

    const onReceiveAnswer = async (data: { sdp: string }) => {
      const answer: RTCSessionDescriptionInit = JSON.parse(data.sdp)
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer))
      for (const c of pendingCandidates.current) await pcRef.current?.addIceCandidate(new RTCIceCandidate(c))
      pendingCandidates.current = []
    }

    const onReceiveIceCandidate = async (data: { candidate: string }) => {
      const cand: RTCIceCandidateInit = JSON.parse(data.candidate)
      if (pcRef.current?.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(cand))
      } else {
        pendingCandidates.current.push(cand)
      }
    }

    const onCallRejected = () => { cleanUp() }
    const onCallEnded    = () => {
      // If CallEnded arrives while we were still ringing → the caller hung up = missed call
      if (callStateRef.current === 'ringing') {
        const name = remoteNameRef.current
        const video = isVideoCallRef.current
        const callerId = remoteIdRef.current || ''

        // Persist to localStorage so Notifications page can show it
        try {
          const stored = JSON.parse(localStorage.getItem('cs_missed_calls') || '[]')
          stored.unshift({ callerName: name, callerUserId: callerId, isVideo: video, at: new Date().toISOString() })
          localStorage.setItem('cs_missed_calls', JSON.stringify(stored.slice(0, 50)))
          window.dispatchEvent(new CustomEvent('cs-missed-call-saved'))
        } catch { /* ignore */ }

        setMissedCall({ callerName: name, isVideo: video, at: new Date() })
      }
      cleanUp()
    }

    // When an "Add Person" upgrade is accepted by backend: end buddy call and join group call
    const onUpgradeToGroupCall = (data: { tempGroupId: string; isVideo: boolean }) => {
      const { tempGroupId, isVideo: vid } = data
      cleanUp()
      window.dispatchEvent(new CustomEvent('cs-join-group-call', {
        detail: { groupId: tempGroupId, isVideo: vid, groupName: 'Group Call' }
      }))
    }

    h.on('IncomingCall',        onIncomingCall)
    h.on('CallAccepted',        onCallAccepted)
    h.on('ReceiveOffer',        onReceiveOffer)
    h.on('ReceiveAnswer',       onReceiveAnswer)
    h.on('ReceiveIceCandidate', onReceiveIceCandidate)
    h.on('CallRejected',        onCallRejected)
    h.on('CallEnded',           onCallEnded)
    h.on('UpgradeToGroupCall',  onUpgradeToGroupCall)

    if (h.state === 'Disconnected') h.start().catch(() => {})

    return () => {
      h.off('IncomingCall',        onIncomingCall)
      h.off('CallAccepted',        onCallAccepted)
      h.off('ReceiveOffer',        onReceiveOffer)
      h.off('ReceiveAnswer',       onReceiveAnswer)
      h.off('ReceiveIceCandidate', onReceiveIceCandidate)
      h.off('CallRejected',        onCallRejected)
      h.off('CallEnded',           onCallEnded)
      h.off('UpgradeToGroupCall',  onUpgradeToGroupCall)
    }
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────

  const startCall = async (targetUserId: string, targetName: string, video: boolean) => {
    setRemoteUserId(targetUserId)
    setRemoteUserName(targetName)
    setIsVideo(video)
    setCallState('calling')
    await hub().invoke('InitiateCall', targetUserId, video, myName())
  }

  const acceptCall = async () => {
    try {
      let stream: MediaStream | null = null

      // Await the pre-warmed stream (started in onIncomingCall).
      // This avoids a race condition where two concurrent getUserMedia calls produce
      // two different streams — only one ends up in the PC, but localRef points to the other.
      if (prewarmRef.current) {
        stream = await prewarmRef.current
        prewarmRef.current = null
      }

      if (!stream) {
        // Pre-warm failed or wasn't started — try directly
        try {
          stream = await getMedia(isVideoRef.current)
        } catch (mediaErr) {
          console.warn('Media not available (permission denied):', mediaErr)
        }
      } else {
        // Stream came from pre-warm — sync to state/ref
        localRef.current = stream
        setLocalStream(stream)
      }

      const pc = createPC()
      if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream!))
      setCallState('connected')
      await hub().invoke('AcceptCall', remoteIdRef.current!)
    } catch (err) {
      console.error('acceptCall failed:', err)
      cleanUp()
    }
  }

  const rejectCall = () => {
    // Stop the pre-warmed stream to release mic/camera
    prewarmRef.current?.then(s => s?.getTracks().forEach(t => t.stop())).catch(() => {})
    prewarmRef.current = null
    hub().invoke('RejectCall', remoteIdRef.current!).catch(() => {})
    cleanUp()
  }

  const endCall = () => {
    if (remoteIdRef.current) hub().invoke('EndCall', remoteIdRef.current).catch(() => {})
    cleanUp()
  }

  // Toggle mute via PC senders so we always affect the tracks actually being transmitted,
  // regardless of what localRef points to.
  const toggleMute = () => {
    const newMuted = !isMuted
    pcRef.current?.getSenders().forEach(s => {
      if (s.track?.kind === 'audio') s.track.enabled = !newMuted
    })
    localRef.current?.getAudioTracks().forEach(t => { t.enabled = !newMuted })
    setIsMuted(newMuted)
  }

  const toggleCamera = async () => {
    const videoTracks = localRef.current?.getVideoTracks() ?? []
    const pc = pcRef.current
    if (videoTracks.length > 0) {
      // Turn OFF: replace PC senders with null, then stop track (releases LED)
      if (pc) {
        pc.getSenders().forEach(s => {
          if (s.track?.kind === 'video') s.replaceTrack(null).catch(() => {})
        })
      }
      videoTracks.forEach(t => { t.stop(); localRef.current?.removeTrack(t) })
      setIsCameraOff(true)
    } else {
      // Turn ON: get new camera and resume
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const camTrack = camStream.getVideoTracks()[0]
        if (!camTrack) return
        if (!localRef.current) { camTrack.stop(); return }
        localRef.current.addTrack(camTrack)
        if (pc) {
          const nullSender = pc.getSenders().find(s => s.track === null)
          if (nullSender) {
            nullSender.replaceTrack(camTrack).catch(() => {})
          } else {
            pc.addTrack(camTrack, localRef.current ?? new MediaStream())
          }
        }
        setIsCameraOff(false)
      } catch { /* denied */ }
    }
  }

  const toggleScreenShare = async () => {
    const pc = pcRef.current
    if (!pc) return

    if (isScreenSharing) {
      screenTrackRef.current?.stop()
      screenTrackRef.current = null
      if (localRef.current) {
        const camTrack = localRef.current.getVideoTracks()[0]
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender && camTrack) await sender.replaceTrack(camTrack)
      }
      setIsScreenSharing(false)
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        const screenTrack = screen.getVideoTracks()[0]
        screenTrackRef.current = screenTrack
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(screenTrack)
        } else {
          // Audio call: add track and renegotiate so the peer gets the video
          const fakeStream = new MediaStream([screenTrack])
          pc.addTrack(screenTrack, fakeStream)
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            hub().invoke('SendOffer', remoteIdRef.current!, JSON.stringify(offer)).catch(() => {})
          } catch (err) { console.error('Screen-share renegotiation error:', err) }
        }
        screenTrack.onended = () => { setIsScreenSharing(false); screenTrackRef.current = null }
        setIsScreenSharing(true)
      } catch { /* user cancelled or denied */ }
    }
  }

  const clearMissedCall = () => setMissedCall(null)

  // Invite a buddy into the current 1-to-1 call, upgrading it to a group call
  const upgradeBuddyCall = (inviteeUserId: string) => {
    if (!remoteIdRef.current) return
    const vid = isVideoRef.current
    try {
      const me = JSON.parse(localStorage.getItem('cs_user') || '{}')
      const displayName: string = me.displayName || 'User'
      hub().invoke('UpgradeBuddyCallToGroup', remoteIdRef.current, inviteeUserId, displayName, vid).catch(() => {})
    } catch { /* ignore */ }
  }

  return (
    <CallContext.Provider value={{
      callState, isVideo, remoteUserId, remoteUserName,
      localStream, remoteStream,
      isMuted, isCameraOff, isScreenSharing,
      missedCall, clearMissedCall,
      startCall, acceptCall, rejectCall, endCall,
      toggleMute, toggleCamera, toggleScreenShare,
      upgradeBuddyCall,
    }}>
      {children}
    </CallContext.Provider>
  )
}
