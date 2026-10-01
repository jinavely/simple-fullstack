import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { apiResponseSchema } from '@/lib/api-response'
import { postPageSchema, postSchema, type PostFormValues } from './schema'
import type { PostListParams } from './search-params'

const idResponseSchema = apiResponseSchema(z.number())

export async function fetchPosts({
  page,
  size,
  sort,
  searchType,
  keyword,
}: PostListParams) {
  const { data } = await apiClient.get('/posts', {
    params: {
      page: page - 1, // 화면은 1부터, Spring Pageable은 0부터
      size,
      sort,
      searchType: searchType === 'all' ? undefined : searchType,
      keyword: keyword || undefined,
    },
  })
  return apiResponseSchema(postPageSchema).parse(data).data
}

export async function fetchPost(id: number) {
  const { data } = await apiClient.get(`/posts/${id}`)
  return apiResponseSchema(postSchema).parse(data).data
}

export async function createPost(body: PostFormValues) {
  const { data } = await apiClient.post('/posts', body)
  return idResponseSchema.parse(data).data
}

export async function updatePost(id: number, body: PostFormValues) {
  const { data } = await apiClient.put(`/posts/${id}`, body)
  return idResponseSchema.parse(data).data
}

export async function deletePost(id: number) {
  await apiClient.delete(`/posts/${id}`)
}
