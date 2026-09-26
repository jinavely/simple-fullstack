import { Link } from 'react-router'
import { ChevronRightIcon, ListIcon, PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ROUTES } from '@/routes/paths'

export function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 py-8">
        <h1 className="text-3xl font-semibold">Simple Fullstack 게시판</h1>
        <p className="text-muted-foreground">
          자유롭게 글을 쓰고, 댓글로 이야기를 나눠보세요.
        </p>
        <div className="flex gap-2">
          <Button asChild>
            <Link to={ROUTES.POSTS}>
              <ListIcon />
              게시판 보기
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.POST_NEW}>
              <PencilIcon />
              글쓰기
            </Link>
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>최근 게시글</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link to={ROUTES.POSTS}>
                더보기
                <ChevronRightIcon />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* TODO: 최근 게시글 목록 API 연동 */}
          <p className="py-8 text-center text-sm text-muted-foreground">
            게시글이 없습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
