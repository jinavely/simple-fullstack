// lib/api-response.ts
import { z } from 'zod'

// 백엔드 global/common/ApiResponse · PageResponse와 필드명을 정확히 맞춤
export const apiResponseSchema = <T extends z.ZodType>(data: T) =>
  z.object({ success: z.literal(true), data })

export const pageResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    content: z.array(item),
    page: z.number(), // 0부터 시작
    size: z.number(),
    totalElements: z.number(),
    totalPages: z.number(),
    last: z.boolean(),
  })
