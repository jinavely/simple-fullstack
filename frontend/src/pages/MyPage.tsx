import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileImageField } from '@/features/member/ProfileImageField'
import { ProfileForm } from '@/features/member/ProfileForm'
import { PasswordChangeForm } from '@/features/member/PasswordChangeForm'
import { WithdrawDialog } from '@/features/member/WithdrawDialog'
import { MyPostTable } from '@/features/member/MyPostTable'
import { MyCommentTable } from '@/features/member/MyCommentTable'

export function MyPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">마이페이지</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">내 정보</TabsTrigger>
          <TabsTrigger value="posts">내가 쓴 글</TabsTrigger>
          <TabsTrigger value="comments">내 댓글</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>프로필</CardTitle>
              <CardDescription>
                프로필 이미지와 닉네임을 변경할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <ProfileImageField />
              <ProfileForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>비밀번호 변경</CardTitle>
            </CardHeader>
            <CardContent>
              <PasswordChangeForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>회원 탈퇴</CardTitle>
              <CardDescription>
                탈퇴 후에는 계정을 복구할 수 없습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WithdrawDialog />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts" className="pt-4">
          <MyPostTable />
        </TabsContent>

        <TabsContent value="comments" className="pt-4">
          <MyCommentTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
