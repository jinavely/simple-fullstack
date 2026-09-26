import { Link } from 'react-router'
import { PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PostSearchBar } from '@/features/post/PostSearchBar'
import { PostTable } from '@/features/post/PostTable'
import { PostPagination } from '@/features/post/PostPagination'
import { ROUTES } from '@/routes/paths'

export function PostListPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">게시판</h1>
        <Button asChild>
          <Link to={ROUTES.POST_NEW}>
            <PencilIcon />
            글쓰기
          </Link>
        </Button>
      </div>

      <PostSearchBar />

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          전체 <span className="font-medium text-foreground">0</span>건
        </p>
        <PostTable />
      </div>

      <PostPagination />
    </div>
  )
}
