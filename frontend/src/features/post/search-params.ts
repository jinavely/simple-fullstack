// features/post/search-params.ts
import { z } from 'zod'

// 목록 쿼리스트링 규칙. 잘못된 값은 .catch()로 기본값이 된다
export const postListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1), // 화면 기준 1부터
  size: z.enum(['10', '20', '50']).catch('10'),
  sort: z.enum(['id,desc', 'id,asc', 'viewCount,desc']).catch('id,desc'),
  searchType: z.enum(['all', 'title', 'content']).catch('all'),
  keyword: z.string().trim().catch(''),
})
export type PostListParams = z.infer<typeof postListParamsSchema>

export const DEFAULT_POST_LIST_PARAMS = postListParamsSchema.parse({})

export function parsePostListParams(
  searchParams: URLSearchParams,
): PostListParams {
  return postListParamsSchema.parse(Object.fromEntries(searchParams))
}

// 기본값과 같은 항목은 URL에서 뺀다 → /posts?page=2&keyword=spring
export function toPostSearchParams(params: PostListParams) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const isDefault =
      value === DEFAULT_POST_LIST_PARAMS[key as keyof PostListParams]
    if (value !== '' && !isDefault) next.set(key, String(value))
  }
  return next
}
