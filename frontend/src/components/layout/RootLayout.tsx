import { Link, Outlet } from 'react-router'
import { ROUTES } from '@/routes/paths'

const navLinkClass = 'text-sm font-medium hover:underline'

export function RootLayout() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col">
      <nav className="flex items-center justify-between gap-4 border-b p-4">
        <div className="flex gap-4">
          <Link to={ROUTES.HOME} className={navLinkClass}>
            Home
          </Link>
          <Link to={ROUTES.POSTS} className={navLinkClass}>
            게시판
          </Link>
        </div>
        {/* 로그인 전: 로그인·회원가입 / 로그인 후: 마이페이지·로그아웃 */}
        <div className="flex gap-4">
          <Link to={ROUTES.LOGIN} className={navLinkClass}>
            로그인
          </Link>
          <Link to={ROUTES.SIGNUP} className={navLinkClass}>
            회원가입
          </Link>
          <Link to={ROUTES.MYPAGE} className={navLinkClass}>
            마이페이지
          </Link>
          <button type="button" className={navLinkClass}>
            로그아웃
          </button>
        </div>
      </nav>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
