import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ProfileForm() {
  return (
    <form noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-loginId">아이디</Label>
        <Input id="profile-loginId" name="loginId" disabled />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-nickname">닉네임</Label>
        <Input
          id="profile-nickname"
          name="nickname"
          maxLength={20}
          placeholder="2~20자"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">가입일</span>
        <p className="text-sm text-muted-foreground">
          <time>0000-00-00</time>
        </p>
      </div>

      <Button type="submit" className="self-end">
        저장
      </Button>
    </form>
  )
}
