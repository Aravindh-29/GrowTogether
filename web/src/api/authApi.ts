import axios from 'axios'

export interface AuthResponse {
  token: string
  userId: string
  email: string
  displayName: string
}

const API_ORIGIN = import.meta.env.VITE_API_URL ?? ''
const api = axios.create({ baseURL: `${API_ORIGIN}/api` })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cs_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const authApi = {
  register: (email: string, password: string, displayName: string) =>
    api.post<AuthResponse>('/identity/register', { email, password, displayName }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/identity/login', { email, password }),

  googleLogin: (accessToken: string) =>
    api.post<AuthResponse>('/identity/google-auth', { accessToken }),

  me: () =>
    api.get<{ userId: string; email: string; name: string }>('/identity/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/identity/change-password', { currentPassword, newPassword }),
}

export default api
