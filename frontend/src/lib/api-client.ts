import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  // TODO: attach auth token once backend auth exists
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: centralized error handling (toast, 401 redirect) once backend exists
    return Promise.reject(error)
  },
)
