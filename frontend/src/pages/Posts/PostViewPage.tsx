// pages/PostViewPage.tsx
import { Link, useNavigate, useParams } from 'react-router'
import { ListIcon, PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PostDetail } from '@/features/post/PostDetail'
import { PostDeleteDialog } from '@/features/post/PostDeleteDialog'
import { PostErrorState } from '@/features/post/PostErrorState'
import {
  isValidPostId,
  useDeletePostMutation,
  usePostQuery,
} from '@/features/post/queries'
import { AttachmentList } from '@/features/file/AttachmentList'
import { CommentSection } from '@/features/comment/CommentSection'
import { ROUTES, toPostEdit } from '@/routes/paths'

export function PostViewPage() {
  const postId = Number(useParams().id)
  const navigate = useNavigate()
  const { data: post, isPending, isError, error } = usePostQuery(postId)
  const deletePost = useDeletePostMutation()

  if (!isValidPostId(postId)) return <PostErrorState error={null} />
  if (isPending)
    return <p className="py-12 text-center text-sm">불러오는 중…</p>
  if (isError) return <PostErrorState error={error} />

  const handleDelete = () =>
    deletePost.mutate(post.id, {
      // replace: 뒤로가기로 삭제된 글에 돌아오지 않게
      onSuccess: () => navigate(ROUTES.POSTS, { replace: true }),
    })

  return (
    <div className="flex flex-col gap-6">
      <PostDetail post={post} />

      {/* 5주차에 연결 */}
      <AttachmentList />

      <Separator />

      {deletePost.isError && (
        <p role="alert" className="text-sm text-destructive">
          {deletePost.error.message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link to={ROUTES.POSTS}>
            <ListIcon />
            목록
          </Link>
        </Button>
        {/* 4주차: 내 글일 때만 수정 · 삭제 버튼 표시 */}
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={toPostEdit(post.id)}>
              <PencilIcon />
              수정
            </Link>
          </Button>
          <PostDeleteDialog
            onConfirm={handleDelete}
            isPending={deletePost.isPending}
          />
        </div>
      </div>

      <Separator />

      {/* 5주차에 연결 */}
      <CommentSection />
    </div>
  )
}
