# 2주차 · 게시판 프런트 (10/6~9 · 10h)

> 1주차 백엔드(`/api/posts`)를 React 화면에 붙인다.
> 각 단계는 **🎯 목표 → 🤔 왜 지금 → 📄 파일 → ⌨️ 코드 → 🔍 원리 → ✔ 확인** 순서다.
> 코드는 TypeScript + Vite 기준. 백엔드(8080)를 켜 둔 상태에서 진행한다.
> 아직 로그인이 없으므로 **누구나 글을 쓰고 지울 수 있는 상태가 정상**이다. 작성자는 1주차 `TEMP_USER_ID`로 표시된다.

---

## 🗺 전체 흐름

```text
[페이지 컴포넌트]  PostListPage / PostDetailPage / PostWritePage / PostEditPage
      │ ① 훅 호출 (usePostList, useCreatePost ...)
      ▼
[React Query]      queries.ts  ── 캐시 · 로딩/에러 상태 · Query Key로 데이터 식별
      │ ② API 함수 호출
      ▼
[API 함수]         api.ts      ── URL과 메서드만 아는 얇은 층
      │ ③ HTTP
      ▼
[axios 인스턴스]   client.ts   ── baseURL, ApiResponse 풀기, 에러를 ApiError로 통일
      │ ④ /api/posts  (Vite 프록시가 8080으로 전달)
      ▼
[Spring Boot]      1주차 PostController
```

**핵심 한 줄**: 페이지는 "무엇을 보여줄지", React Query는 "언제 다시 가져올지", axios는 "어떻게 요청하고 에러를 어떤 모양으로 바꿀지"만 책임진다.

## 📋 순서표

| # | 할 일 | 파일 | 끝나면 확인할 것 |
|---|---|---|---|
| 1 | 패키지 설치 · Vite 프록시 | `vite.config.ts`, `.env.*` | 브라우저에서 `/api/posts` JSON 보임 |
| 2 | 폴더 구조 | 폴더만 | 트리 완성 |
| 3 | 공통 응답 타입 · axios 인스턴스 | `shared/api/types.ts`, `client.ts` | 컴파일 OK |
| 4 | QueryClient · 라우터 · 레이아웃 | `main.tsx`, `app/router.tsx`, `app/Layout.tsx` | `/` → `/posts` 이동 |
| 5 | 게시글 타입 · zod 스키마 | `features/posts/types.ts`, `schema.ts` | 컴파일 OK |
| 6 | API 함수 | `features/posts/api.ts` | 컴파일 OK |
| 7 | Query Key · 훅 | `features/posts/queries.ts` | 컴파일 OK |
| 8 | 목록 (페이징 · 검색 · URL 동기화) | `PostListPage.tsx` | 목록 · 검색 · 새로고침 후 유지 |
| 9 | 상세 · 삭제 | `PostDetailPage.tsx` | 조회수 표시 · 삭제 후 목록 갱신 |
| 10 | 공통 폼 · 작성 · 수정 | `PostForm.tsx`, `PostWritePage.tsx`, `PostEditPage.tsx` | 등록 · 수정 · 서버 400 표시 · 더블클릭 방지 |
| 11 | 테스트 | `vite.config.ts`, `test/*`, `*.test.ts(x)` | `npm run test` 통과 |

## 📁 완성 후 폴더

```text
src
 ├─ main.tsx                                   (4)
 ├─ index.css
 ├─ app
 │   ├─ router.tsx                             (4)
 │   ├─ Layout.tsx · Layout.module.css         (4)
 ├─ shared
 │   ├─ api
 │   │   ├─ types.ts                           (3)
 │   │   └─ client.ts                          (3)
 │   └─ ui/  (shadcn 컴포넌트)                 (1)
 ├─ features
 │   ├─ auth/   (4주차에 채움)
 │   └─ posts
 │       ├─ types.ts · schema.ts               (5)
 │       ├─ api.ts                             (6)
 │       ├─ queries.ts                         (7)
 │       ├─ components/PostForm.tsx            (10)
 │       └─ pages
 │           ├─ PostListPage.tsx · .module.css (8)
 │           ├─ PostDetailPage.tsx             (9)
 │           ├─ PostWritePage.tsx              (10)
 │           └─ PostEditPage.tsx               (10)
 └─ test
     ├─ setup.ts                               (11)
     ├─ handlers.ts                            (11)
     └─ renderWithProviders.tsx                (11)
```

---

## 1 · 패키지 설치 · Vite 프록시

**🎯 목표**: 라이브러리를 설치하고, 프런트(5173)에서 `/api`로 보낸 요청이 백엔드(8080)로 가게 한다.

**🤔 왜 지금**: 이게 안 되면 모든 요청이 CORS 에러로 막혀서 아무것도 확인할 수 없다.

**📄 파일**: 터미널, `vite.config.ts`, `.env.development`, `.env.production`

```bash
npm i axios @tanstack/react-query react-router-dom zod react-hook-form @hookform/resolvers
npm i -D @types/node vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw
npx shadcn@latest init
npx shadcn@latest add button input textarea form label
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
```

```bash
# .env.development
VITE_API_URL=/api

# .env.production  (6주차 Nginx가 /api를 백엔드로 넘겨 줌)
VITE_API_URL=/api
```

**🔍 원리**
- 브라우저는 **출처(프로토콜+주소+포트)가 다른 서버**로의 요청을 막는다(CORS). 5173 → 8080은 포트가 달라서 다른 출처다.
- 프록시를 쓰면 브라우저는 **같은 출처인 5173**에 요청하고, Vite 개발 서버가 뒤에서 8080으로 대신 전달한다. 브라우저 입장에서는 다른 출처 요청이 아니므로 CORS가 아예 생기지 않는다.
- 6주차 Nginx도 똑같은 원리(`/api`는 백엔드로, 나머지는 React)라서, 백엔드에 CORS 설정 없이 **개발과 운영이 같은 구조**가 된다.
- `VITE_`로 시작하는 환경변수만 브라우저 코드에서 `import.meta.env.VITE_API_URL`로 읽을 수 있다. (비밀값을 실수로 번들에 넣지 않게 하려는 규칙)
- `tsconfig.json`(또는 `tsconfig.app.json`)의 `compilerOptions`에도 `"baseUrl": "."`, `"paths": { "@/*": ["./src/*"] }`를 넣어야 `@/` import가 에디터에서 빨간 줄이 안 뜬다.

**✔ 확인**: `npm run dev` 후 주소창에 `http://localhost:5173/api/posts` → 1주차 JSON(`{"success":true,"data":{...}}`)이 보이면 성공.

---

## 2 · 폴더 구조

**🎯 목표**: 위 트리대로 폴더를 만든다.

**🤔 왜 지금**: 파일을 만들기 전에 자리를 정해 둬야 뒤섞이지 않는다.

**🔍 원리**
- 백엔드와 마찬가지로 **기능(feature) 단위**로 나눈다. 4주차 `auth`, 5주차 `comments`·`files`가 `posts` 옆에 나란히 붙는다.
- `shared`는 어느 기능에도 속하지 않는 공통 부품(axios, shadcn UI)이다. 백엔드의 `global` 패키지와 같은 역할이다.
- shadcn은 `components.json`의 `aliases.ui`를 `@/shared/ui`로 바꿔 두면 컴포넌트가 그 폴더에 생성된다.
- 규칙: `features/posts`는 `shared`를 가져다 쓸 수 있지만, `shared`는 `features`를 import하지 않는다. (공통 부품이 특정 기능에 묶이지 않게)

**✔ 확인**: `src/features/posts/pages`, `src/shared/api`까지 폴더가 보이면 OK.

---

## 3 · 공통 응답 타입 · axios 인스턴스

**🎯 목표**: 백엔드 `ApiResponse`·`PageResponse` 모양을 타입으로 옮기고, 모든 에러를 한 가지 모양(`ApiError`)으로 바꾸는 axios 인스턴스를 만든다.

**🤔 왜 지금**: 이후 모든 API 함수가 이 인스턴스를 쓴다. 백엔드 1주차 `GlobalExceptionHandler`의 프런트 버전이다.

**📄 파일**: `src/shared/api/types.ts`, `src/shared/api/client.ts`

```ts
// shared/api/types.ts — 1주차 ApiResponse, PageResponse와 필드명을 정확히 맞춤
export type ApiErrorBody = {
  code: string
  message: string
  fields?: Record<string, string>
}

export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: ApiErrorBody
}

export type PageResponse<T> = {
  content: T[]
  page: number // 0부터 시작
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}
```

```ts
// shared/api/client.ts
import axios, { AxiosError } from 'axios'
import type { ApiResponse } from './types'

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

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10_000,
})

// 실패 응답을 전부 ApiError 하나로 통일한다
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiResponse<unknown>>) => {
    const body = err.response?.data
    return Promise.reject(
      new ApiError(
        err.response?.status ?? 0,
        body?.error?.code ?? 'NETWORK_ERROR',
        body?.error?.message ?? '서버에 연결할 수 없습니다.',
        body?.error?.fields,
      ),
    )
  },
)

// 성공 응답에서 data만 꺼내는 도우미
export async function unwrap<T>(req: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await req
  return res.data.data as T
}
```

**🔍 원리**
- 서버가 성공이든 실패든 같은 모양의 JSON을 주기 때문에, 프런트도 **성공은 `unwrap`으로 `data`만, 실패는 인터셉터에서 `ApiError`로** 한 번에 정리할 수 있다.
- 화면 코드는 `error.code`, `error.fields`, `error.message`만 보면 된다. axios 내부 구조(`err.response.data.error.fields`)를 페이지마다 알 필요가 없다.
- 서버가 꺼져 응답 자체가 없으면 `status 0` + `NETWORK_ERROR`가 된다.
- **4주차에는 이 파일에 요청 인터셉터(토큰 첨부)와 401 재발급만 추가**하면 된다. 그래서 지금 인스턴스를 하나로 모아 두는 것이다.
- 인터셉터 = "요청이 나가기 전 / 응답이 도착한 직후에 끼어드는 함수". 백엔드의 필터와 같은 자리다.

**✔ 확인**: 빨간 줄 없이 컴파일 OK.

---

## 4 · QueryClient · 라우터 · 레이아웃

**🎯 목표**: React Query와 라우터를 앱에 연결하고, 헤더가 있는 공통 레이아웃 안에서 페이지가 바뀌게 한다.

**🤔 왜 지금**: 8~10번 페이지를 만들자마자 주소로 들어가 확인하려면 라우터가 먼저 있어야 한다.

**📄 파일**: `src/main.tsx`, `src/app/router.tsx`, `src/app/Layout.tsx`, `src/app/Layout.module.css`

```tsx
// main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'
import './index.css'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
```

```tsx
// app/router.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from './Layout'
import PostListPage from '@/features/posts/pages/PostListPage'
import PostDetailPage from '@/features/posts/pages/PostDetailPage'
import PostWritePage from '@/features/posts/pages/PostWritePage'
import PostEditPage from '@/features/posts/pages/PostEditPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/posts" replace /> },
      { path: 'posts', element: <PostListPage /> },
      { path: 'posts/new', element: <PostWritePage /> },
      { path: 'posts/:id', element: <PostDetailPage /> },
      { path: 'posts/:id/edit', element: <PostEditPage /> },
    ],
  },
])
```

```tsx
// app/Layout.tsx
import { Link, Outlet } from 'react-router-dom'
import styles from './Layout.module.css'

export default function Layout() {
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <Link to="/posts" className={styles.logo}>
          Board
        </Link>
        {/* 4주차: 로그인 상태 · 로그아웃 버튼 자리 */}
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
```

```css
/* app/Layout.module.css */
.wrap { min-height: 100vh; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  height: 56px; padding: 0 16px; border-bottom: 1px solid #e5e7eb;
}
.logo { font-weight: 700; }
.main { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
```

**🔍 원리**
- `Outlet`은 "자식 라우트 페이지가 들어갈 자리"다. 퍼블리싱의 공통 헤더·푸터 인클루드와 같다.
- `QueryClientProvider`로 감싸야 어느 컴포넌트에서든 `useQuery`가 같은 캐시를 공유한다.
- `refetchOnWindowFocus: false`는 **1주차 상세 조회가 조회수를 올리기 때문**에 넣었다. 기본값(true)이면 다른 탭에 갔다 오기만 해도 상세를 다시 불러 조회수가 계속 오른다.
- `retry: 1`: 실패하면 한 번만 재시도. 기본값(3)이면 404도 세 번 더 요청해서 에러 화면이 늦게 뜬다.
- `posts/new`는 `posts/:id`보다 우선 매칭된다. React Router는 **고정 경로를 동적 경로보다 먼저** 고른다.
- `queryClient`를 `export`한 이유: 4주차 로그아웃 때 `queryClient.clear()`를 부르기 위해서다.
- 아직 없는 페이지 파일은 `export default function PostListPage() { return null }`처럼 빈 껍데기로 만들어 두면 컴파일 에러가 안 난다.

**✔ 확인**: `http://localhost:5173/`로 들어가면 주소가 `/posts`로 바뀌고 헤더가 보이면 OK.

---

## 5 · 게시글 타입 · zod 스키마

**🎯 목표**: 1주차 `PostResponse`와 같은 타입, 작성·수정 폼 검증 규칙을 만든다.

**🤔 왜 지금**: API 함수(6번)와 폼(10번)이 이 타입을 사용한다. 백엔드의 DTO를 먼저 만든 것과 같은 순서다.

**📄 파일**: `src/features/posts/types.ts`, `src/features/posts/schema.ts`

```ts
// features/posts/types.ts — 1주차 PostResponse와 필드명 · 타입을 맞춤
export type Post = {
  id: number
  writerId: number
  writerNickname: string
  title: string
  content: string
  viewCount: number
  createdAt: string // LocalDateTime → "2026-10-06T10:15:00.123456"
  updatedAt: string
}

export type PostListParams = {
  page: number // 서버 기준 0부터
  size: number
  keyword?: string
}
```

```ts
// features/posts/schema.ts
import { z } from 'zod'

export const postFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '제목은 필수입니다.')
    .max(200, '제목은 200자 이하여야 합니다.'),
  content: z.string().trim().min(1, '내용은 필수입니다.'),
})

export type PostFormValues = z.infer<typeof postFormSchema>
```

**🔍 원리**
- 규칙 숫자는 **ERD `posts.title VARCHAR(200)` → 백엔드 `@Size(max = 200)` → 프런트 `max(200)`** 세 곳이 같아야 한다. 하나라도 다르면 "화면에서는 통과했는데 서버가 400"이 난다.
- `z.infer`로 타입을 뽑으면 **검증 규칙과 타입이 한 곳**에 있다. 필드를 추가할 때 스키마만 고치면 타입도 따라온다.
- `.trim()`은 공백만 입력한 값을 빈 값으로 만들어 `min(1)`에 걸리게 한다. 백엔드 `@NotBlank`와 같은 효과다.
- 날짜는 JSON에서 문자열로 온다. 화면에 보여줄 때만 `new Date(post.createdAt).toLocaleString('ko-KR')`로 바꾼다.
- 프런트 검증은 **사용자 편의**, 서버 검증은 **보안**이다. 둘 다 있어야 한다.

**✔ 확인**: 컴파일 OK.

---

## 6 · API 함수

**🎯 목표**: 게시글 API 5개를 함수로 만든다.

**🤔 왜 지금**: 7번 훅이 이 함수들을 부른다. 백엔드의 Repository처럼 **데이터 창구**를 먼저 만든다.

**📄 파일**: `src/features/posts/api.ts`

```ts
import { api, unwrap } from '@/shared/api/client'
import type { ApiResponse, PageResponse } from '@/shared/api/types'
import type { Post, PostListParams } from './types'
import type { PostFormValues } from './schema'

export const postApi = {
  list: ({ page, size, keyword }: PostListParams) =>
    unwrap(
      api.get<ApiResponse<PageResponse<Post>>>('/posts', {
        params: { page, size, keyword: keyword || undefined },
      }),
    ),

  get: (id: number) => unwrap(api.get<ApiResponse<Post>>(`/posts/${id}`)),

  create: (body: PostFormValues) => unwrap(api.post<ApiResponse<number>>('/posts', body)),

  update: (id: number, body: PostFormValues) =>
    unwrap(api.put<ApiResponse<number>>(`/posts/${id}`, body)),

  remove: (id: number) => unwrap(api.delete<ApiResponse<void>>(`/posts/${id}`)),
}
```

**🔍 원리**
- 이 층은 **URL과 메서드만** 안다. 캐시, 로딩 상태, 화면 이동은 모른다. 역할이 작을수록 테스트와 교체가 쉽다.
- `keyword: keyword || undefined`: 빈 문자열이면 파라미터 자체를 빼서 `?keyword=`가 안 붙게 한다. (서버도 빈 값을 null로 처리하지만 URL이 깔끔해진다)
- 제네릭 `api.get<ApiResponse<Post>>`를 적어 주면 `unwrap` 결과가 자동으로 `Post` 타입이 된다.
- `create`는 새 글 번호(`number`)를 돌려준다. 1주차 백엔드가 `ApiResponse.ok(id)`로 응답하기 때문이다.
- 1주차 Swagger의 `/v3/api-docs`를 AI에게 주고 "이 명세로 api.ts를 만들어줘"라고 하면 거의 이 모양이 나온다. 직접 한 번 쓰고 비교해 보자.

**✔ 확인**: 컴파일 OK.

---

## 7 · Query Key · 훅

**🎯 목표**: 조회는 `useQuery`, 변경은 `useMutation` 훅으로 감싸고, 캐시 이름표(Query Key)를 한 곳에서 관리한다.

**🤔 왜 지금**: 페이지는 이 훅만 쓴다. 등록·수정·삭제 후 "어떤 캐시를 새로 가져올지"를 여기서 한 번만 정의한다.

**📄 파일**: `src/features/posts/queries.ts`

```ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { postApi } from './api'
import type { PostListParams } from './types'
import type { PostFormValues } from './schema'

export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (params: PostListParams) => [...postKeys.lists(), params] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: number) => [...postKeys.details(), id] as const,
}

export function usePostList(params: PostListParams) {
  return useQuery({
    queryKey: postKeys.list(params),
    queryFn: () => postApi.list(params),
    placeholderData: keepPreviousData, // 페이지 넘길 때 이전 목록을 잠깐 유지
  })
}

export function usePost(id: number) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => postApi.get(id),
    enabled: Number.isFinite(id),
  })
}

export function useCreatePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PostFormValues) => postApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: postKeys.lists() }),
  })
}

export function useUpdatePost(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PostFormValues) => postApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: postKeys.lists() })
      qc.invalidateQueries({ queryKey: postKeys.detail(id) })
    },
  })
}

export function useDeletePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => postApi.remove(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: postKeys.detail(id) })
      qc.invalidateQueries({ queryKey: postKeys.lists() })
    },
  })
}
```

**🔍 원리**
- **Query Key = 캐시의 주소**다. `['posts', 'list', { page: 0, size: 10 }]`처럼 파라미터까지 포함되므로 페이지·검색어마다 캐시가 따로 저장된다.
- 키를 **계층 구조**로 만든 이유: `invalidateQueries({ queryKey: ['posts', 'list'] })` 한 번이면 **모든 페이지·모든 검색어의 목록 캐시**가 한꺼번에 "오래됨" 표시가 된다. 키가 앞부분부터 일치하면 다 걸린다.
- `invalidate` = "이 캐시는 낡았으니 지금 화면에 쓰이고 있으면 다시 가져와". 삭제된 글 상세는 다시 가져올 필요가 없으므로 `removeQueries`로 아예 지운다.
- `keepPreviousData`: 2페이지로 넘어갈 때 새 데이터가 올 때까지 1페이지 목록을 보여준다. 이게 없으면 페이지를 넘길 때마다 "불러오는 중..."으로 화면이 깜빡인다.
- **서버 상태는 React Query, 클라이언트 상태는 zustand**. 이번 주는 서버 데이터뿐이라 zustand가 필요 없다. 게시글 목록을 zustand에 복사해 두면 "등록했는데 목록이 안 바뀌는" 캐시 불일치가 생긴다.
- `enabled`: `id`가 숫자가 아니면(잘못된 주소) 요청 자체를 보내지 않는다.

**✔ 확인**: 컴파일 OK.

---

## 8 · 목록 (페이징 · 검색 · URL 동기화)

**🎯 목표**: 게시글을 10개씩 보여주고, 검색·페이지 이동 상태를 URL에 둔다. 로딩·에러·빈 목록 화면을 모두 만든다.

**🤔 왜 지금**: 데이터가 있어야 상세·수정을 확인할 수 있다. 백엔드에서 등록을 먼저 만든 것과 같은 이유로, 화면은 **목록부터** 만든다(1주차 Swagger로 글을 몇 개 넣어 두자).

**📄 파일**: `src/features/posts/pages/PostListPage.tsx`, `PostListPage.module.css`

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { usePostList } from '../queries'
import styles from './PostListPage.module.css'

const PAGE_SIZE = 10

export default function PostListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page') ?? 1)) // 화면용 1부터
  const keyword = searchParams.get('keyword') ?? ''
  const [input, setInput] = useState(keyword)

  const { data, isPending, isError, error, refetch, isFetching } = usePostList({
    page: page - 1, // 서버는 0부터
    size: PAGE_SIZE,
    keyword,
  })

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams()
    if (input.trim()) next.set('keyword', input.trim())
    next.set('page', '1') // 새로 검색하면 1페이지부터
    setSearchParams(next)
  }

  const goPage = (p: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(p))
    setSearchParams(next)
  }

  return (
    <section>
      <div className={styles.toolbar}>
        <form onSubmit={onSearch} className={styles.search}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="제목·내용 검색"
            aria-label="검색어"
          />
          <Button type="submit">검색</Button>
        </form>
        <Button asChild>
          <Link to="/posts/new">글쓰기</Link>
        </Button>
      </div>

      {isPending && <p className={styles.state}>불러오는 중...</p>}

      {isError && (
        <div className={styles.state} role="alert">
          <p>{error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      )}

      {data && data.content.length === 0 && (
        <p className={styles.state}>
          {keyword ? `"${keyword}" 검색 결과가 없습니다.` : '첫 글을 작성해 보세요.'}
        </p>
      )}

      {data && data.content.length > 0 && (
        <>
          <table className={styles.table} aria-busy={isFetching}>
            <thead>
              <tr>
                <th>번호</th>
                <th>제목</th>
                <th>작성자</th>
                <th>조회</th>
                <th>작성일</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((post) => (
                <tr key={post.id}>
                  <td>{post.id}</td>
                  <td className={styles.title}>
                    <Link to={`/posts/${post.id}`}>{post.title}</Link>
                  </td>
                  <td>{post.writerNickname}</td>
                  <td>{post.viewCount}</td>
                  <td>{new Date(post.createdAt).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <nav className={styles.pager} aria-label="페이지">
            <Button variant="outline" disabled={page <= 1} onClick={() => goPage(page - 1)}>
              이전
            </Button>
            <span>
              {page} / {data.totalPages}
            </span>
            <Button variant="outline" disabled={data.last} onClick={() => goPage(page + 1)}>
              다음
            </Button>
          </nav>
        </>
      )}
    </section>
  )
}
```

```css
/* PostListPage.module.css */
.toolbar { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.search { display: flex; gap: 8px; flex: 1; max-width: 420px; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
.title { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pager { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; }
.state { padding: 48px 0; text-align: center; color: #6b7280; }
```

**🔍 원리**
- **URL이 곧 상태**: `useState`에 페이지를 두면 새로고침·뒤로가기·링크 공유 때 사라진다. `?page=2&keyword=점검`에 두면 상세에 갔다 뒤로 와도 그대로다. SI 화면 요구사항 단골이다.
- 화면은 1페이지부터, 서버는 0페이지부터. **변환은 이 페이지 한 곳에서만** 한다(`page - 1`).
- 검색창 입력값(`input`)과 실제 검색어(`keyword`, URL)를 분리했다. 타이핑할 때마다 요청이 나가지 않고, **검색 버튼을 눌렀을 때만** URL이 바뀌고 → Query Key가 바뀌고 → 요청이 나간다.
- `isPending`(첫 로딩) / `isError` / 빈 목록 / 정상, **4가지 상태 화면**을 모두 만든다. 실무 QA에서 가장 많이 나오는 결함이 "빈 목록에서 표 머리만 덩그러니" 같은 상태 누락이다.
- `isFetching`: 이전 데이터를 보여주며 뒤에서 새로 가져오는 중일 때 true. `aria-busy`로 접근성 표시만 했다.
- `<Button asChild><Link/></Button>`: shadcn 버튼 스타일을 입힌 **링크**다. 페이지 이동은 `<a>`여야 새 탭 열기·접근성이 맞다.

**✔ 확인**
- [ ] `/posts` → 최신 글이 위, 작성자 닉네임·조회수 표시
- [ ] 검색 → 주소에 `?keyword=...&page=1`, 결과만 표시 / 결과 없으면 안내 문구
- [ ] 2페이지로 이동 후 새로고침해도 2페이지 유지, 뒤로가기하면 1페이지
- [ ] 백엔드를 끄고 새로고침 → 에러 메시지 + 다시 시도 버튼

---

## 9 · 상세 · 삭제

**🎯 목표**: 글 하나를 보여주고, 삭제하면 목록으로 돌아가며 목록이 갱신되게 한다.

**🤔 왜 지금**: 목록에서 들어갈 곳이 있어야 한다. 삭제는 버튼 하나라 상세에 함께 둔다.

**📄 파일**: `src/features/posts/pages/PostDetailPage.tsx`

```tsx
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { ApiError } from '@/shared/api/client'
import { useDeletePost, usePost } from '../queries'

export default function PostDetailPage() {
  const { id } = useParams()
  const postId = Number(id)
  const navigate = useNavigate()
  const { data: post, isPending, isError, error } = usePost(postId)
  const deletePost = useDeletePost()

  if (isPending) return <p>불러오는 중...</p>

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div role="alert">
        <p>{notFound ? '삭제되었거나 없는 게시글입니다.' : error.message}</p>
        <Link to="/posts">목록으로</Link>
      </div>
    )
  }

  const onDelete = () => {
    if (!window.confirm('이 글을 삭제할까요?')) return
    deletePost.mutate(postId, {
      onSuccess: () => navigate('/posts', { replace: true }),
      onError: (e) => alert(e.message),
    })
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <p>
        {post.writerNickname} · 조회 {post.viewCount} ·{' '}
        {new Date(post.createdAt).toLocaleString('ko-KR')}
        {post.updatedAt !== post.createdAt && ' (수정됨)'}
      </p>
      <div style={{ whiteSpace: 'pre-wrap' }}>{post.content}</div>

      <div>
        <Button variant="outline" asChild>
          <Link to="/posts">목록</Link>
        </Button>
        {/* 4주차: 내 글일 때만 수정·삭제 버튼 표시 */}
        <Button variant="outline" asChild>
          <Link to={`/posts/${post.id}/edit`}>수정</Link>
        </Button>
        <Button variant="destructive" onClick={onDelete} disabled={deletePost.isPending}>
          {deletePost.isPending ? '삭제 중...' : '삭제'}
        </Button>
      </div>
    </article>
  )
}
```

**🔍 원리**
- 404를 따로 처리했다. 1주차 백엔드는 **없는 글·숨김 글·삭제된 글을 모두 404 + P001**로 준다. 사용자에게 "에러"보다 "없는 글"이 맞는 안내다.
- `whiteSpace: 'pre-wrap'`: 본문의 줄바꿈을 그대로 보여준다. `dangerouslySetInnerHTML`로 HTML을 넣지 않는 이유는 **XSS**(글에 스크립트를 넣는 공격) 때문이다.
- 삭제 성공 후 `replace: true`로 이동: 뒤로가기를 눌러도 삭제된 글 상세로 돌아가지 않는다.
- `window.confirm`은 가장 단순한 확인창이다. 디자인이 필요하면 `npx shadcn@latest add alert-dialog`로 바꾸자(8주차 관리자 일괄 삭제에서 다시 쓴다).
- 조회수: 이 페이지를 열 때마다 백엔드가 +1한다. StrictMode 개발 환경에서도 `useQuery`는 요청을 한 번만 보내지만, **캐시가 없는 상태로 다시 들어오면** 다시 +1된다. 운영에서 조회수 중복 방지(같은 사용자 하루 1회 등)는 별도 설계가 필요하다.

**✔ 확인**
- [ ] 목록에서 제목 클릭 → 상세, 조회수가 들어올 때마다 증가
- [ ] `/posts/99999` → "삭제되었거나 없는 게시글입니다."
- [ ] 삭제 → 목록으로 이동, 삭제한 글이 목록에서 사라짐(새로고침 없이)

---

## 10 · 공통 폼 · 작성 · 수정

**🎯 목표**: 작성과 수정이 함께 쓰는 폼 하나를 만들고, 서버 400(`fields`)을 입력창 아래에 표시하며, 저장 중 중복 제출을 막는다.

**🤔 왜 지금**: 5번 스키마와 7번 훅이 모두 준비됐다. 폼을 공통으로 만들면 검증·에러 표시 규칙이 한 곳에 모인다.

**📄 파일**: `src/features/posts/components/PostForm.tsx`, `pages/PostWritePage.tsx`, `pages/PostEditPage.tsx`

```tsx
// components/PostForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form'
import { ApiError } from '@/shared/api/client'
import { postFormSchema, type PostFormValues } from '../schema'

type Props = {
  defaultValues?: PostFormValues
  submitLabel: string
  onSubmit: (values: PostFormValues) => Promise<unknown>
}

export default function PostForm({
  defaultValues = { title: '', content: '' },
  submitLabel,
  onSubmit,
}: Props) {
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues,
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        // 서버 검증 실패(400) → 해당 입력창 아래에 표시
        Object.entries(e.fields).forEach(([name, message]) =>
          form.setError(name as keyof PostFormValues, { message }),
        )
      } else if (e instanceof Error) {
        form.setError('root', { message: e.message })
      }
    }
  })

  const { isSubmitting, errors } = form.formState

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} noValidate>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>제목</FormLabel>
              <FormControl>
                <Input {...field} maxLength={200} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>내용</FormLabel>
              <FormControl>
                <Textarea {...field} rows={12} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {errors.root && <p role="alert">{errors.root.message}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '저장 중...' : submitLabel}
        </Button>
      </form>
    </Form>
  )
}
```

```tsx
// pages/PostWritePage.tsx
import { useNavigate } from 'react-router-dom'
import PostForm from '../components/PostForm'
import { useCreatePost } from '../queries'

export default function PostWritePage() {
  const navigate = useNavigate()
  const createPost = useCreatePost()

  return (
    <section>
      <h1>글쓰기</h1>
      <PostForm
        submitLabel="등록"
        onSubmit={async (values) => {
          const id = await createPost.mutateAsync(values)
          navigate(`/posts/${id}`, { replace: true })
        }}
      />
    </section>
  )
}
```

```tsx
// pages/PostEditPage.tsx
import { useNavigate, useParams } from 'react-router-dom'
import PostForm from '../components/PostForm'
import { usePost, useUpdatePost } from '../queries'

export default function PostEditPage() {
  const postId = Number(useParams().id)
  const navigate = useNavigate()
  const { data: post, isPending, isError, error } = usePost(postId)
  const updatePost = useUpdatePost(postId)

  if (isPending) return <p>불러오는 중...</p>
  if (isError) return <p role="alert">{error.message}</p>

  return (
    <section>
      <h1>글 수정</h1>
      <PostForm
        key={post.id}
        defaultValues={{ title: post.title, content: post.content }}
        submitLabel="수정"
        onSubmit={async (values) => {
          await updatePost.mutateAsync(values)
          navigate(`/posts/${postId}`, { replace: true })
        }}
      />
    </section>
  )
}
```

**🔍 원리**
- **중복 제출 방지**: `handleSubmit`에 `async` 함수를 넘기면 react-hook-form이 그 Promise가 끝날 때까지 `isSubmitting = true`로 둔다. 버튼을 `disabled`로 묶으면 더블클릭해도 요청이 한 번만 나간다. `mutateAsync`를 `await`해야 이 원리가 동작한다(`mutate`는 기다리지 않음).
- **에러 두 겹**: zod(클라이언트)가 먼저 막고, 통과했는데 서버가 400을 주면 `ApiError.fields`를 `setError`로 **같은 자리**에 표시한다. 사용자는 어느 쪽 검증인지 몰라도 된다. 키 이름(`title`)이 백엔드 DTO 필드명과 같아서 그대로 연결된다.
- 필드 에러가 아닌 서버 에러(500, 네트워크)는 `root` 에러로 폼 아래에 한 줄 표시한다.
- `noValidate`: 브라우저 기본 검증 말풍선을 끄고 zod 메시지만 쓴다.
- `key={post.id}`: 다른 글 수정으로 바로 이동했을 때 폼을 새로 만들어 `defaultValues`가 다시 적용되게 한다. `defaultValues`는 **처음 한 번만** 읽히기 때문이다.
- 수정 페이지도 상세 API를 부르므로 조회수가 오른다. 1주차 설계의 한계로 두고, 필요하면 백엔드에 조회수를 올리지 않는 `GET /api/posts/{id}/edit-form` 같은 API를 따로 두는 게 실무 해법이다(선택 과제).
- 등록 성공 후 `replace`로 상세 이동: 뒤로가기 했을 때 빈 글쓰기 폼으로 돌아가지 않는다.

**✔ 확인**
- [ ] 제목·내용 입력 후 등록 → 상세로 이동, 목록에도 새 글 반영
- [ ] 빈 제목 제출 → 서버 요청 없이 "제목은 필수입니다."
- [ ] 개발자도구에서 `maxLength` 속성을 지우고 201자 입력 → zod가 막음
- [ ] zod `max(200)`을 잠시 `max(300)`으로 바꾸고 250자 제출 → **서버 400 메시지가 입력창 아래에** 표시 (확인 후 원래대로)
- [ ] 개발자도구 Network 탭 **Slow 3G**에서 등록 버튼 연타 → 요청 1건만
- [ ] 수정 → 상세에 반영, "(수정됨)" 표시

---

## 11 · 테스트 (Vitest + RTL + MSW)

**🎯 목표**: 스키마 단위 테스트, 목록 화면 테스트(정상·빈 목록·에러), 폼 테스트(빈 값·서버 400)를 작성한다.

**🤔 왜 지금**: 화면을 다 만들고 수동으로 확인한 내용을 코드로 옮긴다. 1주차 백엔드와 같은 순서다.

**📄 파일**: `vite.config.ts`(test 설정 추가), `src/test/setup.ts`, `src/test/handlers.ts`, `src/test/renderWithProviders.tsx`, `features/posts/schema.test.ts`, `pages/PostListPage.test.tsx`, `components/PostForm.test.tsx`, `package.json`

```ts
// vite.config.ts — defineConfig에 test 추가 (맨 위 import를 'vitest/config'로 바꿔야 타입이 맞음)
import { defineConfig } from 'vitest/config'
// ...plugins, resolve, server는 그대로
export default defineConfig({
  // ...
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})

// package.json scripts
// "test": "vitest run", "test:watch": "vitest"
```

```bash
# .env.test — Vitest는 mode가 'test'라서 .env.development를 읽지 않는다
VITE_API_URL=/api
```

```ts
// test/handlers.ts — 가짜 백엔드. 1주차 응답 모양 그대로
import { http, HttpResponse } from 'msw'

export const samplePost = {
  id: 1,
  writerId: 1,
  writerNickname: '테스터',
  title: '첫 글',
  content: '내용',
  viewCount: 3,
  createdAt: '2026-10-06T10:00:00',
  updatedAt: '2026-10-06T10:00:00',
}

export const handlers = [
  http.get('/api/posts', () =>
    HttpResponse.json({
      success: true,
      data: { content: [samplePost], page: 0, size: 10, totalElements: 1, totalPages: 1, last: true },
    }),
  ),
  http.post('/api/posts', () => HttpResponse.json({ success: true, data: 2 }, { status: 201 })),
]
```

```ts
// test/setup.ts
import '@testing-library/jest-dom/vitest'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

```tsx
// test/renderWithProviders.tsx
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
```

```ts
// features/posts/schema.test.ts
import { postFormSchema } from './schema'

describe('postFormSchema', () => {
  it('공백만 있는 제목은 실패한다', () => {
    const r = postFormSchema.safeParse({ title: '   ', content: '내용' })
    expect(r.success).toBe(false)
  })

  it('제목 201자는 실패한다', () => {
    const r = postFormSchema.safeParse({ title: 'a'.repeat(201), content: '내용' })
    expect(r.success).toBe(false)
  })

  it('정상 값은 통과하고 앞뒤 공백을 제거한다', () => {
    const r = postFormSchema.parse({ title: '  제목 ', content: '내용' })
    expect(r.title).toBe('제목')
  })
})
```

```tsx
// features/posts/pages/PostListPage.test.tsx
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/setup'
import { renderWithProviders } from '@/test/renderWithProviders'
import PostListPage from './PostListPage'

describe('PostListPage', () => {
  it('목록을 보여준다', async () => {
    renderWithProviders(<PostListPage />, { route: '/posts' })
    expect(await screen.findByText('첫 글')).toBeInTheDocument()
    expect(screen.getByText('테스터')).toBeInTheDocument()
  })

  it('빈 목록이면 안내 문구를 보여준다', async () => {
    server.use(
      http.get('/api/posts', () =>
        HttpResponse.json({
          success: true,
          data: { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, last: true },
        }),
      ),
    )
    renderWithProviders(<PostListPage />, { route: '/posts' })
    expect(await screen.findByText('첫 글을 작성해 보세요.')).toBeInTheDocument()
  })

  it('서버 에러면 에러 메시지와 다시 시도 버튼을 보여준다', async () => {
    server.use(
      http.get('/api/posts', () =>
        HttpResponse.json(
          { success: false, error: { code: 'C999', message: '서버 오류가 발생했습니다.' } },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<PostListPage />, { route: '/posts' })
    expect(await screen.findByText('서버 오류가 발생했습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })
})
```

```tsx
// features/posts/components/PostForm.test.tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ApiError } from '@/shared/api/client'
import PostForm from './PostForm'

describe('PostForm', () => {
  it('빈 값으로 제출하면 에러 메시지를 보여주고 onSubmit을 부르지 않는다', async () => {
    const onSubmit = vi.fn()
    renderWithProviders(<PostForm submitLabel="등록" onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(await screen.findByText('제목은 필수입니다.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('서버 400의 fields를 입력창 아래에 보여준다', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(400, 'C001', '입력값이 올바르지 않습니다.', { title: '금지어가 포함되어 있습니다.' }),
    )
    renderWithProviders(<PostForm submitLabel="등록" onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('제목'), '제목')
    await userEvent.type(screen.getByLabelText('내용'), '내용')
    await userEvent.click(screen.getByRole('button', { name: '등록' }))
    expect(await screen.findByText('금지어가 포함되어 있습니다.')).toBeInTheDocument()
  })
})
```

**🔍 원리**
- **MSW**는 네트워크 요청을 가로채 가짜 응답을 준다. 컴포넌트·axios·React Query 코드는 **진짜 그대로** 동작하고 서버만 가짜다. axios를 mock하는 것보다 실제에 가깝다.
- `onUnhandledRequest: 'error'`: 핸들러를 안 만든 요청이 나가면 테스트를 실패시킨다. "몰래 나가는 요청"을 잡아낸다.
- `server.use(...)`: 그 테스트에서만 응답을 바꾼다. `afterEach`의 `resetHandlers()`가 원래대로 돌려놓는다.
- 테스트마다 **새 QueryClient**를 만드는 이유: 캐시가 테스트끼리 섞이지 않게. `retry: false`가 없으면 에러 테스트가 재시도 때문에 느려진다.
- `findBy...`는 "나타날 때까지 기다린다"(비동기), `getBy...`는 "지금 있어야 한다". 서버 응답 뒤에 그려지는 것은 `findBy`.
- `getByLabelText('제목')`가 동작하는 건 shadcn `FormLabel`이 input과 `htmlFor`로 연결돼 있어서다. **테스트하기 쉬운 마크업 = 접근성이 좋은 마크업**이다.

**✔ 확인**: `npm run test` → 전부 통과.

---

## 🔧 안 될 때 체크리스트

- **CORS 에러** → axios `baseURL`이 `http://localhost:8080`처럼 절대 주소인가? `/api`여야 프록시를 탄다(1번).
- **`/api/posts`가 404 HTML** → `vite.config.ts` 수정 후 dev 서버를 재시작했나? 백엔드가 켜져 있나?
- **`import.meta.env.VITE_API_URL`이 undefined** → `.env.development` 파일 위치가 프로젝트 루트(= `package.json` 옆)인가? 수정 후 재시작했나?
- **등록했는데 목록이 그대로** → `onSuccess`의 `invalidateQueries` 키가 `postKeys.lists()`인가? 키 배열 앞부분이 일치해야 한다(7번).
- **조회수가 갑자기 여러 번 오름** → `refetchOnWindowFocus: false`(4번)? 테스트 중 수정 페이지도 조회수를 올린다(10번).
- **수정 폼이 비어 있음** → `defaultValues`는 처음 한 번만 적용. 데이터가 온 뒤에 폼을 그리고 `key`를 줬나(10번)?
- **서버 400인데 입력창 아래 표시가 안 됨** → 백엔드 `fields`의 키 이름과 폼 필드 이름이 같은가?
- **테스트에서 `ReferenceError: describe`** → `vite.config.ts`에 `globals: true`, `tsconfig`의 `types`에 `"vitest/globals"`.

## 🧠 스스로 설명해보기

1. Vite 프록시를 쓰면 왜 CORS가 생기지 않나? 6주차 Nginx와 어떤 점이 같은가?
2. `unwrap`과 응답 인터셉터가 각각 맡은 일은?
3. `postKeys.lists()`로 invalidate하면 어떤 캐시들이 새로 고쳐지나?
4. 게시글 목록을 zustand에 저장하면 어떤 문제가 생기나?
5. 페이지·검색어를 `useState`가 아니라 URL에 둔 이유는?
6. 저장 버튼 더블클릭이 막히는 원리는? `mutate`를 쓰면 왜 안 막히나?
7. 서버 400의 `fields`가 입력창 아래까지 오는 경로를 axios → 폼 순서로 설명해 보자.
8. MSW와 axios mock의 차이는?

## 🚀 여유가 있다면

- [ ] `window.confirm` 대신 shadcn `AlertDialog`로 삭제 확인
- [ ] 목록 로딩을 스켈레톤 UI로 바꾸기 (퍼블리싱 강점 살리기)
- [ ] 검색어 하이라이트 (`<mark>` 사용, `dangerouslySetInnerHTML` 없이)
- [ ] 목록 응답에서 본문(`content`)을 빼는 `PostSummaryResponse`를 백엔드에 추가하고 타입 분리
