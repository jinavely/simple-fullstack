// lib/api-client.ts
import axios, { type AxiosError } from 'axios'

// 백엔드 ApiResponse.ErrorBody와 같은 모양
export type ApiErrorBody = {
  code: string
  message: string
  fields?: Record<string, string>
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.fields = body.fields
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

apiClient.interceptors.request.use((config) => {
  // TODO 4주차: 로그인 토큰 첨부
  return config
})

// 실패 응답을 전부 ApiError 하나로 통일한다
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: ApiErrorBody }>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data?.error ?? {
      code: 'NETWORK_ERROR',
      message: '서버에 연결할 수 없습니다.',
    }
    return Promise.reject(new ApiError(status, body))
  },
)
