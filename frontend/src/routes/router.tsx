import { createBrowserRouter } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PostListPage } from '@/pages/Posts/PostListPage'
import { PostWritePage } from '@/pages/Posts/PostWritePage'
import { PostViewPage } from '@/pages/Posts/PostViewPage'
import { PostEditPage } from '@/pages/Posts/PostEditPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { MyPage } from '@/pages/MyPage'
import { ROUTES } from './paths'

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: ROUTES.POSTS, element: <PostListPage /> },
      { path: ROUTES.POST_NEW, element: <PostWritePage /> },
      { path: ROUTES.POST_DETAIL, element: <PostViewPage /> },
      { path: ROUTES.POST_EDIT, element: <PostEditPage /> },
      { path: ROUTES.LOGIN, element: <LoginPage /> },
      { path: ROUTES.SIGNUP, element: <SignupPage /> },
      { path: ROUTES.MYPAGE, element: <MyPage /> },
      { path: ROUTES.NOT_FOUND, element: <NotFoundPage /> },
    ],
  },
])
