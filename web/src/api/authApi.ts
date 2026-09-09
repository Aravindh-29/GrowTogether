import axios from 'axios'

export interface AuthResponse {
  token: string
  userId: string
  email: string
  displayName: string
}

const api = axios.create({ baseURL: '/api' })

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

  me: () =>
    api.get<{ userId: string; email: string; name: string }>('/identity/me'),
}

export default api
