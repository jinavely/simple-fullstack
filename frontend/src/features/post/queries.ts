import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
  } from '@tanstack/react-query'
  import { createPost, deletePost, fetchPost, fetchPosts, updatePost } from './api'
  import type { PostFormValues } from './schema'
  import type { PostListParams } from './search-params'
  
  export const postKeys = {
    all: ['posts'] as const,
    lists: () => [...postKeys.all, 'list'] as const,
    list: (params: PostListParams) => [...postKeys.lists(), params] as const,
    details: () => [...postKeys.all, 'detail'] as const,
    detail: (id: number) => [...postKeys.details(), id] as const,
  }
  
  export const isValidPostId = (id: number) => Number.isInteger(id) && id > 0
  
  export function usePostListQuery(params: PostListParams) {
    return useQuery({
      queryKey: postKeys.list(params),
      queryFn: () => fetchPosts(params),
      placeholderData: keepPreviousData, // 페이지를 넘길 때 이전 목록을 잠깐 유지
    })
  }
  
  export function usePostQuery(id: number) {
    return useQuery({
      queryKey: postKeys.detail(id),
      queryFn: () => fetchPost(id),
      enabled: isValidPostId(id),
    })
  }
  
  export function useCreatePostMutation() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (body: PostFormValues) => createPost(body),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: postKeys.lists() }),
    })
  }
  
  export function useUpdatePostMutation(id: number) {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (body: PostFormValues) => updatePost(id, body),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: postKeys.lists() })
        queryClient.invalidateQueries({ queryKey: postKeys.detail(id) })
      },
    })
  }
  
  export function useDeletePostMutation() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (id: number) => deletePost(id),
      onSuccess: (_data, id) => {
        queryClient.removeQueries({ queryKey: postKeys.detail(id) })
        queryClient.invalidateQueries({ queryKey: postKeys.lists() })
      },
    })
  }
  