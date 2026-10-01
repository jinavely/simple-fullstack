// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api-client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 4xx(없는 글, 잘못된 요청)는 다시 보내도 결과가 같다
        if (error instanceof ApiError && error.status >= 400 && error.status < 500)
          return false
        return failureCount < 1
      },
    },
  },
})
