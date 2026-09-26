import { PaperclipIcon } from 'lucide-react'

export function AttachmentList() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1 text-sm font-medium">
        <PaperclipIcon className="size-4" />
        첨부파일 <span className="text-muted-foreground">0</span>
      </h2>
      <div className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
        첨부파일이 없습니다.
      </div>
    </section>
  )
}
