import { z } from 'zod'
import { pageResponseSchema } from '@/lib/api-response'

// 백엔드 PostResponse와 필드명 · 타입을 맞춤
export const postSchema = z.object({
  id: z.number(),
  writerId: z.number(),
  writerNickname: z.string(),
  title: z.string(),
  content: z.string(),
  viewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Post = z.infer<typeof postSchema>

export const postPageSchema = pageResponseSchema(postSchema)
export type PostPage = z.infer<typeof postPageSchema>

// 작성 · 수정 폼 — 백엔드 PostCreateRequest / PostUpdateRequest와 규칙을 맞춤
export const postFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '제목은 필수입니다.')
    .max(200, '제목은 200자 이하여야 합니다.'),
  content: z.string().trim().min(1, '내용은 필수입니다.'),
})
export type PostFormValues = z.infer<typeof postFormSchema>
