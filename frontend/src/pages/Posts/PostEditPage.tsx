import { useParams } from 'react-router'
import { PostForm } from '@/features/post/PostForm'
import { toPostDetail } from '@/routes/paths'

export function PostEditPage() {
  const { id } = useParams()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">글 수정</h1>
      <PostForm mode="edit" cancelTo={toPostDetail(id!)} />
    </div>
  )
}
