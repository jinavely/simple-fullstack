// features/post/PostDetail.tsx
import { EyeIcon, UserIcon, CalendarIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { formatDateTime } from '@/lib/format'
import type { Post } from './schema'

type PostDetailProps = {
  post: Post
}

export function PostDetail({ post }: PostDetailProps) {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold break-words">{post.title}</h1>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <dt>
              <UserIcon className="size-4" aria-label="작성자" />
            </dt>
            <dd>{post.writerNickname}</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt>
              <CalendarIcon className="size-4" aria-label="작성일" />
            </dt>
            <dd>
              <time dateTime={post.createdAt}>
                {formatDateTime(post.createdAt)}
              </time>
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt>
              <EyeIcon className="size-4" aria-label="조회수" />
            </dt>
            <dd>{post.viewCount.toLocaleString()}</dd>
          </div>
        </dl>
      </header>

      <Separator />

      {/* 줄바꿈은 whitespace-pre-wrap으로. HTML로 넣지 않는다(XSS) */}
      <div className="min-h-60 text-sm leading-relaxed break-words whitespace-pre-wrap">
        {post.content}
      </div>
    </article>
  )
}
