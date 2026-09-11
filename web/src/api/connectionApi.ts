import api from './authApi'

export type ConnStatus = 'None' | 'Pending' | 'Accepted' | 'Rejected' | 'Cancelled'

export interface ConnectionDto {
  id: string
  senderId: string
  receiverId: string
  status: ConnStatus
  note?: string
  sentAt: string
  respondedAt?: string
}

export interface ConnectionWithProfile {
  connectionId: string
  userId: string
  username?: string
  name: string
  profilePictureUrl?: string
  role?: string
  headline?: string
  city?: string
  country?: string
  status: ConnStatus
  note?: string
  sentAt: string
  respondedAt?: string
  isSender: boolean
}

export const connectionApi = {
  sendRequest: (receiverId: string, note?: string) =>
    api.post<ConnectionDto>('/connections/request', { receiverId, note }),
  accept: (id: string) => api.post<ConnectionDto>(`/connections/${id}/accept`),
  reject: (id: string) => api.post<ConnectionDto>(`/connections/${id}/reject`),
  cancel: (id: string) => api.delete(`/connections/${id}`),
  getConnections: () => api.get<ConnectionWithProfile[]>('/connections'),
  getRequests: () => api.get<ConnectionWithProfile[]>('/connections/requests'),
  getSent: () => api.get<ConnectionWithProfile[]>('/connections/sent'),
  getStatus: (targetUserId: string) =>
    api.get<{ status: ConnStatus; connectionId: string | null; isSender: boolean }>(`/connections/status/${targetUserId}`),
}
