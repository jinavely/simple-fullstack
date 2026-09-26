import { UploadIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'

export function FileUploader() {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="files">첨부파일</Label>

      <label
        htmlFor="files"
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
      >
        <UploadIcon className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">
          클릭하거나 파일을 끌어다 놓으세요
        </span>
        <span className="text-xs text-muted-foreground">
          이미지(JPG, PNG, GIF) 및 문서 · 파일당 최대 10MB · 최대 5개
        </span>
        <input
          id="files"
          name="files"
          type="file"
          multiple
          className="sr-only"
        />
      </label>

      {/* 선택한 파일 목록: 이미지는 썸네일 그리드, 그 외 파일은 리스트 */}
      <ul className="grid grid-cols-3 gap-2 empty:hidden sm:grid-cols-5" />
      <ul className="flex flex-col divide-y rounded-lg border empty:hidden" />
    </div>
  )
}
