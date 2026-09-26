# 4주차 · 회원·로그인 프런트 + 마이페이지 (10/19~25 · 12h)

> 3주차 인증 API를 화면에 연결하고, 마이페이지(백엔드 + 프런트)로 회원 기능을 마무리한다.
> 각 단계는 **🎯 목표 → 🤔 왜 지금 → 📄 파일 → ⌨️ 코드 → 🔍 원리 → ✔ 확인** 순서.
> 전제: 2주차 `shared/api/client.ts`, 3주차 `/api/auth/*`(login · reissue · logout · signup)가 동작한다.

---

## 🗺 전체 흐름

```text
앱 시작 ──▶ AuthBootstrap: POST /api/auth/reissue (쿠키 자동)
              ├ 200 → authStore { accessToken, user, status: 'authenticated' }
              └ 401 → authStore { status: 'guest' }
                         (그동안 status: 'checking' → ProtectedRoute는 로딩 표시)

API 요청 ──▶ 요청 인터셉터: Authorization: Bearer <accessToken>
          ◀── 401? ──▶ 응답 인터셉터
                         ├ 재발급 진행 중이면 그 Promise를 같이 기다림 (대기열)
                         ├ 아니면 reissue 1회 실행
                         ├ 성공 → 새 토큰으로 원래 요청 재시도
                         └ 실패 → authStore.clear() → ProtectedRoute가 /login으로
```

**핵심 한 줄**: 토큰은 **zustand(메모리)**, 쿠키는 **브라우저가 알아서**, 만료 처리는 **axios 인터셉터 한 곳**에서. 페이지 코드는 토큰을 전혀 몰라야 한다.

## 📋 순서표

| # | 할 일 | 파일 | 끝나면 확인할 것 |
|---|---|---|---|
| 1 | 인증 스토어 | `features/auth/authStore.ts` | 컴파일 OK |
| 2 | 인증 API · 스키마 | `features/auth/api.ts`, `schema.ts`, `types.ts` | 컴파일 OK |
| 3 | 인터셉터: 토큰 첨부 · 401 재발급 · 대기열 | `shared/api/client.ts` 수정 | 컴파일 OK |
| 4 | 새로고침 로그인 복원 | `features/auth/AuthBootstrap.tsx`, `main.tsx` | 새로고침 후 로그인 유지 |
| 5 | 라우트 보호 | `ProtectedRoute.tsx`, `router.tsx` | 비로그인 글쓰기 → /login |
| 6 | 로그인 · 회원가입 페이지 | `LoginPage.tsx`, `SignupPage.tsx` | 가입 → 로그인 → 원래 페이지 |
| 7 | 헤더 로그인 상태 · 로그아웃 | `Layout.tsx`, `useLogout.ts` | 로그아웃 후 캐시 비움 |
| 8 | 게시판 작성자 연결 | `PostDetailPage.tsx` | 내 글만 수정·삭제 버튼 |
| 9 | 마이페이지 백엔드 | `UserController`, `UserService`, DTO, `User` | Swagger로 `/api/users/me` |
| 10 | 마이페이지 프런트 | `features/users/*` | 정보 수정 · 비밀번호 변경 · 탈퇴 · 내 글 |
| 11 | 테스트 | `client.test.ts`, `LoginPage.test.tsx`, `UserServiceTest` | 전부 통과 |

---

## 1 · 인증 스토어 (zustand)

**🎯 목표**: Access Token, 로그인 사용자, 확인 상태를 메모리에 보관한다.

**🤔 왜 지금**: 인터셉터(3번), 복원(4번), 라우트 보호(5번)가 모두 이 스토어를 읽는다.

**📄 파일**: `src/features/auth/types.ts`, `src/features/auth/authStore.ts`

```bash
npm i zustand
```

```ts
// features/auth/types.ts — 3주차 UserSummary, TokenResponse와 맞춤
export type Role = 'USER' | 'ADMIN'

export type AuthUser = {
  id: number
  loginId: string
  nickname: string
  role: Role
}

export type TokenResponse = {
  accessToken: string
  expiresIn: number
  user: AuthUser
}
```

```ts
// features/auth/authStore.ts
import { create } from 'zustand'
import type { AuthUser } from './types'

type AuthStatus = 'checking' | 'authenticated' | 'guest'

type AuthState = {
  accessToken: string | null
  user: AuthUser | null
  status: AuthStatus
  setAuth: (accessToken: string, user: AuthUser) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  status: 'checking',
  setAuth: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  clear: () => set({ accessToken: null, user: null, status: 'guest' }),
}))
```

**🔍 원리**
- **왜 localStorage가 아니라 메모리인가**: localStorage는 페이지의 모든 스크립트가 읽을 수 있다. XSS 한 번이면 토큰이 털린다. 메모리는 새로고침하면 사라지지만, 사라진 토큰은 4번에서 **httpOnly 쿠키(Refresh)로 다시 받는다**. 안전성과 편의를 둘 다 얻는 조합이다.
- `persist` 미들웨어를 쓰지 않는 이유도 같다(persist = localStorage 저장).
- `status`를 3개로 둔 이유: 앱을 막 열었을 때는 "로그인인지 아닌지 **아직 모름**"이다. 이걸 `guest`로 두면 새로고침 순간 로그인 페이지로 튕겼다가 돌아오는 깜빡임이 생긴다.
- **zustand에는 로그인 정보만**. 게시글·내 정보 수정 결과 같은 서버 데이터는 계속 React Query에 둔다(2주차 원칙).
- `useAuthStore.getState()`: 컴포넌트 밖(axios 인터셉터)에서도 현재 값을 읽을 수 있다. zustand를 고른 이유 중 하나다.

**✔ 확인**: 컴파일 OK.

---

## 2 · 인증 API · 스키마

**🎯 목표**: 3주차 API 4개를 함수로 만들고, 가입·로그인 폼 규칙을 3주차 백엔드와 똑같이 맞춘다.

**📄 파일**: `src/features/auth/api.ts`, `src/features/auth/schema.ts`

```ts
// features/auth/api.ts
import { api, unwrap } from '@/shared/api/client'
import type { ApiResponse } from '@/shared/api/types'
import type { TokenResponse } from './types'
import type { LoginValues, SignupValues } from './schema'

export const authApi = {
  signup: (body: Omit<SignupValues, 'passwordConfirm'>) =>
    unwrap(api.post<ApiResponse<number>>('/auth/signup', body)),
  login: (body: LoginValues) => unwrap(api.post<ApiResponse<TokenResponse>>('/auth/login', body)),
  logout: () => unwrap(api.post<ApiResponse<void>>('/auth/logout')),
}
// reissue는 인터셉터와 얽혀 있어서 3번 client.ts 안에 둔다
```

```ts
// features/auth/schema.ts — 3주차 SignupRequest의 @Pattern · @Size와 같은 규칙
import { z } from 'zod'

export const loginSchema = z.object({
  loginId: z.string().trim().min(1, '아이디를 입력하세요.'),
  password: z.string().min(1, '비밀번호를 입력하세요.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const passwordRule = z
  .string()
  .regex(/^(?=.*[A-Za-z])(?=.*\d).{8,20}$/, '비밀번호는 영문과 숫자를 포함해 8~20자입니다.')

export const signupSchema = z
  .object({
    loginId: z.string().trim().regex(/^[a-z0-9]{4,20}$/, '아이디는 영문 소문자·숫자 4~20자입니다.'),
    password: passwordRule,
    passwordConfirm: z.string(),
    nickname: z.string().trim().min(2, '닉네임은 2~20자입니다.').max(20, '닉네임은 2~20자입니다.'),
    email: z.string().trim().email('이메일 형식이 아닙니다.').max(100, '이메일은 100자 이하입니다.'),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다.',
  })
export type SignupValues = z.infer<typeof signupSchema>
```

**🔍 원리**
- 정규식이 **백엔드와 글자 하나까지 같아야** 한다. ERD(`login_id VARCHAR(20)`, `nickname VARCHAR(20)`, `email VARCHAR(100)`) → 백엔드 DTO → zod 순으로 숫자가 이어진다.
- `passwordConfirm`은 서버에 보내지 않는다(서버 DTO에 없음). `.refine`은 **필드 두 개를 비교**하는 검증이고, `path`로 에러를 어느 입력창 아래에 띄울지 정한다.
- `passwordRule`을 따로 export: 10번 비밀번호 변경 폼에서 재사용한다.

**✔ 확인**: 컴파일 OK.

---

## 3 · 인터셉터: 토큰 첨부 · 401 재발급 · 대기열

**🎯 목표**: 모든 요청에 토큰을 붙이고, 401이 오면 **한 번만** 재발급한 뒤 원래 요청을 다시 보낸다. 동시에 여러 요청이 401을 받아도 재발급은 1번만 한다.

**🤔 왜 지금**: 이게 있어야 페이지 코드가 토큰 만료를 전혀 신경 쓰지 않는다. 2주차에 인스턴스를 하나로 모아 둔 이유가 여기서 드러난다.

**📄 파일**: `src/shared/api/client.ts` (2주차 파일 수정 — 전체 교체)

```ts
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from './types'
import { useAuthStore } from '@/features/auth/authStore'
import type { TokenResponse } from '@/features/auth/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const baseURL = import.meta.env.VITE_API_URL

export const api = axios.create({
  baseURL,
  timeout: 10_000,
  withCredentials: true,
})

// ── 재발급: 동시에 여러 번 불려도 실제 요청은 1번 ──────────────────
let refreshPromise: Promise<TokenResponse> | null = null

export function refreshAccessToken(): Promise<TokenResponse> {
  if (!refreshPromise) {
    refreshPromise = axios
      // 인터셉터가 없는 "맨 axios"로 호출해야 무한 루프가 안 생긴다
      .post<ApiResponse<TokenResponse>>(`${baseURL}/auth/reissue`, null, { withCredentials: true })
      .then((res) => {
        const data = res.data.data as TokenResponse
        useAuthStore.getState().setAuth(data.accessToken, data.user)
        return data
      })
      .catch((err) => {
        useAuthStore.getState().clear()
        throw err
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

// ── 요청 인터셉터: 토큰 첨부 ──────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── 응답 인터셉터: 401 → 재발급 → 재시도, 그 외 → ApiError ───────
type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<ApiResponse<unknown>>) => {
    const original = err.config as RetryConfig | undefined
    const status = err.response?.status
    const isAuthUrl = original?.url?.startsWith('/auth/')

    if (status === 401 && original && !original._retry && !isAuthUrl) {
      original._retry = true
      try {
        const { accessToken } = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original) // 원래 요청 재시도
      } catch {
        // 재발급도 실패 → 아래로 내려가 원래 401을 ApiError로 변환
      }
    }

    const body = err.response?.data
    return Promise.reject(
      new ApiError(
        status ?? 0,
        body?.error?.code ?? 'NETWORK_ERROR',
        body?.error?.message ?? '서버에 연결할 수 없습니다.',
        body?.error?.fields,
      ),
    )
  },
)

export async function unwrap<T>(req: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await req
  return res.data.data as T
}
```

**🔍 원리**
- **대기열 = Promise 하나 공유**: 목록·댓글·내 정보 요청 3개가 동시에 401을 받으면, 첫 번째가 `refreshPromise`를 만들고 나머지 둘은 **같은 Promise를 기다린다**. 재발급 요청은 1번만 나가고, 끝나면 셋 다 새 토큰으로 재시도한다. 배열로 콜백을 모으는 방식과 결과는 같고 코드가 짧다.
- **왜 재발급이 1번이어야 하나**: 3주차 **Rotation** 때문이다. 재발급을 동시에 2번 하면 두 번째 요청은 방금 폐기된 Refresh를 쓰게 되고, 서버는 "탈취"로 판단해 **모든 토큰을 폐기**한다. 결과는 원인 모를 강제 로그아웃이다.
- `_retry` 표시: 재시도한 요청이 또 401이면 다시 재발급하지 않는다(무한 루프 방지).
- `/auth/*` 제외: 로그인 실패(401 A003)에서 재발급을 시도하면 안 된다.
- 재발급은 **맨 `axios`**로 호출: `api` 인스턴스로 부르면 재발급의 401이 다시 인터셉터를 타서 루프가 된다.
- `withCredentials: true`: 브라우저가 **쿠키(Refresh)를 요청에 실어 보내게** 한다. 같은 출처(프록시)에서는 없어도 동작하지만, 명시해 두면 도메인이 나뉘는 배포에서도 안전하다.
- 재발급 실패 시 `clear()`만 한다. 화면 이동은 5번 `ProtectedRoute`가 **스토어 변화를 보고** 알아서 한다. 인터셉터에서 `window.location`을 바꾸면 React 상태가 다 날아가고 테스트도 어렵다.
- `features/auth`를 `shared`가 import하는 건 2주차 규칙의 예외다. 인증은 모든 요청에 걸치는 관심사라서 허용한다(대신 `authStore`는 `shared`를 import하지 않아 순환이 없다).

**✔ 확인**: 컴파일 OK. (동작 확인은 4번 이후)

---

## 4 · 새로고침 로그인 복원 (`AuthBootstrap`)

**🎯 목표**: 앱이 열릴 때 쿠키로 Access Token을 다시 받아 로그인 상태를 복원한다.

**🤔 왜 지금**: 메모리에 둔 토큰은 새로고침하면 사라진다. 복원이 없으면 새로고침할 때마다 로그아웃된다.

**📄 파일**: `src/features/auth/AuthBootstrap.tsx`, `src/main.tsx` 수정

```tsx
// features/auth/AuthBootstrap.tsx
import { useEffect, type ReactNode } from 'react'
import { refreshAccessToken } from '@/shared/api/client'

export default function AuthBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    // 실패해도 refreshAccessToken 안에서 status가 'guest'로 바뀐다
    refreshAccessToken().catch(() => {})
  }, [])

  return <>{children}</>
}
```

```tsx
// main.tsx — RouterProvider를 감싼다
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
    </QueryClientProvider>
  </StrictMode>,
)
```

**🔍 원리**
- **StrictMode 함정**: 개발 모드의 StrictMode는 `useEffect`를 **일부러 두 번** 실행한다. 재발급을 그냥 두 번 호출하면 두 번째가 폐기된 토큰을 써서 3주차 "재사용 감지"에 걸리고 **전부 로그아웃**된다. `refreshAccessToken`이 진행 중인 Promise를 공유하기 때문에 두 번 불려도 요청은 1번이다. 3번에서 대기열을 Promise 공유로 만든 두 번째 이유다.
- 복원 전까지 `status = 'checking'` → 5번 `ProtectedRoute`가 로딩을 보여준다. 공개 페이지(목록)는 기다리지 않고 바로 뜬다.
- 로그인한 적 없는 사용자는 쿠키가 없어 401 → `guest`. 정상 흐름이다. 콘솔의 401 한 줄은 에러가 아니다.
- **탭 여러 개 주의**: 탭 두 개가 동시에 새로고침되면 각 탭이 따로 재발급해서 재사용 감지에 걸릴 수 있다. 실무에서는 `BroadcastChannel`로 탭 간 조율하거나, 서버가 방금 폐기된 토큰을 몇 초간 봐주는 유예 시간을 둔다(선택 과제).

**✔ 확인**: 6번 로그인 후 새로고침 → 헤더에 닉네임이 유지되면 성공. Network 탭에 `reissue` 요청이 **1건**인지 확인.

---

## 5 · 라우트 보호 (`ProtectedRoute`)

**🎯 목표**: 로그인이 필요한 페이지는 비로그인 사용자를 로그인 페이지로 보내고, 로그인 후 **원래 가려던 페이지**로 돌아오게 한다.

**📄 파일**: `src/features/auth/ProtectedRoute.tsx`, `src/app/router.tsx` 수정

```tsx
// features/auth/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from './authStore'

export default function ProtectedRoute() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'checking') return <p>로그인 확인 중...</p>
  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}
```

```tsx
// app/router.tsx
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/posts" replace /> },
      { path: 'posts', element: <PostListPage /> },
      { path: 'posts/:id', element: <PostDetailPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      {
        element: <ProtectedRoute />, // 아래는 로그인 필요
        children: [
          { path: 'posts/new', element: <PostWritePage /> },
          { path: 'posts/:id/edit', element: <PostEditPage /> },
          { path: 'me', element: <MyPage /> },
        ],
      },
    ],
  },
])
```

**🔍 원리**
- `path` 없는 라우트(**레이아웃 라우트**)로 감싸면 그 아래 페이지들이 전부 같은 검사를 받는다. 페이지마다 `if (!user)`를 쓰지 않는다.
- `state.from`: 로그인 페이지가 이 값을 읽어 로그인 후 원래 페이지로 보낸다.
- 재발급 실패로 `clear()`가 되면 `status`가 `guest`로 바뀌고, 이 컴포넌트가 **다시 렌더링되며** 자동으로 로그인 페이지로 간다. 3번에서 인터셉터가 화면 이동을 하지 않은 이유다.
- **화면 보호는 편의 기능**이다. 진짜 보호는 3주차 서버(`anyRequest().authenticated()`)가 한다.

**✔ 확인**: 로그아웃 상태에서 `/posts/new` → `/login`으로 이동.

---

## 6 · 로그인 · 회원가입 페이지

**🎯 목표**: 로그인 성공 시 스토어 저장 후 원래 페이지로, 가입 성공 시 로그인 페이지로 이동한다. 서버 409(중복)·400을 입력창에 표시한다.

**📄 파일**: `src/features/auth/pages/LoginPage.tsx`, `SignupPage.tsx`

```tsx
// features/auth/pages/LoginPage.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { ApiError } from '@/shared/api/client'
import { authApi } from '../api'
import { useAuthStore } from '../authStore'
import { loginSchema, type LoginValues } from '../schema'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/posts'
  const setAuth = useAuthStore((s) => s.setAuth)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { loginId: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await authApi.login(values)
      setAuth(res.accessToken, res.user)
      navigate(from, { replace: true })
    } catch (e) {
      form.setError('root', { message: e instanceof ApiError ? e.message : '로그인에 실패했습니다.' })
      form.resetField('password')
    }
  })

  return (
    <section>
      <h1>로그인</h1>
      <Form {...form}>
        <form onSubmit={onSubmit} noValidate>
          <FormField control={form.control} name="loginId" render={({ field }) => (
            <FormItem>
              <FormLabel>아이디</FormLabel>
              <FormControl><Input autoComplete="username" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>비밀번호</FormLabel>
              <FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          {form.formState.errors.root && <p role="alert">{form.formState.errors.root.message}</p>}
          <Button type="submit" disabled={form.formState.isSubmitting}>로그인</Button>
        </form>
      </Form>
      <Link to="/signup">회원가입</Link>
    </section>
  )
}
```

```tsx
// features/auth/pages/SignupPage.tsx (핵심 부분)
export default function SignupPage() {
  const navigate = useNavigate()
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { loginId: '', password: '', passwordConfirm: '', nickname: '', email: '' },
  })

  const onSubmit = form.handleSubmit(async ({ passwordConfirm: _, ...body }) => {
    try {
      await authApi.signup(body)
      navigate('/login', { replace: true, state: { signedUp: true } })
    } catch (e) {
      if (!(e instanceof ApiError)) return
      if (e.fields) {
        Object.entries(e.fields).forEach(([k, m]) => form.setError(k as keyof SignupValues, { message: m }))
      } else if (e.code === 'U002') {
        form.setError('loginId', { message: e.message })
      } else if (e.code === 'U003') {
        form.setError('email', { message: e.message })
      } else {
        form.setError('root', { message: e.message })
      }
    }
  })

  // JSX는 LoginPage와 같은 패턴: loginId, password, passwordConfirm, nickname, email 필드
  // password 계열은 type="password" autoComplete="new-password"
}
```

**🔍 원리**
- **에러 코드로 입력창 연결**: 409는 `fields`가 없고 `code`만 온다. `U002` → 아이디 칸, `U003` → 이메일 칸처럼 **코드를 필드에 매핑**한다. 1주차에 도메인별 에러 코드를 나눈 이유가 여기서 쓰인다.
- 로그인 실패는 **특정 칸이 아니라 폼 전체(root)**에 표시한다. 서버가 어느 쪽이 틀렸는지 알려주지 않기 때문이다(3주차).
- 실패 시 `resetField('password')`: 틀린 비밀번호를 지워 다시 입력하게 한다.
- `autoComplete` 값을 정확히 주면 브라우저 비밀번호 관리자가 제대로 동작한다. 퍼블리싱 품질 포인트다.
- 로그인 응답의 `Set-Cookie`는 브라우저가 알아서 저장한다. JS는 Refresh를 볼 수도, 볼 필요도 없다.

**✔ 확인**
- [ ] 가입 → 로그인 페이지로 이동 / 같은 아이디 재가입 → 아이디 칸 아래 "이미 사용 중인 아이디입니다."
- [ ] 비로그인으로 `/posts/new` → 로그인 → **글쓰기 페이지로 복귀**
- [ ] 개발자도구 Application → Cookies에 `refresh_token`이 있고 **HttpOnly 체크**, Local Storage는 비어 있음

---

## 7 · 헤더 로그인 상태 · 로그아웃

**🎯 목표**: 헤더에 닉네임·로그아웃 또는 로그인·회원가입 링크를 보여주고, 로그아웃 시 서버 토큰 폐기 + 캐시 초기화를 한다.

**📄 파일**: `src/features/auth/useLogout.ts`, `src/app/Layout.tsx` 수정

```ts
// features/auth/useLogout.ts
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from './api'
import { useAuthStore } from './authStore'

export function useLogout() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const clear = useAuthStore((s) => s.clear)

  return async () => {
    try {
      await authApi.logout()
    } finally {
      clear()
      qc.clear() // 이전 사용자의 캐시(내 정보, 내 글) 제거
      navigate('/posts', { replace: true })
    }
  }
}
```

```tsx
// app/Layout.tsx (header 안)
const user = useAuthStore((s) => s.user)
const logout = useLogout()

<nav className={styles.nav}>
  {user ? (
    <>
      <Link to="/me">{user.nickname}님</Link>
      <button type="button" onClick={logout}>로그아웃</button>
    </>
  ) : (
    <>
      <Link to="/login">로그인</Link>
      <Link to="/signup">회원가입</Link>
    </>
  )}
</nav>
```

**🔍 원리**
- `finally`: 서버 로그아웃이 실패해도(네트워크 끊김) 화면에서는 로그아웃시킨다. 사용자는 "로그아웃 눌렀는데 안 됨"을 겪지 않는다.
- `qc.clear()`: 안 하면 다른 계정으로 로그인했을 때 **이전 사람의 마이페이지 데이터가 잠깐 보이는** 결함이 생긴다. 실무 QA에서 개인정보 노출로 분류되는 심각한 결함이다.
- `useAuthStore((s) => s.user)`처럼 **필요한 값만 선택**하면 토큰이 바뀔 때 헤더가 불필요하게 다시 그려지지 않는다.

**✔ 확인**: 로그아웃 → 헤더가 로그인 링크로, `refresh_tokens`의 해당 행에 `revoked_at` 기록, 쿠키 삭제.

---

## 8 · 게시판 작성자 연결

**🎯 목표**: 상세에서 **내 글일 때만** 수정·삭제 버튼을 보여주고, 403을 안내한다.

**📄 파일**: `src/features/posts/pages/PostDetailPage.tsx` 수정

```tsx
const me = useAuthStore((s) => s.user)
const canEdit = !!me && (me.id === post.writerId || me.role === 'ADMIN')

{canEdit && (
  <>
    <Button variant="outline" asChild><Link to={`/posts/${post.id}/edit`}>수정</Link></Button>
    <Button variant="destructive" onClick={onDelete} disabled={deletePost.isPending}>삭제</Button>
  </>
)}

// onDelete의 onError
onError: (e) => alert(e instanceof ApiError && e.status === 403 ? '본인 글만 삭제할 수 있습니다.' : e.message),
```

목록의 **글쓰기** 버튼은 비로그인이어도 보여주고, 누르면 `ProtectedRoute`가 로그인으로 보낸다(로그인 후 복귀).

**🔍 원리**
- 비교 기준은 `writerId`(숫자)다. 닉네임은 바뀔 수 있고 중복될 수도 있으므로 비교에 쓰지 않는다. 1주차 `PostResponse`에 `writerId`를 넣은 이유다.
- 버튼을 숨겨도 서버 403 처리는 남겨 둔다. 다른 탭에서 로그아웃·계정 전환이 일어날 수 있다.
- 수정 페이지 URL을 직접 입력하는 경우: 폼은 열리지만 저장 시 서버가 403을 준다. 더 엄격하게 하려면 `PostEditPage`에서 `canEdit`이 아니면 상세로 돌려보낸다(선택).

**✔ 확인**: A로 로그인 → A 글에만 수정·삭제 버튼, B 글에는 없음.

---

## 9 · 마이페이지 백엔드

**🎯 목표**: 내 정보 조회·수정, 비밀번호 변경, 탈퇴, 내 글 목록 API를 만든다.

**🤔 왜 지금**: 로그인 흐름이 완성돼야 "나"를 알 수 있다. 회원 기능을 이번 주에 끝낸다.

**📄 파일**: `user/User.java`(메서드 추가), `user/dto/*`, `user/UserService.java`, `user/UserController.java`, `post/PostRepository.java`, `global/error/ErrorCode.java`

```java
// ErrorCode 추가
INVALID_PASSWORD(HttpStatus.BAD_REQUEST, "U004", "현재 비밀번호가 올바르지 않습니다."),
```

```java
// User.java 메서드 추가
public void updateProfile(String nickname, String email) {
    this.nickname = nickname;
    this.email = email;
}

public void changePassword(String encodedPassword) {
    this.password = encodedPassword;
}

public void withdraw() {
    this.status = UserStatus.WITHDRAWN;
    this.deletedAt = LocalDateTime.now();
}
```

```java
// user/dto
public record MyInfoResponse(Long id, String loginId, String nickname, String email,
                             Role role, Long profileFileId, LocalDateTime createdAt, LocalDateTime lastLoginAt) {
    public static MyInfoResponse from(User u) {
        return new MyInfoResponse(u.getId(), u.getLoginId(), u.getNickname(), u.getEmail(),
                u.getRole(), u.getProfileFileId(), u.getCreatedAt(), u.getLastLoginAt());
    }
}

public record UpdateMyInfoRequest(
        @NotBlank @Size(min = 2, max = 20, message = "닉네임은 2~20자입니다.") String nickname,
        @NotBlank @Email(message = "이메일 형식이 아닙니다.") @Size(max = 100) String email) {
}

public record ChangePasswordRequest(
        @NotBlank(message = "현재 비밀번호를 입력하세요.") String currentPassword,
        @NotBlank @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,20}$",
                message = "비밀번호는 영문과 숫자를 포함해 8~20자입니다.") String newPassword) {
}

public record WithdrawRequest(@NotBlank(message = "비밀번호를 입력하세요.") String password) {
}
```

```java
// UserRepository 추가
boolean existsByEmailAndIdNot(String email, Long id);

// PostRepository 추가 — 내 글 목록 (idx_posts_user_created 인덱스를 타는 조건)
@EntityGraph(attributePaths = "user")
Page<Post> findByUserId(Long userId, Pageable pageable);
```

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    public MyInfoResponse getMe(Long userId) {
        return MyInfoResponse.from(findUser(userId));
    }

    @Transactional
    public MyInfoResponse updateMe(Long userId, UpdateMyInfoRequest req) {
        if (userRepository.existsByEmailAndIdNot(req.email(), userId)) {
            throw new BusinessException(ErrorCode.DUPLICATE_EMAIL);
        }
        User user = findUser(userId);
        user.updateProfile(req.nickname(), req.email());
        return MyInfoResponse.from(user);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest req) {
        User user = findUser(userId);
        verifyPassword(user, req.currentPassword());
        user.changePassword(passwordEncoder.encode(req.newPassword()));
        // 비밀번호가 바뀌면 다른 기기 로그인도 끊는다
        refreshTokenRepository.revokeAllByUserId(userId, LocalDateTime.now());
    }

    @Transactional
    public void withdraw(Long userId, WithdrawRequest req) {
        User user = findUser(userId);
        verifyPassword(user, req.password());
        user.withdraw();
        refreshTokenRepository.revokeAllByUserId(userId, LocalDateTime.now());
    }

    public PageResponse<PostResponse> myPosts(Long userId, Pageable pageable) {
        return PageResponse.from(postRepository.findByUserId(userId, pageable).map(PostResponse::from));
    }

    private void verifyPassword(User user, String raw) {
        if (!passwordEncoder.matches(raw, user.getPassword())) {
            throw new BusinessException(ErrorCode.INVALID_PASSWORD);
        }
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .filter(User::isActive)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
```

```java
@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ApiResponse<MyInfoResponse> me(@AuthenticationPrincipal LoginUser loginUser) {
        return ApiResponse.ok(userService.getMe(loginUser.id()));
    }

    @PatchMapping
    public ApiResponse<MyInfoResponse> update(@AuthenticationPrincipal LoginUser loginUser,
                                              @Valid @RequestBody UpdateMyInfoRequest req) {
        return ApiResponse.ok(userService.updateMe(loginUser.id(), req));
    }

    @PatchMapping("/password")
    public ApiResponse<Void> changePassword(@AuthenticationPrincipal LoginUser loginUser,
                                            @Valid @RequestBody ChangePasswordRequest req) {
        userService.changePassword(loginUser.id(), req);
        return ApiResponse.ok(null);
    }

    @DeleteMapping
    public ApiResponse<Void> withdraw(@AuthenticationPrincipal LoginUser loginUser,
                                      @Valid @RequestBody WithdrawRequest req) {
        userService.withdraw(loginUser.id(), req);
        return ApiResponse.ok(null);
    }

    @GetMapping("/posts")
    public ApiResponse<PageResponse<PostResponse>> myPosts(
            @AuthenticationPrincipal LoginUser loginUser,
            @ParameterObject @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(userService.myPosts(loginUser.id(), pageable));
    }
}
```

**🔍 원리**
- 경로에 `/users/{id}`가 아니라 **`/users/me`**: 누구의 정보인지를 URL이 아니라 토큰이 정한다. `/users/5`로 남의 정보를 보는 식의 권한 우회(IDOR)가 원천 차단된다.
- **탈퇴 = 소프트 삭제**: ERD 규칙대로 행을 지우지 않고 `status = WITHDRAWN` + `deleted_at` 기록. 작성한 글의 FK(`posts.user_id`)도 깨지지 않는다. 3주차 로그인 로직이 `WITHDRAWN`을 막고, 모든 Refresh를 폐기해 **다른 기기도 즉시 로그아웃**된다(Access는 최대 30분 남지만 `findUser`의 `isActive` 체크로 마이페이지 API는 바로 막힌다).
- 비밀번호 변경·탈퇴 때 **현재 비밀번호를 다시 확인**: 자리를 비운 사이 누가 키보드를 만져도 계정을 빼앗을 수 없다.
- `existsByEmailAndIdNot`: 이메일을 안 바꾸고 닉네임만 수정할 때 **자기 자신과 중복**으로 걸리지 않게 한다.
- 내 글 목록은 숨김 글도 보여준다(내 글이니까). `@SQLRestriction` 때문에 삭제한 글은 자동으로 빠진다. `user_id` 조건 + `created_at` 정렬이 ERD 인덱스 `idx_posts_user_created (user_id, created_at)`과 정확히 맞는다.
- 탈퇴는 `DELETE`인데 본문(비밀번호)이 있다. HTTP 명세상 가능하지만 일부 프록시가 DELETE 본문을 버린다. 문제가 되면 `POST /api/users/me/withdraw`로 바꾸는 것도 흔한 선택이다.

**✔ 확인** (Swagger, Authorize 후)
- [ ] `GET /api/users/me` → 내 정보 / `PATCH` 닉네임 변경 → 헤더 닉네임은 **다음 재발급 때** 바뀜(10번에서 즉시 반영)
- [ ] 다른 사람 이메일로 변경 → 409 U003
- [ ] 현재 비밀번호 틀리게 변경 → 400 U004 / 성공 후 `refresh_tokens` 전부 revoked
- [ ] 탈퇴 → `users.status = WITHDRAWN`, `deleted_at` 기록 → 같은 계정 로그인 401 A003, 작성한 글은 목록에 닉네임과 함께 남아 있음

---

## 10 · 마이페이지 프런트

**🎯 목표**: 내 정보 수정, 비밀번호 변경, 탈퇴, 내 글 목록을 한 페이지에 만든다.

**📄 파일**: `src/features/users/api.ts`, `queries.ts`, `schema.ts`, `pages/MyPage.tsx`

```ts
// features/users/api.ts
export type MyInfo = {
  id: number; loginId: string; nickname: string; email: string
  role: Role; profileFileId: number | null; createdAt: string; lastLoginAt: string | null
}

export const userApi = {
  me: () => unwrap(api.get<ApiResponse<MyInfo>>('/users/me')),
  update: (body: { nickname: string; email: string }) =>
    unwrap(api.patch<ApiResponse<MyInfo>>('/users/me', body)),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    unwrap(api.patch<ApiResponse<void>>('/users/me/password', body)),
  withdraw: (password: string) => unwrap(api.delete<ApiResponse<void>>('/users/me', { data: { password } })),
  myPosts: (page: number) =>
    unwrap(api.get<ApiResponse<PageResponse<Post>>>('/users/me/posts', { params: { page, size: 10 } })),
}
```

```ts
// features/users/queries.ts
export const userKeys = {
  me: ['users', 'me'] as const,
  myPosts: (page: number) => ['users', 'me', 'posts', page] as const,
}

export const useMe = () => useQuery({ queryKey: userKeys.me, queryFn: userApi.me })

export const useMyPosts = (page: number) =>
  useQuery({ queryKey: userKeys.myPosts(page), queryFn: () => userApi.myPosts(page), placeholderData: keepPreviousData })

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: userApi.update,
    onSuccess: (me) => {
      qc.setQueryData(userKeys.me, me)              // 응답으로 캐시 바로 교체
      const { accessToken, user } = useAuthStore.getState()
      if (accessToken && user) {
        useAuthStore.getState().setAuth(accessToken, { ...user, nickname: me.nickname })
      }
      qc.invalidateQueries({ queryKey: postKeys.all }) // 목록의 작성자 닉네임도 갱신
    },
  })
}
```

```tsx
// features/users/pages/MyPage.tsx (구조)
export default function MyPage() {
  const { data: me, isPending } = useMe()
  const [page, setPage] = useState(0)
  const myPosts = useMyPosts(page)
  const logout = useLogout()

  if (isPending || !me) return <p>불러오는 중...</p>

  return (
    <section>
      <h1>마이페이지</h1>
      <ProfileForm me={me} />            {/* nickname, email — PostForm과 같은 패턴, 409 U003 → email 칸 */}
      <PasswordForm />                   {/* current, new, confirm — passwordRule 재사용, 400 U004 → current 칸 */}
      <MyPostList query={myPosts} page={page} onPage={setPage} />
      <WithdrawSection onDone={logout} /> {/* 비밀번호 입력 + confirm → 성공 시 logout() */}
    </section>
  )
}

// PasswordForm의 onSubmit 핵심
await userApi.changePassword({ currentPassword, newPassword })
alert('비밀번호가 변경되었습니다. 다시 로그인해 주세요.')
await logout() // 서버가 모든 Refresh를 폐기했으므로 깔끔하게 로그아웃
```

**🔍 원리**
- `setQueryData`: 수정 API가 새 정보를 돌려주므로 다시 조회하지 않고 **응답으로 캐시를 교체**한다. 요청 1번 절약.
- 헤더 닉네임은 zustand `user`에서 오므로 **스토어도 함께** 갱신한다. 서버 상태(React Query)와 클라이언트 상태(zustand)가 한 값을 나눠 들고 있을 때는 이렇게 둘 다 맞춰야 한다. 그래서 zustand에는 최소한만 둔다.
- 비밀번호 변경 후 로그아웃: 서버가 이미 모든 Refresh를 폐기했으므로 30분 뒤 어차피 튕긴다. 바로 다시 로그인시키는 게 사용자에게 명확하다.
- 탈퇴는 되돌릴 수 없으므로 확인 단계를 두 번(비밀번호 + confirm) 둔다.
- 폼 컴포넌트(ProfileForm, PasswordForm, WithdrawSection)는 2주차 `PostForm`과 똑같은 패턴이다. 직접 만들어 보고 막히면 `PostForm`을 참고하자.

**✔ 확인**
- [ ] 닉네임 변경 → 헤더·게시글 목록 작성자명이 새로고침 없이 바뀜
- [ ] 비밀번호 변경 → 로그아웃 → 새 비밀번호로 로그인
- [ ] 탈퇴 → 로그아웃 상태, 같은 계정 로그인 실패
- [ ] A로 마이페이지 확인 → 로그아웃 → B로 로그인 → 마이페이지에 **A 정보가 잠깐도 안 보임**

---

## 11 · 테스트

**📄 파일**: `src/shared/api/client.test.ts`, `src/features/auth/pages/LoginPage.test.tsx`, 백엔드 `UserServiceTest.java`

```ts
// shared/api/client.test.ts — 인터셉터: 401 → 재발급 → 재시도, 동시 401은 재발급 1번
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { api } from './client'
import { useAuthStore } from '@/features/auth/authStore'

const user = { id: 1, loginId: 'tester', nickname: '테스터', role: 'USER' as const }

describe('axios 인터셉터', () => {
  beforeEach(() => useAuthStore.getState().setAuth('old-token', user))

  it('401이면 재발급 후 원래 요청을 새 토큰으로 재시도한다', async () => {
    let reissueCount = 0
    server.use(
      http.get('/api/users/me', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer new-token'
          ? HttpResponse.json({ success: true, data: { id: 1 } })
          : HttpResponse.json({ success: false, error: { code: 'A001', message: '만료' } }, { status: 401 }),
      ),
      http.post('/api/auth/reissue', () => {
        reissueCount++
        return HttpResponse.json({ success: true, data: { accessToken: 'new-token', expiresIn: 1800, user } })
      }),
    )

    const results = await Promise.all([api.get('/users/me'), api.get('/users/me'), api.get('/users/me')])

    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(reissueCount).toBe(1) // 동시에 3번 401이어도 재발급은 1번
    expect(useAuthStore.getState().accessToken).toBe('new-token')
  })

  it('재발급도 실패하면 로그아웃 상태가 되고 401 ApiError를 던진다', async () => {
    server.use(
      http.get('/api/users/me', () =>
        HttpResponse.json({ success: false, error: { code: 'A001', message: '만료' } }, { status: 401 })),
      http.post('/api/auth/reissue', () =>
        HttpResponse.json({ success: false, error: { code: 'A002', message: '다시 로그인' } }, { status: 401 })),
    )

    await expect(api.get('/users/me')).rejects.toMatchObject({ status: 401 })
    expect(useAuthStore.getState().status).toBe('guest')
  })
})
```

```tsx
// features/auth/pages/LoginPage.test.tsx
it('로그인 성공 시 원래 가려던 페이지로 이동한다', async () => {
  server.use(http.post('/api/auth/login', () =>
    HttpResponse.json({ success: true, data: { accessToken: 't', expiresIn: 1800, user } })))

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/posts/new' } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/posts/new" element={<p>글쓰기 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  await userEvent.type(screen.getByLabelText('아이디'), 'tester')
  await userEvent.type(screen.getByLabelText('비밀번호'), 'pass1234')
  await userEvent.click(screen.getByRole('button', { name: '로그인' }))

  expect(await screen.findByText('글쓰기 화면')).toBeInTheDocument()
})

it('빈 값 제출 시 에러 메시지를 보여준다', async () => {
  // ...같은 render
  await userEvent.click(screen.getByRole('button', { name: '로그인' }))
  expect(await screen.findByText('아이디를 입력하세요.')).toBeInTheDocument()
})
```

```java
// UserServiceTest (Mockito 단위 테스트)
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock PostRepository postRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks UserService userService;

    @Test
    @DisplayName("현재 비밀번호가 틀리면 U004, 토큰은 폐기하지 않는다")
    void changePassword_wrongCurrent() {
        User user = User.builder().loginId("tester").password("hash").nickname("n").email("e@e.com").build();
        given(userRepository.findById(1L)).willReturn(Optional.of(user));
        given(passwordEncoder.matches("wrong", "hash")).willReturn(false);

        assertThatThrownBy(() -> userService.changePassword(1L, new ChangePasswordRequest("wrong", "newpass123")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_PASSWORD);
        then(refreshTokenRepository).shouldHaveNoInteractions();
    }
}
```

**🔍 원리**
- 인터셉터 테스트가 이번 주 **가장 가치 있는 테스트**다. "동시 401에 재발급 1번"은 손으로 재현하기 매우 어렵지만, MSW로는 `Promise.all` 한 줄이다.
- 탈퇴 계정 로그인 실패는 3주차 `AuthIntegrationTest`에 한 케이스로 추가하면 된다(가입 → 탈퇴 API → 로그인 401).
- 수동 체크: 3주차 `application.yml`의 `access-exp-minutes`를 **1**로 바꾸고, 로그인 후 1분 뒤 글쓰기 → Network 탭에서 `401 → reissue → 201` 순서가 보이면 인터셉터가 실제로 동작하는 것이다(확인 후 30으로 복구).

**✔ 확인**: `npm run test`, `./gradlew test` 전부 통과.

---

## 🔧 안 될 때 체크리스트

- **새로고침하면 로그아웃됨** → `reissue` 응답에 `Set-Cookie`가 있나? 쿠키 `path=/api/auth`와 요청 경로가 맞나? `withCredentials`(3번)?
- **로그인 직후 바로 로그아웃됨 / 가끔 강제 로그아웃** → 재발급이 동시에 2번 나가고 있다. Network 탭에서 `reissue` 개수 확인. StrictMode(4번), 대기열(3번).
- **무한 요청** → 재발급을 `api` 인스턴스로 호출했거나 `_retry` 표시가 없다(3번).
- **로그인 실패인데 재발급 요청이 나감** → `/auth/` URL 제외 조건(3번).
- **로그인 페이지로 튕겼다가 돌아옴(깜빡임)** → 초기 `status`가 `'checking'`인가(1번)?
- **다른 계정 로그인 시 이전 정보가 보임** → 로그아웃에서 `queryClient.clear()`(7번).
- **닉네임 수정했는데 헤더가 그대로** → zustand `user`도 갱신했나(10번)?
- **쿠키가 저장 안 됨(운영)** → `secure=true`인데 HTTP로 접속했거나, `SameSite=Strict`인데 프런트·백엔드 도메인이 다르다(6주차 Nginx로 같은 도메인).

## 🧠 스스로 설명해보기

1. Access Token을 localStorage가 아니라 메모리에 두면 새로고침 때 어떻게 로그인이 유지되나?
2. 동시에 요청 3개가 401을 받을 때 재발급이 1번만 나가는 원리는? 2번 나가면 왜 로그아웃되나?
3. StrictMode에서 `useEffect`가 두 번 실행되는데도 재발급이 한 번인 이유는?
4. 재발급 실패 시 인터셉터가 직접 페이지를 이동시키지 않는 이유는?
5. `status`에 `'checking'`이 없으면 어떤 결함이 생기나?
6. 로그아웃 때 `queryClient.clear()`를 하지 않으면 어떤 결함이 생기나?
7. `/api/users/{id}` 대신 `/api/users/me`를 쓰면 무엇이 막아지나?
8. 탈퇴를 소프트 삭제로 하면 작성한 게시글은 어떻게 되나?

## 🚀 여유가 있다면

- [ ] 탭 간 로그아웃 동기화: `BroadcastChannel('auth')`로 한 탭에서 로그아웃하면 다른 탭도 로그아웃
- [ ] Access 만료 1분 전에 미리 재발급(`expiresIn` 활용)해서 401 자체를 줄이기
- [ ] 아이디 중복을 가입 버튼 누르기 전에 확인하는 `GET /api/auth/check-login-id?loginId=` (디바운스 500ms)
- [ ] 마이페이지 "로그인된 기기" 목록 (3주차 선택 과제 API 연결)
