import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PasswordChangeForm() {
  return (
    <form noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">현재 비밀번호</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">새 비밀번호</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="8자 이상, 영문·숫자·특수문자 조합"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPasswordConfirm">새 비밀번호 확인</Label>
        <Input
          id="newPasswordConfirm"
          name="newPasswordConfirm"
          type="password"
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" className="self-end">
        비밀번호 변경
      </Button>
    </form>
  )
}
