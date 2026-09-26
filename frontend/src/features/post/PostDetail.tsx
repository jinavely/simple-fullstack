import { EyeIcon, UserIcon, CalendarIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export function PostDetail() {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold break-words">제목</h1>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <dt>
              <UserIcon className="size-4" aria-label="작성자" />
            </dt>
            <dd>작성자</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt>
              <CalendarIcon className="size-4" aria-label="작성일" />
            </dt>
            <dd>
              <time>0000-00-00 00:00</time>
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt>
              <EyeIcon className="size-4" aria-label="조회수" />
            </dt>
            <dd>0</dd>
          </div>
        </dl>
      </header>

      <Separator />

      <div className="min-h-60 text-sm leading-relaxed break-words whitespace-pre-wrap">
        내용
      </div>
    </article>
  )
}
