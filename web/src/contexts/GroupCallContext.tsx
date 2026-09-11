import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { getChatHub } from '../api/chatApi'

export interface GroupCallParticipant {
  userId: string
  name: string
  stream: MediaStream | null
  audioMuted: boolean
  videoMuted: boolean
  handRaised: boolean
}

export type GroupCallStatus = 'idle' | 'incoming' | 'active'
export type GroupCallLayout = 'tiled' | 'spotlight' | 'sidebar'

export interface CallChatMessage {
  id: string
  userId: string
  name: string
  message: string
  timestamp: string
}

export interface CallReaction {
  id: string
  userId: string
  name: string
  emoji: string
}

interface GroupCallCtx {
  status: GroupCallStatus
  groupId: string | null
  groupName: string
  isVideo: boolean
  callerName: string
  participants: GroupCallParticipant[]
  localStream: MediaStream | null
  screenStream: MediaStream | null
  localAudioMuted: boolean
  localVideoMuted: boolean
  isScreenSharing: boolean
  isOwnerOrAdmin: boolean
  isCallHost: boolean
  isLocked: boolean
  myHandRaised: boolean
  raisedHands: Set<string>
  reactions: CallReaction[]
  callMessages: CallChatMessage[]
  unreadChatCount: number
  pinnedParticipant: string | null
  layout: GroupCallLayout
  speakingParticipants: Set<string>

  startGroupCall(groupId: string, groupName: string, isVideo: boolean, amIOwnerOrAdmin: boolean): void
  joinGroupCall(): void
  joinActiveGroupCall(groupId: string, groupName: string, isVideo: boolean): void
  declineGroupCall(): void
  leaveGroupCall(): void
  toggleLocalAudio(): void
  toggleLocalVideo(): void | Promise<void>
  toggleScreenShare(): void
  muteParticipant(userId: string): void
  muteAll(): void
  removeParticipant(userId: string): void
  lockCall(): void
  unlockCall(): void
  raiseHand(): void
  lowerHand(): void
  lowerParticipantHand(userId: string): void
  sendReaction(emoji: string): void
  sendCallMessage(text: string): void
  pinParticipant(userId: string | null): void
  setLayout(layout: GroupCallLayout): void
  markChatRead(): void
  upgradeBuddyCall(otherUserId: string, inviteeUserId: string): void
  endCallForAll(): void
  groupCallActiveMap: Record<string, boolean>
}

const GroupCallContext = createContext<GroupCallCtx | null>(null)
export const useGroupCall = () => useContext(GroupCallContext)!

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export function GroupCallProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GroupCallStatus>('idle')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [isVideo, setIsVideo] = useState(false)
  const [callerName, setCallerName] = useState('')
  const [participants, setParticipants] = useState<GroupCallParticipant[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [localAudioMuted, setLocalAudioMuted] = useState(false)
  const [localVideoMuted, setLocalVideoMuted] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false)
  const [isCallHost, setIsCallHost] = useState(false)
  const [groupCallActiveMap, setGroupCallActiveMap] = useState<Record<string, boolean>>({})
  const [isLocked, setIsLocked] = useState(false)
  const [myHandRaised, setMyHandRaised] = useState(false)
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set())
  const [reactions, setReactions] = useState<CallReaction[]>([])
  const [callMessages, setCallMessages] = useState<CallChatMessage[]>([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null)
  const [layout, setLayoutState] = useState<GroupCallLayout>('tiled')
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set())

  // Stale-closure-safe refs
  const statusRef = useRef<GroupCallStatus>('idle')
  const groupIdRef = useRef<string | null>(null)
  const isVideoRef = useRef(false)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenTrackRef = useRef<MediaStreamTrack | null>(null)
  const peerConnections = useRef(new Map<string, RTCPeerConnection>())
  const remoteStreams = useRef(new Map<string, MediaStream>())
  const participantNames = useRef(new Map<string, string>())
  const mutedParticipants = useRef(new Set<string>())
  const videoMutedParticipants = useRef(new Set<string>())
  const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>())
  const audioMonitors = useRef(new Map<string, () => void>())
  const chatOpenRef = useRef(false)
  // Used to abort in-flight getUserMedia if cleanup runs before the promise resolves
  const mediaAbortRef = useRef(false)

  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { groupIdRef.current = groupId }, [groupId])
  useEffect(() => { isVideoRef.current = isVideo }, [isVideo])

  const getHub = () => getChatHub(localStorage.getItem('cs_token') || '')
  const getMe = () => {
    try { return JSON.parse(localStorage.getItem('cs_user') || '{}') } catch { return {} }
  }

  // Audio level monitoring for speaking indicators
  const setupAudioMonitor = (userId: string, stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      let speaking = false
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        const isSpeaking = avg > 12
        if (isSpeaking !== speaking) {
          speaking = isSpeaking
          setSpeakingParticipants(prev => {
            const next = new Set(prev)
            if (isSpeaking) next.add(userId)
            else next.delete(userId)
            return next
          })
        }
      }, 150)
      const cleanup = () => { clearInterval(interval); audioCtx.close().catch(() => {}) }
      audioMonitors.current.set(userId, cleanup)
    } catch { /* audio monitoring not critical */ }
  }

  const updateParticipantsState = () => {
    setParticipants(
      Array.from(participantNames.current.entries()).map(([uid, name]) => ({
        userId: uid,
        name,
        stream: remoteStreams.current.get(uid) ?? null,
        audioMuted: mutedParticipants.current.has(uid),
        videoMuted: videoMutedParticipants.current.has(uid),
        handRaised: false, // kept via raisedHands state separately
      }))
    )
  }

  const createPC = (peerId: string): RTCPeerConnection => {
    const existing = peerConnections.current.get(peerId)
    if (existing) { existing.close(); peerConnections.current.delete(peerId) }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = (e) => {
      if (e.candidate && groupIdRef.current)
        getHub().invoke('SendGroupIceCandidate', groupIdRef.current, peerId, JSON.stringify(e.candidate)).catch(() => {})
    }

    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track])
      remoteStreams.current.set(peerId, stream)
      updateParticipantsState()
      // Start audio monitoring for this participant
      if (!audioMonitors.current.has(peerId))
        setupAudioMonitor(peerId, stream)
      // Track video mute state: replaceTrack(null) on sender fires mute/unmute here
      if (e.track.kind === 'video') {
        e.track.onmute = () => {
          videoMutedParticipants.current.add(peerId)
          updateParticipantsState()
        }
        e.track.onunmute = () => {
          videoMutedParticipants.current.delete(peerId)
          updateParticipantsState()
        }
      }
    }

    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!))
    peerConnections.current.set(peerId, pc)
    return pc
  }

  const flushPendingCandidates = async (pc: RTCPeerConnection, peerId: string) => {
    const pending = pendingCandidates.current.get(peerId) ?? []
    pendingCandidates.current.delete(peerId)
    for (const c of pending)
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch { /* ignore */ }
  }

  // Creates a new offer for an existing peer connection (mid-call track additions)
  const renegotiateWithPeer = async (peerId: string) => {
    const pc = peerConnections.current.get(peerId)
    if (!pc || pc.signalingState === 'closed') return
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      getHub().invoke('SendGroupOffer', groupIdRef.current, peerId, JSON.stringify(offer)).catch(() => {})
    } catch (err) { console.error('Renegotiation error:', err) }
  }

  const cleanupCall = () => {
    mediaAbortRef.current = true  // abort any in-flight getUserMedia
    // Stop sender tracks BEFORE closing (catches tracks not in localStreamRef due to race)
    peerConnections.current.forEach(pc => {
      pc.getSenders().forEach(s => { if (s.track) s.track.stop() })
      pc.close()
    })
    peerConnections.current.clear()
    remoteStreams.current.clear()
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    if (screenTrackRef.current) { screenTrackRef.current.stop(); screenTrackRef.current = null }
    audioMonitors.current.forEach(cleanup => cleanup())
    audioMonitors.current.clear()
    participantNames.current.clear()
    mutedParticipants.current.clear()
    videoMutedParticipants.current.clear()
    pendingCandidates.current.clear()
    chatOpenRef.current = false
    statusRef.current = 'idle'
    groupIdRef.current = null
    isVideoRef.current = false
    setStatus('idle')
    setGroupId(null)
    setGroupName('')
    setIsVideo(false)
    setCallerName('')
    setParticipants([])
    setLocalStream(null)
    setScreenStream(null)
    setLocalAudioMuted(false)
    setLocalVideoMuted(false)
    setIsScreenSharing(false)
    setIsOwnerOrAdmin(false)
    setIsCallHost(false)
    setIsLocked(false)
    setMyHandRaised(false)
    setRaisedHands(new Set())
    setReactions([])
    setCallMessages([])
    setUnreadChatCount(0)
    setPinnedParticipant(null)
    setLayoutState('tiled')
    setSpeakingParticipants(new Set())
  }

  // ── SignalR event handlers (registered once on mount) ─────────────────────
  useEffect(() => {
    const token = localStorage.getItem('cs_token') || ''
    if (!token) return
    const h = getChatHub(token)

    const onIncomingGroupCall = (data: { callerId: string; callerName: string; groupId: string; groupName?: string; isVideo: boolean }) => {
      // Track that this group has an active call (for Join button)
      setGroupCallActiveMap(prev => ({ ...prev, [data.groupId]: true }))
      if (statusRef.current !== 'idle') return
      statusRef.current = 'incoming'
      groupIdRef.current = data.groupId
      isVideoRef.current = data.isVideo
      setStatus('incoming')
      setGroupId(data.groupId)
      setGroupName(data.groupName ?? '')
      setIsVideo(data.isVideo)
      setCallerName(data.callerName)
    }

    const onGroupCallParticipantList = async (data: { groupId: string; participants: Array<{ userId: string; name: string }>; isHost?: boolean }) => {
      if (data.groupId !== groupIdRef.current) return
      if (data.isHost) setIsCallHost(true)
      for (const p of data.participants) {
        participantNames.current.set(p.userId, p.name)
        const pc = createPC(p.userId)
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: isVideoRef.current })
          await pc.setLocalDescription(offer)
          getHub().invoke('SendGroupOffer', data.groupId, p.userId, JSON.stringify(offer)).catch(() => {})
        } catch (err) { console.error('Error creating group offer:', err) }
      }
      updateParticipantsState()
    }

    const onGroupCallParticipantJoined = (data: { groupId: string; participantId: string; participantName: string }) => {
      if (data.groupId !== groupIdRef.current) return
      participantNames.current.set(data.participantId, data.participantName)
      updateParticipantsState()
    }

    const onGroupCallParticipantLeft = (data: { groupId: string; participantId: string }) => {
      if (data.groupId !== groupIdRef.current) return
      const pc = peerConnections.current.get(data.participantId)
      if (pc) { pc.close(); peerConnections.current.delete(data.participantId) }
      remoteStreams.current.delete(data.participantId)
      participantNames.current.delete(data.participantId)
      mutedParticipants.current.delete(data.participantId)
      videoMutedParticipants.current.delete(data.participantId)
      pendingCandidates.current.delete(data.participantId)
      const cleanup = audioMonitors.current.get(data.participantId)
      if (cleanup) { cleanup(); audioMonitors.current.delete(data.participantId) }
      setRaisedHands(prev => { const n = new Set(prev); n.delete(data.participantId); return n })
      setSpeakingParticipants(prev => { const n = new Set(prev); n.delete(data.participantId); return n })
      updateParticipantsState()
    }

    const onReceiveGroupOffer = async (data: { groupId: string; senderId: string; sdp: string }) => {
      if (data.groupId !== groupIdRef.current) return
      const existingPc = peerConnections.current.get(data.senderId)
      // If a PC already exists and is open, treat as renegotiation (e.g., peer added camera)
      if (existingPc && existingPc.signalingState !== 'closed') {
        try {
          await existingPc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.sdp)))
          const answer = await existingPc.createAnswer()
          await existingPc.setLocalDescription(answer)
          getHub().invoke('SendGroupAnswer', data.groupId, data.senderId, JSON.stringify(answer)).catch(() => {})
        } catch (err) { console.error('Renegotiation offer error:', err) }
        return
      }
      // New peer connection
      if (!participantNames.current.has(data.senderId))
        participantNames.current.set(data.senderId, 'Participant')
      try {
        const pc = createPC(data.senderId)
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.sdp)))
        await flushPendingCandidates(pc, data.senderId)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        getHub().invoke('SendGroupAnswer', data.groupId, data.senderId, JSON.stringify(answer)).catch(() => {})
        updateParticipantsState()
      } catch (err) { console.error('Group offer handling error:', err) }
    }

    const onReceiveGroupAnswer = async (data: { groupId: string; senderId: string; sdp: string }) => {
      if (data.groupId !== groupIdRef.current) return
      const pc = peerConnections.current.get(data.senderId)
      if (!pc) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.sdp)))
        await flushPendingCandidates(pc, data.senderId)
      } catch (err) { console.error('Group answer handling error:', err) }
    }

    const onReceiveGroupIceCandidate = async (data: { groupId: string; senderId: string; candidate: string }) => {
      if (data.groupId !== groupIdRef.current) return
      const pc = peerConnections.current.get(data.senderId)
      const cand: RTCIceCandidateInit = JSON.parse(data.candidate)
      if (pc?.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(cand)) } catch { /* ignore */ }
      } else {
        const list = pendingCandidates.current.get(data.senderId) ?? []
        list.push(cand)
        pendingCandidates.current.set(data.senderId, list)
      }
    }

    const onGroupCallMuteRequested = (data: { groupId: string }) => {
      if (data.groupId !== groupIdRef.current) return
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false })
      setLocalAudioMuted(true)
    }

    const onGroupCallLocked = (data: { groupId: string }) => {
      if (data.groupId !== groupIdRef.current) return
      setIsLocked(true)
    }

    const onGroupCallUnlocked = (data: { groupId: string }) => {
      if (data.groupId !== groupIdRef.current) return
      setIsLocked(false)
    }

    const onGroupCallVideoMuteChanged = (data: { groupId: string; userId: string; muted: boolean }) => {
      if (data.groupId !== groupIdRef.current) return
      if (data.muted) videoMutedParticipants.current.add(data.userId)
      else videoMutedParticipants.current.delete(data.userId)
      updateParticipantsState()
    }

    const onGroupCallHandRaised = (data: { groupId: string; userId: string }) => {
      if (data.groupId !== groupIdRef.current) return
      setRaisedHands(prev => new Set([...prev, data.userId]))
    }

    const onGroupCallHandLowered = (data: { groupId: string; userId: string }) => {
      if (data.groupId !== groupIdRef.current) return
      setRaisedHands(prev => { const n = new Set(prev); n.delete(data.userId); return n })
    }

    const onGroupCallReaction = (data: { groupId: string; userId: string; name: string; emoji: string }) => {
      if (data.groupId !== groupIdRef.current) return
      const id = Math.random().toString(36).slice(2)
      setReactions(prev => [...prev, { id, userId: data.userId, name: data.name, emoji: data.emoji }])
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 4000)
    }

    const onGroupCallChatMessage = (data: { groupId: string; userId: string; name: string; message: string; timestamp: string }) => {
      if (data.groupId !== groupIdRef.current) return
      const id = Math.random().toString(36).slice(2)
      setCallMessages(prev => [...prev, { id, userId: data.userId, name: data.name, message: data.message, timestamp: data.timestamp }])
      if (!chatOpenRef.current) setUnreadChatCount(n => n + 1)
    }

    const onRemovedFromGroupCall = (data: { groupId: string }) => {
      if (data.groupId !== groupIdRef.current) return
      cleanupCall()
      window.dispatchEvent(new CustomEvent('cs-removed-from-call'))
    }

    const onGroupCallJoinDenied = (data: { groupId: string; reason: string }) => {
      if (data.groupId !== groupIdRef.current) return
      cleanupCall()
      if (data.reason === 'locked')
        window.dispatchEvent(new CustomEvent('cs-call-join-denied', { detail: { reason: 'This call is locked by the host' } }))
    }

    // Call was ended for all participants by the host, or last person left — dismiss call UI
    const onGroupCallEndedForAll = (data: { groupId: string }) => {
      if (data.groupId !== groupIdRef.current) return
      cleanupCall()
    }

    // A group call ended — update the active-call map so Join buttons hide
    const onGroupCallEnded = (data: { groupId: string }) => {
      setGroupCallActiveMap(prev => ({ ...prev, [data.groupId]: false }))
      // If we're in this call, also dismiss the call UI
      if (data.groupId === groupIdRef.current && statusRef.current === 'active')
        cleanupCall()
    }

    h.on('IncomingGroupCall', onIncomingGroupCall)
    h.on('GroupCallParticipantList', onGroupCallParticipantList)
    h.on('GroupCallParticipantJoined', onGroupCallParticipantJoined)
    h.on('GroupCallParticipantLeft', onGroupCallParticipantLeft)
    h.on('ReceiveGroupOffer', onReceiveGroupOffer)
    h.on('ReceiveGroupAnswer', onReceiveGroupAnswer)
    h.on('ReceiveGroupIceCandidate', onReceiveGroupIceCandidate)
    h.on('GroupCallMuteRequested', onGroupCallMuteRequested)
    h.on('GroupCallLocked', onGroupCallLocked)
    h.on('GroupCallUnlocked', onGroupCallUnlocked)
    h.on('GroupCallVideoMuteChanged', onGroupCallVideoMuteChanged)
    h.on('GroupCallHandRaised', onGroupCallHandRaised)
    h.on('GroupCallHandLowered', onGroupCallHandLowered)
    h.on('GroupCallReaction', onGroupCallReaction)
    h.on('GroupCallChatMessage', onGroupCallChatMessage)
    h.on('RemovedFromGroupCall', onRemovedFromGroupCall)
    h.on('GroupCallJoinDenied', onGroupCallJoinDenied)
    h.on('GroupCallEndedForAll', onGroupCallEndedForAll)
    h.on('GroupCallEnded', onGroupCallEnded)

    if (h.state === 'Disconnected') h.start().catch(() => {})

    return () => {
      h.off('IncomingGroupCall', onIncomingGroupCall)
      h.off('GroupCallParticipantList', onGroupCallParticipantList)
      h.off('GroupCallParticipantJoined', onGroupCallParticipantJoined)
      h.off('GroupCallParticipantLeft', onGroupCallParticipantLeft)
      h.off('ReceiveGroupOffer', onReceiveGroupOffer)
      h.off('ReceiveGroupAnswer', onReceiveGroupAnswer)
      h.off('ReceiveGroupIceCandidate', onReceiveGroupIceCandidate)
      h.off('GroupCallMuteRequested', onGroupCallMuteRequested)
      h.off('GroupCallLocked', onGroupCallLocked)
      h.off('GroupCallUnlocked', onGroupCallUnlocked)
      h.off('GroupCallVideoMuteChanged', onGroupCallVideoMuteChanged)
      h.off('GroupCallHandRaised', onGroupCallHandRaised)
      h.off('GroupCallHandLowered', onGroupCallHandLowered)
      h.off('GroupCallReaction', onGroupCallReaction)
      h.off('GroupCallChatMessage', onGroupCallChatMessage)
      h.off('RemovedFromGroupCall', onRemovedFromGroupCall)
      h.off('GroupCallJoinDenied', onGroupCallJoinDenied)
      h.off('GroupCallEndedForAll', onGroupCallEndedForAll)
      h.off('GroupCallEnded', onGroupCallEnded)
    }
  }, [])

  // Listen for buddy-call upgrade events dispatched by CallContext
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (statusRef.current !== 'idle') return
      const { groupId: gId, isVideo: vid, groupName: gName } = e.detail as { groupId: string; isVideo: boolean; groupName: string }
      const me = getMe()
      const myDisplayName: string = me.displayName || 'User'
      mediaAbortRef.current = false
      navigator.mediaDevices.getUserMedia({ video: vid, audio: true })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: false, audio: true }))
        .then(stream => {
          if (mediaAbortRef.current) { stream.getTracks().forEach(t => t.stop()); return }
          localStreamRef.current = stream
          setLocalStream(stream)
          groupIdRef.current = gId
          isVideoRef.current = vid
          setGroupId(gId)
          setGroupName(gName || 'Group Call')
          setIsVideo(vid)
          setIsOwnerOrAdmin(false)
          statusRef.current = 'active'
          setStatus('active')
          getHub().invoke('JoinGroupCall', gId, myDisplayName).catch(() => {})
        })
        .catch(() => {})
    }
    window.addEventListener('cs-join-group-call', handler as EventListener)
    return () => window.removeEventListener('cs-join-group-call', handler as EventListener)
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────

  const _getMediaAndJoin = (gId: string, gName: string, vid: boolean, ownerAdmin: boolean, isInitiator: boolean) => {
    const me = getMe()
    const myDisplayName: string = me.displayName || 'User'
    mediaAbortRef.current = false
    navigator.mediaDevices.getUserMedia({ video: vid, audio: true })
      .catch(() => vid ? navigator.mediaDevices.getUserMedia({ video: false, audio: true }) : Promise.reject())
      .then(stream => {
        if (mediaAbortRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        localStreamRef.current = stream
        setLocalStream(stream)
        groupIdRef.current = gId
        isVideoRef.current = vid
        setGroupId(gId)
        setGroupName(gName)
        setIsVideo(vid)
        setIsOwnerOrAdmin(ownerAdmin)
        setIsCallHost(isInitiator)
        setGroupCallActiveMap(prev => ({ ...prev, [gId]: true }))
        statusRef.current = 'active'
        setStatus('active')
        const h = getHub()
        if (isInitiator) h.invoke('InitiateGroupCall', gId, vid, myDisplayName).catch(() => {})
        h.invoke('JoinGroupCall', gId, myDisplayName).catch(() => {})
      })
      .catch(err => console.error('Failed to get media for group call:', err))
  }

  const startGroupCall = (gId: string, gName: string, video: boolean, amIOwnerOrAdmin: boolean) =>
    _getMediaAndJoin(gId, gName, video, amIOwnerOrAdmin, true)

  const joinActiveGroupCall = (gId: string, gName: string, video: boolean) =>
    _getMediaAndJoin(gId, gName, video, false, false)

  const joinGroupCall = () => {
    const gId = groupIdRef.current
    if (!gId) return
    _getMediaAndJoin(gId, groupName, isVideoRef.current, false, false)
  }

  const declineGroupCall = () => cleanupCall()

  const leaveGroupCall = () => {
    const gId = groupIdRef.current
    if (gId) getHub().invoke('LeaveGroupCall', gId).catch(() => {})
    cleanupCall()
  }

  const endCallForAll = () => {
    const gId = groupIdRef.current
    if (!gId) return
    getHub().invoke('EndGroupCallForAll', gId).catch(() => {})
    cleanupCall()
  }

  const toggleLocalAudio = () => {
    setLocalAudioMuted(prev => {
      const next = !prev
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next })
      return next
    })
  }

  const toggleLocalVideo = async () => {
    const existingTracks = localStreamRef.current?.getVideoTracks() ?? []
    if (existingTracks.length > 0) {
      // Camera is currently ON — turn it OFF
      // Step 1: Replace each PC's video sender with null (pauses transmission without removing sender)
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(null).catch(() => {})
      })
      // Step 2: Stop the hardware track (releases camera, turns off LED)
      existingTracks.forEach(t => { t.stop(); localStreamRef.current?.removeTrack(t) })
      setLocalVideoMuted(true)
      updateParticipantsState()
      // Tell all remote peers via SignalR so their UI updates immediately
      if (groupIdRef.current)
        getHub().invoke('UpdateVideoMute', groupIdRef.current, true).catch(() => {})
    } else {
      // Camera is OFF — turn it ON (either first time, or re-enabling after stop)
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const camTrack = camStream.getVideoTracks()[0]
        if (!camTrack) return
        // If call was cleaned up while waiting for camera permission, release immediately
        if (!localStreamRef.current) { camTrack.stop(); return }
        localStreamRef.current.addTrack(camTrack)
        peerConnections.current.forEach(async (pc, peerId) => {
          // Prefer replacing the null sender left from the previous off-state
          const nullSender = pc.getSenders().find(s => s.track === null)
          if (nullSender) {
            nullSender.replaceTrack(camTrack).catch(() => {})
          } else {
            // No existing sender (audio call, first time adding camera)
            pc.addTrack(camTrack, localStreamRef.current!)
            await renegotiateWithPeer(peerId)
          }
        })
        setLocalVideoMuted(false)
        updateParticipantsState()
        // Tell all remote peers via SignalR
        if (groupIdRef.current)
          getHub().invoke('UpdateVideoMute', groupIdRef.current, false).catch(() => {})
      } catch { /* user denied camera */ }
    }
  }

  const stopScreenShare = async (camFallback: MediaStreamTrack | null) => {
    screenTrackRef.current?.stop()
    screenTrackRef.current = null
    setScreenStream(null)
    setIsScreenSharing(false)
    if (camFallback) {
      // Camera was already in call: replace screen sender with camera track
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(camFallback).catch(() => {})
      })
    } else {
      // Audio call was screen-sharing: remove the video sender and renegotiate
      peerConnections.current.forEach(async (pc, peerId) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) {
          pc.removeTrack(sender)
          await renegotiateWithPeer(peerId)
        }
      })
    }
  }

  const toggleScreenShare = async () => {
    const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null
    if (isScreenSharing) {
      await stopScreenShare(camTrack)
    } else {
      try {
        const screen = await (navigator.mediaDevices as MediaDevices & { getDisplayMedia(c: MediaStreamConstraints): Promise<MediaStream> })
          .getDisplayMedia({ video: true, audio: false })
        const screenTrack = screen.getVideoTracks()[0]
        screenTrackRef.current = screenTrack
        setScreenStream(screen)
        setIsScreenSharing(true)

        const videoSenderExists = !!camTrack
        if (videoSenderExists) {
          // Video call: replace existing video sender track
          peerConnections.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video')
            if (sender) sender.replaceTrack(screenTrack).catch(() => {})
          })
        } else {
          // Audio call: add the screen track as a new sender and renegotiate
          peerConnections.current.forEach(async (pc, peerId) => {
            pc.addTrack(screenTrack, screen)
            await renegotiateWithPeer(peerId)
          })
        }

        // Auto-stop when browser UI "stop sharing" is clicked
        screenTrack.onended = () => stopScreenShare(camTrack)
      } catch { /* user cancelled */ }
    }
  }

  const muteParticipant = (userId: string) => {
    const gId = groupIdRef.current
    if (!gId) return
    getHub().invoke('MuteGroupParticipant', userId, gId).catch(() => {})
  }

  const muteAll = () => {
    const gId = groupIdRef.current
    if (!gId) return
    getHub().invoke('MuteAllGroupParticipants', gId).catch(() => {})
  }

  const removeParticipant = (userId: string) => {
    const gId = groupIdRef.current
    if (!gId) return
    getHub().invoke('RemoveFromGroupCall', gId, userId).catch(() => {})
  }

  const lockCall = () => {
    const gId = groupIdRef.current
    if (!gId) return
    getHub().invoke('LockGroupCall', gId).catch(() => {})
  }

  const unlockCall = () => {
    const gId = groupIdRef.current
    if (!gId) return
    getHub().invoke('UnlockGroupCall', gId).catch(() => {})
  }

  const raiseHand = () => {
    const gId = groupIdRef.current
    if (!gId) return
    setMyHandRaised(true)
    // Don't add to raisedHands locally — server echo via GroupCallHandRaised handles it
    getHub().invoke('RaiseHand', gId).catch(() => {})
  }

  const lowerHand = () => {
    const gId = groupIdRef.current
    if (!gId) return
    setMyHandRaised(false)
    // Optimistically remove from raisedHands using the correct userId field
    const myUserId: string = getMe().userId || ''
    if (myUserId) setRaisedHands(prev => { const n = new Set(prev); n.delete(myUserId); return n })
    getHub().invoke('LowerHand', gId).catch(() => {})
  }

  const lowerParticipantHand = (userId: string) => {
    const gId = groupIdRef.current
    if (!gId) return
    // Optimistically update local state
    setRaisedHands(prev => { const n = new Set(prev); n.delete(userId); return n })
    getHub().invoke('LowerParticipantHand', gId, userId).catch(() => {})
  }

  const sendReaction = (emoji: string) => {
    const gId = groupIdRef.current
    if (!gId) return
    getHub().invoke('SendCallReaction', gId, emoji).catch(() => {})
  }

  const sendCallMessage = (text: string) => {
    const gId = groupIdRef.current
    if (!gId || !text.trim()) return
    getHub().invoke('SendCallChatMessage', gId, text.trim()).catch(() => {})
  }

  const pinParticipant = (userId: string | null) => setPinnedParticipant(userId)

  const setLayout = (l: GroupCallLayout) => setLayoutState(l)

  const markChatRead = () => {
    chatOpenRef.current = true
    setUnreadChatCount(0)
  }

  const upgradeBuddyCall = (otherUserId: string, inviteeUserId: string) => {
    const me = getMe()
    const myDisplayName: string = me.displayName || 'User'
    const vid = isVideoRef.current
    getHub().invoke('UpgradeBuddyCallToGroup', otherUserId, inviteeUserId, myDisplayName, vid).catch(() => {})
  }

  return (
    <GroupCallContext.Provider value={{
      status, groupId, groupName, isVideo, callerName,
      participants, localStream, screenStream, localAudioMuted, localVideoMuted,
      isScreenSharing, isOwnerOrAdmin, isCallHost, isLocked, myHandRaised, raisedHands,
      reactions, callMessages, unreadChatCount, pinnedParticipant, layout, speakingParticipants,
      groupCallActiveMap,
      startGroupCall, joinGroupCall, joinActiveGroupCall, declineGroupCall, leaveGroupCall,
      endCallForAll,
      toggleLocalAudio, toggleLocalVideo, toggleScreenShare,
      muteParticipant, muteAll, removeParticipant,
      lockCall, unlockCall, raiseHand, lowerHand, lowerParticipantHand,
      sendReaction, sendCallMessage, pinParticipant, setLayout, markChatRead, upgradeBuddyCall,
    }}>
      {children}
    </GroupCallContext.Provider>
  )
}
