// features/post/PostErrorState.tsx — 상세·수정 페이지가 함께 쓰는 "없는 글" 화면
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { ROUTES } from '@/routes/paths'

type PostErrorStateProps = {
  error: Error | null // null = 주소의 id부터 잘못됨
}

export function PostErrorState({ error }: PostErrorStateProps) {
  const notFound =
    error === null || (error instanceof ApiError && error.status === 404)

  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12">
      <p className="text-sm text-muted-foreground">
        {notFound || !error ? '삭제되었거나 없는 게시글입니다.' : error.message}
      </p>
      <Button variant="outline" asChild>
        <Link to={ROUTES.POSTS}>목록으로</Link>
      </Button>
    </div>
  )
}
