import { MessageSquareIcon } from 'lucide-react'
import { CommentForm } from './CommentForm'
import { CommentList } from './CommentList'

export function CommentSection() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-1 text-lg font-medium">
        <MessageSquareIcon className="size-5" />
        댓글 <span className="text-muted-foreground">0</span>
      </h2>
      <CommentForm />
      <CommentList />
    </section>
  )
}
