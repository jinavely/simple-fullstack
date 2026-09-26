import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FileUploader } from '@/features/file/FileUploader'

type PostFormProps = {
  mode: 'create' | 'edit'
  cancelTo: string
}

export function PostForm({ mode, cancelTo }: PostFormProps) {
  return (
    <form noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          name="title"
          maxLength={200}
          placeholder="제목을 입력하세요"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="content">내용</Label>
        <Textarea
          id="content"
          name="content"
          placeholder="내용을 입력하세요"
          className="min-h-80 resize-y"
        />
      </div>

      <FileUploader />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link to={cancelTo}>취소</Link>
        </Button>
        <Button type="submit">{mode === 'create' ? '등록' : '수정'}</Button>
      </div>
    </form>
  )
}
