import { CameraIcon, UserIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export function ProfileImageField() {
  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20">
        <AvatarFallback>
          <UserIcon className="size-8 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <label htmlFor="profileImage" className="cursor-pointer">
              <CameraIcon />
              이미지 변경
              <input
                id="profileImage"
                name="profileImage"
                type="file"
                accept="image/*"
                className="sr-only"
              />
            </label>
          </Button>
          <Button variant="ghost" size="sm">
            삭제
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, GIF · 최대 2MB
        </p>
      </div>
    </div>
  )
}
