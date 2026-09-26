import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

/** 댓글 한 건의 마크업. CommentList에서 데이터를 map으로 돌려 사용 */
export function CommentItem() {
  return (
    <li className="flex gap-3 py-4">
      <Avatar size="sm" className="mt-0.5">
        <AvatarFallback>작</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">작성자</span>
            <time className="text-xs text-muted-foreground">
              0000-00-00 00:00
            </time>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="xs">
              수정
            </Button>
            <Button variant="ghost" size="xs" className="text-destructive">
              삭제
            </Button>
          </div>
        </div>
        <p className="text-sm break-words whitespace-pre-wrap">댓글 내용</p>
      </div>
    </li>
  )
}
