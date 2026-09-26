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

export function PostSearchBar() {
  return (
    <form
      role="search"
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="flex gap-2">
        <Select name="searchType" defaultValue="all">
          <SelectTrigger className="w-28" aria-label="검색 범위">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">제목+내용</SelectItem>
            <SelectItem value="title">제목</SelectItem>
            <SelectItem value="content">내용</SelectItem>
          </SelectContent>
        </Select>

        <Select name="sort" defaultValue="id,desc">
          <SelectTrigger className="w-28" aria-label="정렬">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id,desc">최신순</SelectItem>
            <SelectItem value="id,asc">오래된순</SelectItem>
            <SelectItem value="viewCount,desc">조회순</SelectItem>
          </SelectContent>
        </Select>

        <Select name="size" defaultValue="10">
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
