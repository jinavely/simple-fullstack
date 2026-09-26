# 4주차 · 회원·로그인 프런트 + 마이페이지 (10/19~25 · 12h)

> 3주차 인증 API를 화면에 연결하고, 마이페이지(백엔드 + 프런트)로 회원 기능을 마무리한다.
> 각 단계는 **🎯 목표 → 🤔 왜 지금 → 📄 파일 → ⌨️ 코드 → 🔍 원리 → ✔ 확인** 순서.
> 전제: 2주차 `lib/api-client.ts`(ApiError 통일), 3주차 `/api/auth/*`(signup · check-login-id · login · reissue · logout)가 동작한다.

> 📌 **출발점**: 화면 껍데기는 이미 있다 — `pages/LoginPage` · `SignupPage` · `MyPage`, `features/auth/LoginForm` · `SignupForm`, `features/member/*`(ProfileForm, PasswordChangeForm, WithdrawDialog, MyPostTable, MyCommentTable, ProfileImageField), 헤더(`RootLayout`)의 로그인·회원가입·마이페이지·로그아웃 링크, 라우트(`ROUTES.LOGIN` · `SIGNUP` · `MYPAGE`). 이번 주는 여기에 **상태와 데이터를 연결**한다.
> `ProfileImageField`(프로필 이미지)와 `MyCommentTable`(내 댓글)은 파일·댓글이 필요하므로 **5주차**에 연결한다.

---

## 🗺 전체 흐름

```text
앱 시작 ──▶ AuthBootstrap: POST /api/auth/reissue (쿠키 자동)
              ├ 200 → useAuthStore { accessToken, user, status: 'authenticated' }
              └ 401 → useAuthStore { status: 'guest' }
                         (그동안 status: 'checking' → ProtectedRoute는 로딩 표시)

API 요청 ──▶ 요청 인터셉터: Authorization: Bearer <accessToken>
          ◀── 401? ──▶ 응답 인터셉터 (lib/api-client.ts)
                         ├ 재발급 진행 중이면 그 Promise를 같이 기다림 (대기열)
                         ├ 아니면 reissue 1회 실행
                         ├ 성공 → 새 토큰으로 원래 요청 재시도
                         └ 실패 → useAuthStore.clear() → ProtectedRoute가 /login으로
```

**핵심 한 줄**: 토큰은 **zustand(메모리)**, 쿠키는 **브라우저가 알아서**, 만료 처리는 **axios 인터셉터 한 곳**에서. 페이지 코드는 토큰을 전혀 몰라야 한다.

## 📋 순서표

| # | 할 일 | 파일 | 끝나면 확인할 것 |
|---|---|---|---|
| 1 | 인증 스토어 · 토큰 스키마 | `lib/auth-schema.ts`, `store/useAuthStore.ts` | 컴파일 OK |
| 2 | 인증 API · 폼 스키마 · 훅 | `features/auth/schema.ts`, `api.ts`, `queries.ts` | 컴파일 OK |
| 3 | 인터셉터: 토큰 첨부 · 401 재발급 · 대기열 | `lib/api-client.ts` 수정 | 컴파일 OK |
| 4 | 새로고침 로그인 복원 | `features/auth/AuthBootstrap.tsx`, `main.tsx` | 새로고침 후 로그인 유지 |
| 5 | 라우트 보호 | `routes/ProtectedRoute.tsx`, `routes/router.tsx` | 비로그인 글쓰기 → /login |
| 6 | 로그인 · 회원가입 폼 (+ 아이디 중복 확인) | `LoginForm`, `SignupForm`, `LoginPage`, `SignupPage` | 가입 → 로그인 → 원래 페이지 |
| 7 | 헤더 로그인 상태 · 로그아웃 | `RootLayout.tsx` | 로그아웃 후 캐시 비움 |
| 8 | 게시판 작성자 연결 | `PostViewPage.tsx`, `PostEditPage.tsx` | 내 글만 수정·삭제 버튼 |
| 9 | 마이페이지 백엔드 | `UserController`, `UserService`, DTO, `User` | Swagger로 `/api/users/me` |
| 10 | 마이페이지 프런트 | `features/member/*`, `pages/MyPage.tsx` | 닉네임 수정 · 비밀번호 변경 · 탈퇴 · 내 글 |
| 11 | 테스트 | `lib/api-client.test.ts`, `LoginForm.test.tsx`, `UserServiceTest` | 전부 통과 |

## 📁 추가·변경 파일 (프런트)

```text
frontend/src
 ├─ main.tsx                              (4 수정: AuthBootstrap)
 ├─ lib
 │   ├─ auth-schema.ts                    (1 새로)
 │   ├─ api-client.ts                     (3 수정)
 │   └─ api-client.test.ts                (11)
 ├─ store/useAuthStore.ts                 (1 새로)
 ├─ routes
 │   ├─ ProtectedRoute.tsx                (5 새로)
 │   └─ router.tsx                        (5 수정)
 ├─ components/layout/RootLayout.tsx      (7 수정)
 ├─ features/auth
 │   ├─ schema.ts · api.ts · queries.ts   (2)
 │   ├─ AuthBootstrap.tsx                 (4)
 │   ├─ LoginForm.tsx · SignupForm.tsx    (6 수정)
 │   └─ LoginForm.test.tsx                (11)
 ├─ features/member
 │   ├─ schema.ts · api.ts · queries.ts   (10)
 │   └─ ProfileForm · PasswordChangeForm · WithdrawDialog · MyPostTable (10 수정)
 └─ pages
     ├─ LoginPage.tsx · SignupPage.tsx    (6 수정)
     ├─ MyPage.tsx                        (10 수정)
     └─ PostViewPage.tsx · PostEditPage.tsx (8 수정)
```

---

## 1 · 인증 스토어 · 토큰 스키마 (zustand)

**🎯 목표**: Access Token, 로그인 사용자, 확인 상태를 메모리에 보관한다.

**🤔 왜 지금**: 인터셉터(3번), 복원(4번), 라우트 보호(5번), 헤더(7번)가 모두 이 스토어를 읽는다.

**📄 파일**: `src/lib/auth-schema.ts`, `src/store/useAuthStore.ts`

zustand는 이미 설치돼 있다. 전역 클라이언트 상태는 `src/store/`에 `use...Store` 이름으로 둔다.

```ts
// lib/auth-schema.ts — 3주차 UserSummary, TokenResponse와 맞춤
import { z } from 'zod'

export const authUserSchema = z.object({
  id: z.number(),
  loginId: z.string(),
  nickname: z.string(),
  role: z.enum(['USER', 'ADMIN']),
})
export type AuthUser = z.infer<typeof authUserSchema>

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  user: authUserSchema,
})
export type TokenResponse = z.infer<typeof tokenResponseSchema>
```

```ts
// store/useAuthStore.ts
import { create } from 'zustand'
import type { AuthUser } from '@/lib/auth-schema'

type AuthStatus = 'checking' | 'authenticated' | 'guest'

type AuthState = {
  accessToken: string | null
  user: AuthUser | null
  status: AuthStatus
  setAuth: (accessToken: string, user: AuthUser) => void
  updateUser: (patch: Partial<AuthUser>) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  status: 'checking',
  setAuth: (accessToken, user) =>
    set({ accessToken, user, status: 'authenticated' }),
  updateUser: (patch) =>
    set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
  clear: () => set({ accessToken: null, user: null, status: 'guest' }),
}))
```

**🔍 원리**
- **왜 localStorage가 아니라 메모리인가**: localStorage는 페이지의 모든 스크립트가 읽을 수 있다. XSS 한 번이면 토큰이 털린다. 메모리는 새로고침하면 사라지지만, 사라진 토큰은 4번에서 **httpOnly 쿠키(Refresh)로 다시 받는다**. 안전성과 편의를 둘 다 얻는 조합이다.
- `persist` 미들웨어를 쓰지 않는 이유도 같다(persist = localStorage 저장).
- `status`를 3개로 둔 이유: 앱을 막 열었을 때는 "로그인인지 아닌지 **아직 모름**"이다. 이걸 `guest`로 두면 새로고침 순간 로그인 페이지로 튕겼다가 돌아오는 깜빡임이 생긴다.
- **zustand에는 로그인 정보만**. 게시글·내 정보 같은 서버 데이터는 계속 React Query에 둔다(2주차 원칙). `updateUser`는 10번에서 닉네임을 바꿨을 때 헤더를 즉시 맞추는 용도다.
- `useAuthStore.getState()`: 컴포넌트 밖(axios 인터셉터)에서도 현재 값을 읽을 수 있다. zustand를 고른 이유 중 하나다.
- 토큰 스키마를 `features/auth`가 아니라 **`lib`**에 둔 이유: 3번 `lib/api-client.ts`가 재발급 응답을 검사할 때 이 스키마를 쓴다. `lib`은 `features`를 import하지 않는다는 2주차 규칙을 지키기 위해서다. 방향은 `lib ← store ← features`로 한쪽으로만 흐른다.

**✔ 확인**: 컴파일 OK.

---

## 2 · 인증 API · 폼 스키마 · 훅

**🎯 목표**: 3주차 API를 함수와 훅으로 만들고, 가입·로그인 폼 규칙을 3주차 백엔드와 똑같이 맞춘다.

**📄 파일**: `src/features/auth/schema.ts`, `api.ts`, `queries.ts`

```ts
// features/auth/schema.ts — 3주차 SignupRequest의 @Pattern · @Size와 같은 규칙
import { z } from 'zod'

export const loginSchema = z.object({
  loginId: z.string().trim().min(1, '아이디를 입력하세요.'),
  password: z.string().min(1, '비밀번호를 입력하세요.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const loginIdRule = z
  .string()
  .trim()
  .regex(/^[a-z0-9]{4,20}$/, '아이디는 영문 소문자·숫자 4~20자입니다.')

export const passwordRule = z
  .string()
  .regex(
    /^(?=.*[A-Za-z])(?=.*\d).{8,20}$/,
    '비밀번호는 영문과 숫자를 포함해 8~20자입니다.',
  )

export const nicknameRule = z
  .string()
  .trim()
  .min(2, '닉네임은 2~20자입니다.')
  .max(20, '닉네임은 2~20자입니다.')

export const signupSchema = z
  .object({
    loginId: loginIdRule,
    password: passwordRule,
    passwordConfirm: z.string(),
    nickname: nicknameRule,
    email: z.email('이메일 형식이 아닙니다.').max(100, '이메일은 100자 이하입니다.'),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다.',
  })
export type SignupValues = z.infer<typeof signupSchema>
```

```ts
// features/auth/api.ts
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { apiResponseSchema } from '@/lib/api-response'
import { tokenResponseSchema } from '@/lib/auth-schema'
import type { LoginValues, SignupValues } from './schema'

export async function login(body: LoginValues) {
  const { data } = await apiClient.post('/auth/login', body)
  return apiResponseSchema(tokenResponseSchema).parse(data).data
}

// passwordConfirm은 서버에 보내지 않는다 (서버 DTO에 없음)
export async function signup({ loginId, password, nickname, email }: SignupValues) {
  const { data } = await apiClient.post('/auth/signup', {
    loginId,
    password,
    nickname,
    email,
  })
  return apiResponseSchema(z.number()).parse(data).data
}

export async function checkLoginId(loginId: string) {
  const { data } = await apiClient.get('/auth/check-login-id', {
    params: { loginId },
  })
  return apiResponseSchema(z.object({ available: z.boolean() })).parse(data)
    .data.available
}

export async function logout() {
  await apiClient.post('/auth/logout')
}
// reissue는 인터셉터와 얽혀 있어서 3번 lib/api-client.ts 안에 둔다
```

```ts
// features/auth/queries.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useAuthStore } from '@/store/useAuthStore'
import { ROUTES } from '@/routes/paths'
import { checkLoginId, login, logout, signup } from './api'

export function useLoginMutation() {
  const setAuth = useAuthStore((s) => s.setAuth)
  return useMutation({
    mutationFn: login,
    onSuccess: ({ accessToken, user }) => setAuth(accessToken, user),
  })
}

export function useSignupMutation() {
  return useMutation({ mutationFn: signup })
}

export function useCheckLoginIdMutation() {
  return useMutation({ mutationFn: checkLoginId })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const clear = useAuthStore((s) => s.clear)

  return async () => {
    try {
      await logout()
    } catch {
      // 서버 로그아웃이 실패해도(네트워크 끊김) 화면은 로그아웃시킨다
    } finally {
      navigate(ROUTES.POSTS, { replace: true })
      clear()
      queryClient.clear() // 이전 사용자의 캐시(내 정보, 내 글) 제거
    }
  }
}
```

**🔍 원리**
- 정규식이 **백엔드와 글자 하나까지 같아야** 한다. ERD(`login_id VARCHAR(20)`, `nickname VARCHAR(20)`, `email VARCHAR(100)`) → 백엔드 DTO → zod 순으로 숫자가 이어진다.
- `passwordConfirm`은 서버에 보내지 않는다. `.refine`은 **필드 두 개를 비교**하는 검증이고, `path`로 에러를 어느 입력창 아래에 띄울지 정한다. `signup`이 필요한 필드만 골라 보내므로 컴포넌트가 신경 쓸 필요가 없다.
- `z.email()`: zod 4는 이메일 같은 형식 검사를 최상위 함수로 쓴다(`z.string().email()`은 옛 문법).
- `loginIdRule` · `passwordRule` · `nicknameRule`을 따로 export: 10번 마이페이지(닉네임 수정, 비밀번호 변경)에서 재사용한다.
- 로그인·가입도 2주차처럼 **컴포넌트는 훅만** 쓴다. 로그인 성공 시 스토어에 저장하는 일은 `useLoginMutation`의 `onSuccess`가 맡아서, 폼은 "성공하면 어디로 갈지"만 안다.
- 아이디 중복 확인은 조회지만 **버튼을 눌렀을 때만** 실행하므로 `useQuery` 대신 `useMutation`을 쓴다(자동 실행·캐시가 필요 없음).
- `useLogout`에서 `navigate`를 `clear()`보다 **먼저** 부른다. 마이페이지에서 로그아웃할 때 `clear()`가 먼저 되면 5번 `ProtectedRoute`가 `/login`으로 먼저 보내 버린다.

**✔ 확인**: 컴파일 OK.

---

## 3 · 인터셉터: 토큰 첨부 · 401 재발급 · 대기열

**🎯 목표**: 모든 요청에 토큰을 붙이고, 401이 오면 **한 번만** 재발급한 뒤 원래 요청을 다시 보낸다. 동시에 여러 요청이 401을 받아도 재발급은 1번만 한다.

**🤔 왜 지금**: 이게 있어야 페이지 코드가 토큰 만료를 전혀 신경 쓰지 않는다. 2주차에 인스턴스를 하나로 모아 두고 `TODO 4주차` 자리를 남겨 둔 이유가 여기서 드러난다.

**📄 파일**: `src/lib/api-client.ts` (2주차 파일 수정 — 전체 교체)

```ts
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/useAuthStore'
import { apiResponseSchema } from './api-response'
import { tokenResponseSchema, type TokenResponse } from './auth-schema'

export type ApiErrorBody = {
  code: string
  message: string
  fields?: Record<string, string>
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.fields = body.fields
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
  withCredentials: true,
})

// ── 재발급: 동시에 여러 번 불려도 실제 요청은 1번 ──────────────────
let refreshPromise: Promise<TokenResponse> | null = null

export function refreshAccessToken(): Promise<TokenResponse> {
  refreshPromise ??= axios
    // 인터셉터가 없는 "맨 axios"로 호출해야 무한 루프가 안 생긴다
    .post(`${baseURL}/auth/reissue`, null, { withCredentials: true })
    .then(({ data }) => {
      const token = apiResponseSchema(tokenResponseSchema).parse(data).data
      useAuthStore.getState().setAuth(token.accessToken, token.user)
      return token
    })
    .catch((error: unknown) => {
      useAuthStore.getState().clear()
      throw error
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

// ── 요청 인터셉터: 토큰 첨부 ──────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── 응답 인터셉터: 401 → 재발급 → 재시도, 그 외 → ApiError ───────
type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: ApiErrorBody }>) => {
    const original = error.config as RetryConfig | undefined
    const status = error.response?.status ?? 0
    const isAuthUrl = original?.url?.startsWith('/auth/') ?? false

    if (status === 401 && original && !original._retry && !isAuthUrl) {
      original._retry = true
      try {
        const { accessToken } = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(original) // 원래 요청 재시도
      } catch {
        // 재발급도 실패 → 아래로 내려가 원래 401을 ApiError로 변환
      }
    }

    const body = error.response?.data?.error ?? {
      code: 'NETWORK_ERROR',
      message: '서버에 연결할 수 없습니다.',
    }
    return Promise.reject(new ApiError(status, body))
  },
)
```

**🔍 원리**
- **대기열 = Promise 하나 공유**: 목록·댓글·내 정보 요청 3개가 동시에 401을 받으면, 첫 번째가 `refreshPromise`를 만들고 나머지 둘은 **같은 Promise를 기다린다**(`??=`는 "비어 있을 때만 대입"). 재발급 요청은 1번만 나가고, 끝나면 셋 다 새 토큰으로 재시도한다. 배열로 콜백을 모으는 방식과 결과는 같고 코드가 짧다.
- **왜 재발급이 1번이어야 하나**: 3주차 **Rotation** 때문이다. 재발급을 동시에 2번 하면 두 번째 요청은 방금 폐기된 Refresh를 쓰게 되고, 서버는 "탈취"로 판단해 **모든 토큰을 폐기**한다. 결과는 원인 모를 강제 로그아웃이다.
- `_retry` 표시: 재시도한 요청이 또 401이면 다시 재발급하지 않는다(무한 루프 방지).
- `/auth/*` 제외: 로그인 실패(401 A003)에서 재발급을 시도하면 안 된다.
- 재발급은 **맨 `axios`**로 호출: `apiClient`로 부르면 재발급의 401이 다시 인터셉터를 타서 루프가 된다. 그래서 재발급 응답도 2주차 방식대로 **zod로 직접 검사**한다.
- `withCredentials: true`: 브라우저가 **쿠키(Refresh)를 요청에 실어 보내게** 한다. 같은 출처(Vite 프록시)에서는 없어도 동작하지만, 명시해 두면 도메인이 나뉘는 배포에서도 안전하다.
- 재발급 실패 시 `clear()`만 한다. 화면 이동은 5번 `ProtectedRoute`가 **스토어 변화를 보고** 알아서 한다. 인터셉터에서 `window.location`을 바꾸면 React 상태가 다 날아가고 테스트도 어렵다.
- `lib/api-client`가 `store/useAuthStore`를 import하지만, 스토어는 `lib/auth-schema`의 **타입만** 가져오므로 순환 참조가 생기지 않는다.

**✔ 확인**: 컴파일 OK. (동작 확인은 4번 이후)

---

## 4 · 새로고침 로그인 복원 (`AuthBootstrap`)

**🎯 목표**: 앱이 열릴 때 쿠키로 Access Token을 다시 받아 로그인 상태를 복원한다.

**🤔 왜 지금**: 메모리에 둔 토큰은 새로고침하면 사라진다. 복원이 없으면 새로고침할 때마다 로그아웃된다.

**📄 파일**: `src/features/auth/AuthBootstrap.tsx`, `src/main.tsx` 수정

```tsx
// features/auth/AuthBootstrap.tsx
import { useEffect, type ReactNode } from 'react'
import { refreshAccessToken } from '@/lib/api-client'

export function AuthBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    // 실패해도 refreshAccessToken 안에서 status가 'guest'로 바뀐다
    refreshAccessToken().catch(() => {})
  }, [])

  return children
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
      <ReactQueryDevtools initialIsOpen={false} />
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

**🎯 목표**: 로그인이 필요한 페이지(글쓰기·수정·마이페이지)는 비로그인 사용자를 로그인 페이지로 보내고, 로그인 후 **원래 가려던 페이지**로 돌아오게 한다.

**📄 파일**: `src/routes/ProtectedRoute.tsx`, `src/routes/router.tsx` 수정

```tsx
// routes/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthStore } from '@/store/useAuthStore'
import { ROUTES } from './paths'

export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'checking')
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        로그인 확인 중…
      </p>
    )
  if (status === 'guest')
    return (
      <Navigate
        to={ROUTES.LOGIN}
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  return <Outlet />
}
```

```tsx
// routes/router.tsx
export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: ROUTES.POSTS, element: <PostListPage /> },
      { path: ROUTES.POST_DETAIL, element: <PostViewPage /> },
      { path: ROUTES.LOGIN, element: <LoginPage /> },
      { path: ROUTES.SIGNUP, element: <SignupPage /> },
      {
        element: <ProtectedRoute />, // 아래는 로그인 필요
        children: [
          { path: ROUTES.POST_NEW, element: <PostWritePage /> },
          { path: ROUTES.POST_EDIT, element: <PostEditPage /> },
          { path: ROUTES.MYPAGE, element: <MyPage /> },
        ],
      },
      { path: ROUTES.NOT_FOUND, element: <NotFoundPage /> },
    ],
  },
])
```

**🔍 원리**
- `path` 없는 라우트(**레이아웃 라우트**)로 감싸면 그 아래 페이지들이 전부 같은 검사를 받는다. 페이지마다 `if (!user)`를 쓰지 않는다.
- `ProtectedRoute`를 `routes/`에 둔 이유: 특정 기능이 아니라 **라우팅 규칙**이다.
- `/posts/new`는 `/posts/:id`보다 우선 매칭된다. React Router는 **고정 경로를 동적 경로보다 먼저** 고르므로 그룹이 나뉘어도 문제없다.
- `state.from`: 로그인 페이지가 이 값을 읽어 로그인 후 원래 페이지로 보낸다. `location.search`까지 넣어서 `?tab=posts` 같은 쿼리스트링도 유지된다.
- 재발급 실패로 `clear()`가 되면 `status`가 `guest`로 바뀌고, 이 컴포넌트가 **다시 렌더링되며** 자동으로 로그인 페이지로 간다. 3번에서 인터셉터가 화면 이동을 하지 않은 이유다.
- **화면 보호는 편의 기능**이다. 진짜 보호는 3주차 서버(`anyRequest().authenticated()`)가 한다.

**✔ 확인**: 로그아웃 상태에서 `/posts/new`, `/mypage` → `/login`으로 이동.

---

## 6 · 로그인 · 회원가입 폼 (+ 아이디 중복 확인)

**🎯 목표**: 이미 있는 `LoginForm` · `SignupForm`에 react-hook-form + zod를 연결한다. 로그인 성공 시 원래 페이지로, 가입 성공 시 로그인 페이지로 이동한다. [중복 확인] 버튼을 3주차 API에 연결하고, 서버 409(중복)·400을 입력창에 표시한다.

**📄 파일**: `features/auth/LoginForm.tsx`, `SignupForm.tsx`, `pages/LoginPage.tsx`, `SignupPage.tsx` (모두 수정)

```tsx
// features/auth/LoginForm.tsx
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api-client'
import { ROUTES } from '@/routes/paths'
import { useLoginMutation } from './queries'
import { loginSchema, type LoginValues } from './schema'

type LoginFormProps = {
  onSuccess: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const login = useLoginMutation()
  const {
    register,
    handleSubmit,
    setError,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { loginId: '', password: '' },
  })

  const submit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
      onSuccess()
    } catch (e) {
      setError('root', {
        message: e instanceof ApiError ? e.message : '로그인에 실패했습니다.',
      })
      resetField('password')
    }
  })

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="loginId">아이디</Label>
        <Input
          id="loginId"
          autoComplete="username"
          maxLength={20}
          placeholder="아이디를 입력하세요"
          aria-invalid={!!errors.loginId}
          {...register('loginId')}
        />
        {errors.loginId && (
          <p className="text-sm text-destructive">{errors.loginId.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="mt-2 w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? '로그인 중…' : '로그인'}
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
```

```tsx
// pages/LoginPage.tsx — 폼은 "성공"만 알리고, 어디로 갈지는 페이지가 정한다
import { useLocation, useNavigate } from 'react-router'
// ...Card import는 그대로
import { LoginForm } from '@/features/auth/LoginForm'
import { ROUTES } from '@/routes/paths'

type LoginLocationState = { from?: string; signedUp?: boolean } | null

export function LoginPage() {
  const navigate = useNavigate()
  const state = useLocation().state as LoginLocationState
  const from = state?.from ?? ROUTES.POSTS

  return (
    <div className="mx-auto w-full max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">로그인</CardTitle>
          <CardDescription>
            {state?.signedUp
              ? '가입이 완료되었습니다. 로그인해 주세요.'
              : '아이디와 비밀번호를 입력하세요.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm onSuccess={() => navigate(from, { replace: true })} />
        </CardContent>
      </Card>
    </div>
  )
}
```

```tsx
// features/auth/SignupForm.tsx
import { useState } from 'react'
import { Link } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api-client'
import { ROUTES } from '@/routes/paths'
import { useCheckLoginIdMutation, useSignupMutation } from './queries'
import { signupSchema, type SignupValues } from './schema'

type SignupFormProps = {
  onSuccess: () => void
}

// 서버 에러 코드 → 입력창 (fields가 없는 409용)
const FIELD_BY_CODE: Record<string, keyof SignupValues> = {
  U002: 'loginId',
  U003: 'email',
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const signup = useSignupMutation()
  const checkLoginId = useCheckLoginIdMutation()
  const [checkedLoginId, setCheckedLoginId] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      loginId: '',
      password: '',
      passwordConfirm: '',
      nickname: '',
      email: '',
    },
  })

  // 확인한 뒤 아이디를 고치면 "확인됨"이 풀린다
  const loginId = useWatch({ control, name: 'loginId' }).trim()
  const isLoginIdChecked = checkedLoginId === loginId

  const handleCheckLoginId = async () => {
    if (!(await trigger('loginId'))) return // 형식부터 통과해야 서버에 묻는다
    const value = getValues('loginId').trim()
    try {
      const available = await checkLoginId.mutateAsync(value)
      if (available) {
        setCheckedLoginId(value)
        clearErrors('loginId')
      } else {
        setCheckedLoginId(null)
        setError('loginId', { message: '이미 사용 중인 아이디입니다.' })
      }
    } catch (e) {
      setError('loginId', {
        message: e instanceof Error ? e.message : '확인하지 못했습니다.',
      })
    }
  }

  const submit = handleSubmit(async (values) => {
    if (values.loginId !== checkedLoginId) {
      setError('loginId', { message: '아이디 중복 확인을 해 주세요.' })
      return
    }
    try {
      await signup.mutateAsync(values)
      onSuccess()
    } catch (e) {
      if (!(e instanceof ApiError)) {
        setError('root', { message: '가입하지 못했습니다.' })
      } else if (e.fields) {
        for (const [name, message] of Object.entries(e.fields)) {
          setError(name as keyof SignupValues, { message })
        }
      } else if (FIELD_BY_CODE[e.code]) {
        setError(FIELD_BY_CODE[e.code], { message: e.message })
      } else {
        setError('root', { message: e.message })
      }
    }
  })

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="loginId">아이디</Label>
        <div className="flex gap-2">
          <Input
            id="loginId"
            autoComplete="username"
            maxLength={20}
            placeholder="4~20자 영문 소문자, 숫자"
            className="flex-1"
            aria-invalid={!!errors.loginId}
            {...register('loginId')}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleCheckLoginId}
            disabled={checkLoginId.isPending || isLoginIdChecked}
          >
            {isLoginIdChecked ? '확인 완료' : '중복 확인'}
          </Button>
        </div>
        {errors.loginId ? (
          <p className="text-sm text-destructive">{errors.loginId.message}</p>
        ) : (
          isLoginIdChecked && (
            <p className="text-sm text-muted-foreground">
              사용 가능한 아이디입니다.
            </p>
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="8~20자, 영문·숫자 포함"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
        <Input
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더 입력하세요"
          aria-invalid={!!errors.passwordConfirm}
          {...register('passwordConfirm')}
        />
        {errors.passwordConfirm && (
          <p className="text-sm text-destructive">
            {errors.passwordConfirm.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          maxLength={20}
          placeholder="2~20자"
          aria-invalid={!!errors.nickname}
          {...register('nickname')}
        />
        {errors.nickname && (
          <p className="text-sm text-destructive">{errors.nickname.message}</p>
        )}
      </div>

      {/* 새로 추가: ERD users.email NOT NULL · UNIQUE */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          maxLength={100}
          placeholder="example@email.com"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="mt-2 w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? '가입 중…' : '가입하기'}
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
```

```tsx
// pages/SignupPage.tsx — SignupForm에 onSuccess만 연결
const navigate = useNavigate()
// ...
<SignupForm
  onSuccess={() =>
    navigate(ROUTES.LOGIN, { replace: true, state: { signedUp: true } })
  }
/>
```

**🔍 원리**
- **퍼블리싱 마크업은 그대로**: `name="..."` 속성 자리를 `{...register('...')}`로 바꾸고 에러 문구 줄만 추가했다. `register`가 `name`·`onChange`·`ref`를 한꺼번에 넣어 준다.
- **아이디 중복 확인 흐름**: ① `trigger('loginId')`로 형식 검사 → ② 통과하면 서버에 질문 → ③ 사용 가능하면 그 아이디를 `checkedLoginId`에 기억. 아이디를 한 글자라도 고치면 `useWatch`로 본 현재 값과 달라져 "확인됨"이 풀린다. 제출할 때 확인한 아이디와 다르면 막는다.
- 중복 확인은 **편의**다. 확인과 가입 사이에 다른 사람이 같은 아이디로 가입할 수 있다. 그 경우 서버가 **409 U002**를 주고, 아래 매핑으로 같은 칸에 표시된다.
- **에러 코드로 입력창 연결**: 409는 `fields`가 없고 `code`만 온다. `U002` → 아이디 칸, `U003` → 이메일 칸처럼 **코드를 필드에 매핑**한다. 1주차에 도메인별 에러 코드를 나눈 이유가 여기서 쓰인다.
- **이메일 칸 추가**: 기존 화면에는 없었지만 ERD의 `users.email`이 NOT NULL · UNIQUE다. 백엔드가 요구하는 값은 화면에도 있어야 한다.
- 비밀번호 placeholder를 "영문·숫자·특수문자 조합"에서 **"8~20자, 영문·숫자 포함"**으로 고쳤다. 안내 문구가 실제 규칙과 다르면 사용자는 통과할 수 없는 조건을 맞추려 애쓴다.
- 로그인 실패는 **특정 칸이 아니라 폼 전체(root)**에 표시한다. 서버가 어느 쪽이 틀렸는지 알려주지 않기 때문이다(3주차).
- 실패 시 `resetField('password')`: 틀린 비밀번호를 지워 다시 입력하게 한다.
- `autoComplete` 값을 정확히 주면 브라우저 비밀번호 관리자가 제대로 동작한다. 퍼블리싱 품질 포인트다.
- 로그인 응답의 `Set-Cookie`는 브라우저가 알아서 저장한다. JS는 Refresh를 볼 수도, 볼 필요도 없다.

**✔ 확인**
- [ ] 중복 확인 없이 가입 → "아이디 중복 확인을 해 주세요." / 확인 후 아이디 수정 → 버튼이 다시 "중복 확인"
- [ ] 가입 → 로그인 페이지에 "가입이 완료되었습니다." / 같은 아이디로 중복 확인 → "이미 사용 중인 아이디입니다."
- [ ] 다른 계정과 같은 이메일로 가입 → 이메일 칸 아래 "이미 사용 중인 이메일입니다."
- [ ] 비로그인으로 `/posts/new` → 로그인 → **글쓰기 페이지로 복귀**
- [ ] 개발자도구 Application → Cookies에 `refresh_token`이 있고 **HttpOnly 체크**, Local Storage는 비어 있음

---

## 7 · 헤더 로그인 상태 · 로그아웃

**🎯 목표**: 헤더(이미 네 링크가 다 보이는 상태)를 로그인 여부에 따라 나눠 보여주고, 로그아웃 시 서버 토큰 폐기 + 캐시 초기화를 한다.

**📄 파일**: `src/components/layout/RootLayout.tsx` 수정

```tsx
// components/layout/RootLayout.tsx — 오른쪽 링크 묶음만 교체
import { Link, Outlet } from 'react-router'
import { useLogout } from '@/features/auth/queries'
import { useAuthStore } from '@/store/useAuthStore'
import { ROUTES } from '@/routes/paths'

const navLinkClass = 'text-sm font-medium hover:underline'

export function RootLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col">
      <nav className="flex items-center justify-between gap-4 border-b p-4">
        <div className="flex gap-4">{/* Home · 게시판 링크 그대로 */}</div>
        <div className="flex gap-4">
          {user ? (
            <>
              <Link to={ROUTES.MYPAGE} className={navLinkClass}>
                {user.nickname}님
              </Link>
              <button type="button" onClick={logout} className={navLinkClass}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to={ROUTES.LOGIN} className={navLinkClass}>
                로그인
              </Link>
              <Link to={ROUTES.SIGNUP} className={navLinkClass}>
                회원가입
              </Link>
            </>
          )}
        </div>
      </nav>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
```

**🔍 원리**
- `components/layout`이 `features/auth`를 import하는 건 2주차 규칙의 예외처럼 보이지만, 레이아웃은 **앱 조립 단계**(페이지와 같은 층)라서 허용한다. `components/ui`는 계속 features를 모른다.
- `queryClient.clear()`(2번 `useLogout`): 안 하면 다른 계정으로 로그인했을 때 **이전 사람의 마이페이지 데이터가 잠깐 보이는** 결함이 생긴다. 실무 QA에서 개인정보 노출로 분류되는 심각한 결함이다.
- `useAuthStore((s) => s.user)`처럼 **필요한 값만 선택**하면 토큰이 바뀔 때 헤더가 불필요하게 다시 그려지지 않는다.
- 첫 화면에서 `status === 'checking'`인 짧은 순간에는 `user`가 없어 로그인 링크가 보였다가 닉네임으로 바뀐다. 거슬리면 `status === 'checking'`일 때 오른쪽 묶음을 비워 두자.

**✔ 확인**: 로그아웃 → 헤더가 로그인·회원가입 링크로, `refresh_tokens`의 해당 행에 `revoked_at` 기록, 쿠키 삭제, 게시판으로 이동.

---

## 8 · 게시판 작성자 연결

**🎯 목표**: 상세에서 **내 글일 때만** 수정·삭제 버튼을 보여주고, 403을 안내한다.

**📄 파일**: `src/pages/PostViewPage.tsx`, `src/pages/PostEditPage.tsx` 수정

```tsx
// pages/PostViewPage.tsx — 훅은 조기 반환보다 위에
const me = useAuthStore((s) => s.user)
// ...if (isError) return ... 아래에서
const canEdit = !!me && (me.id === post.writerId || me.role === 'ADMIN')

// 삭제 실패 메시지
{deletePost.isError && (
  <p role="alert" className="text-sm text-destructive">
    {deletePost.error instanceof ApiError && deletePost.error.status === 403
      ? '본인 글만 삭제할 수 있습니다.'
      : deletePost.error.message}
  </p>
)}

// 버튼 묶음 ("4주차" 주석 자리)
{canEdit && (
  <div className="flex gap-2">
    <Button variant="outline" asChild>
      <Link to={toPostEdit(post.id)}>
        <PencilIcon />
        수정
      </Link>
    </Button>
    <PostDeleteDialog onConfirm={handleDelete} isPending={deletePost.isPending} />
  </div>
)}
```

```tsx
// pages/PostEditPage.tsx — 남의 글 수정 주소로 직접 들어오면 상세로 돌려보낸다
const me = useAuthStore((s) => s.user)
// ...if (isError) return ... 아래에서
const canEdit = me && (me.id === post.writerId || me.role === 'ADMIN')
if (!canEdit) return <Navigate to={toPostDetail(post.id)} replace />
```

목록의 **글쓰기** 버튼은 비로그인이어도 보여주고, 누르면 `ProtectedRoute`가 로그인으로 보낸다(로그인 후 복귀).

**🔍 원리**
- 비교 기준은 `writerId`(숫자)다. 닉네임은 바뀔 수 있고 중복될 수도 있으므로 비교에 쓰지 않는다. 1주차 `PostResponse`에 `writerId`를 넣은 이유다.
- 버튼을 숨겨도 서버 403 처리는 남겨 둔다. 다른 탭에서 로그아웃·계정 전환이 일어날 수 있다.
- 2주차 `PostForm`의 `root` 에러 덕분에 수정 저장 시 403이 와도 "권한이 없습니다."가 폼 아래에 그대로 뜬다. 추가 코드가 필요 없다.
- 같은 `canEdit` 계산이 두 곳에 있다. 5주차 댓글에서도 쓰므로 `features/post`에 `canEditPost(me, post)` 같은 함수로 빼도 좋다.

**✔ 확인**: A로 로그인 → A 글에만 수정·삭제 버튼, B 글에는 없음 / B 글의 `/posts/{id}/edit` 직접 입력 → 상세로 이동.

---

## 9 · 마이페이지 백엔드

**🎯 목표**: 마이페이지 화면(`pages/MyPage.tsx`)에 필요한 API — 내 정보 조회, **닉네임** 수정, 비밀번호 변경, 탈퇴, 내 글 목록 — 를 만든다.

**🤔 왜 지금**: 로그인 흐름이 완성돼야 "나"를 알 수 있다. 회원 기능을 이번 주에 끝낸다.

**📄 파일**: `user/entity/User.java`(메서드 추가), `user/dto/*`, `user/service/UserService.java`, `user/controller/UserController.java`, `post/repository/PostRepository.java`, `global/error/ErrorCode.java`

> 화면 기준: `ProfileForm`은 **아이디(수정 불가) · 닉네임 · 가입일**만 보여준다. 이메일은 수정 대상이 아니므로 수정 API는 닉네임만 받는다.

```java
// ErrorCode 추가
INVALID_PASSWORD(HttpStatus.BAD_REQUEST, "U004", "현재 비밀번호가 올바르지 않습니다."),
```

```java
// User.java 메서드 추가
public void changeNickname(String nickname) {
    this.nickname = nickname;
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
        @NotBlank(message = "닉네임은 필수입니다.")
        @Size(min = 2, max = 20, message = "닉네임은 2~20자입니다.") String nickname) {
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
        User user = findUser(userId);
        user.changeNickname(req.nickname());
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
- **화면이 API를 정한다**: 처음 설계에는 이메일 수정도 있었지만, 화면(`ProfileForm`)에 이메일 칸이 없으므로 API에서도 뺐다. 쓰이지 않는 API는 테스트·보안 점검 대상만 늘린다. 이메일 변경이 필요해지면 "인증 메일 확인" 같은 별도 흐름으로 만드는 게 실무 방식이다.
- **탈퇴 = 소프트 삭제**: ERD 규칙대로 행을 지우지 않고 `status = WITHDRAWN` + `deleted_at` 기록. 작성한 글의 FK(`posts.user_id`)도 깨지지 않는다. 3주차 로그인 로직이 `WITHDRAWN`을 막고, 모든 Refresh를 폐기해 **다른 기기도 즉시 로그아웃**된다(Access는 최대 30분 남지만 `findUser`의 `isActive` 체크로 마이페이지 API는 바로 막힌다).
- 비밀번호 변경·탈퇴 때 **현재 비밀번호를 다시 확인**: 자리를 비운 사이 누가 키보드를 만져도 계정을 빼앗을 수 없다.
- 내 글 목록은 숨김 글도 보여준다(내 글이니까). `@SQLRestriction` 때문에 삭제한 글은 자동으로 빠진다. `user_id` 조건 + `created_at` 정렬이 ERD 인덱스 `idx_posts_user_created (user_id, created_at)`과 정확히 맞는다.
- `MyInfoResponse`의 `profileFileId`는 5주차 프로필 이미지에서 쓴다. 지금은 항상 null이고, 1주차 `@JsonInclude(NON_NULL)` 때문에 JSON에서 **키가 아예 빠진다**(프런트 스키마에서 `nullish` 처리, 10번).
- 탈퇴는 `DELETE`인데 본문(비밀번호)이 있다. HTTP 명세상 가능하지만 일부 프록시가 DELETE 본문을 버린다. 문제가 되면 `POST /api/users/me/withdraw`로 바꾸는 것도 흔한 선택이다.

**✔ 확인** (Swagger, Authorize 후)
- [ ] `GET /api/users/me` → 내 정보 / `PATCH` 닉네임 변경 → 헤더 닉네임은 **다음 재발급 때** 바뀜(10번에서 즉시 반영)
- [ ] 닉네임 1자 → 400 + `fields.nickname`
- [ ] 현재 비밀번호 틀리게 변경 → 400 U004 / 성공 후 `refresh_tokens` 전부 revoked
- [ ] 탈퇴 → `users.status = WITHDRAWN`, `deleted_at` 기록 → 같은 계정 로그인 401 A003, 작성한 글은 목록에 닉네임과 함께 남아 있음

---

## 10 · 마이페이지 프런트

**🎯 목표**: 이미 있는 마이페이지 탭(내 정보 / 내가 쓴 글 / 내 댓글)에 데이터를 연결한다. 닉네임 수정, 비밀번호 변경, 탈퇴, 내 글 목록까지. (프로필 이미지·내 댓글은 5주차)

**📄 파일**: `src/features/member/schema.ts`, `api.ts`, `queries.ts`(새로), `ProfileForm.tsx`, `PasswordChangeForm.tsx`, `WithdrawDialog.tsx`, `MyPostTable.tsx`, `pages/MyPage.tsx`(수정)

```ts
// features/member/schema.ts
import { z } from 'zod'
import { nicknameRule, passwordRule } from '@/features/auth/schema'

// 백엔드 MyInfoResponse — null 값은 @JsonInclude(NON_NULL)로 키가 빠지므로 nullish
export const myInfoSchema = z.object({
  id: z.number(),
  loginId: z.string(),
  nickname: z.string(),
  email: z.string(),
  role: z.enum(['USER', 'ADMIN']),
  profileFileId: z.number().nullish(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullish(),
})
export type MyInfo = z.infer<typeof myInfoSchema>

export const profileFormSchema = z.object({ nickname: nicknameRule })
export type ProfileFormValues = z.infer<typeof profileFormSchema>

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력하세요.'),
    newPassword: passwordRule,
    newPasswordConfirm: z.string(),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: '새 비밀번호가 일치하지 않습니다.',
  })
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>

export const withdrawSchema = z.object({
  password: z.string().min(1, '비밀번호를 입력하세요.'),
})
export type WithdrawValues = z.infer<typeof withdrawSchema>
```

```ts
// features/member/api.ts
import { apiClient } from '@/lib/api-client'
import { apiResponseSchema } from '@/lib/api-response'
import { postPageSchema } from '@/features/post/schema'
import {
  myInfoSchema,
  type PasswordChangeValues,
  type ProfileFormValues,
} from './schema'

export async function fetchMe() {
  const { data } = await apiClient.get('/users/me')
  return apiResponseSchema(myInfoSchema).parse(data).data
}

export async function updateMe(body: ProfileFormValues) {
  const { data } = await apiClient.patch('/users/me', body)
  return apiResponseSchema(myInfoSchema).parse(data).data
}

export async function changePassword({
  currentPassword,
  newPassword,
}: PasswordChangeValues) {
  await apiClient.patch('/users/me/password', { currentPassword, newPassword })
}

export async function withdraw(password: string) {
  await apiClient.delete('/users/me', { data: { password } })
}

export async function fetchMyPosts(page: number) {
  const { data } = await apiClient.get('/users/me/posts', {
    params: { page: page - 1, size: 10 },
  })
  return apiResponseSchema(postPageSchema).parse(data).data
}
```

```ts
// features/member/queries.ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { postKeys } from '@/features/post/queries'
import { useAuthStore } from '@/store/useAuthStore'
import { changePassword, fetchMe, fetchMyPosts, updateMe, withdraw } from './api'

export const memberKeys = {
  me: ['member', 'me'] as const,
  myPosts: (page: number) => [...memberKeys.me, 'posts', page] as const,
}

export function useMeQuery() {
  return useQuery({ queryKey: memberKeys.me, queryFn: fetchMe })
}

export function useMyPostsQuery(page: number) {
  return useQuery({
    queryKey: memberKeys.myPosts(page),
    queryFn: () => fetchMyPosts(page),
    placeholderData: keepPreviousData,
  })
}

export function useUpdateMeMutation() {
  const queryClient = useQueryClient()
  const updateUser = useAuthStore((s) => s.updateUser)
  return useMutation({
    mutationFn: updateMe,
    onSuccess: (me) => {
      queryClient.setQueryData(memberKeys.me, me) // 응답으로 캐시 바로 교체
      updateUser({ nickname: me.nickname }) // 헤더 닉네임
      queryClient.invalidateQueries({ queryKey: postKeys.all }) // 목록의 작성자 닉네임
    },
  })
}

export function useChangePasswordMutation() {
  return useMutation({ mutationFn: changePassword })
}

export function useWithdrawMutation() {
  return useMutation({ mutationFn: withdraw })
}
```

```tsx
// features/member/ProfileForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import { useUpdateMeMutation } from './queries'
import { profileFormSchema, type MyInfo, type ProfileFormValues } from './schema'

export function ProfileForm({ me }: { me: MyInfo }) {
  const updateMe = useUpdateMeMutation()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { nickname: me.nickname },
  })

  const submit = handleSubmit(async (values) => {
    try {
      await updateMe.mutateAsync(values)
    } catch (e) {
      const message =
        e instanceof ApiError ? (e.fields?.nickname ?? e.message) : '저장하지 못했습니다.'
      setError('nickname', { message })
    }
  })

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-loginId">아이디</Label>
        <Input id="profile-loginId" value={me.loginId} disabled />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-nickname">닉네임</Label>
        <Input
          id="profile-nickname"
          maxLength={20}
          placeholder="2~20자"
          aria-invalid={!!errors.nickname}
          {...register('nickname')}
        />
        {errors.nickname ? (
          <p className="text-sm text-destructive">{errors.nickname.message}</p>
        ) : (
          isSubmitSuccessful && (
            <p className="text-sm text-muted-foreground">저장되었습니다.</p>
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">가입일</span>
        <p className="text-sm text-muted-foreground">
          <time dateTime={me.createdAt}>{formatDate(me.createdAt)}</time>
        </p>
      </div>

      <Button type="submit" className="self-end" disabled={isSubmitting}>
        {isSubmitting ? '저장 중…' : '저장'}
      </Button>
    </form>
  )
}
```

```tsx
// features/member/PasswordChangeForm.tsx — 핵심 부분 (마크업은 기존 + register + 에러 줄)
export function PasswordChangeForm({ onChanged }: { onChanged: () => void }) {
  const changePassword = useChangePasswordMutation()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<PasswordChangeValues>({
      resolver: zodResolver(passwordChangeSchema),
      defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' },
    })

  const submit = handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync(values)
      onChanged() // 서버가 모든 Refresh를 폐기했으므로 → 로그아웃
    } catch (e) {
      if (e instanceof ApiError && e.code === 'U004') {
        setError('currentPassword', { message: e.message })
      } else if (e instanceof ApiError && e.fields) {
        for (const [name, message] of Object.entries(e.fields)) {
          setError(name as keyof PasswordChangeValues, { message })
        }
      } else {
        setError('root', { message: e instanceof Error ? e.message : '변경하지 못했습니다.' })
      }
    }
  })

  // 새 비밀번호 placeholder도 "8~20자, 영문·숫자 포함"으로 수정
  // ...
}
```

```tsx
// features/member/WithdrawDialog.tsx — 확인창 안에 비밀번호 입력을 추가
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ApiError } from '@/lib/api-client'
import { useWithdrawMutation } from './queries'
import { withdrawSchema, type WithdrawValues } from './schema'

export function WithdrawDialog({ onWithdrawn }: { onWithdrawn: () => void }) {
  const [open, setOpen] = useState(false)
  const withdraw = useWithdrawMutation()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WithdrawValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { password: '' },
  })

  const submit = handleSubmit(async ({ password }) => {
    try {
      await withdraw.mutateAsync(password)
      setOpen(false)
      onWithdrawn()
    } catch (e) {
      setError('password', {
        message: e instanceof ApiError ? e.message : '탈퇴하지 못했습니다.',
      })
    }
  })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset() // 닫으면 입력한 비밀번호를 지운다
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">회원 탈퇴</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>정말 탈퇴하시겠어요?</AlertDialogTitle>
            <AlertDialogDescription>
              탈퇴하면 계정 정보가 삭제되며 복구할 수 없습니다. 확인을 위해
              비밀번호를 입력하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="withdraw-password">비밀번호</Label>
            <Input
              id="withdraw-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button">취소</AlertDialogCancel>
            {/* AlertDialogAction은 누르는 즉시 창을 닫으므로 일반 submit 버튼을 쓴다 */}
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? '처리 중…' : '탈퇴'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

```tsx
// features/member/MyPostTable.tsx — 데이터 + 페이징 (2주차 PostPagination 재사용)
import { Link } from 'react-router'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PostPagination } from '@/features/post/PostPagination'
import { formatDate } from '@/lib/format'
import { toPostDetail } from '@/routes/paths'
import { useMyPostsQuery } from './queries'

type MyPostTableProps = {
  page: number
  toHref: (page: number) => string
  onPageChange: (page: number) => void
}

export function MyPostTable({ page, toHref, onPageChange }: MyPostTableProps) {
  const { data, isPending, isError, error } = useMyPostsQuery(page)

  if (isPending) return <p className="py-12 text-center text-sm">불러오는 중…</p>
  if (isError) return <p role="alert" className="text-sm text-destructive">{error.message}</p>

  return (
    <div className="flex flex-col gap-4">
      <Table>
        {/* TableHeader 그대로 (제목 · 작성일 · 조회) */}
        <TableBody>
          {data.content.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                작성한 게시글이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            data.content.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="max-w-0 truncate">
                  <Link to={toPostDetail(post.id)} className="hover:underline">{post.title}</Link>
                </TableCell>
                <TableCell className="text-center">{formatDate(post.createdAt)}</TableCell>
                <TableCell className="text-center">{post.viewCount.toLocaleString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <PostPagination page={page} totalPages={data.totalPages} toHref={toHref} onPageChange={onPageChange} />
    </div>
  )
}
```

```tsx
// pages/MyPage.tsx — 탭 · 페이지를 쿼리스트링으로 (?tab=posts&page=2)
import { useSearchParams } from 'react-router'
// ...기존 Card · Tabs · member 컴포넌트 import
import { useLogout } from '@/features/auth/queries'
import { useMeQuery } from '@/features/member/queries'

const TABS = ['profile', 'posts', 'comments'] as const
type Tab = (typeof TABS)[number]

export function MyPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'profile'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const { data: me, isPending, isError, error } = useMeQuery()
  const logout = useLogout()

  if (isPending) return <p className="py-12 text-center text-sm">불러오는 중…</p>
  if (isError) return <p role="alert" className="text-sm text-destructive">{error.message}</p>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">마이페이지</h1>

      <Tabs value={tab} onValueChange={(next) => setSearchParams({ tab: next })}>
        {/* TabsList 그대로 */}

        <TabsContent value="profile" className="flex flex-col gap-6 pt-4">
          {/* 프로필 Card: <ProfileImageField />(5주차) + <ProfileForm me={me} /> */}
          {/* 비밀번호 Card: <PasswordChangeForm onChanged={logout} /> */}
          {/* 탈퇴 Card:    <WithdrawDialog onWithdrawn={logout} /> */}
        </TabsContent>

        <TabsContent value="posts" className="pt-4">
          <MyPostTable
            page={page}
            toHref={(p) => `?tab=posts&page=${p}`}
            onPageChange={(p) => setSearchParams({ tab: 'posts', page: String(p) })}
          />
        </TabsContent>

        <TabsContent value="comments" className="pt-4">
          <MyCommentTable /> {/* 5주차 */}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**🔍 원리**
- **`nullish`**: 백엔드 `ApiResponse`는 `@JsonInclude(NON_NULL)`이라 값이 null인 필드는 **키 자체가 빠진다**. `z.number().nullable()`은 "키는 있고 값이 null"만 허용하므로 파싱이 실패한다. `nullish()` = null 또는 undefined(키 없음) 둘 다 허용.
- `setQueryData`: 수정 API가 새 정보를 돌려주므로 다시 조회하지 않고 **응답으로 캐시를 교체**한다. 요청 1번 절약.
- 헤더 닉네임은 zustand `user`에서 오므로 **스토어도 함께** 갱신한다(`updateUser`). 서버 상태(React Query)와 클라이언트 상태(zustand)가 한 값을 나눠 들고 있을 때는 이렇게 둘 다 맞춰야 한다. 그래서 zustand에는 최소한만 둔다.
- `postKeys.all` invalidate: 게시판 목록·상세의 작성자 닉네임도 새로 가져온다. 2주차에 키를 계층으로 만든 덕분에 한 줄이다.
- `ProfileForm`은 `me`가 **온 뒤에** 그려지므로 `defaultValues`가 정확하다(2주차 수정 폼과 같은 원리).
- **탈퇴 확인창**: 기존 `AlertDialogAction`은 누르는 순간 창을 닫는다. 비밀번호가 틀리면 창이 닫히면 안 되므로 `open`을 직접 관리하고, 제출은 일반 `Button type="submit"`으로 바꿨다. 되돌릴 수 없는 작업이라 확인 단계를 두 번(확인창 + 비밀번호) 둔다.
- 비밀번호 변경·탈퇴 후 `logout()`: 서버가 이미 모든 Refresh를 폐기했으므로 30분 뒤 어차피 튕긴다. 바로 로그아웃시키는 게 사용자에게 명확하다.
- **탭도 URL에**: `?tab=posts&page=2`에 두면 내 글 2페이지에서 글을 보고 뒤로가기해도 그 탭·그 페이지로 돌아온다. 2주차 "URL이 곧 상태" 원칙을 마이페이지에도 적용했다.
- `features/member`가 `features/post`의 스키마·`PostPagination`·`postKeys`를 가져다 쓴다. 기능끼리의 import는 허용하되 **한 방향**(member → post)만 유지한다. post가 member를 import하기 시작하면 공통 부분을 `lib`로 옮길 때다.

**✔ 확인**
- [ ] 닉네임 변경 → "저장되었습니다.", 헤더·게시글 목록 작성자명이 새로고침 없이 바뀜
- [ ] 비밀번호 변경: 현재 비밀번호 틀림 → 현재 비밀번호 칸 아래 U004 메시지 / 성공 → 로그아웃 → 새 비밀번호로 로그인
- [ ] 탈퇴: 비밀번호 틀림 → 창이 닫히지 않고 에러 / 성공 → 로그아웃 상태, 같은 계정 로그인 실패
- [ ] 내가 쓴 글 탭 → 2페이지 → 글 클릭 → 뒤로가기 → 같은 탭·같은 페이지
- [ ] A로 마이페이지 확인 → 로그아웃 → B로 로그인 → 마이페이지에 **A 정보가 잠깐도 안 보임**

---

## 11 · 테스트

**📄 파일**: `src/lib/api-client.test.ts`, `src/features/auth/LoginForm.test.tsx`, 백엔드 `UserServiceTest.java`

인터셉터는 **진짜 네트워크 요청**이 오가야 검증되므로 이번 주에 MSW를 도입한다.

```bash
pnpm add -D msw
```

```ts
// lib/api-client.test.ts — 인터셉터: 401 → 재발급 → 재시도, 동시 401은 재발급 1번
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from './api-client'

const user = { id: 1, loginId: 'tester', nickname: '테스터', role: 'USER' as const }
const unauthorized = () =>
  HttpResponse.json(
    { success: false, error: { code: 'A001', message: '토큰이 만료되었습니다.' } },
    { status: 401 },
  )

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('apiClient 인터셉터', () => {
  beforeEach(() => useAuthStore.getState().setAuth('old-token', user))

  it('401이면 재발급 후 원래 요청을 새 토큰으로 재시도한다', async () => {
    let reissueCount = 0
    server.use(
      http.get('/api/users/me', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer new-token'
          ? HttpResponse.json({ success: true, data: { id: 1 } })
          : unauthorized(),
      ),
      http.post('/api/auth/reissue', () => {
        reissueCount++
        return HttpResponse.json({
          success: true,
          data: { accessToken: 'new-token', expiresIn: 1800, user },
        })
      }),
    )

    const results = await Promise.all([
      apiClient.get('/users/me'),
      apiClient.get('/users/me'),
      apiClient.get('/users/me'),
    ])

    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(reissueCount).toBe(1) // 동시에 3번 401이어도 재발급은 1번
    expect(useAuthStore.getState().accessToken).toBe('new-token')
  })

  it('재발급도 실패하면 로그아웃 상태가 되고 401 ApiError를 던진다', async () => {
    server.use(
      http.get('/api/users/me', unauthorized),
      http.post('/api/auth/reissue', () =>
        HttpResponse.json(
          { success: false, error: { code: 'A002', message: '다시 로그인해 주세요.' } },
          { status: 401 },
        ),
      ),
    )

    await expect(apiClient.get('/users/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    })
    expect(useAuthStore.getState().status).toBe('guest')
  })
})
```

```tsx
// features/auth/LoginForm.test.tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { useAuthStore } from '@/store/useAuthStore'
import { renderWithProviders } from '@/test/renderWithProviders'
import { login } from './api'
import { LoginForm } from './LoginForm'

vi.mock('./api')

const user = { id: 1, loginId: 'tester', nickname: '테스터', role: 'USER' as const }

describe('LoginForm', () => {
  it('로그인 성공 시 스토어에 저장하고 onSuccess를 부른다', async () => {
    vi.mocked(login).mockResolvedValue({ accessToken: 't', expiresIn: 1800, user })
    const onSuccess = vi.fn()
    renderWithProviders(<LoginForm onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText('아이디'), 'tester')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'pass1234')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(useAuthStore.getState().user?.nickname).toBe('테스터')
  })

  it('로그인 실패 시 폼 아래에 서버 메시지를 보여준다', async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError(401, { code: 'A003', message: '아이디 또는 비밀번호가 올바르지 않습니다.' }),
    )
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('아이디'), 'tester')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'wrong123')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByText('아이디 또는 비밀번호가 올바르지 않습니다.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toHaveValue('')
  })

  it('빈 값 제출 시 에러 메시지를 보여준다', async () => {
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))
    expect(await screen.findByText('아이디를 입력하세요.')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })
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
- **MSW vs `vi.mock`**: 2주차처럼 `api.ts`를 `vi.mock`하면 axios·인터셉터를 **건너뛴다**. 인터셉터 자체를 시험하려면 그 아래 네트워크를 가로채야 한다. 그래서 이 파일에서만 `setupServer`를 켠다(다른 테스트에 영향 없음). 폼 테스트는 계속 `vi.mock`이 더 간단하다.
- 테스트 환경에는 `VITE_API_BASE_URL`이 없어서 `baseURL`이 기본값 `/api`가 된다. MSW 핸들러 경로를 `/api/...`로 쓰는 이유다.
- zustand 스토어는 모듈 전역이라 테스트 사이에 값이 남는다. `beforeEach`에서 `setAuth`로 매번 초기 상태를 만든다.
- 탈퇴 계정 로그인 실패는 3주차 `AuthIntegrationTest`에 한 케이스로 추가하면 된다(가입 → 탈퇴 API → 로그인 401).
- 수동 체크: 3주차 `application.yml`의 `access-exp-minutes`를 **1**로 바꾸고, 로그인 후 1분 뒤 글쓰기 → Network 탭에서 `401 → reissue → 201` 순서가 보이면 인터셉터가 실제로 동작하는 것이다(확인 후 30으로 복구).

**✔ 확인**: `pnpm test`, `./gradlew test` 전부 통과.

---

## 🔧 안 될 때 체크리스트

- **새로고침하면 로그아웃됨** → `reissue` 응답에 `Set-Cookie`가 있나? 쿠키 `path=/api/auth`와 요청 경로가 맞나? `withCredentials`(3번)?
- **로그인 직후 바로 로그아웃됨 / 가끔 강제 로그아웃** → 재발급이 동시에 2번 나가고 있다. Network 탭에서 `reissue` 개수 확인. StrictMode(4번), 대기열(3번).
- **무한 요청** → 재발급을 `apiClient`로 호출했거나 `_retry` 표시가 없다(3번).
- **로그인 실패인데 재발급 요청이 나감** → `/auth/` URL 제외 조건(3번).
- **로그인 페이지로 튕겼다가 돌아옴(깜빡임)** → 초기 `status`가 `'checking'`인가(1번)?
- **마이페이지에서 로그아웃하면 게시판이 아니라 로그인 페이지로 감** → `useLogout`에서 `navigate`를 `clear()`보다 먼저 불렀나(2번)?
- **다른 계정 로그인 시 이전 정보가 보임** → 로그아웃에서 `queryClient.clear()`(2번).
- **닉네임 수정했는데 헤더가 그대로** → `updateUser`로 zustand도 갱신했나(10번)?
- **`ZodError ... profileFileId ... expected number, received undefined`** → `nullable()`이 아니라 `nullish()`(10번).
- **탈퇴 창이 비밀번호가 틀려도 닫힘** → `AlertDialogAction` 대신 일반 submit 버튼 + `open` 직접 관리(10번).
- **쿠키가 저장 안 됨(운영)** → `secure=true`인데 HTTP로 접속했거나, `SameSite=Strict`인데 프런트·백엔드 도메인이 다르다(6주차 Nginx로 같은 도메인).

## 🧠 스스로 설명해보기

1. Access Token을 localStorage가 아니라 메모리에 두면 새로고침 때 어떻게 로그인이 유지되나?
2. 동시에 요청 3개가 401을 받을 때 재발급이 1번만 나가는 원리는? 2번 나가면 왜 로그아웃되나?
3. StrictMode에서 `useEffect`가 두 번 실행되는데도 재발급이 한 번인 이유는?
4. 재발급 실패 시 인터셉터가 직접 페이지를 이동시키지 않는 이유는?
5. `status`에 `'checking'`이 없으면 어떤 결함이 생기나?
6. 아이디 중복 확인을 통과했는데도 가입 때 409가 날 수 있는 이유는?
7. `/api/users/{id}` 대신 `/api/users/me`를 쓰면 무엇이 막아지나?
8. 백엔드가 null 필드를 JSON에서 빼면 프런트 zod 스키마는 어떻게 써야 하나?

## 🚀 여유가 있다면

- [ ] 탭 간 로그아웃 동기화: `BroadcastChannel('auth')`로 한 탭에서 로그아웃하면 다른 탭도 로그아웃
- [ ] Access 만료 1분 전에 미리 재발급(`expiresIn` 활용)해서 401 자체를 줄이기
- [ ] 로그인 상태에서 `/login`, `/signup` 접근 시 게시판으로 돌려보내는 `GuestOnlyRoute`
- [ ] 마이페이지 "로그인된 기기" 목록 (3주차 선택 과제 API 연결)
