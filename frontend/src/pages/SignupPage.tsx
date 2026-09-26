import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SignupForm } from '@/features/auth/SignupForm'

export function SignupPage() {
  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">회원가입</CardTitle>
          <CardDescription>계정 정보를 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
    </div>
  )
}
