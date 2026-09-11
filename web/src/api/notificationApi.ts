import api from './authApi';

export interface NotificationCounts {
  pendingRequests: number;
  unreadMessages: number;
  pendingGroupInvites: number;
}

export const notificationApi = {
  getCounts: () => api.get<NotificationCounts>('/notifications/counts'),
  getOnlineStatus: (userId: string) => api.get<{ online: boolean }>(`/users/${userId}/online`),
};
