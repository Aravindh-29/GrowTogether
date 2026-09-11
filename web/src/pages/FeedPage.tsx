import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { postApi, type PostDto, type PostCommentDto, type PostReactionUserDto } from '../api/postApi'
import { profileApi } from '../api/profileApi'
import { connectionApi, type ConnectionWithProfile } from '../api/connectionApi'
import { chatApi } from '../api/chatApi'
import { useAuthStore } from '../store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

function mediaUrl(url: string | null | undefined) {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url
  return `${BASE_URL}${url}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
  const color = COLORS[(name.charCodeAt(0) || 0) % COLORS.length]
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const src = mediaUrl(url)
  return src
    ? <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
        {initials || '?'}
      </div>
}

// ── Emoji data ────────────────────────────────────────────────────────────

const EMOJI_CATEGORIES = [
  { label: '😊 Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😋','😛','😜','🤪','🤑','🤗','🤔','😐','😑','😶','😏','😒','🙄','😬','🤥','😔','😪','😴','😷','🤒','🤕','🤢','🥵','🥶','😵','🤯','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','😤','😡','😠','🤬','😈','👿','💀','🤡','👻','👽','🤖'] },
  { label: '👋 Gestures', emojis: ['👍','👎','👏','🙌','🤝','🤜','🤛','👊','✊','✌️','🤞','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','🖖','💪','🦾','🖐️','✋','👋','🤚','🤙','💅','🤳','🫵','🫶','❤️‍🔥'] },
  { label: '❤️ Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','❤️‍🩹','❤️‍🔥','🫀'] },
  { label: '🎉 Activities', emojis: ['🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','🎯','🎮','🎲','🎭','🎨','🎬','🎤','🎵','🎶','🎸','🎹','🥁','🎺','🎻','🎼','🏅','🏋️','⚽','🏀','🏈','⚾','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥊','⛷️','🏂','🏄','🚴','🤸','🧘','🤺'] },
  { label: '🌿 Nature', emojis: ['🌸','🌺','🌻','🌹','🌷','🌼','💐','🌿','🍀','🌱','🌲','🌳','🌴','🍁','🍂','🍃','🌾','🌵','🎋','🎍','☘️','🌊','🌈','⭐','🌟','✨','💫','☀️','🌤️','⛅','🌧️','⛈️','🌩️','❄️','☃️','🌙','🌍','🔥','💧','🌊'] },
  { label: '💡 Objects', emojis: ['💡','🔑','🗝️','💼','📱','💻','🖥️','⌨️','🖱️','📷','📸','📹','🎥','📺','📻','🔊','🔔','📣','💬','💭','📝','📋','📌','📍','🔍','🔎','📚','📖','📰','🗞️','📊','📈','📉','🔧','🔨','⚙️','🛠️','🔒','🔓','🚀','🛸','⚡','💰','💳','🎓','🏥','🏦','🏠','🚗','✈️','🚢','🚂'] },
]

// ── Emoji Picker ──────────────────────────────────────────────────────────

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState(0)

  const filtered = search.trim()
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search.trim()))
    : EMOJI_CATEGORIES[cat].emojis

  return (
    <div className="absolute bottom-12 left-0 z-50 rounded-2xl shadow-2xl overflow-hidden"
      style={{ width: 320, background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}
      onMouseDown={e => e.preventDefault()}>
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emoji…"
          className="w-full text-xs px-3 py-1.5 rounded-full outline-none"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
      </div>
      {/* Category tabs */}
      {!search.trim() && (
        <div className="flex gap-1 px-3 pb-1 overflow-x-auto">
          {EMOJI_CATEGORIES.map((c, i) => (
            <button key={i} onClick={() => setCat(i)}
              className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full transition-all"
              style={{ background: i === cat ? 'rgba(45,212,191,0.2)' : 'transparent', color: i === cat ? '#2dd4bf' : 'var(--cs-text-3)' }}>
              {c.label.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
      {/* Grid */}
      <div className="grid px-2 pb-3 overflow-y-auto" style={{ gridTemplateColumns: 'repeat(8, 1fr)', maxHeight: 200 }}>
        {filtered.map((e, i) => (
          <button key={i} onClick={() => { onSelect(e); onClose() }}
            className="text-xl p-1 rounded-lg transition-all hover:scale-125"
            style={{ lineHeight: 1.4 }}>
            {e}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-8 text-center text-xs py-4" style={{ color: 'var(--cs-text-3)' }}>No emoji found</p>
        )}
      </div>
    </div>
  )
}

// ── Compose Modal ─────────────────────────────────────────────────────────

interface ComposeModalProps {
  myName: string
  myAvatar: string | null
  myHeadline: string | null
  onClose: () => void
  onPosted: (post: PostDto) => void
}

export function ComposeModal({ myName, myAvatar, myHeadline, onClose, onPosted }: ComposeModalProps) {
  const [content, setContent] = useState('')
  // images (multi-select up to 5)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  // document
  const [docFile, setDocFile] = useState<File | null>(null)
  // poll
  const [showPoll, setShowPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  // link (via More menu)
  const [linkUrl, setLinkUrl] = useState('')
  const [showLink, setShowLink] = useState(false)
  // schedule
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  // audience
  const [audience, setAudience] = useState<'anyone' | 'connections'>('anyone')
  const [commentVisibility, setCommentVisibility] = useState<'anyone' | 'connections'>('anyone')
  const [showAudiencePicker, setShowAudiencePicker] = useState(false)
  const [showCommentsPicker, setShowCommentsPicker] = useState(false)
  // ui state
  const [showEmoji, setShowEmoji] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [posting, setPosting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  // Insert emoji at cursor position
  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current
    if (!ta) { setContent(c => c + emoji); return }
    const start = ta.selectionStart ?? content.length
    const end = ta.selectionEnd ?? content.length
    const next = content.slice(0, start) + emoji + content.slice(end)
    setContent(next)
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + emoji.length
      ta.focus()
    })
  }

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - imageFiles.length)
    if (!files.length) return
    setImageFiles(prev => [...prev, ...files])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setImagePreviews(prev => [...prev, ev.target?.result as string])
      reader.readAsDataURL(file)
    })
    if (imageInputRef.current) imageInputRef.current.value = ''
    setDocFile(null)
  }

  const onDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setDocFile(file)
    setImageFiles([]); setImagePreviews([])
  }

  const removeImage = (idx: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx))
    setImagePreviews(prev => prev.filter((_, i) => i !== idx))
  }
  const removeDoc = () => { setDocFile(null); if (docInputRef.current) docInputRef.current.value = '' }

  const addPollOption = () => { if (pollOptions.length < 4) setPollOptions(o => [...o, '']) }
  const removePollOption = (i: number) => { if (pollOptions.length > 2) setPollOptions(o => o.filter((_, x) => x !== i)) }

  const handlePost = async () => {
    if (!content.trim()) return
    setPosting(true)
    try {
      const uploadedUrls: string[] = []
      let documentUrl: string | null = null
      let documentName: string | null = null

      for (let i = 0; i < imageFiles.length; i++) {
        setUploadStatus(`Uploading image ${i + 1}/${imageFiles.length}…`)
        const r = await postApi.uploadImage(imageFiles[i])
        uploadedUrls.push(r.data.url)
      }
      if (docFile) {
        setUploadStatus('Uploading document…')
        const r = await postApi.uploadDocument(docFile)
        documentUrl = r.data.url
        documentName = r.data.name
      }
      setUploadStatus('Posting…')

      const finalContent = linkUrl.trim()
        ? content.trim() + '\n\n🔗 ' + linkUrl.trim()
        : content.trim()

      const hasPoll = showPoll && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2

      await postApi.create(finalContent, {
        imageUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        documentUrl,
        documentName,
        pollQuestion: hasPoll ? pollQuestion.trim() : null,
        pollOptions: hasPoll ? pollOptions.filter(o => o.trim()) : undefined,
        scheduledAt: showSchedule && scheduledAt ? scheduledAt : null,
        audience,
        commentVisibility,
      }).then(r => { onPosted(r.data); onClose() })
    } catch {}
    setPosting(false)
    setUploadStatus('')
  }

  const canPost = content.trim().length > 0
  const isBusy = posting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="w-full max-w-2xl mx-4 rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)', maxHeight: '92vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--cs-border)' }}>
          <h2 className="font-bold text-base" style={{ color: 'var(--cs-text-1)' }}>Create a post</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--cs-text-2)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="overflow-y-auto flex-1">

          {/* Author + pills */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={myName} url={myAvatar} size={46} />
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--cs-text-1)' }}>{myName}</p>
                {myHeadline && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--cs-text-3)' }}>{myHeadline}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">

                  {/* Audience picker */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowAudiencePicker(s => !s); setShowCommentsPicker(false) }}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all hover:opacity-80"
                      style={{ color: '#2dd4bf', borderColor: 'rgba(45,212,191,0.4)', background: 'rgba(45,212,191,0.07)' }}>
                      {audience === 'anyone'
                        ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                        : <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                      }
                      {audience === 'anyone' ? 'Anyone' : 'Connections only'}
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5"><path d="M7 10l5 5 5-5z"/></svg>
                    </button>
                    {showAudiencePicker && (
                      <div className="absolute top-7 left-0 z-50 rounded-xl shadow-2xl overflow-hidden"
                        style={{ width: 240, background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}>
                        <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--cs-text-3)' }}>Who can see this?</p>
                        {(['anyone', 'connections'] as const).map(opt => (
                          <button key={opt} onClick={() => { setAudience(opt); setShowAudiencePicker(false) }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-all hover:opacity-80"
                            style={{ color: audience === opt ? '#2dd4bf' : 'var(--cs-text-1)', background: audience === opt ? 'rgba(45,212,191,0.07)' : 'transparent' }}>
                            {opt === 'anyone'
                              ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                              : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                            }
                            <div>
                              <p>{opt === 'anyone' ? 'Anyone' : 'Connections only'}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: 'var(--cs-text-3)' }}>
                                {opt === 'anyone' ? 'Visible to everyone' : 'Only your connections'}
                              </p>
                            </div>
                            {audience === opt && <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 ml-auto flex-shrink-0"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comments visibility picker */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowCommentsPicker(s => !s); setShowAudiencePicker(false) }}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all hover:opacity-80"
                      style={{ color: 'var(--cs-text-2)', borderColor: 'var(--cs-border)', background: 'rgba(255,255,255,0.04)' }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                      Comments: {commentVisibility === 'anyone' ? 'Anyone' : 'Connections'}
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5"><path d="M7 10l5 5 5-5z"/></svg>
                    </button>
                    {showCommentsPicker && (
                      <div className="absolute top-7 left-0 z-50 rounded-xl shadow-2xl overflow-hidden"
                        style={{ width: 240, background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}>
                        <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--cs-text-3)' }}>Who can comment?</p>
                        {(['anyone', 'connections'] as const).map(opt => (
                          <button key={opt} onClick={() => { setCommentVisibility(opt); setShowCommentsPicker(false) }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-all hover:opacity-80"
                            style={{ color: commentVisibility === opt ? '#2dd4bf' : 'var(--cs-text-1)', background: commentVisibility === opt ? 'rgba(45,212,191,0.07)' : 'transparent' }}>
                            {opt === 'anyone'
                              ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                              : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                            }
                            <div>
                              <p>{opt === 'anyone' ? 'Anyone' : 'Connections only'}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: 'var(--cs-text-3)' }}>
                                {opt === 'anyone' ? 'Everyone can comment' : 'Only your connections'}
                              </p>
                            </div>
                            {commentVisibility === opt && <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 ml-auto flex-shrink-0"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Textarea */}
          <div className="px-5 pb-2">
            <textarea ref={textareaRef} value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') onClose() }}
              placeholder="Share your thoughts ..."
              rows={7}
              className="w-full resize-none text-sm leading-relaxed outline-none"
              style={{ background: 'transparent', color: 'var(--cs-text-1)', caretColor: '#2dd4bf' }}
            />
          </div>

          {/* ── Image previews grid ── */}
          {imagePreviews.length > 0 && (
            <div className="px-5 pb-3">
              <div className={`grid gap-1.5 ${imagePreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden"
                    style={{ border: '1px solid var(--cs-border)' }}>
                    <img src={src} alt={`preview-${i}`} className="w-full object-cover" style={{ maxHeight: imagePreviews.length === 1 ? 240 : 140 }} />
                    <button onClick={() => removeImage(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                  </div>
                ))}
                {imagePreviews.length < 5 && (
                  <button onClick={() => imageInputRef.current?.click()}
                    className="rounded-xl flex items-center justify-center text-xs font-medium transition-all hover:opacity-80"
                    style={{ minHeight: 80, background: 'rgba(255,255,255,0.04)', border: '2px dashed var(--cs-border)', color: 'var(--cs-text-3)' }}>
                    + Add
                  </button>
                )}
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--cs-text-3)' }}>
                {imagePreviews.length}/5 images
              </p>
            </div>
          )}

          {/* ── Document chip ── */}
          {docFile && (
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0" style={{ color: '#818cf8' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
                </svg>
                <span className="flex-1 text-xs font-medium truncate" style={{ color: 'var(--cs-text-1)' }}>{docFile.name}</span>
                <span className="text-xs" style={{ color: 'var(--cs-text-3)' }}>
                  {(docFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button onClick={removeDoc} className="w-5 h-5 flex items-center justify-center" style={{ color: '#ef4444' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Poll builder ── */}
          {showPoll && (
            <div className="px-5 pb-3">
              <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>📊 Create a Poll</p>
                  <button onClick={() => setShowPoll(false)} className="text-xs" style={{ color: '#ef4444' }}>Remove</button>
                </div>
                <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
                  placeholder="Ask a question…"
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none mb-2"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <input value={opt} onChange={e => { const o = [...pollOptions]; o[i] = e.target.value; setPollOptions(o) }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 text-sm px-3 py-1.5 rounded-lg outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
                    {pollOptions.length > 2 && (
                      <button onClick={() => removePollOption(i)} style={{ color: '#ef4444' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <button onClick={addPollOption} className="text-xs font-semibold mt-1" style={{ color: '#f59e0b' }}>
                    + Add option
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Link input ── */}
          {showLink && (
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0" style={{ color: '#0ea5e9' }}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 text-sm outline-none"
                  style={{ background: 'transparent', color: 'var(--cs-text-1)' }} />
                <button onClick={() => { setShowLink(false); setLinkUrl('') }} style={{ color: '#ef4444' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Schedule picker ── */}
          {showSchedule && (
            <div className="px-5 pb-3">
              <div className="rounded-xl p-3" style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold" style={{ color: '#2dd4bf' }}>🕐 Schedule post</p>
                  <button onClick={() => { setShowSchedule(false); setScheduledAt('') }} className="text-xs" style={{ color: '#ef4444' }}>Cancel</button>
                </div>
                <input type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }} />
                {scheduledAt && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--cs-text-3)' }}>
                    Will post on {new Date(scheduledAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--cs-border)' }}>

          {/* Hidden inputs */}
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onImageChange} />
          <input ref={docInputRef} type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
            className="hidden" onChange={onDocChange} />

          {/* Toolbar row */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-0.5 relative">

              {/* 1 — Emoji */}
              <button
                title="Emoji"
                onClick={() => { setShowEmoji(s => !s); setShowMore(false) }}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-70"
                style={{ color: showEmoji ? '#2dd4bf' : 'var(--cs-text-3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
                  <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3"/>
                  <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3"/>
                </svg>
              </button>
              {showEmoji && (
                <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />
              )}

              {/* 2 — Photo */}
              <button
                title="Photo"
                onClick={() => { imageInputRef.current?.click(); setShowMore(false) }}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-70"
                style={{ color: imageFiles.length > 0 ? '#2dd4bf' : 'var(--cs-text-3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>

              {/* 3 — Document */}
              <button
                title="Document (PDF/DOC/PPT/XLS)"
                onClick={() => { docInputRef.current?.click(); setShowMore(false) }}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-70"
                style={{ color: docFile ? '#818cf8' : 'var(--cs-text-3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </button>

              {/* 4 — More (…) */}
              <div className="relative">
                <button
                  title="More options"
                  onClick={() => { setShowMore(s => !s); setShowEmoji(false) }}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-70"
                  style={{ color: showMore ? '#2dd4bf' : 'var(--cs-text-3)' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                  </svg>
                </button>
                {showMore && (
                  <div className="absolute bottom-11 left-0 z-50 rounded-xl shadow-2xl overflow-hidden"
                    style={{ width: 200, background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}>
                    <button
                      onClick={() => { setShowPoll(true); setShowMore(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:opacity-80 transition-all"
                      style={{ color: 'var(--cs-text-1)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-lg">📊</span>
                      <div>
                        <p className="font-semibold text-xs">Create a poll</p>
                        <p className="text-[10px]" style={{ color: 'var(--cs-text-3)' }}>Ask your network</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setShowLink(true); setShowMore(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:opacity-80 transition-all"
                      style={{ color: 'var(--cs-text-1)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-lg">🔗</span>
                      <div>
                        <p className="font-semibold text-xs">Add a link</p>
                        <p className="text-[10px]" style={{ color: 'var(--cs-text-3)' }}>Share a URL</p>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setContent(c => c ? c + '\n\n🎉 ' : '🎉 ')
                        setShowMore(false)
                        textareaRef.current?.focus()
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:opacity-80 transition-all"
                      style={{ color: 'var(--cs-text-1)' }}>
                      <span className="text-lg">🎉</span>
                      <div>
                        <p className="font-semibold text-xs">Celebrate</p>
                        <p className="text-[10px]" style={{ color: 'var(--cs-text-3)' }}>Share an achievement</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 5 — Schedule clock + Post button */}
            <div className="flex items-center gap-2">
              <button
                title="Schedule post"
                onClick={() => setShowSchedule(s => !s)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-70"
                style={{ color: showSchedule && scheduledAt ? '#2dd4bf' : 'var(--cs-text-3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>
              <button
                onClick={handlePost}
                disabled={!canPost || isBusy}
                className="px-5 py-2 rounded-full text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: canPost && !isBusy ? 'linear-gradient(135deg,#0d9488,#0ea5e9)' : 'rgba(255,255,255,0.1)',
                  color: canPost && !isBusy ? '#fff' : 'var(--cs-text-3)',
                  boxShadow: canPost && !isBusy ? '0 4px 12px rgba(13,148,136,0.35)' : 'none',
                }}>
                {isBusy ? (uploadStatus || 'Posting…') : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Send Modal ────────────────────────────────────────────────────────────

interface SendModalProps { post: PostDto; onClose: () => void }

export function SendModal({ post, onClose }: SendModalProps) {
  const navigate = useNavigate()
  const [friends, setFriends] = useState<ConnectionWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  useEffect(() => {
    connectionApi.getConnections()
      .then(r => setFriends(r.data.filter(c => c.status === 'Accepted')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sendToFriend = async (f: ConnectionWithProfile) => {
    if (sent === f.userId) return
    setSending(f.userId)
    try {
      const convRes = await chatApi.startConversation(f.userId)
      await chatApi.sendMessage(convRes.data.id, '', post.id)
      setSent(f.userId)
      setTimeout(() => navigate('/messages'), 900)
    } catch {}
    setSending(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--cs-border)' }}>
          <h2 className="font-bold text-sm" style={{ color: 'var(--cs-text-1)' }}>Send via Message</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--cs-text-2)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#2dd4bf', borderTopColor: 'transparent' }} />
            </div>
          ) : friends.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--cs-text-3)' }}>No connections yet</p>
          ) : friends.map(f => (
            <div key={f.userId} className="flex items-center gap-3 px-5 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Avatar name={f.name} url={f.profilePictureUrl} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--cs-text-1)' }}>{f.name}</p>
                {f.headline && <p className="text-xs truncate" style={{ color: 'var(--cs-text-3)' }}>{f.headline}</p>}
              </div>
              <button onClick={() => sendToFriend(f)}
                disabled={sending === f.userId || sent === f.userId}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 disabled:opacity-60"
                style={{
                  background: sent === f.userId ? 'rgba(34,197,94,0.15)' : 'rgba(45,212,191,0.15)',
                  color: sent === f.userId ? '#22c55e' : '#2dd4bf',
                  border: `1px solid ${sent === f.userId ? 'rgba(34,197,94,0.3)' : 'rgba(45,212,191,0.3)'}`,
                }}>
                {sending === f.userId ? '…' : sent === f.userId ? '✓ Sent' : 'Send'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Comment Section ───────────────────────────────────────────────────────

interface CommentSectionProps {
  postId: string
  myName: string
  myAvatar: string | null
  myUserId: string
}

function CommentSection({ postId, myName, myAvatar, myUserId }: CommentSectionProps) {
  const [comments, setComments] = useState<PostCommentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    postApi.getComments(postId)
      .then(r => setComments(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [postId])

  const submit = async () => {
    if (!newText.trim()) return
    setPosting(true)
    try {
      const res = await postApi.addComment(postId, newText.trim())
      setComments(prev => [...prev, res.data])
      setNewText('')
    } catch {}
    setPosting(false)
  }

  const deleteComment = async (commentId: string) => {
    try {
      await postApi.deleteComment(postId, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch {}
  }

  return (
    <div className="pt-3">
      <div className="flex items-start gap-2.5 mb-3">
        <Avatar name={myName} url={myAvatar} size={32} />
        <div className="flex-1 flex items-center gap-2">
          <input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder="Add a comment…"
            className="flex-1 text-sm px-3 py-2 rounded-full outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-1)' }}
          />
          <button onClick={submit} disabled={!newText.trim() || posting}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'rgba(45,212,191,0.2)', color: '#2dd4bf' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-3">
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: '#2dd4bf', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar name={c.authorName} url={c.authorAvatar} size={30} />
              <div className="flex-1 min-w-0">
                <div className="inline-block px-3 py-2 rounded-2xl rounded-tl-sm text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--cs-text-1)', maxWidth: '100%' }}>
                  <p className="font-semibold text-xs mb-0.5" style={{ color: '#2dd4bf' }}>{c.authorName}</p>
                  <p className="leading-snug">{c.content}</p>
                </div>
                <div className="flex items-center gap-3 mt-0.5 px-1">
                  <span className="text-[11px]" style={{ color: 'var(--cs-text-3)' }}>{timeAgo(c.createdAt)}</span>
                  {c.authorId === myUserId && (
                    <button onClick={() => deleteComment(c.id)}
                      className="text-[11px] transition-all hover:opacity-80"
                      style={{ color: '#ef4444' }}>Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Reaction List Modal ───────────────────────────────────────────────────

function ReactionListModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [reactions, setReactions] = useState<PostReactionUserDto[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'agree' | 'disagree'>('all')

  useEffect(() => {
    postApi.getReactions(postId)
      .then(r => setReactions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [postId])

  const filtered = tab === 'all' ? reactions : reactions.filter(r => r.type === tab)
  const agreeCount = reactions.filter(r => r.type === 'agree').length
  const disagreeCount = reactions.filter(r => r.type === 'disagree').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--cs-border)' }}>
          <p className="font-bold text-base" style={{ color: 'var(--cs-text-1)' }}>Reactions</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--cs-text-2)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div className="flex gap-1 px-4 pt-3">
          {(['all', 'agree', 'disagree'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
              style={{ background: tab === t ? 'rgba(45,212,191,0.2)' : 'transparent', color: tab === t ? '#2dd4bf' : 'var(--cs-text-3)' }}>
              {t === 'all' ? `All ${reactions.length}` : t === 'agree' ? `✅ ${agreeCount}` : `👎 ${disagreeCount}`}
            </button>
          ))}
        </div>
        <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#2dd4bf', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--cs-text-3)' }}>No reactions yet</p>
          ) : filtered.map(r => (
            <div key={r.userId} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
              onClick={() => { navigate(`/profile/view/${r.userId}`); onClose() }}>
              <Avatar name={r.name} url={r.avatar} size={38} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--cs-text-1)' }}>{r.name}</p>
              </div>
              <span className="text-lg">{r.type === 'agree' ? '✅' : '👎'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Post Card ─────────────────────────────────────────────────────────────

export interface PostCardProps {
  post: PostDto
  myUserId: string
  myName: string
  myAvatar: string | null
  onLike: (id: string) => void
  onRepost: (id: string) => void
  onSend: (post: PostDto) => void
  onDelete: (id: string) => void
  onAgree: (id: string) => void
  onDisagree: (id: string) => void
  onSave: (id: string) => void
  onVotePoll?: (id: string, option: number) => void
}

export function PostCard({ post, myUserId, myName, myAvatar, onLike, onRepost, onSend, onDelete, onAgree, onDisagree, onSave, onVotePoll }: PostCardProps) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const isEdited = post.updatedAt !== post.createdAt
  const MAX_CONTENT = 280
  const needsMore = post.content.length > MAX_CONTENT
  const displayContent = expanded ? post.content : post.content.slice(0, MAX_CONTENT)
  const images = (post.imageUrls ?? []).map(u => mediaUrl(u)).filter(Boolean) as string[]

  return (
    <>
      <div className="rounded-2xl mb-4 overflow-hidden"
        style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}>

        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <div onClick={() => navigate(`/profile/view/${post.authorId}`)} className="cursor-pointer flex-shrink-0">
            <Avatar name={post.authorName} url={post.authorAvatar} size={46} />
          </div>
          <div className="flex-1 min-w-0">
            <p onClick={() => navigate(`/profile/view/${post.authorId}`)}
              className="font-bold text-sm leading-tight cursor-pointer hover:underline" style={{ color: 'var(--cs-text-1)' }}>
              {post.authorName}
            </p>
            {post.authorHeadline && (
              <p className="text-xs mt-0.5 leading-snug line-clamp-2" style={{ color: 'var(--cs-text-3)' }}>
                {post.authorHeadline}
              </p>
            )}
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className="text-[11px]" style={{ color: 'var(--cs-text-3)' }}>{timeAgo(post.createdAt)}</span>
              {isEdited && <>
                <span style={{ color: 'var(--cs-text-3)', fontSize: 9 }}>·</span>
                <span className="text-[11px]" style={{ color: 'var(--cs-text-3)' }}>Edited</span>
              </>}
              <span style={{ color: 'var(--cs-text-3)', fontSize: 9 }}>·</span>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3" style={{ color: 'var(--cs-text-3)' }}>
                <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => onSave(post.id)} title={post.savedByMe ? 'Remove from saved' : 'Save post'}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:opacity-80"
              style={{ color: post.savedByMe ? '#2dd4bf' : 'var(--cs-text-3)', background: post.savedByMe ? 'rgba(45,212,191,0.12)' : 'transparent' }}>
              <svg viewBox="0 0 24 24" fill={post.savedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
              </svg>
            </button>
            {post.authorId === myUserId && (
              <button onClick={() => onDelete(post.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all hover:opacity-80"
                style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Content text */}
        <div className="px-4 pb-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--cs-text-1)' }}>
            {displayContent}
            {needsMore && !expanded && (
              <span>
                {'… '}
                <button onClick={() => setExpanded(true)} className="font-semibold hover:underline" style={{ color: '#2dd4bf' }}>
                  see more
                </button>
              </span>
            )}
          </p>
        </div>

        {/* Image carousel */}
        {images.length > 0 && (
          <div className="relative overflow-hidden cursor-pointer" onClick={() => setLightboxOpen(true)}>
            <img src={images[imgIndex]} alt="post" className="w-full object-cover" style={{ maxHeight: 420, display: 'block' }} />
            {images.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length) }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all"
                  style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
                </button>
                <button onClick={e => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all"
                  style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <div key={i} onClick={e => { e.stopPropagation(); setImgIndex(i) }}
                      className="w-1.5 h-1.5 rounded-full transition-all cursor-pointer"
                      style={{ background: i === imgIndex ? '#fff' : 'rgba(255,255,255,0.45)', transform: i === imgIndex ? 'scale(1.3)' : 'scale(1)' }} />
                  ))}
                </div>
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                  {imgIndex + 1}/{images.length}
                </div>
              </>
            )}
          </div>
        )}

        {/* Document attachment */}
        {post.documentUrl && (
          <div className="px-4 pb-3">
            <a
              href={mediaUrl(post.documentUrl) ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:opacity-80"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.22)', textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 flex-shrink-0" style={{ color: '#818cf8' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--cs-text-1)' }}>
                  {post.documentName || 'Document'}
                </p>
                <p className="text-xs" style={{ color: 'var(--cs-text-3)' }}>Click to download</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0" style={{ color: '#818cf8' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </a>
          </div>
        )}

        {/* Poll */}
        {post.pollQuestion && post.pollOptions.length >= 2 && (() => {
          const totalVotes = (post.pollVoteCounts ?? []).reduce((s, n) => s + n, 0)
          const hasVoted = post.myPollVote != null
          return (
            <div className="px-4 pb-3">
              <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--cs-text-1)' }}>
                  📊 {post.pollQuestion}
                </p>
                <div className="flex flex-col gap-2">
                  {post.pollOptions.map((opt, i) => {
                    const count = post.pollVoteCounts?.[i] ?? 0
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                    const isSelected = post.myPollVote === i
                    if (hasVoted) {
                      return (
                        <div key={i} className="relative rounded-lg overflow-hidden"
                          style={{ border: isSelected ? '1.5px solid rgba(245,158,11,0.7)' : '1px solid rgba(245,158,11,0.25)' }}>
                          <div className="absolute inset-0 rounded-lg transition-all duration-500"
                            style={{ width: `${pct}%`, background: isSelected ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.1)' }} />
                          <div className="relative flex items-center justify-between px-3 py-2.5">
                            <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--cs-text-1)' }}>
                              {isSelected && <span className="text-amber-400">✓</span>}
                              {opt}
                            </span>
                            <span className="text-xs font-bold" style={{ color: 'rgba(245,158,11,0.9)' }}>{pct}%</span>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <button key={i} onClick={() => onVotePoll?.(post.id, i)}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-80 active:scale-[0.98]"
                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--cs-text-1)' }}>
                        {opt}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--cs-text-3)' }}>
                  {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                  {!hasVoted && ' · Click to vote'}
                </p>
              </div>
            </div>
          )
        })()}

        {/* Scheduled indicator */}
        {post.scheduledAt && (
          <div className="px-4 pb-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(45,212,191,0.1)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Scheduled · {new Date(post.scheduledAt).toLocaleString()}
            </span>
          </div>
        )}

        {/* Stats */}
        {(post.agreeCount > 0 || post.disagreeCount > 0 || post.commentsCount > 0 || post.repostsCount > 0) && (
          <div className="flex items-center gap-3 px-4 py-2 text-xs"
            style={{ color: 'var(--cs-text-3)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {(post.agreeCount > 0 || post.disagreeCount > 0) && (
              <button onClick={() => setShowReactions(true)} className="flex items-center gap-1.5 hover:underline">
                {post.agreeCount > 0 && <><span>✅</span><span>{post.agreeCount}</span></>}
                {post.disagreeCount > 0 && <><span className="ml-1">👎</span><span>{post.disagreeCount}</span></>}
              </button>
            )}
            <span className="flex-1"/>
            {post.commentsCount > 0 && (
              <button onClick={() => setShowComments(s => !s)} className="hover:underline">
                {post.commentsCount} comment{post.commentsCount !== 1 ? 's' : ''}
              </button>
            )}
            {post.repostsCount > 0 && (
              <span>{post.repostsCount} share{post.repostsCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        )}

        {showReactions && <ReactionListModal postId={post.id} onClose={() => setShowReactions(false)} />}

        {/* Action bar */}
        <div className="grid grid-cols-4 px-1 py-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => onAgree(post.id)}
            className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95"
            style={{ color: post.agreedByMe ? '#22c55e' : 'var(--cs-text-3)' }}>
            <svg viewBox="0 0 24 24" fill={post.agreedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" style={{ width: 17, height: 17 }}>
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            Agree{post.agreeCount > 0 ? ` ${post.agreeCount}` : ''}
          </button>

          <button onClick={() => onDisagree(post.id)}
            className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95"
            style={{ color: post.disagreedByMe ? '#ef4444' : 'var(--cs-text-3)' }}>
            <svg viewBox="0 0 24 24" fill={post.disagreedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" style={{ width: 17, height: 17, transform: 'rotate(180deg)' }}>
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            Nope{post.disagreeCount > 0 ? ` ${post.disagreeCount}` : ''}
          </button>

          <button onClick={() => setShowComments(s => !s)}
            className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95"
            style={{ color: showComments ? '#2dd4bf' : 'var(--cs-text-3)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 17, height: 17 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Comment{post.commentsCount > 0 ? ` ${post.commentsCount}` : ''}
          </button>

          <button onClick={() => onSend(post)}
            className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95"
            style={{ color: 'var(--cs-text-3)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 17, height: 17 }}>
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Send
          </button>
        </div>

        {/* Inline Comments */}
        {showComments && (
          <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--cs-border)' }}>
            <CommentSection postId={post.id} myName={myName} myAvatar={myAvatar} myUserId={myUserId} />
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightboxOpen(false)}>
          <div className="relative flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img src={images[imgIndex]} alt="full"
              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12 }} />
            {images.length > 1 && (
              <>
                <button onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-[-48px] w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
                </button>
                <button onClick={() => setImgIndex(i => (i + 1) % images.length)}
                  className="absolute right-[-48px] w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                </button>
              </>
            )}
          </div>
          <button className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
            onClick={() => setLightboxOpen(false)}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
          <a href={images[imgIndex]} download onClick={e => e.stopPropagation()}
            className="absolute bottom-5 right-5 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(45,212,191,0.85)', color: '#fff', textDecoration: 'none' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Save Photo
          </a>
        </div>
      )}
    </>
  )
}

// ── FeedPage ──────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [myName, setMyName] = useState(user?.displayName ?? '')
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [myHeadline, setMyHeadline] = useState<string | null>(null)
  const [connectionsCount, setConnectionsCount] = useState(0)
  const [connections, setConnections] = useState<ConnectionWithProfile[]>([])

  const [posts, setPosts] = useState<PostDto[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [sendPost, setSendPost] = useState<PostDto | null>(null)
  const [sentinelVisible, setSentinelVisible] = useState(false)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const PAGE_SIZE = 20
  const hasMore = posts.length < total
  const sentinelRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef(1)
  const baselineTotalRef = useRef(0)   // total when feed was first loaded
  const fetchingRef = useRef(false)    // prevents double-fire during React batching

  useEffect(() => {
    profileApi.getMe()
      .then(r => {
        const p = r.data
        setMyName(`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || user?.displayName || '')
        setMyAvatar(p.profilePictureUrl ?? null)
        setMyHeadline(p.headline ?? null)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    connectionApi.getConnections()
      .then(r => {
        const accepted = r.data.filter(c => c.status === 'Accepted')
        setConnectionsCount(accepted.length)
        setConnections(accepted)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async (p: number, append: boolean) => {
    if (p === 1) setLoading(true)
    else setLoadingMore(true)
    fetchingRef.current = true
    try {
      const res = await postApi.getFeed(p, PAGE_SIZE)
      const data = res.data
      setTotal(data.total)
      if (!append) {
        baselineTotalRef.current = data.total
        setNewPostsCount(0)
      }
      setPosts(prev => append ? [...prev, ...data.items] : data.items)
    } catch {}
    setLoading(false)
    setLoadingMore(false)
    fetchingRef.current = false
  }, [])

  // Initial load
  useEffect(() => { pageRef.current = 1; load(1, false) }, [load])

  // Poll every 30 s for new posts while user is scrolling — show banner instead of auto-jump
  useEffect(() => {
    const id = setInterval(async () => {
      if (baselineTotalRef.current === 0) return
      try {
        const res = await postApi.getFeed(1, 1)
        const latest = res.data.total
        if (latest > baselineTotalRef.current) {
          setNewPostsCount(latest - baselineTotalRef.current)
        }
      } catch {}
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  // IntersectionObserver just tracks whether sentinel is in view
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const ob = new IntersectionObserver(
      ([e]) => setSentinelVisible(e.isIntersecting),
      { rootMargin: '400px' }
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [])

  // Load next page whenever sentinel becomes visible AND conditions are met
  useEffect(() => {
    if (!sentinelVisible || !hasMore || loading || loadingMore || fetchingRef.current) return
    const next = pageRef.current + 1
    pageRef.current = next
    setPage(next)
    load(next, true)
  }, [sentinelVisible, hasMore, loading, loadingMore, load])

  const handleRefresh = useCallback(() => {
    pageRef.current = 1
    setPage(1)
    setNewPostsCount(0)
    baselineTotalRef.current = 0
    load(1, false)
  }, [load])

  const handleLike = async (id: string) => {
    try {
      const res = await postApi.toggleLike(id)
      setPosts(prev => prev.map(p => p.id === id ? res.data : p))
    } catch {}
  }

  const handleRepost = async (id: string) => {
    try {
      const res = await postApi.toggleRepost(id)
      setPosts(prev => prev.map(p => p.id === id ? res.data : p))
    } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return
    try {
      await postApi.delete(id)
      setPosts(prev => prev.filter(p => p.id !== id))
      setTotal(t => t - 1)
    } catch {}
  }

  const handleAgree = async (id: string) => {
    try {
      const res = await postApi.react(id, 'agree')
      setPosts(prev => prev.map(p => p.id === id ? res.data : p))
    } catch {}
  }

  const handleDisagree = async (id: string) => {
    try {
      const res = await postApi.react(id, 'disagree')
      setPosts(prev => prev.map(p => p.id === id ? res.data : p))
    } catch {}
  }

  const handleSave = async (id: string) => {
    try {
      const res = await postApi.save(id)
      setPosts(prev => prev.map(p => p.id === id ? res.data : p))
    } catch {}
  }

  const handleVotePoll = async (id: string, option: number) => {
    try {
      const res = await postApi.votePoll(id, option)
      setPosts(prev => prev.map(p => p.id === id ? res.data : p))
    } catch {}
  }

  const handlePosted = (post: PostDto) => {
    setPosts(prev => [post, ...prev])
    setTotal(t => { baselineTotalRef.current = t + 1; return t + 1 })
    setNewPostsCount(0)
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--cs-bg)' }}>

      {/* ── LEFT PANEL ── */}
      <aside className="w-72 flex-shrink-0 overflow-y-auto py-4 px-3 hidden lg:flex lg:flex-col gap-2"
        style={{ borderRight: '1px solid var(--cs-border)' }}>

        {/* Profile card */}
        <div className="rounded-2xl overflow-hidden flex-shrink-0"
          style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}>
          <div className="h-14" style={{ background: 'linear-gradient(135deg,#0d9488 0%,#0ea5e9 100%)' }} />
          <div className="px-4 pb-4">
            <div className="-mt-7 mb-2 inline-block" style={{ borderRadius: '50%', boxShadow: '0 0 0 3px var(--cs-bg-card)' }}>
              <Avatar name={myName || '?'} url={myAvatar} size={52} />
            </div>
            <p className="font-bold text-sm leading-tight" style={{ color: 'var(--cs-text-1)' }}>{myName || '…'}</p>
            {myHeadline && (
              <p className="text-xs mt-0.5 leading-snug line-clamp-2" style={{ color: 'var(--cs-text-3)' }}>{myHeadline}</p>
            )}
            <div className="mt-3 pt-2.5 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--cs-border)' }}>
              <span className="text-xs" style={{ color: 'var(--cs-text-3)' }}>Connections</span>
              <span className="text-xs font-bold" style={{ color: '#2dd4bf' }}>{connectionsCount}</span>
            </div>
          </div>
          <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--cs-border)' }}>
            <button onClick={() => navigate(`/profile/view/${user?.userId}`)}
              className="text-xs font-semibold hover:underline"
              style={{ color: '#2dd4bf' }}>
              View full profile →
            </button>
          </div>
        </div>

        {/* Quick links */}
        {[
          { icon: '🔖', label: 'Saved Posts', path: '/saved-posts' },
          { icon: '👥', label: 'Study Groups', path: '/study-groups' },
          { icon: '📈', label: 'Progress', path: '/progress' },
          { icon: '💡', label: 'Your Ideas', path: '/posts' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 flex-shrink-0"
            style={{ color: 'var(--cs-text-2)', background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}>
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </aside>

      {/* ── CENTER FEED ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        {/* New posts banner */}
        {newPostsCount > 0 && (
          <div className="sticky top-3 z-30 flex justify-center pointer-events-none">
            <button
              onClick={handleRefresh}
              className="pointer-events-auto flex items-center gap-2 px-5 py-2 rounded-full shadow-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', color: '#fff', boxShadow: '0 6px 24px rgba(13,148,136,0.45)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
              {newPostsCount} new post{newPostsCount !== 1 ? 's' : ''} · tap to see
            </button>
          </div>
        )}

        {/* Compose bar — sticky */}
        <div className="sticky top-0 z-20 px-4 pt-3 pb-0" style={{ background: 'var(--cs-bg)', backdropFilter: 'blur(12px)' }}>
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            <Avatar name={myName || '?'} url={myAvatar} size={44} />
            <button onClick={() => setShowCompose(true)}
              className="flex-1 text-left px-4 py-2.5 rounded-full text-sm transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-3)' }}>
              Start a post…
            </button>
            <button onClick={() => setShowCompose(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
              style={{ background: 'rgba(45,212,191,0.15)', color: '#2dd4bf' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Posts */}
        <div className="px-4 pb-6">
          <div>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#2dd4bf', borderTopColor: 'transparent' }} />
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8" style={{ color: '#2dd4bf' }}>
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                  </svg>
                </div>
                <p className="text-base font-bold mb-2" style={{ color: 'var(--cs-text-1)' }}>No posts yet</p>
                <p className="text-sm mb-5" style={{ color: 'var(--cs-text-3)' }}>Be the first to share something.</p>
                <button onClick={() => setShowCompose(true)}
                  className="px-6 py-2.5 rounded-full text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', boxShadow: '0 4px 12px rgba(13,148,136,0.35)' }}>
                  Start a post
                </button>
              </div>
            ) : (
              <>
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    myUserId={user?.userId ?? ''}
                    myName={myName}
                    myAvatar={myAvatar}
                    onLike={handleLike}
                    onRepost={handleRepost}
                    onSend={setSendPost}
                    onDelete={handleDelete}
                    onAgree={handleAgree}
                    onDisagree={handleDisagree}
                    onSave={handleSave}
                    onVotePoll={handleVotePoll}
                  />
                ))}
              </>
            )}
            {/* Sentinel always in DOM so IntersectionObserver can attach on mount */}
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loadingMore && (
                <div className="w-6 h-6 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#2dd4bf', borderTopColor: 'transparent' }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <aside className="w-72 flex-shrink-0 py-4 px-3 hidden lg:flex lg:flex-col gap-3"
        style={{ borderLeft: '1px solid var(--cs-border)' }}>
        <div className="rounded-2xl p-4"
          style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--cs-text-3)' }}>
            {connections.length > 0 ? 'Your Connections' : 'Add to your network'}
          </p>
          {connections.slice(0, 4).map(c => (
            <div key={c.connectionId} onClick={() => navigate(`/profile/view/${c.userId}`)}
              className="flex items-center gap-2.5 py-2 cursor-pointer hover:opacity-80 transition-all">
              <Avatar name={c.name} url={c.profilePictureUrl} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--cs-text-1)' }}>{c.name}</p>
                {c.headline && (
                  <p className="text-[11px] truncate leading-snug" style={{ color: 'var(--cs-text-3)' }}>{c.headline}</p>
                )}
              </div>
            </div>
          ))}
          <button onClick={() => navigate('/partners')}
            className="w-full mt-2 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: 'rgba(45,212,191,0.1)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }}>
            Find Study Partners →
          </button>
        </div>
      </aside>

      {showCompose && (
        <ComposeModal
          myName={myName}
          myAvatar={myAvatar}
          myHeadline={myHeadline}
          onClose={() => setShowCompose(false)}
          onPosted={handlePosted}
        />
      )}
      {sendPost && <SendModal post={sendPost} onClose={() => setSendPost(null)} />}
    </div>
  )
}
