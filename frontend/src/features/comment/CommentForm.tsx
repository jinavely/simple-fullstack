import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function CommentForm() {
  return (
    <form noValidate className="flex flex-col gap-2">
      <Textarea
        name="content"
        aria-label="댓글 내용"
        placeholder="댓글을 입력하세요"
        maxLength={1000}
        className="min-h-20 resize-y"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">0 / 1000</span>
        <Button type="submit" size="sm">
          등록
        </Button>
      </div>
    </form>
  )
}
