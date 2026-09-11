import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { groupApi } from '../api/groupApi'
import type { GroupDetailDto, GroupDto, GroupInviteDto, GroupMessageDto } from '../api/groupApi'
import { connectionApi } from '../api/connectionApi'
import type { ConnectionWithProfile } from '../api/connectionApi'
import { getChatHub } from '../api/chatApi'
import { useGroupCall } from '../contexts/GroupCallContext'

const COLORS = ['#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e']

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function Avatar({ name, url, size = 9 }: { name: string; url?: string | null; size?: number }) {
  const s = `w-${size} h-${size}`
  return url
    ? <img src={url} alt={name} className={`${s} rounded-full object-cover flex-shrink-0`} />
    : <div className={`${s} rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold`}
        style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
        {name[0]?.toUpperCase()}
      </div>
}

function AvatarMsg({ url, name, size = 28 }: { url?: string | null; name: string; size?: number }) {
  const colors = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6']
  const bg = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.35 }}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
    </div>
  )
}

// View: 'list' → 'chat' → optionally 'settings'
type View = 'list' | 'chat' | 'settings'

export default function StudyGroupsPage() {
  const location = useLocation()

  // ── List state ──
  const [tab, setTab]                 = useState<'mine' | 'discover'>('mine')
  const [myGroups, setMyGroups]       = useState<GroupDto[]>([])
  const [discover, setDiscover]       = useState<GroupDto[]>([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [name, setName]               = useState('')
  const [subject, setSubject]         = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving]           = useState(false)
  const [openMenuId, setOpenMenuId]   = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // ── View / navigation ──
  const [view, setView]               = useState<View>('list')
  const [chatGroup, setChatGroup]     = useState<GroupDto | null>(null)
  const [selected, setSelected]       = useState<GroupDetailDto | null>(null)  // settings view
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Chat state ──
  const [chatMessages, setChatMessages]   = useState<GroupMessageDto[]>([])
  const [chatLoading, setChatLoading]     = useState(false)
  const [chatText, setChatText]           = useState('')
  const [chatSending, setChatSending]     = useState(false)
  const [chatMenuOpen, setChatMenuOpen]   = useState(false)
  const chatMenuRef                       = useRef<HTMLDivElement>(null)
  const chatBottomRef                     = useRef<HTMLDivElement>(null)
  const chatGroupIdRef                    = useRef<string | null>(null)
  useEffect(() => { chatGroupIdRef.current = chatGroup?.id ?? null }, [chatGroup])

  // ── Settings (detail) state ──
  const [buddies, setBuddies]         = useState<ConnectionWithProfile[]>([])
  const [inviting, setInviting]       = useState(false)
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set())
  const [buddySearch, setBuddySearch] = useState('')
  const [openMemberMenuId, setOpenMemberMenuId] = useState<string | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<GroupDto | GroupDetailDto | null>(null)

  // ── Pending invites ──
  const [myPendingInvites, setMyPendingInvites] = useState<GroupInviteDto[]>([])

  // ── Toast / misc ──
  const [toast, setToast]             = useState('')

  const csUser = (() => { try { return JSON.parse(localStorage.getItem('cs_user') || '{}') } catch { return {} } })()
  const myUserId: string = csUser.userId || ''
  const token = localStorage.getItem('cs_token') || ''

  const { startGroupCall, joinActiveGroupCall, status: gcStatus, groupCallActiveMap } = useGroupCall()

  const [groupCallActive, setGroupCallActive] = useState(false)
  // Initial fetch when switching groups
  useEffect(() => {
    if (!chatGroup?.id) { setGroupCallActive(false); return }
    let cancelled = false
    fetch(`/api/groups/${chatGroup.id}/call-active`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setGroupCallActive(d.active === true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [chatGroup?.id])
  // Real-time updates via SignalR events (IncomingGroupCall / GroupCallEnded)
  useEffect(() => {
    if (chatGroup?.id && groupCallActiveMap[chatGroup.id] !== undefined)
      setGroupCallActive(groupCallActiveMap[chatGroup.id])
  }, [chatGroup?.id, groupCallActiveMap])

  const handleGroupCall = async (isVideo: boolean) => {
    if (!chatGroup) return
    if (groupCallActive && gcStatus === 'idle') {
      joinActiveGroupCall(chatGroup.id, chatGroup.name, isVideo)
      return
    }
    try {
      const detail = await groupApi.detail(chatGroup.id)
      const me = detail.data.members.find(m => m.userId === myUserId)
      startGroupCall(chatGroup.id, chatGroup.name, isVideo, !!me && (me.isOwner || me.isAdmin))
    } catch { /* ignore */ }
  }

  const showToast = (msg: string) => setToast(msg)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // ── SignalR: listen for group messages + GroupDeleted ──
  useEffect(() => {
    if (!token) return
    const hub = getChatHub(token)

    const onGroupMsg = (msg: GroupMessageDto) => {
      if (msg.groupId === chatGroupIdRef.current) {
        setChatMessages(ms => [...ms, msg])
      }
    }

    const onGroupDeleted = (data: { groupId: string; groupName: string }) => {
      if (data.groupId === chatGroupIdRef.current) {
        setChatGroup(null)
        setChatMessages([])
        setView('list')
        setToast(`"${data.groupName}" was deleted by the owner.`)
        groupApi.mine().then(r => setMyGroups(r.data)).catch(() => {})
        groupApi.discover().then(r => setDiscover(r.data)).catch(() => {})
      } else {
        setMyGroups(prev => prev.filter(g => g.id !== data.groupId))
      }
    }

    hub.on('ReceiveGroupMessage', onGroupMsg)
    hub.on('GroupDeleted', onGroupDeleted)
    if (hub.state === 'Disconnected') hub.start().catch(() => {})
    return () => {
      hub.off('ReceiveGroupMessage', onGroupMsg)
      hub.off('GroupDeleted', onGroupDeleted)
    }
  }, [token])

  // Scroll to bottom when chat messages change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Close chat menu on outside click
  useEffect(() => {
    if (!chatMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) setChatMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [chatMenuOpen])

  // Close card three-dots menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-card-menu]')) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenuId])

  // Close member admin dropdown on outside click
  useEffect(() => {
    if (!openMemberMenuId) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-member-menu]')) setOpenMemberMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMemberMenuId])

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const [mine, disc, invites] = await Promise.all([groupApi.mine(), groupApi.discover(), groupApi.getMyInvites()])
      setMyGroups(mine.data)
      setDiscover(disc.data)
      setMyPendingInvites(invites.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])
  useEffect(() => { if (showCreate) nameRef.current?.focus() }, [showCreate])

  useEffect(() => {
    connectionApi.getConnections()
      .then(r => setBuddies(r.data.filter(c => c.status === 'Accepted')))
      .catch(() => {})
  }, [])

  // Auto-open group from router state (notification click)
  // → members open chat; non-members (pending invite) open detail/settings view
  useEffect(() => {
    const openGroupId = (location.state as { openGroupId?: string } | null)?.openGroupId
    if (!openGroupId || loading) return
    const isMember = myGroups.some(g => g.id === openGroupId)
    if (isMember) {
      const target = myGroups.find(g => g.id === openGroupId)
      if (target) openChat(target)
    } else {
      groupApi.detail(openGroupId).then(res => {
        openSettings(res.data as unknown as GroupDto)
      }).catch(() => {})
    }
    window.history.replaceState({}, '')
  }, [loading])

  // ── Navigation helpers ──

  const loadChatMessages = async (groupId: string) => {
    setChatLoading(true)
    try {
      const r = await groupApi.getMessages(groupId)
      setChatMessages(r.data)
    } catch { /* ignore */ }
    finally { setChatLoading(false) }
  }

  const openChat = (g: GroupDto) => {
    setChatGroup(g)
    setChatText('')
    setChatMessages([])
    setView('chat')
    loadChatMessages(g.id)
  }

  const openSettings = async (g: GroupDto) => {
    setDetailLoading(true)
    setBuddySearch('')
    setInvitedUserIds(new Set())
    setOpenMemberMenuId(null)
    try {
      const res = await groupApi.detail(g.id)
      setSelected(res.data)
      setView('settings')
    } catch { showToast('Could not load group details.') }
    finally { setDetailLoading(false) }
  }

  const refreshSettings = async () => {
    if (!selected) return
    try {
      const res = await groupApi.detail(selected.id)
      setSelected(res.data)
    } catch { /* ignore */ }
  }

  const backFromSettings = () => {
    setSelected(null)
    // if we came from chat, go back to chat; else go to list
    setView(chatGroup ? 'chat' : 'list')
  }

  const backFromChat = () => {
    setChatGroup(null)
    setChatMessages([])
    setView('list')
  }

  // ── Chat actions ──

  const sendChatMessage = async () => {
    if (!chatText.trim() || !chatGroup || chatSending) return
    const body = chatText.trim()
    setChatText('')
    setChatSending(true)
    try {
      const r = await groupApi.sendMessage(chatGroup.id, body)
      setChatMessages(ms => [...ms, r.data])
    } finally { setChatSending(false) }
  }

  // ── Settings actions ──

  const create = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      await groupApi.create({ name: name.trim(), subject: subject.trim() || 'General', description: description.trim(), color })
      setName(''); setSubject(''); setDescription(''); setShowCreate(false)
      await loadGroups()
      showToast('Group created!')
    } catch { showToast('Failed to create group.') }
    finally { setSaving(false) }
  }

  const doLeave = async () => {
    if (!leaveTarget) return
    try {
      await groupApi.leave(leaveTarget.id)
      setLeaveTarget(null)
      setSelected(null)
      setChatGroup(null)
      setView('list')
      await loadGroups()
      showToast('Left the group.')
    } catch { showToast('Failed to leave group.') }
  }

  const doJoin = async (g: GroupDto) => {
    try {
      await groupApi.join(g.id)
      await loadGroups()
      showToast(`Joined "${g.name}"!`)
    } catch { showToast('Could not join group.') }
  }

  const inviteBuddy = async (targetUserId: string) => {
    if (!selected) return
    setInviting(true)
    try {
      await groupApi.invite(selected.id, targetUserId)
      setInvitedUserIds(prev => new Set([...prev, targetUserId]))
      showToast('Invite sent!')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (msg === 'Invite already sent.') {
        // Invite exists — mark as sent in UI
        setInvitedUserIds(prev => new Set([...prev, targetUserId]))
        showToast('Invite already sent to this user.')
      } else {
        showToast(msg ?? 'Could not send invite.')
      }
    }
    finally { setInviting(false) }
  }

  const doPromote = async (memberId: string) => {
    if (!selected) return
    setOpenMemberMenuId(null)
    try {
      await groupApi.promoteToAdmin(selected.id, memberId)
      await refreshSettings()
      showToast('Member promoted to admin.')
    } catch { showToast('Could not promote member.') }
  }

  const doDemote = async (memberId: string) => {
    if (!selected) return
    setOpenMemberMenuId(null)
    try {
      await groupApi.demoteAdmin(selected.id, memberId)
      await refreshSettings()
      showToast('Admin role removed.')
    } catch { showToast('Could not demote member.') }
  }

  const nonMembers = selected
    ? buddies.filter(b => !selected.members.some(m => m.userId === b.userId))
    : [] as ConnectionWithProfile[]

  const filteredBuddies = buddySearch.trim()
    ? nonMembers.filter(b => b.name.toLowerCase().includes(buddySearch.toLowerCase()))
    : nonMembers

  const myMemberEntry = selected?.members.find(m => m.userId === myUserId)
  const iAmOwnerOrAdmin = selected?.isOwner || myMemberEntry?.isAdmin === true

  // ════════════════════════════════════════════════════════════════
  // VIEW: Settings / Detail
  // ════════════════════════════════════════════════════════════════
  if (view === 'settings' && selected) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--cs-bg)' }}>

        {/* Coloured banner */}
        <div className="relative h-36 flex-shrink-0"
          style={{ background: `linear-gradient(135deg,${selected.color}dd,${selected.color}66)` }}>
          <button onClick={backFromSettings}
            className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold text-white/90 hover:bg-white/20 transition-all"
            style={{ background: 'rgba(0,0,0,0.2)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
            Back
          </button>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg absolute -bottom-8 left-6"
            style={{ background: selected.color, border: '4px solid var(--cs-bg)' }}>
            {selected.name[0].toUpperCase()}
          </div>
        </div>

        <div className="px-6 pt-12 pb-8 max-w-2xl mx-auto">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: 'var(--cs-text-1)' }}>{selected.name}</h1>
              {selected.isOwner && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Owner</span>
              )}
            </div>
            <div className="text-right text-xs flex-shrink-0 ml-4" style={{ color: 'var(--cs-text-3)' }}>
              <p>{selected.memberCount} member{selected.memberCount !== 1 ? 's' : ''}</p>
              <p>Created {timeAgo(selected.createdAt)}</p>
            </div>
          </div>
          <p className="text-sm font-semibold mb-2" style={{ color: '#2dd4bf' }}>{selected.subject}</p>
          {selected.description && (
            <p className="text-sm mb-5" style={{ color: 'var(--cs-text-2)' }}>{selected.description}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mb-7">
            {myMemberEntry ? (
              <>
                <button
                  onClick={() => { setSelected(null); openChat(selected as unknown as GroupDto) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: `linear-gradient(135deg,${selected.color},${selected.color}99)` }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                  </svg>
                  Open Group Chat
                </button>
                <button onClick={() => setLeaveTarget(selected)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                  Leave
                </button>
              </>
            ) : (() => {
              const pendingInvite = myPendingInvites.find(i => i.groupId === selected.id)
              if (pendingInvite) {
                return (
                  <button
                    onClick={async () => {
                      try {
                        await groupApi.respondToInvite(pendingInvite.id, true)
                        setMyPendingInvites(prev => prev.filter(i => i.id !== pendingInvite.id))
                        await loadGroups()
                        setSelected(null)
                        showToast(`Joined "${selected.name}"!`)
                      } catch { showToast('Could not accept invite.') }
                    }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                    style={{ background: `linear-gradient(135deg,#0d9488,#0ea5e9)` }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    Accept Invite
                  </button>
                )
              }
              return (
                <button
                  onClick={async () => {
                    await doJoin(selected as unknown as GroupDto)
                    setSelected(null)
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: `linear-gradient(135deg,#0d9488,#0ea5e9)` }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  Join Group
                </button>
              )
            })()}
          </div>

          {/* Members */}
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--cs-text-3)' }}>
            Members ({selected.memberCount})
          </p>
          <div className="flex flex-col gap-2 mb-6">
            {selected.members.map(m => (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}>
                <Avatar name={m.displayName} url={m.profilePictureUrl} size={10} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--cs-text-1)' }}>{m.displayName}</p>
                  {m.headline && <p className="text-xs truncate" style={{ color: 'var(--cs-text-3)' }}>{m.headline}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.isOwner && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Owner</span>
                  )}
                  {!m.isOwner && m.isAdmin && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9' }}>Admin</span>
                  )}
                  {selected.isOwner && !m.isOwner && (
                    <div className="relative" data-member-menu>
                      <button
                        onClick={() => setOpenMemberMenuId(prev => prev === m.userId ? null : m.userId)}
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
                        style={{ color: 'var(--cs-text-3)' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                      </button>
                      {openMemberMenuId === m.userId && (
                        <div className="absolute right-0 top-8 w-40 rounded-xl shadow-2xl overflow-hidden z-50 py-1"
                          style={{ background: 'var(--cs-bg-nav)', border: '1px solid var(--cs-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                          {!m.isAdmin ? (
                            <button onClick={() => doPromote(m.userId)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                              style={{ color: 'var(--cs-text-1)' }}>
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#0ea5e9' }}>
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                              Make Admin
                            </button>
                          ) : (
                            <button onClick={() => doDemote(m.userId)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                              style={{ color: '#ef4444' }}>
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                              Remove Admin
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Invite Buddies — owner or admin only */}
          {iAmOwnerOrAdmin && nonMembers.length > 0 && (
            <>
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cs-text-3)' }}>
                  Invite Buddies <span className="ml-1 normal-case font-normal">({nonMembers.length})</span>
                </p>
              </div>
              <div className="relative mb-3">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--cs-text-3)' }}>
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input value={buddySearch} onChange={e => setBuddySearch(e.target.value)}
                  placeholder="Search buddies…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
                {buddySearch && (
                  <button onClick={() => setBuddySearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: 'var(--cs-text-3)' }}>✕</button>
                )}
              </div>
              {filteredBuddies.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--cs-text-3)' }}>No buddies match "{buddySearch}"</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                  {filteredBuddies.map(b => (
                    <div key={b.userId} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                      style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}>
                      <Avatar name={b.name} url={b.profilePictureUrl ?? null} size={10} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--cs-text-1)' }}>{b.name}</p>
                        {b.headline && <p className="text-xs truncate" style={{ color: 'var(--cs-text-3)' }}>{b.headline}</p>}
                      </div>
                      {invitedUserIds.has(b.userId) ? (
                        <span className="text-xs px-3 py-1.5 rounded-xl font-semibold flex-shrink-0"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                          Sent ✓
                        </span>
                      ) : (
                        <button onClick={() => inviteBuddy(b.userId)} disabled={inviting}
                          className="text-xs px-4 py-1.5 rounded-xl font-semibold text-white disabled:opacity-50 transition-all active:scale-95 flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
                          Invite
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {leaveTarget && <LeaveDialog name={leaveTarget.name} onCancel={() => setLeaveTarget(null)} onConfirm={doLeave} />}
        {toast && <Toast msg={toast} />}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW: Group Chat (inline)
  // ════════════════════════════════════════════════════════════════
  if (view === 'chat' && chatGroup) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--cs-bg)' }}>

        {/* Chat header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3"
          style={{ borderBottom: '1px solid var(--cs-border)', background: 'var(--cs-bg-nav)' }}>
          <button onClick={backFromChat}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
            style={{ color: 'var(--cs-text-2)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>

          <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm"
            style={{ background: chatGroup.color }}>
            {chatGroup.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: 'var(--cs-text-1)' }}>{chatGroup.name}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: '#2dd4bf' }}>{chatGroup.subject}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(45,212,191,0.1)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }}>
                {chatGroup.memberCount} members
              </span>
            </div>
          </div>

          {/* Group call buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {groupCallActive && gcStatus === 'idle' ? (
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

          {/* ⋮ menu */}
          <div className="relative flex-shrink-0" ref={chatMenuRef}>
            <button onClick={() => setChatMenuOpen(o => !o)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
              style={{ color: 'var(--cs-text-2)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            {chatMenuOpen && (
              <div className="absolute right-0 top-11 w-48 rounded-2xl shadow-2xl overflow-hidden z-50 py-1"
                style={{ background: 'var(--cs-bg-nav)', border: '1px solid var(--cs-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                <button onClick={() => { setChatMenuOpen(false); openSettings(chatGroup) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                  style={{ color: 'var(--cs-text-1)' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--cs-text-3)' }}>
                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                  </svg>
                  Group Settings
                </button>
                <button onClick={() => { setChatMenuOpen(false); setLeaveTarget(chatGroup) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                  style={{ color: '#ef4444' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                    <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
                  </svg>
                  Leave Group
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {chatLoading ? (
            <div className="flex justify-center py-10">
              <svg className="animate-spin w-5 h-5" style={{ color: '#2dd4bf' }} viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--cs-text-3)' }}>
              <p className="text-sm">No messages yet. Start the conversation! 👋</p>
            </div>
          ) : (
            chatMessages.map(m => {
              if (m.isSystem) {
                return (
                  <div key={m.id} className="flex justify-center my-1">
                    <span className="text-[11px] px-3 py-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--cs-text-3)' }}>
                      {m.text}
                    </span>
                  </div>
                )
              }
              const mine = m.senderId === myUserId
              return (
                <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && <AvatarMsg url={m.senderPictureUrl} name={m.senderName} size={28} />}
                  <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-xs lg:max-w-md`}>
                    {!mine && (
                      <p className="text-[11px] font-semibold mb-1 ml-1" style={{ color: 'var(--cs-text-2)' }}>{m.senderName}</p>
                    )}
                    <div className="px-4 py-2.5 rounded-2xl text-sm"
                      style={mine
                        ? { background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', color: 'white', borderBottomRightRadius: 4 }
                        : { background: 'var(--cs-input-bg)', color: 'var(--cs-text-1)', border: '1px solid var(--cs-border)', borderBottomLeftRadius: 4 }}>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`text-[10px] mt-1 ${mine ? 'text-right opacity-70' : ''}`}
                        style={!mine ? { color: 'var(--cs-text-3)' } : {}}>
                        {timeLabel(m.sentAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 flex items-end gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--cs-border)', background: 'var(--cs-bg-nav)' }}>
          <textarea
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 rounded-2xl px-4 py-3 text-sm resize-none outline-none"
            style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)', maxHeight: 120 }} />
          <button onClick={sendChatMessage} disabled={!chatText.trim() || chatSending}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ background: chatText.trim() ? 'linear-gradient(135deg,#0d9488,#0ea5e9)' : 'var(--cs-input-bg)', color: chatText.trim() ? 'white' : 'var(--cs-text-3)' }}>
            {chatSending
              ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
          </button>
        </div>

        {leaveTarget && <LeaveDialog name={leaveTarget.name} onCancel={() => setLeaveTarget(null)} onConfirm={doLeave} />}
        {toast && <Toast msg={toast} />}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW: Group List
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--cs-bg)' }}>
      <div>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cs-text-1)' }}>Study Groups</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--cs-text-2)' }}>Collaborate with peers on shared subjects</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
            Create Group
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'var(--cs-input-bg)', width: 'fit-content' }}>
          {(['mine', 'discover'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === t ? 'var(--cs-bg)' : 'transparent',
                color: tab === t ? '#2dd4bf' : 'var(--cs-text-2)',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              {t === 'mine' ? `My Groups${myGroups.length ? ` (${myGroups.length})` : ''}` : 'Discover'}
            </button>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="p-5 rounded-2xl mb-5" style={{ background: 'var(--cs-input-bg)', border: '1px solid rgba(45,212,191,0.3)' }}>
            <p className="text-sm font-bold mb-4" style={{ color: 'var(--cs-text-1)' }}>Create Study Group</p>
            <div className="flex flex-col gap-3">
              <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="Group name" maxLength={60}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Subject (e.g. Data Science, React, IELTS…)" maxLength={60}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What will this group study? (optional)" maxLength={200} rows={2}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
              <div className="flex gap-3">
                <button onClick={create} disabled={saving || !name.trim()}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#0d9488,#22c55e)' }}>
                  {saving ? 'Creating…' : 'Create Group'}
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'var(--cs-bg)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-2)' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading spinner */}
        {loading || detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2dd4bf" strokeWidth="4"/>
              <path className="opacity-75" fill="#2dd4bf" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : tab === 'mine' ? (
          <GroupList
            groups={myGroups}
            onOpenChat={openChat}
            onOpenSettings={openSettings}
            onLeave={g => setLeaveTarget(g)}
            emptyText="No groups yet"
            emptyHint="Create a group to start studying together"
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
          />
        ) : (
          <GroupList
            groups={discover}
            onOpenChat={openSettings}
            onOpenSettings={openSettings}
            onJoin={doJoin}
            emptyText="No other groups yet"
            emptyHint="Be the first to create a group others can discover"
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
          />
        )}
      </div>

      {leaveTarget && <LeaveDialog name={leaveTarget.name} onCancel={() => setLeaveTarget(null)} onConfirm={doLeave} />}
      {toast && <Toast msg={toast} />}
    </div>
  )
}

// ── Shared sub-components ───────────────────────────────────────────────────

function LeaveDialog({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onCancel}>
      <div className="p-6 rounded-2xl w-80 shadow-2xl"
        style={{ background: 'var(--cs-bg-nav)', border: '1px solid var(--cs-border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(239,68,68,0.12)' }}>
          <svg viewBox="0 0 24 24" fill="#ef4444" className="w-6 h-6">
            <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
          </svg>
        </div>
        <p className="text-sm font-bold text-center mb-1" style={{ color: 'var(--cs-text-1)' }}>Leave "{name}"?</p>
        <p className="text-xs text-center mb-5" style={{ color: 'var(--cs-text-2)' }}>You will be removed from this group.</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)', color: '#2dd4bf' }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
            Yes, Leave
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium text-white shadow-xl"
      style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(45,212,191,0.3)' }}>
      {msg}
    </div>
  )
}

interface GroupListProps {
  groups: GroupDto[]
  onOpenChat: (g: GroupDto) => void
  onOpenSettings: (g: GroupDto) => void
  onLeave?: (g: GroupDto) => void
  onJoin?: (g: GroupDto) => void
  emptyText: string
  emptyHint: string
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
}

function GroupList({ groups, onOpenChat, onOpenSettings, onLeave, onJoin, emptyText, emptyHint, openMenuId, setOpenMenuId }: GroupListProps) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--cs-input-bg)' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" style={{ color: 'var(--cs-text-3)' }}>
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--cs-text-2)' }}>{emptyText}</p>
        <p className="text-xs text-center" style={{ color: 'var(--cs-text-3)' }}>{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map(g => (
        <div key={g.id}
          onClick={() => onOpenChat(g)}
          className="flex items-center gap-4 px-4 py-4 rounded-2xl cursor-pointer transition-all"
          style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = `${g.color}60`}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cs-border)'}>

          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
            style={{ background: g.color }}>
            {g.name[0].toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--cs-text-1)' }}>{g.name}</p>
              {g.isOwner && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Owner</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs" style={{ color: '#2dd4bf' }}>{g.subject}</span>
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--cs-text-3)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
                {g.memberCount}
              </span>
            </div>
            {g.description && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--cs-text-3)' }}>{g.description}</p>}
          </div>

          {/* Join button (discover tab) */}
          {onJoin && (
            <button onClick={e => { e.stopPropagation(); onJoin(g) }}
              className="text-xs px-3 py-1.5 rounded-xl font-medium text-white transition-all active:scale-95 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
              Join
            </button>
          )}

          {/* Three-dots menu (my groups tab) */}
          {onLeave && (
            <div className="relative flex-shrink-0" data-card-menu onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setOpenMenuId(openMenuId === g.id ? null : g.id)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
                style={{ color: 'var(--cs-text-3)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
              {openMenuId === g.id && (
                <div className="absolute right-0 top-9 w-44 rounded-xl shadow-2xl overflow-hidden z-50 py-1"
                  style={{ background: 'var(--cs-bg-nav)', border: '1px solid var(--cs-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                  <button onClick={() => { setOpenMenuId(null); onOpenChat(g) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-white/5"
                    style={{ color: 'var(--cs-text-1)' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#2dd4bf' }}>
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                    </svg>
                    Open Chat
                  </button>
                  <button onClick={() => { setOpenMenuId(null); onOpenSettings(g) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-white/5"
                    style={{ color: 'var(--cs-text-1)' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--cs-text-3)' }}>
                      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                    </svg>
                    Group Settings
                  </button>
                  {g.isOwner && (
                    <button onClick={() => { setOpenMenuId(null); onOpenSettings(g) }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-white/5"
                      style={{ color: 'var(--cs-text-1)' }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22c55e' }}>
                        <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                      Invite Members
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
