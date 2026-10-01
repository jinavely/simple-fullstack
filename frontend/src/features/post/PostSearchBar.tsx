// features/post/PostSearchBar.tsx
import type { FormEvent } from 'react'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PostListParams } from './search-params'

type PostSearchBarProps = {
  params: PostListParams
  onChange: (next: Partial<PostListParams>) => void
}

export function PostSearchBar({ params, onChange }: PostSearchBarProps) {
  // 검색 범위 · 검색어는 [검색] 버튼을 눌렀을 때만 반영
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    onChange({
      searchType: form.get('searchType') as PostListParams['searchType'],
      keyword: String(form.get('keyword') ?? '').trim(),
    })
  }

  return (
    <form
      // 뒤로가기로 URL이 바뀌면 입력창도 URL 값으로 다시 채운다
      key={`${params.searchType}:${params.keyword}`}
      role="search"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="flex gap-2">
        <Select name="searchType" defaultValue={params.searchType}>
          <SelectTrigger className="w-28" aria-label="검색 범위">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">제목+내용</SelectItem>
            <SelectItem value="title">제목</SelectItem>
            <SelectItem value="content">내용</SelectItem>
          </SelectContent>
        </Select>

        {/* 정렬 · 개수는 고르자마자 반영 */}
        <Select
          value={params.sort}
          onValueChange={(sort) =>
            onChange({ sort: sort as PostListParams['sort'] })
          }
        >
          <SelectTrigger className="w-28" aria-label="정렬">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id,desc">최신순</SelectItem>
            <SelectItem value="id,asc">오래된순</SelectItem>
            <SelectItem value="viewCount,desc">조회순</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={params.size}
          onValueChange={(size) =>
            onChange({ size: size as PostListParams['size'] })
          }
        >
          <SelectTrigger className="w-24" aria-label="페이지당 개수">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10개씩</SelectItem>
            <SelectItem value="20">20개씩</SelectItem>
            <SelectItem value="50">50개씩</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 gap-2">
        <Input
          type="search"
          name="keyword"
          defaultValue={params.keyword}
          placeholder="검색어를 입력하세요"
          aria-label="검색어"
          className="flex-1"
        />
        <Button type="submit" variant="outline">
          <SearchIcon />
          검색
        </Button>
      </div>
    </form>
  )
}
