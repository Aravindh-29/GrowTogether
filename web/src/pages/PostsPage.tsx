import { useEffect, useState } from 'react'
import { postApi, type PostDto } from '../api/postApi'
import { profileApi } from '../api/profileApi'
import { useAuthStore } from '../store/authStore'
import { ComposeModal, PostCard, SendModal } from './FeedPage'

export default function PostsPage() {
  const { user } = useAuthStore()
  const [myName, setMyName] = useState(user?.displayName ?? '')
  const [myAvatar, setMyAvatar] = useState<string | null>(null)
  const [myHeadline, setMyHeadline] = useState<string | null>(null)
  const [posts, setPosts] = useState<PostDto[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [sendPost, setSendPost] = useState<PostDto | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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
    postApi.getMine()
      .then(res => setPosts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLike = async (id: string) => {
    try { const r = await postApi.like(id); setPosts(p => p.map(x => x.id === id ? r.data : x)) } catch {}
  }
  const handleRepost = async (id: string) => {
    try { const r = await postApi.repost(id); setPosts(p => p.map(x => x.id === id ? r.data : x)) } catch {}
  }
  const handleAgree = async (id: string) => {
    try { const r = await postApi.react(id, 'agree'); setPosts(p => p.map(x => x.id === id ? r.data : x)) } catch {}
  }
  const handleDisagree = async (id: string) => {
    try { const r = await postApi.react(id, 'disagree'); setPosts(p => p.map(x => x.id === id ? r.data : x)) } catch {}
  }
  const handleSave = async (id: string) => {
    try { const r = await postApi.save(id); setPosts(p => p.map(x => x.id === id ? r.data : x)) } catch {}
  }
  const handleVotePoll = async (id: string, option: number) => {
    try { const r = await postApi.votePoll(id, option); setPosts(p => p.map(x => x.id === id ? r.data : x)) } catch {}
  }
  const handleDelete = (id: string) => setDeleteId(id)

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await postApi.delete(deleteId)
      setPosts(prev => prev.filter(p => p.id !== deleteId))
    } catch {}
    setDeleteId(null)
  }

  const handlePosted = (post: PostDto) => {
    setPosts(prev => [post, ...prev])
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--cs-bg)' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4" style={{ borderBottom: '1px solid var(--cs-border)', background: 'var(--cs-bg-nav)' }}>
        <h1 className="text-lg font-bold" style={{ color: 'var(--cs-text-1)' }}>Your Ideas</h1>
        <p className="text-xs" style={{ color: 'var(--cs-text-3)' }}>Your posts and thoughts</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">

        {/* Compose bar — opens full ComposeModal */}
        <div className="rounded-2xl p-4 mb-5 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-all"
          style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}
          onClick={() => setShowCompose(true)}>
          {myAvatar
            ? <img src={myAvatar.startsWith('data:') || myAvatar.startsWith('http') ? myAvatar : `${import.meta.env.VITE_API_URL ?? ''}${myAvatar}`}
                alt={myName} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', background: '#0d9488', fontSize: 17 }}>
                {(myName || '?')[0]?.toUpperCase()}
              </div>
          }
          <div className="flex-1 px-4 py-2.5 rounded-full text-sm"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--cs-border)', color: 'var(--cs-text-3)' }}>
            Share your ideas…
          </div>
          <button className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(45,212,191,0.15)', color: '#2dd4bf' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </button>
        </div>

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#2dd4bf', borderTopColor: 'transparent' }} />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8" style={{ color: '#2dd4bf' }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--cs-text-2)' }}>No posts yet</p>
            <p className="text-xs mb-4" style={{ color: 'var(--cs-text-3)' }}>Share your first idea with the community</p>
            <button onClick={() => setShowCompose(true)}
              className="px-5 py-2 rounded-full text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}>
              Start a post
            </button>
          </div>
        ) : (
          posts.map(post => (
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
          ))
        )}
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setDeleteId(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'var(--cs-bg-card)', border: '1px solid var(--cs-border)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--cs-text-1)' }}>Delete post?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--cs-text-2)' }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'var(--cs-bg-elevated)', color: 'var(--cs-text-2)', border: '1px solid var(--cs-border)' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
