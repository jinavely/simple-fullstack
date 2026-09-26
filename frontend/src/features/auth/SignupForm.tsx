import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/routes/paths'

export function SignupForm() {
  return (
    <form noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="loginId">아이디</Label>
        <div className="flex gap-2">
          <Input
            id="loginId"
            name="loginId"
            autoComplete="username"
            maxLength={20}
            placeholder="4~20자 영문, 숫자"
            className="flex-1"
          />
          <Button type="button" variant="outline">
            중복 확인
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="8자 이상, 영문·숫자·특수문자 조합"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
        <Input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더 입력하세요"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          name="nickname"
          maxLength={20}
          placeholder="2~20자"
        />
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full">
        가입하기
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{' '}
        <Link
          to={ROUTES.LOGIN}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          로그인
        </Link>
      </p>
    </form>
  )
}
