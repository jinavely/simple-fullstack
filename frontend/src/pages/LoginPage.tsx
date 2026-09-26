import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LoginForm } from '@/features/auth/LoginForm'

export function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">로그인</CardTitle>
          <CardDescription>아이디와 비밀번호를 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
