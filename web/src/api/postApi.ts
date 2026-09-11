import axios from 'axios'

const API = import.meta.env.VITE_API_URL ?? ''

function authHeaders() {
  const token = localStorage.getItem('cs_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface PostDto {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  authorHeadline: string | null
  content: string
  imageUrls: string[]
  documentUrl: string | null
  documentName: string | null
  pollQuestion: string | null
  pollOptions: string[]
  scheduledAt: string | null
  audience: string
  commentVisibility: string
  createdAt: string
  updatedAt: string
  likesCount: number
  likedByMe: boolean
  commentsCount: number
  repostsCount: number
  repostedByMe: boolean
  agreeCount: number
  disagreeCount: number
  agreedByMe: boolean
  disagreedByMe: boolean
  savedByMe: boolean
  pollVoteCounts: number[]
  myPollVote: number | null
}

export interface PostCommentDto {
  id: string
  postId: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  content: string
  createdAt: string
}

export interface PostFeedResponse {
  items: PostDto[]
  total: number
  page: number
  pageSize: number
}

export interface PostReactionUserDto {
  userId: string
  name: string
  avatar: string | null
  type: string
}

export interface PostActivityDto {
  id: string
  postId: string
  actorId: string
  actorName: string
  actorAvatar: string | null
  type: string
  extraText: string | null
  isRead: boolean
  createdAt: string
}

export const postApi = {
  getById: (id: string) =>
    axios.get<PostDto>(`${API}/api/posts/${id}`, { headers: authHeaders() }),

  getFeed: (page = 1, pageSize = 20) =>
    axios.get<PostFeedResponse>(`${API}/api/posts/feed`, {
      headers: authHeaders(),
      params: { page, pageSize },
    }),

  getMine: () =>
    axios.get<PostDto[]>(`${API}/api/posts/mine`, { headers: authHeaders() }),

  getSaved: (page = 1, pageSize = 20) =>
    axios.get<PostFeedResponse>(`${API}/api/posts/saved`, {
      headers: authHeaders(),
      params: { page, pageSize },
    }),

  uploadImage: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return axios.post<{ url: string }>(`${API}/api/posts/upload-image`, form, {
      headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
    })
  },

  uploadDocument: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return axios.post<{ url: string; name: string }>(`${API}/api/posts/upload-document`, form, {
      headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
    })
  },

  create: (content: string, extra?: {
    imageUrls?: string[]
    documentUrl?: string | null
    documentName?: string | null
    pollQuestion?: string | null
    pollOptions?: string[]
    scheduledAt?: string | null
    audience?: string
    commentVisibility?: string
  }) =>
    axios.post<PostDto>(`${API}/api/posts`, { content, ...extra }, { headers: authHeaders() }),

  update: (id: string, content: string, extra?: {
    imageUrls?: string[]
    documentUrl?: string | null
    documentName?: string | null
    pollQuestion?: string | null
    pollOptions?: string[]
    scheduledAt?: string | null
    audience?: string
    commentVisibility?: string
  }) =>
    axios.put<PostDto>(`${API}/api/posts/${id}`, { content, ...extra }, { headers: authHeaders() }),

  delete: (id: string) =>
    axios.delete(`${API}/api/posts/${id}`, { headers: authHeaders() }),

  toggleLike: (id: string) =>
    axios.post<PostDto>(`${API}/api/posts/${id}/like`, {}, { headers: authHeaders() }),

  toggleRepost: (id: string) =>
    axios.post<PostDto>(`${API}/api/posts/${id}/repost`, {}, { headers: authHeaders() }),

  react: (id: string, type: 'agree' | 'disagree') =>
    axios.post<PostDto>(`${API}/api/posts/${id}/react`, {}, {
      headers: authHeaders(),
      params: { type },
    }),

  save: (id: string) =>
    axios.post<PostDto>(`${API}/api/posts/${id}/save`, {}, { headers: authHeaders() }),

  getComments: (postId: string) =>
    axios.get<PostCommentDto[]>(`${API}/api/posts/${postId}/comments`, { headers: authHeaders() }),

  addComment: (postId: string, content: string) =>
    axios.post<PostCommentDto>(`${API}/api/posts/${postId}/comments`, { content }, { headers: authHeaders() }),

  deleteComment: (postId: string, commentId: string) =>
    axios.delete(`${API}/api/posts/${postId}/comments/${commentId}`, { headers: authHeaders() }),

  votePoll: (postId: string, option: number) =>
    axios.post<PostDto>(`${API}/api/posts/${postId}/poll-vote`, {}, {
      headers: authHeaders(),
      params: { option },
    }),

  getReactions: (postId: string) =>
    axios.get<PostReactionUserDto[]>(`${API}/api/posts/${postId}/reactions`, { headers: authHeaders() }),

  getActivity: (limit = 30) =>
    axios.get<PostActivityDto[]>(`${API}/api/posts/activity`, {
      headers: authHeaders(),
      params: { limit },
    }),

  markActivityRead: () =>
    axios.post(`${API}/api/posts/activity/mark-read`, {}, { headers: authHeaders() }),
}
