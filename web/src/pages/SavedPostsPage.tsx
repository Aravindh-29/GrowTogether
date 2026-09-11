import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { postApi, type PostDto } from '../api/postApi'
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
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString()
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

interface SavedPostCardProps {
  post: PostDto
  myUserId: string
  onUnsave: (id: string) => void
}

function SavedPostCard({ post, myUserId, onUnsave }: SavedPostCardProps) {
  const navigate = useNavigate()
  const [imgIndex, setImgIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const MAX_CONTENT = 280
  const needsMore = post.content.length > MAX_CONTENT
  const displayContent = expanded ? post.content : post.content.slice(0, MAX_CONTENT)
  const images = (post.imageUrls ?? []).map(u => mediaUrl(u)).filter(Boolean) as string[]

  const goAuthor = () => navigate(`/profile/view/${post.authorId}`)

  return (
    <>
      <div className="rounded-2xl mb-4 overflow-hidden"
        style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}>

        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <div onClick={goAuthor} className="cursor-pointer flex-shrink-0">
            <Avatar name={post.authorName} url={post.authorAvatar} size={46} />
          </div>
          <div className="flex-1 min-w-0">
            <p onClick={goAuthor} className="font-bold text-sm leading-tight cursor-pointer hover:underline"
              style={{ color: 'var(--cs-text-1)' }}>{post.authorName}</p>
            {post.authorHeadline && (
              <p className="text-xs mt-0.5 leading-snug line-clamp-2" style={{ color: 'var(--cs-text-3)' }}>
                {post.authorHeadline}
              </p>
            )}
            <span className="text-[11px]" style={{ color: 'var(--cs-text-3)' }}>{timeAgo(post.createdAt)}</span>
          </div>
          <button onClick={() => onUnsave(post.id)}
            title="Remove from saved"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
            style={{ color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)', background: 'rgba(45,212,191,0.08)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
            Saved
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--cs-text-1)' }}>
            {displayContent}
            {needsMore && !expanded && (
              <span>{'… '}
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
            <img src={images[imgIndex]} alt="post" className="w-full object-cover" style={{ maxHeight: 400, display: 'block' }} />
            {images.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); setImgIndex(i => (i - 1 + images.length) % images.length) }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
                </button>
                <button onClick={e => { e.stopPropagation(); setImgIndex(i => (i + 1) % images.length) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <div key={i} onClick={e => { e.stopPropagation(); setImgIndex(i) }}
                      className="w-1.5 h-1.5 rounded-full transition-all cursor-pointer"
                      style={{ background: i === imgIndex ? '#fff' : 'rgba(255,255,255,0.45)' }} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Document */}
        {post.documentUrl && (
          <div className="px-4 pb-3">
            <a href={mediaUrl(post.documentUrl) ?? '#'} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:opacity-80"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.22)', textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 flex-shrink-0" style={{ color: '#818cf8' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--cs-text-1)' }}>{post.documentName || 'Document'}</p>
                <p className="text-xs" style={{ color: 'var(--cs-text-3)' }}>Click to download</p>
              </div>
            </a>
          </div>
        )}

        {/* Reaction counts */}
        {(post.agreeCount > 0 || post.disagreeCount > 0 || post.commentsCount > 0) && (
          <div className="flex items-center gap-3 px-4 py-1.5 text-xs"
            style={{ color: 'var(--cs-text-3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {post.agreeCount > 0 && <span className="flex items-center gap-1">✅ {post.agreeCount} agree</span>}
            {post.disagreeCount > 0 && <span className="flex items-center gap-1">❌ {post.disagreeCount} disagree</span>}
            <span className="flex-1" />
            {post.commentsCount > 0 && <span>{post.commentsCount} comment{post.commentsCount !== 1 ? 's' : ''}</span>}
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
          <a href={images[imgIndex]} download
            onClick={e => e.stopPropagation()}
            className="absolute bottom-5 right-5 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(45,212,191,0.85)', color: '#fff' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Save
          </a>
        </div>
      )}
    </>
  )
}

export default function SavedPostsPage() {
  const { user } = useAuthStore()
  const [posts, setPosts] = useState<PostDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 20
  const hasMore = posts.length < total

  const load = useCallback(async (p: number, append: boolean) => {
    if (p === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await postApi.getSaved(p, PAGE_SIZE)
      setTotal(res.data.total)
      setPosts(prev => append ? [...prev, ...res.data.items] : res.data.items)
    } catch {}
    setLoading(false)
    setLoadingMore(false)
  }, [])

  useEffect(() => { load(1, false) }, [load])

  const handleUnsave = async (id: string) => {
    try {
      await postApi.save(id)
      setPosts(prev => prev.filter(p => p.id !== id))
      setTotal(t => t - 1)
    } catch {}
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--cs-bg)' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3" style={{ background: 'var(--cs-bg)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" style={{ color: '#2dd4bf' }}>
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
            </svg>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cs-text-1)' }}>Saved Posts</h1>
            {total > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(45,212,191,0.12)', color: '#2dd4bf' }}>
                {total}
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: 'var(--cs-text-3)' }}>Ideas and thoughts you bookmarked</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#2dd4bf', borderTopColor: 'transparent' }} />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8" style={{ color: '#2dd4bf' }}>
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <p className="text-base font-bold mb-2" style={{ color: 'var(--cs-text-1)' }}>No saved posts yet</p>
              <p className="text-sm" style={{ color: 'var(--cs-text-3)' }}>
                Bookmark posts from the feed by clicking the save icon.
              </p>
            </div>
          ) : (
            <>
              {posts.map(post => (
                <SavedPostCard
                  key={post.id}
                  post={post}
                  myUserId={user?.userId ?? ''}
                  onUnsave={handleUnsave}
                />
              ))}
              {hasMore && (
                <div className="flex justify-center pb-4">
                  <button onClick={() => { const n = page + 1; setPage(n); load(n, true) }}
                    disabled={loadingMore}
                    className="px-6 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.25)' }}>
                    {loadingMore ? 'Loading…' : `Load more (${total - posts.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
