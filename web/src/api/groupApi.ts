import api from './authApi'

export interface GroupDto {
  id: string
  name: string
  subject: string
  description: string
  color: string
  ownerId: string
  isOwner: boolean
  memberCount: number
  createdAt: string
}

export interface GroupMemberDto {
  userId: string
  displayName: string
  profilePictureUrl: string | null
  headline: string | null
  joinedAt: string
  isOwner: boolean
  isAdmin: boolean
}

export interface GroupDetailDto extends GroupDto {
  memberCount: number
  members: GroupMemberDto[]
}

export interface GroupMessageDto {
  id: string
  groupId: string
  senderId: string
  senderName: string
  senderPictureUrl: string | null
  text: string
  sentAt: string
  isSystem?: boolean
}

export interface GroupInviteDto {
  id: string
  groupId: string
  groupName: string
  groupColor: string
  invitedByName: string
  createdAt: string
}

export const groupApi = {
  create: (data: { name: string; subject: string; description?: string; color?: string }) =>
    api.post<GroupDto>('/groups', data),

  mine: () =>
    api.get<GroupDto[]>('/groups/mine'),

  discover: () =>
    api.get<GroupDto[]>('/groups/discover'),

  detail: (id: string) =>
    api.get<GroupDetailDto>(`/groups/${id}`),

  join: (groupId: string) =>
    api.post(`/groups/${groupId}/join`),

  invite: (groupId: string, userId: string) =>
    api.post(`/groups/${groupId}/invite`, { userId }),

  getMyInvites: () =>
    api.get<GroupInviteDto[]>('/groups/invites/mine'),

  respondToInvite: (inviteId: string, accept: boolean) =>
    api.post(`/groups/invites/${inviteId}/respond`, { accept }),

  promoteToAdmin: (groupId: string, userId: string) =>
    api.post(`/groups/${groupId}/members/promote`, { userId }),

  demoteAdmin: (groupId: string, userId: string) =>
    api.post(`/groups/${groupId}/members/demote`, { userId }),

  getMessages: (groupId: string) =>
    api.get<GroupMessageDto[]>(`/groups/${groupId}/messages`),

  sendMessage: (groupId: string, text: string) =>
    api.post<GroupMessageDto>(`/groups/${groupId}/messages`, { text }),

  leave: (groupId: string) =>
    api.post(`/groups/${groupId}/leave`),

  delete: (groupId: string) =>
    api.delete(`/groups/${groupId}`),
}
