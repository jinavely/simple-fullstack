// features/post/usePostListParams.ts
import { useSearchParams } from 'react-router'
import {
  parsePostListParams,
  toPostSearchParams,
  type PostListParams,
} from './search-params'

export function usePostListParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parsePostListParams(searchParams)

  // 검색 조건이 바뀌면 1페이지로. page를 직접 넘기면 그 값이 이긴다
  const setParams = (next: Partial<PostListParams>) =>
    setSearchParams(toPostSearchParams({ ...params, page: 1, ...next }))

  // 페이지 링크의 href용 (새 탭 열기 · 링크 복사가 되도록)
  const toHref = (next: Partial<PostListParams>) =>
    `?${toPostSearchParams({ ...params, ...next })}`

  return { params, setParams, toHref }
}
