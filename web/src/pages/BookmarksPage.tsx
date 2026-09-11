import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Types ────────────────────────────────────────────────────────────────────

interface BookmarkEntry {
  userId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  city?: string
  country?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readBookmarks(): BookmarkEntry[] {
  try {
    const raw = localStorage.getItem('cs_bookmarks')
    if (!raw) return []
    return JSON.parse(raw) as BookmarkEntry[]
  } catch {
    return []
  }
}

function writeBookmarks(items: BookmarkEntry[]): void {
  localStorage.setItem('cs_bookmarks', JSON.stringify(items))
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0d9488,#0ea5e9)',
  'linear-gradient(135deg,#7c3aed,#0ea5e9)',
  'linear-gradient(135deg,#d97706,#ef4444)',
  'linear-gradient(135deg,#0d9488,#22c55e)',
  'linear-gradient(135deg,#6366f1,#ec4899)',
  'linear-gradient(135deg,#0ea5e9,#22c55e)',
]

function getAvatarGradient(index: number): string {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

// ── Bookmark Card ─────────────────────────────────────────────────────────────

function BookmarkCard({
  bookmark,
  index,
  onRemove,
  onView,
}: {
  bookmark: BookmarkEntry
  index: number
  onRemove: () => void
  onView: () => void
}) {
  const location = [bookmark.city, bookmark.country].filter(Boolean).join(', ')
  const initials = getInitials(bookmark.name)

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all hover:scale-[1.015]"
      style={{ background: 'var(--cs-bg-elevated)', border: '1px solid var(--cs-border)' }}
    >
      {/* Top row: avatar + info + remove button */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
          style={{ background: getAvatarGradient(index) }}
        >
          {bookmark.profilePictureUrl ? (
            <img
              src={bookmark.profilePictureUrl}
              alt={bookmark.name}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        {/* Name / headline / location */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--cs-text-1)' }}>
            {bookmark.name}
          </p>
          {bookmark.headline && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--cs-text-2)' }}>
              {bookmark.headline}
            </p>
          )}
          {location && (
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--cs-text-3)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
              </svg>
              {location}
            </p>
          )}
        </div>

        {/* Remove (✕) button */}
        <button
          onClick={onRemove}
          title="Remove bookmark"
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
          style={{
            color: 'var(--cs-text-3)',
            border: '1px solid var(--cs-border)',
            background: 'var(--cs-input-bg)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {/* View Profile button */}
      <button
        onClick={onView}
        className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}
      >
        View Profile
      </button>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onFindBuddies }: { onFindBuddies: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--cs-input-bg)', border: '1px solid var(--cs-border)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--cs-text-3)" strokeWidth="1.5" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
        </svg>
      </div>
      <h2 className="text-base font-bold mb-2" style={{ color: 'var(--cs-text-1)' }}>
        No bookmarks yet
      </h2>
      <p className="text-sm max-w-xs" style={{ color: 'var(--cs-text-3)' }}>
        Find buddies and bookmark them to see them here.
      </p>
      <button
        onClick={onFindBuddies}
        className="mt-6 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]"
        style={{
          background: 'linear-gradient(135deg,#0d9488,#0ea5e9)',
          boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
        }}
      >
        Find Buddies
      </button>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BookmarksPage() {
  const navigate = useNavigate()
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(readBookmarks)

  function handleRemove(userId: string) {
    const updated = bookmarks.filter(b => b.userId !== userId)
    writeBookmarks(updated)
    setBookmarks(updated)
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--cs-bg)' }}>

      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 px-6 py-4 flex items-center gap-3"
        style={{
          background: 'var(--cs-bg-nav)',
          borderBottom: '1px solid var(--cs-border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Bookmark icon */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)' }}
        >
          <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold" style={{ color: 'var(--cs-text-1)' }}>Bookmarks</h1>

        {bookmarks.length > 0 && (
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-bold"
            style={{
              background: 'rgba(45,212,191,0.15)',
              color: '#2dd4bf',
              border: '1px solid rgba(45,212,191,0.3)',
            }}
          >
            {bookmarks.length}
          </span>
        )}
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto">
        {bookmarks.length === 0 ? (
          <EmptyState onFindBuddies={() => navigate('/partners')} />
        ) : (
          <>
            <p className="text-xs mb-5" style={{ color: 'var(--cs-text-3)' }}>
              {bookmarks.length} saved {bookmarks.length === 1 ? 'buddy' : 'buddies'}
            </p>
            <div className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {bookmarks.map((bm, i) => (
                <BookmarkCard
                  key={bm.userId}
                  bookmark={bm}
                  index={i}
                  onRemove={() => handleRemove(bm.userId)}
                  onView={() => navigate(`/profile/view/${bm.userId}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
