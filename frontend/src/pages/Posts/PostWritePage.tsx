import { PostForm } from '@/features/post/PostForm'
import { ROUTES } from '@/routes/paths'

export function PostWritePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">글쓰기</h1>
      <PostForm mode="create" cancelTo={ROUTES.POSTS} />
    </div>
  )
}
