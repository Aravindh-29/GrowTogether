import api from './authApi'
import * as signalR from '@microsoft/signalr'

export interface ConversationSummary {
  id: string
  otherUserId: string
  otherUsername?: string
  otherName: string
  otherPicture?: string
  lastMessage?: string
  lastMessageAt?: string
  unreadCount: number
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  text: string
  sentAt: string
  readAt?: string
  postId?: string | null
}

export const chatApi = {
  startConversation: (userId: string) =>
    api.post<{ id: string }>('/chats/start', { userId }),
  getConversations: () => api.get<ConversationSummary[]>('/chats'),
  getMessages: (convId: string) => api.get<ChatMessage[]>(`/chats/${convId}/messages`),
  sendMessage: (convId: string, text: string, postId?: string | null) =>
    api.post<ChatMessage>(`/chats/${convId}/messages`, { text, postId: postId ?? null }),
  markRead: (convId: string) => api.post(`/chats/${convId}/read`),
}

let hubConnection: signalR.HubConnection | null = null

export function getChatHub(token: string): signalR.HubConnection {
  if (hubConnection) return hubConnection
  hubConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}/hubs/chat`, {
      accessTokenFactory: () => token,
    })
    .withAutomaticReconnect()
    .build()
  return hubConnection
}

export function disposeChatHub() {
  hubConnection?.stop()
  hubConnection = null
}
