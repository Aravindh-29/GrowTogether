import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { chatApi, getChatHub, type ChatMessage, type ConversationSummary } from '../api/chatApi'
import { groupApi } from '../api/groupApi'
import type { GroupDto, GroupMessageDto } from '../api/groupApi'
import { notificationApi } from '../api/notificationApi'
import { useNotifications } from '../contexts/NotificationContext'
import { useCall } from '../contexts/CallContext'
import { useGroupCall } from '../contexts/GroupCallContext'

function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#6366f1','#0ea5e9','#22c55e','#f59e0b','#ec4899','#14b8a6','#8b5cf6']
  const bg = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.32 }}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover"/> : initials}
    </div>
  )
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })
}

function browserNotify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: body.slice(0, 100), icon: '/vite.svg' })
  }
}

export default function MessagesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { markConvRead, incrementUnread, incrementGroupUnread, markGroupRead, unreadDMMessages, unreadGroupMessages, groupUnreadCounts } = useNotifications()
  const csUser = (() => { try { return JSON.parse(localStorage.getItem('cs_user') || '{}') } catch { return {} } })()
  const myUserId: string = csUser.userId || ''
  const token = localStorage.getItem('cs_token') || ''

  const { startCall, callState } = useCall()
  const { startGroupCall, joinActiveGroupCall, status: gcStatus, groupCallActiveMap } = useGroupCall()


  const handleGroupCall = async (isVideo: boolean) => {
    if (!activeGroupId || !activeGroup) return
    // If call is in progress and we're idle, join instead of start
    if (groupCallActive && gcStatus === 'idle') {
      joinActiveGroupCall(activeGroupId, activeGroup.name, isVideo)
      return
    }
    try {
      const detail = await groupApi.detail(activeGroupId)
      const me = detail.data.members.find(m => m.userId === myUserId)
      const amIOwnerOrAdmin = !!me && (me.isOwner || me.isAdmin)
      startGroupCall(activeGroupId, activeGroup.name, isVideo, amIOwnerOrAdmin)
    } catch { /* ignore */ }
  }

  // ── Sidebar tab: 'direct' | 'groups' ──
  const [sideTab, setSideTab] = useState<'direct' | 'groups'>('direct')

  // ── DM state ──
  const [convs, setConvs] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [convSearch, setConvSearch] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})
  const menuRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<ReturnType<typeof getChatHub> | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const convsRef = useRef<ConversationSummary[]>([])
  useEffect(() => {
    activeIdRef.current = activeId
    setTypingUser(null)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
  }, [activeId])

  // ── Typing indicator state ──
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef<number>(0)
  useEffect(() => { convsRef.current = convs }, [convs])

  // ── Groups state ──
  const [groups, setGroups] = useState<GroupDto[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [groupMessages, setGroupMessages] = useState<GroupMessageDto[]>([])
  const [groupText, setGroupText] = useState('')
  const [groupSending, setGroupSending] = useState(false)
  const [loadingGroupMsgs, setLoadingGroupMsgs] = useState(false)
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const groupMenuRef = useRef<HTMLDivElement>(null)
  const groupBottomRef = useRef<HTMLDivElement>(null)
  const activeGroupIdRef = useRef<string | null>(null)
  useEffect(() => { activeGroupIdRef.current = activeGroupId }, [activeGroupId])
  const [groupUnread, setGroupUnread] = useState<Record<string, number>>({})

  // Track whether a group call is currently in progress for the active group
  const [groupCallActive, setGroupCallActive] = useState(false)
  // Initial fetch when switching groups
  useEffect(() => {
    if (!activeGroupId) { setGroupCallActive(false); return }
    let cancelled = false
    fetch(`/api/groups/${activeGroupId}/call-active`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setGroupCallActive(d.active === true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeGroupId])
  // Real-time updates via SignalR events (IncomingGroupCall / GroupCallEnded)
  useEffect(() => {
    if (activeGroupId && groupCallActiveMap[activeGroupId] !== undefined)
      setGroupCallActive(groupCallActiveMap[activeGroupId])
  }, [activeGroupId, groupCallActiveMap])

  // Close options menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Close group menu when clicking outside
  useEffect(() => {
    if (!groupMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) setGroupMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [groupMenuOpen])

  const clearChat = () => {
    setMessages([])
    setMenuOpen(false)
  }

  // Load conversations on mount
  useEffect(() => {
    chatApi.getConversations().then(r => {
      setConvs(r.data)
      setLoadingConvs(false)
      const stateConvId = (location.state as { convId?: string; groupId?: string } | null)?.convId
      if (stateConvId) {
        const found = r.data.find(c => c.id === stateConvId)
        if (found) selectConv(stateConvId)
        else {
          chatApi.getConversations().then(r2 => {
            setConvs(r2.data)
            selectConv(stateConvId)
          })
        }
      }
    }).catch(() => setLoadingConvs(false))
  }, [])

  // Handle groupId in location state — switch to Groups tab and open that group
  useEffect(() => {
    const stateGroupId = (location.state as { convId?: string; groupId?: string } | null)?.groupId
    if (!stateGroupId) return
    setSideTab('groups')
    setActiveGroupId(stateGroupId)
    loadGroupMessages(stateGroupId)
  }, [])

  // Load groups when switching to groups tab
  useEffect(() => {
    if (sideTab !== 'groups') return
    setLoadingGroups(true)
    groupApi.mine().then(r => setGroups(r.data)).catch(() => {}).finally(() => setLoadingGroups(false))
  }, [sideTab])

  // SignalR connection
  useEffect(() => {
    if (!token) return
    const hub = getChatHub(token)
    hubRef.current = hub

    const onUserOnline  = (userId: string) => setOnlineUsers(prev => ({ ...prev, [userId]: true }))
    const onUserOffline = (userId: string) => setOnlineUsers(prev => ({ ...prev, [userId]: false }))

    hub.on('UserOnline',  onUserOnline)
    hub.on('UserOffline', onUserOffline)

    const onReceiveMessage = (msg: ChatMessage) => {
      if (msg.conversationId === activeIdRef.current) {
        setMessages(ms => [...ms, msg])
        chatApi.markRead(msg.conversationId)
      } else {
        setConvs(cs => cs.map(c => c.id === msg.conversationId
          ? { ...c, lastMessage: msg.text, lastMessageAt: msg.sentAt, unreadCount: (c.unreadCount || 0) + 1 }
          : c))
        incrementUnread()
        const senderName = convsRef.current.find(c => c.id === msg.conversationId)?.otherName || 'New message'
        browserNotify(senderName, msg.text)
      }
    }

    const onReceiveGroupMessage = (msg: GroupMessageDto) => {
      if (msg.groupId === activeGroupIdRef.current) {
        setGroupMessages(ms => [...ms, msg])
      } else if (!msg.isSystem) {
        setGroupUnread(prev => ({ ...prev, [msg.groupId]: (prev[msg.groupId] || 0) + 1 }))
        incrementGroupUnread(msg.groupId)
      }
    }

    const onGroupDeleted = (data: { groupId: string; groupName: string }) => {
      if (data.groupId === activeGroupIdRef.current) {
        setActiveGroupId(null)
        setGroupMessages([])
        setGroups(prev => prev.filter(g => g.id !== data.groupId))
      } else {
        setGroups(prev => prev.filter(g => g.id !== data.groupId))
      }
    }

    const onUserTypingDm = (data: { senderName: string }) => {
      setTypingUser(data.senderName)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000)
    }

    hub.on('ReceiveMessage', onReceiveMessage)
    hub.on('ReceiveGroupMessage', onReceiveGroupMessage)
    hub.on('GroupDeleted', onGroupDeleted)
    hub.on('UserTypingDm', onUserTypingDm)

    if (hub.state === 'Disconnected') {
      hub.start().catch(() => {})
    }

    return () => {
      hub.off('ReceiveMessage', onReceiveMessage)
      hub.off('ReceiveGroupMessage', onReceiveGroupMessage)
      hub.off('GroupDeleted', onGroupDeleted)
      hub.off('UserOnline',  onUserOnline)
      hub.off('UserOffline', onUserOffline)
      hub.off('UserTypingDm', onUserTypingDm)
    }
  }, [token])

  const selectConv = async (id: string) => {
    setActiveId(id)
    setLoadingMsgs(true)
    const conv = convsRef.current.find(c => c.id === id)
    if (conv) {
      notificationApi.getOnlineStatus(conv.otherUserId)
        .then(r => setOnlineUsers(prev => ({ ...prev, [conv.otherUserId]: r.data.online })))
        .catch(() => {})
    }
    try {
      const r = await chatApi.getMessages(id)
      setMessages(r.data)
      const conv = convsRef.current.find(c => c.id === id)
      const unread = conv?.unreadCount || 0
      if (unread > 0) {
        chatApi.markRead(id)
        markConvRead(unread)
        setConvs(cs => cs.map(c => c.id === id ? { ...c, unreadCount: 0 } : c))
      }
    } finally { setLoadingMsgs(false) }
  }

  const loadGroupMessages = async (groupId: string) => {
    setLoadingGroupMsgs(true)
    try {
      const r = await groupApi.getMessages(groupId)
      setGroupMessages(r.data)
    } catch { /* ignore */ }
    finally { setLoadingGroupMsgs(false) }
  }

  const selectGroup = (groupId: string) => {
    markGroupRead(groupId)
    setGroupUnread(prev => { const n = { ...prev }; delete n[groupId]; return n })
    setActiveGroupId(groupId)
    loadGroupMessages(groupId)
  }

  // Scroll to bottom when DM messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Scroll to bottom when group messages change
  useEffect(() => {
    groupBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [groupMessages])

  const emitTyping = () => {
    if (!hubRef.current || !activeConv) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < 2000) return
    lastTypingSentRef.current = now
    hubRef.current.invoke('TypingDm', activeConv.otherUserId, csUser.displayName || 'Someone').catch(() => {})
  }

  const sendMessage = async () => {
    if (!text.trim() || !activeId || sending) return
    const body = text.trim()
    setText('')
    setTypingUser(null)
    setSending(true)
    try {
      const r = await chatApi.sendMessage(activeId, body)
      setMessages(ms => [...ms, r.data])
      setConvs(cs => cs.map(c => c.id === activeId
        ? { ...c, lastMessage: body, lastMessageAt: r.data.sentAt }
        : c))
    } finally { setSending(false) }
  }

  const sendGroupMessage = async () => {
    if (!groupText.trim() || !activeGroupId || groupSending) return
    const body = groupText.trim()
    setGroupText('')
    setGroupSending(true)
    try {
      const r = await groupApi.sendMessage(activeGroupId, body)
      setGroupMessages(ms => [...ms, r.data])
    } finally { setGroupSending(false) }
  }

  const activeConv = convs.find(c => c.id === activeId)
  const activeGroup = groups.find(g => g.id === activeGroupId)
  const filteredConvs = convs.filter(c =>
    !convSearch || c.otherName.toLowerCase().includes(convSearch.toLowerCase()) ||
    (c.otherUsername && c.otherUsername.includes(convSearch.replace('@', '')))
  )

  return (
    <div className="flex-1 flex overflow-hidden" style={{ background:'var(--cs-bg)' }}>

      {/* ── Left: Sidebar ── */}
      <div className="flex flex-col flex-shrink-0" style={{ width:300, borderRight:'1px solid var(--cs-border)', background:'var(--cs-bg-nav)' }}>
        <div className="flex-shrink-0 px-4 pt-4 pb-3" style={{ borderBottom:'1px solid var(--cs-border)' }}>
          {/* Pill tabs */}
          <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background:'var(--cs-input-bg)' }}>
            {(['direct', 'groups'] as const).map(t => {
              const isActive = sideTab === t
              return (
                <button key={t}
                  onClick={() => setSideTab(t)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  style={{
                    background: isActive ? 'var(--cs-bg)' : 'transparent',
                    color: isActive ? '#2dd4bf' : 'var(--cs-text-2)',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {t === 'direct' ? 'Buddies' : 'Groups'}
                  {t === 'direct' && unreadDMMessages > 0 && (
                    <span className="min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                      style={{ background: '#2dd4bf', lineHeight: 1 }}>
                      {unreadDMMessages > 9 ? '9+' : unreadDMMessages}
                    </span>
                  )}
                  {t === 'groups' && unreadGroupMessages > 0 && (
                    <span className="min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                      style={{ background: '#2dd4bf', lineHeight: 1 }}>
                      {unreadGroupMessages > 9 ? '9+' : unreadGroupMessages}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search (only for direct) */}
          {sideTab === 'direct' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="2" className="w-3.5 h-3.5 flex-shrink-0">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={convSearch} onChange={e => setConvSearch(e.target.value)}
                placeholder="Search conversations…" className="flex-1 bg-transparent outline-none text-xs" style={{ color:'var(--cs-text-1)' }}/>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Direct tab list ── */}
          {sideTab === 'direct' && (
            <>
              {loadingConvs && (
                <div className="flex justify-center py-10">
                  <svg className="animate-spin w-5 h-5" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              )}
              {!loadingConvs && filteredConvs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-10 h-10 opacity-30">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  <p className="text-xs text-center" style={{ color:'var(--cs-text-3)' }}>No conversations yet.<br/>Connect with a buddy to start chatting.</p>
                </div>
              )}
              {filteredConvs.map(c => (
                <button key={c.id} onClick={() => selectConv(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{
                    background: activeId === c.id ? 'rgba(45,212,191,0.08)' : 'transparent',
                    borderLeft: activeId === c.id ? '3px solid #2dd4bf' : '3px solid transparent',
                  }}>
                  <Avatar url={c.otherPicture} name={c.otherName} size={40}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-sm truncate" style={{ color:'var(--cs-text-1)' }}>{c.otherName}</p>
                      {c.lastMessageAt && <span className="text-[10px] flex-shrink-0" style={{ color:'var(--cs-text-3)' }}>{timeLabel(c.lastMessageAt)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs truncate" style={{ color:'var(--cs-text-3)' }}>{c.lastMessage || 'No messages yet'}</p>
                      {c.unreadCount > 0 && (
                        <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background:'#0d9488' }}>{c.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* ── Groups tab list ── */}
          {sideTab === 'groups' && (
            <>
              {loadingGroups && (
                <div className="flex justify-center py-10">
                  <svg className="animate-spin w-5 h-5" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              )}
              {!loadingGroups && groups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-10 h-10 opacity-30">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                  <p className="text-xs text-center" style={{ color:'var(--cs-text-3)' }}>No groups yet.<br/>Join or create a group to chat.</p>
                </div>
              )}
              {groups.map(g => (
                <button key={g.id} onClick={() => selectGroup(g.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{
                    background: activeGroupId === g.id ? 'rgba(45,212,191,0.08)' : 'transparent',
                    borderLeft: activeGroupId === g.id ? '3px solid #2dd4bf' : '3px solid transparent',
                  }}>
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{ background: g.color }}>
                    {g.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color:'var(--cs-text-1)' }}>{g.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs truncate" style={{ color:'#2dd4bf' }}>{g.subject}</span>
                      <span className="text-[10px] flex-shrink-0" style={{ color:'var(--cs-text-3)' }}>{g.memberCount} members</span>
                    </div>
                  </div>
                  {(() => {
                    const count = (groupUnread[g.id] || 0) + (groupUnreadCounts[g.id] || 0)
                    return count > 0 ? (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                        style={{ background: '#2dd4bf', lineHeight: 1 }}>
                        {count > 9 ? '9+' : count}
                      </span>
                    ) : null
                  })()}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Right: Chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── DM chat panel ── */}
        {sideTab === 'direct' && (
          <>
            {!activeConv ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color:'var(--cs-text-3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-14 h-14 opacity-25">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <p className="text-sm">Select a conversation to start chatting</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom:'1px solid var(--cs-border)', background:'var(--cs-bg-nav)' }}>

                  <div className="relative flex-shrink-0">
                    <Avatar url={activeConv.otherPicture} name={activeConv.otherName} size={36}/>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                      style={{
                        background: onlineUsers[activeConv.otherUserId] ? '#22c55e' : '#9ca3af',
                        borderColor: 'var(--cs-bg-nav)',
                      }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color:'var(--cs-text-1)' }}>{activeConv.otherName}</p>
                    <div className="flex items-center gap-1.5">
                      {activeConv.otherUsername && (
                        <p className="text-xs font-semibold" style={{ color:'#2dd4bf' }}>@{activeConv.otherUsername}</p>
                      )}
                      <span className="text-xs font-medium"
                        style={{ color: onlineUsers[activeConv.otherUserId] ? '#22c55e' : '#9ca3af' }}>
                        {activeConv.otherUsername ? '·' : ''} {onlineUsers[activeConv.otherUserId] ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startCall(activeConv.otherUserId, activeConv.otherName, false)}
                        disabled={callState !== 'idle'}
                        title="Audio call"
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background:'rgba(13,148,136,0.12)', border:'1px solid rgba(13,148,136,0.25)', color:'#2dd4bf' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                        </svg>
                      </button>

                      <button
                        onClick={() => startCall(activeConv.otherUserId, activeConv.otherName, true)}
                        disabled={callState !== 'idle'}
                        title="Video call"
                        className="ml-5 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)', color:'#818cf8' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <div className="w-px h-6" style={{ background:'var(--cs-border)' }} />

                      <div className="relative" ref={menuRef}>
                        <button
                          onClick={() => setMenuOpen(o => !o)}
                          title="More options"
                          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                          style={{ background: menuOpen ? 'rgba(255,255,255,0.08)' : 'transparent', color:'var(--cs-text-2)' }}>
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                          </svg>
                        </button>

                        {menuOpen && (
                          <div className="absolute right-0 top-11 w-52 rounded-2xl shadow-2xl overflow-hidden z-50 py-1"
                            style={{ background:'var(--cs-bg-nav)', border:'1px solid var(--cs-border)', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>

                            <button onClick={() => { navigate(`/profile/view/${activeConv.otherUserId}`); setMenuOpen(false) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                              style={{ color:'var(--cs-text-1)' }}>
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color:'var(--cs-text-3)' }}>
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                              </svg>
                              View Profile
                            </button>

                            <button onClick={() => { startCall(activeConv.otherUserId, activeConv.otherName, false); setMenuOpen(false) }}
                              disabled={callState !== 'idle'}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5 disabled:opacity-40"
                              style={{ color:'var(--cs-text-1)' }}>
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color:'#2dd4bf' }}>
                                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                              </svg>
                              Audio Call
                            </button>

                            <button onClick={() => { startCall(activeConv.otherUserId, activeConv.otherName, true); setMenuOpen(false) }}
                              disabled={callState !== 'idle'}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5 disabled:opacity-40"
                              style={{ color:'var(--cs-text-1)' }}>
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color:'#818cf8' }}>
                                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                              </svg>
                              Video Call
                            </button>

                            <div className="my-1 mx-3" style={{ height:1, background:'var(--cs-border)' }} />

                            <button onClick={clearChat}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                              style={{ color:'#ef4444' }}>
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                              </svg>
                              Clear Chat
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                  {loadingMsgs ? (
                    <div className="flex justify-center py-10">
                      <svg className="animate-spin w-5 h-5" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color:'var(--cs-text-3)' }}>
                      <p className="text-sm">No messages yet. Say hello! 👋</p>
                    </div>
                  ) : (
                    messages.map(m => {
                      const mine = m.senderId === myUserId
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm"
                            style={mine
                              ? { background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white', borderBottomRightRadius:4 }
                              : { background:'var(--cs-bg-card)', color:'var(--cs-text-1)', border:'1px solid var(--cs-border)', borderBottomLeftRadius:4 }}>
                            <p className="whitespace-pre-wrap break-words">{m.text}</p>
                            <p className={`text-[10px] mt-1 ${mine ? 'text-right opacity-70' : ''}`}
                              style={!mine ? { color:'var(--cs-text-3)' } : {}}>
                              {timeLabel(m.sentAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={bottomRef}/>
                </div>

                {/* Typing indicator */}
                {typingUser && (
                  <div className="px-5 pb-1 flex items-center gap-2">
                    <span className="text-xs italic" style={{ color:'var(--cs-text-3)' }}>
                      {typingUser} is typing
                    </span>
                    <span className="flex gap-0.5 items-center">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ background:'var(--cs-text-3)', animationDelay:`${i*150}ms` }}/>
                      ))}
                    </span>
                  </div>
                )}

                {/* Input */}
                <div className="flex-shrink-0 flex items-end gap-3 px-5 py-4" style={{ borderTop:'1px solid var(--cs-border)', background:'var(--cs-bg-nav)' }}>
                  <textarea
                    value={text}
                    onChange={e => { setText(e.target.value); emitTyping() }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                    rows={1}
                    className="flex-1 rounded-2xl px-4 py-3 text-sm resize-none outline-none"
                    style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)', color:'var(--cs-text-1)', maxHeight:120 }}/>
                  <button onClick={sendMessage} disabled={!text.trim() || sending}
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
                    style={{ background: text.trim() ? 'linear-gradient(135deg,#0d9488,#0ea5e9)' : 'var(--cs-input-bg)', color: text.trim() ? 'white' : 'var(--cs-text-3)' }}>
                    {sending
                      ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Group chat panel ── */}
        {sideTab === 'groups' && (
          <>
            {!activeGroup ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color:'var(--cs-text-3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-14 h-14 opacity-25">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                <p className="text-sm">Select a group to start chatting</p>
              </div>
            ) : (
              <>
                {/* Group chat header */}
                <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3"
                  style={{ borderBottom:'1px solid var(--cs-border)', background:'var(--cs-bg-nav)' }}>
                  <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm"
                    style={{ background: activeGroup.color }}>
                    {activeGroup.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color:'var(--cs-text-1)' }}>{activeGroup.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color:'#2dd4bf' }}>{activeGroup.subject}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background:'rgba(45,212,191,0.1)', color:'#2dd4bf', border:'1px solid rgba(45,212,191,0.2)' }}>
                        {activeGroup.memberCount} members
                      </span>
                    </div>
                  </div>

                  {/* Group call buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {groupCallActive && gcStatus === 'idle' ? (
                      // Call is in progress — show a prominent Join button
                      <button onClick={() => handleGroupCall(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all active:scale-95 animate-pulse"
                        style={{ background: 'linear-gradient(135deg,#22c55e,#0d9488)' }}
                        title="A call is in progress — click to join">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                        </svg>
                        Join call
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleGroupCall(false)}
                          title="Group voice call"
                          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                          style={{ background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.25)', color: '#2dd4bf' }}>
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleGroupCall(true)}
                          title="Group video call"
                          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8' }}>
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Group menu */}
                  <div className="relative" ref={groupMenuRef}>
                    <button
                      onClick={() => setGroupMenuOpen(o => !o)}
                      title="Group options"
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                      style={{ background: groupMenuOpen ? 'rgba(255,255,255,0.08)' : 'transparent', color:'var(--cs-text-2)' }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                      </svg>
                    </button>

                    {groupMenuOpen && (
                      <div className="absolute right-0 top-11 w-48 rounded-2xl shadow-2xl overflow-hidden z-50 py-1"
                        style={{ background:'var(--cs-bg-nav)', border:'1px solid var(--cs-border)', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
                        <button
                          onClick={() => {
                            setGroupMenuOpen(false)
                            navigate('/study-groups', { state: { openGroupId: activeGroup.id } })
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                          style={{ color:'var(--cs-text-1)' }}>
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color:'var(--cs-text-3)' }}>
                            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                          </svg>
                          Group Settings
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Group messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {loadingGroupMsgs ? (
                    <div className="flex justify-center py-10">
                      <svg className="animate-spin w-5 h-5" style={{ color:'#2dd4bf' }} viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    </div>
                  ) : groupMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color:'var(--cs-text-3)' }}>
                      <p className="text-sm">No messages yet. Start the conversation! 👋</p>
                    </div>
                  ) : (
                    groupMessages.map(m => {
                      if (m.isSystem) {
                        return (
                          <div key={m.id} className="flex justify-center my-1">
                            <span className="text-[11px] px-3 py-1 rounded-full"
                              style={{ background:'rgba(0,0,0,0.06)', color:'var(--cs-text-3)' }}>
                              {m.text}
                            </span>
                          </div>
                        )
                      }
                      const mine = m.senderId === myUserId
                      return (
                        <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                          {!mine && (
                            <Avatar url={m.senderPictureUrl} name={m.senderName} size={28}/>
                          )}
                          <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-xs lg:max-w-md`}>
                            {!mine && (
                              <p className="text-[11px] font-semibold mb-1 ml-1" style={{ color:'var(--cs-text-2)' }}>{m.senderName}</p>
                            )}
                            <div className="px-4 py-2.5 rounded-2xl text-sm"
                              style={mine
                                ? { background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'white', borderBottomRightRadius:4 }
                                : { background:'var(--cs-input-bg)', color:'var(--cs-text-1)', border:'1px solid var(--cs-border)', borderBottomLeftRadius:4 }}>
                              <p className="whitespace-pre-wrap break-words">{m.text}</p>
                              <p className={`text-[10px] mt-1 ${mine ? 'text-right opacity-70' : ''}`}
                                style={!mine ? { color:'var(--cs-text-3)' } : {}}>
                                {timeLabel(m.sentAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={groupBottomRef}/>
                </div>

                {/* Group input */}
                <div className="flex-shrink-0 flex items-end gap-3 px-5 py-4" style={{ borderTop:'1px solid var(--cs-border)', background:'var(--cs-bg-nav)' }}>
                  <textarea
                    value={groupText}
                    onChange={e => setGroupText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGroupMessage() } }}
                    placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                    rows={1}
                    className="flex-1 rounded-2xl px-4 py-3 text-sm resize-none outline-none"
                    style={{ background:'var(--cs-input-bg)', border:'1px solid var(--cs-border)', color:'var(--cs-text-1)', maxHeight:120 }}/>
                  <button onClick={sendGroupMessage} disabled={!groupText.trim() || groupSending}
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
                    style={{ background: groupText.trim() ? 'linear-gradient(135deg,#0d9488,#0ea5e9)' : 'var(--cs-input-bg)', color: groupText.trim() ? 'white' : 'var(--cs-text-3)' }}>
                    {groupSending
                      ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
