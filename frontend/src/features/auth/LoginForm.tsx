import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/routes/paths'

export function LoginForm() {
  return (
    <form noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="loginId">아이디</Label>
        <Input
          id="loginId"
          name="loginId"
          autoComplete="username"
          maxLength={20}
          placeholder="아이디를 입력하세요"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
        />
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full">
        로그인
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        아직 회원이 아니신가요?{' '}
        <Link
          to={ROUTES.SIGNUP}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          회원가입
        </Link>
      </p>
    </form>
  )
}
