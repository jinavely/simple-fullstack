import { Link, useParams } from 'react-router'
import { ListIcon, PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PostDetail } from '@/features/post/PostDetail'
import { PostDeleteDialog } from '@/features/post/PostDeleteDialog'
import { AttachmentList } from '@/features/file/AttachmentList'
import { CommentSection } from '@/features/comment/CommentSection'
import { ROUTES, toPostEdit } from '@/routes/paths'

export function PostViewPage() {
  const { id } = useParams()

  return (
    <div className="flex flex-col gap-6">
      <PostDetail />

      <AttachmentList />

      <Separator />

      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link to={ROUTES.POSTS}>
            <ListIcon />
            목록
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={toPostEdit(id!)}>
              <PencilIcon />
              수정
            </Link>
          </Button>
          <PostDeleteDialog />
        </div>
      </div>

      <Separator />

      <CommentSection />
    </div>
  )
}
