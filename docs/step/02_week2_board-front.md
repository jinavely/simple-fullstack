# 2주차 · 게시판 프런트 (10/6~9 · 10h)

> 1주차 백엔드(`/api/posts`)를 React 화면에 붙인다.
> 각 단계는 **🎯 목표 → 🤔 왜 지금 → 📄 파일 → ⌨️ 코드 → 🔍 원리 → ✔ 확인** 순서다.
> 코드는 `frontend/` 기준(TypeScript + Vite, **pnpm**, react-router 8, shadcn/ui). 백엔드(8080)를 켜 둔 상태에서 진행한다.
> 아직 로그인이 없으므로 **누구나 글을 쓰고 지울 수 있는 상태가 정상**이다. 작성자는 1주차 `TEMP_USER_ID`로 표시된다.

> 📌 **출발점**: 라우터(`routes/`), 레이아웃, shadcn 컴포넌트, 게시판 화면 껍데기(`features/post/*`, `pages/Post*Page.tsx`)는 **이미 있다**. 이번 주는 새 화면을 그리는 게 아니라, 가짜 글자(`제목`, `0000-00-00`)로 채워진 껍데기에 **진짜 데이터를 흘려 넣는** 작업이다.

---

## 🗺 전체 흐름

```text
[페이지]           pages/PostListPage · PostViewPage · PostWritePage · PostEditPage
      │ ① 훅 호출 (usePostListQuery, useCreatePostMutation ...)
      │   ↳ 화면 조각은 features/post/*  (PostTable, PostSearchBar, PostForm ...)
      ▼
[React Query]      features/post/queries.ts ── 캐시 · 로딩/에러 상태 · Query Key
      │ ② API 함수 호출
      ▼
[API 함수]         features/post/api.ts     ── URL · 메서드 + zod로 응답 검사
      │ ③ HTTP
      ▼
[axios 인스턴스]   lib/api-client.ts        ── baseURL, 에러를 ApiError로 통일
      │ ④ /api/posts  (Vite 프록시가 8080으로 전달)
      ▼
[Spring Boot]      1주차 PostController
```

**핵심 한 줄**: 페이지는 "무엇을 보여줄지", React Query는 "언제 다시 가져올지", `api.ts`는 "어디로 요청하고 응답이 맞는 모양인지", axios는 "에러를 어떤 모양으로 바꿀지"만 책임진다.

## 📋 순서표

| # | 할 일 | 파일 | 끝나면 확인할 것 |
|---|---|---|---|
| 1 | Vite 프록시 · 환경변수 | `vite.config.ts`, `.env.development`, `.env.example` | 브라우저에서 `/api/posts` JSON 보임 |
| 2 | 폴더 구조 확인 | 새 파일 자리만 | 트리 이해 |
| 3 | 공통 응답 스키마 · axios 에러 통일 | `lib/api-response.ts`, `lib/api-client.ts` | 컴파일 OK |
| 4 | QueryClient 옵션 · 날짜 포맷 | `lib/queryClient.ts`, `lib/format.ts` | 컴파일 OK |
| 5 | 게시글 zod 스키마 | `features/post/schema.ts` | 컴파일 OK |
| 6 | 목록 쿼리스트링 규칙 | `features/post/search-params.ts`, `usePostListParams.ts` | 컴파일 OK |
| 7 | API 함수 | `features/post/api.ts` | 컴파일 OK |
| 8 | Query Key · 훅 | `features/post/queries.ts` | 컴파일 OK |
| 9 | 목록 (검색 · 정렬 · 개수 · 페이징 · URL 동기화) | `PostSearchBar`, `PostTable`, `PostPagination`, `pages/PostListPage` | 목록 · 검색 · 새로고침 후 유지 |
| 10 | 상세 · 삭제 | `PostDetail`, `PostDeleteDialog`, `PostErrorState`, `pages/PostViewPage` | 조회수 표시 · 삭제 후 목록 갱신 |
| 11 | 공통 폼 · 작성 · 수정 | `PostForm`, `pages/PostWritePage`, `pages/PostEditPage` | 등록 · 수정 · 서버 400 표시 · 더블클릭 방지 |
| 12 | 테스트 | `test/renderWithProviders.tsx`, `*.test.ts(x)` | `pnpm test` 통과 |

## 📁 완성 후 폴더 (이번 주에 만들거나 고치는 파일)

```text
frontend
 ├─ vite.config.ts                          (1 수정: 프록시)
 ├─ .env.development · .env.example         (1 수정)
 └─ src
     ├─ main.tsx                            (그대로)
     ├─ routes/router.tsx · paths.ts        (그대로 — 경로는 ROUTES / toPostDetail / toPostEdit만 사용)
     ├─ components/layout/RootLayout.tsx    (그대로)
     ├─ components/ui/*                     (그대로 — shadcn)
     ├─ lib
     │   ├─ api-client.ts                   (3 수정)
     │   ├─ api-response.ts                 (3 새로)
     │   ├─ queryClient.ts                  (4 수정)
     │   └─ format.ts                       (4 새로)
     ├─ features/post
     │   ├─ schema.ts                       (5)
     │   ├─ search-params.ts                (6)
     │   ├─ usePostListParams.ts            (6)
     │   ├─ api.ts                          (7)
     │   ├─ queries.ts                      (8)
     │   ├─ PostSearchBar.tsx               (9 수정)
     │   ├─ PostTable.tsx                   (9 수정)
     │   ├─ PostPagination.tsx              (9 수정)
     │   ├─ PostDetail.tsx                  (10 수정)
     │   ├─ PostDeleteDialog.tsx            (10 수정)
     │   ├─ PostErrorState.tsx              (10 새로)
     │   ├─ PostForm.tsx                    (11 수정)
     │   └─ *.test.ts(x)                    (12)
     ├─ pages
     │   ├─ PostListPage.tsx                (9 수정)
     │   ├─ PostViewPage.tsx                (10 수정)
     │   ├─ PostWritePage.tsx · PostEditPage.tsx (11 수정)
     │   └─ PostListPage.test.tsx           (12)
     └─ test
         ├─ setup.ts                        (그대로)
         └─ renderWithProviders.tsx         (12 새로)
```

---

## 1 · Vite 프록시 · 환경변수

**🎯 목표**: 프런트(5175)에서 `/api`로 보낸 요청이 백엔드(8080)로 가게 한다.

**🤔 왜 지금**: 지금 `.env.development`는 `http://localhost:8080/api`(절대 주소)를 가리킨다. 백엔드에 CORS 설정이 없으므로 이대로면 모든 요청이 CORS 에러로 막힌다.

**📄 파일**: `vite.config.ts`, `.env.development`, `.env.example`

패키지는 이미 다 설치돼 있다(`axios`, `@tanstack/react-query`, `react-router`, `zod`, `react-hook-form`, `@hookform/resolvers`, vitest, Testing Library). 이번 주에 **추가 설치는 없다**.

```ts
// vite.config.ts — server에 proxy만 추가
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  // resolve, test는 그대로
})
```

```bash
# .env.development / .env.example
VITE_API_BASE_URL=/api
```

`frontend/.env`에 남아 있는 `VITE_API_URL=""`는 아무 데서도 쓰지 않는 옛 변수라 지워도 된다.

**🔍 원리**
- 브라우저는 **출처(프로토콜+주소+포트)가 다른 서버**로의 요청을 막는다(CORS). 5175 → 8080은 포트가 달라서 다른 출처다.
- 프록시를 쓰면 브라우저는 **같은 출처인 5175**에 요청하고, Vite 개발 서버가 뒤에서 8080으로 대신 전달한다. 브라우저 입장에서는 다른 출처 요청이 아니므로 CORS가 아예 생기지 않는다.
- 6주차 Nginx도 똑같은 원리(`/api`는 백엔드로, 나머지는 React)라서, 백엔드에 CORS 설정 없이 **개발과 운영이 같은 구조**가 된다.
- `VITE_`로 시작하는 환경변수만 브라우저 코드에서 `import.meta.env.VITE_API_BASE_URL`로 읽을 수 있다(비밀값을 실수로 번들에 넣지 않게 하려는 규칙).
- `lib/api-client.ts`는 이미 `import.meta.env.VITE_API_BASE_URL ?? '/api'`로 되어 있다. 변수가 없어도 `/api`가 기본값이라 6주차 운영 빌드에서 `.env.production`이 필요 없다.
- `.gitignore`가 `.env.*`를 제외하고 `.env.example`만 올린다. 팀원은 `.env.example`을 복사해서 쓴다.

**✔ 확인**: `pnpm dev` 후 주소창에 `http://localhost:5175/api/posts` → 1주차 JSON(`{"success":true,"data":{...}}`)이 보이면 성공.

---

## 2 · 폴더 구조 확인

**🎯 목표**: 위 트리에서 **새 파일이 어디에 들어가는지** 이해한다. 폴더를 새로 만들 필요는 없다.

**🤔 왜 지금**: 파일을 만들기 전에 자리를 정해 둬야 뒤섞이지 않는다.

**🔍 원리**
- `pages/` = **라우트 단위 화면**. URL 하나에 페이지 하나. 데이터 훅을 부르고 화면 조각을 배치한다.
- `features/post/` = **게시글 기능에 속한 모든 것**. `api.ts`(요청) · `schema.ts`(zod) · `queries.ts`(React Query 훅) · 화면 조각 컴포넌트 · 테스트가 한 폴더에 모인다. 3주차 이후 `auth`, `member`, `comment`, `file`이 같은 모양으로 옆에 붙는다(백엔드의 `post/`, `user/` 패키지와 같은 발상).
- `lib/` = 어느 기능에도 속하지 않는 공통 부품(axios 인스턴스, QueryClient, 포맷 함수). 백엔드의 `global` 패키지와 같은 역할이다.
- `components/ui/` = shadcn이 생성한 부품(`components.json`의 `aliases.ui`). 직접 고치지 않는다.
- 규칙: `features`는 `lib`·`components`를 가져다 쓸 수 있지만, `lib`·`components`는 `features`를 import하지 않는다. (공통 부품이 특정 기능에 묶이지 않게)
- **데이터 흐름 규칙**: 컴포넌트는 `queries.ts`의 훅만 쓴다. `api.ts`나 axios를 컴포넌트에서 직접 부르지 않는다.
- 경로 문자열은 `routes/paths.ts`의 `ROUTES`, `toPostDetail(id)`, `toPostEdit(id)`만 쓴다. `` `/posts/${id}` `` 같은 하드코딩은 금지.

**✔ 확인**: `src/features/post`, `src/pages`, `src/lib`의 현재 파일을 한 번 열어 보고, 위 트리의 "수정"·"새로"를 구분할 수 있으면 OK.

---

## 3 · 공통 응답 스키마 · axios 에러 통일

**🎯 목표**: 백엔드 `ApiResponse`·`PageResponse` 모양을 zod 스키마로 옮기고, 모든 에러를 한 가지 모양(`ApiError`)으로 바꾼다.

**🤔 왜 지금**: 이후 모든 API 함수가 이 두 파일을 쓴다. 백엔드 1주차 `GlobalExceptionHandler`의 프런트 버전이다.

**📄 파일**: `src/lib/api-response.ts`(새로), `src/lib/api-client.ts`(수정)

```ts
// lib/api-response.ts
import { z } from 'zod'

// 백엔드 global/common/ApiResponse · PageResponse와 필드명을 정확히 맞춤
export const apiResponseSchema = <T extends z.ZodType>(data: T) =>
  z.object({ success: z.literal(true), data })

export const pageResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    content: z.array(item),
    page: z.number(), // 0부터 시작
    size: z.number(),
    totalElements: z.number(),
    totalPages: z.number(),
    last: z.boolean(),
  })
```

```ts
// lib/api-client.ts
import axios, { type AxiosError } from 'axios'

// 백엔드 ApiResponse.ErrorBody와 같은 모양
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

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

apiClient.interceptors.request.use((config) => {
  // TODO 4주차: 로그인 토큰 첨부
  return config
})

// 실패 응답을 전부 ApiError 하나로 통일한다
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: ApiErrorBody }>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data?.error ?? {
      code: 'NETWORK_ERROR',
      message: '서버에 연결할 수 없습니다.',
    }
    return Promise.reject(new ApiError(status, body))
  },
)
```

**🔍 원리**
- 서버가 성공이든 실패든 같은 모양의 JSON을 주기 때문에, 프런트도 **성공은 zod 스키마로 `data`만 꺼내고, 실패는 인터셉터에서 `ApiError`로** 한 번에 정리할 수 있다.
- **zod로 응답을 검사하는 이유**: 타입 선언(`type Post = {...}`)은 컴파일할 때만 존재한다. 서버가 필드 이름을 바꾸면 화면에서 `undefined`가 조용히 찍힌다. `schema.parse(data)`는 **실행 중에** 모양을 확인해서 "어느 필드가 틀렸는지"를 에러로 바로 알려준다.
- 화면 코드는 `error.code`, `error.fields`, `error.message`만 보면 된다. axios 내부 구조(`err.response.data.error.fields`)를 페이지마다 알 필요가 없다.
- 서버가 꺼져 응답 자체가 없으면 `status 0` + `NETWORK_ERROR`가 된다. (Vite 프록시는 백엔드가 꺼져 있으면 본문 없는 500을 준다 → status 500 + `NETWORK_ERROR` 메시지)
- `constructor(public status: number, ...)` 같은 **매개변수 속성** 문법은 쓰지 않는다. `tsconfig.app.json`의 `erasableSyntaxOnly: true`가 이 문법을 막는다(TS 전용 문법이라 타입만 지워서는 JS가 되지 않기 때문). 필드를 따로 선언하고 생성자에서 대입한다.
- **4주차에는 이 파일에 요청 인터셉터(토큰 첨부)와 401 재발급만 추가**하면 된다. 그래서 지금 인스턴스를 하나로 모아 두는 것이다.
- 인터셉터 = "요청이 나가기 전 / 응답이 도착한 직후에 끼어드는 함수". 백엔드의 필터와 같은 자리다.

**✔ 확인**: `pnpm build`(또는 에디터)에서 빨간 줄 없이 컴파일 OK.

---

## 4 · QueryClient 옵션 · 날짜 포맷

**🎯 목표**: React Query 기본 동작을 이 게시판에 맞게 조정하고, 날짜 표시 함수를 한 곳에 둔다.

**🤔 왜 지금**: `main.tsx`는 이미 `QueryClientProvider`와 `RouterProvider`로 감싸져 있다. 옵션만 고치면 된다.

**📄 파일**: `src/lib/queryClient.ts`(수정), `src/lib/format.ts`(새로)

```ts
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api-client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 4xx(없는 글, 잘못된 요청)는 다시 보내도 결과가 같다
        if (error instanceof ApiError && error.status >= 400 && error.status < 500)
          return false
        return failureCount < 1
      },
    },
  },
})
```

```ts
// lib/format.ts
// LocalDateTime 문자열("2026-10-06T10:15:00.123456") → 화면 표시용
export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ko-KR')

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
```

**🔍 원리**
- `refetchOnWindowFocus: false`는 **1주차 상세 조회가 조회수를 올리기 때문**에 넣었다. 기본값(true)이면 다른 탭에 갔다 오기만 해도 상세를 다시 불러 조회수가 계속 오른다.
- `staleTime: 30_000`: 30초 안에 같은 데이터를 다시 쓰면 요청 없이 캐시를 보여준다. 목록 → 상세 → 뒤로가기가 즉시 뜬다. 대신 **30초 안에 같은 글을 다시 열면 조회수가 오르지 않는다**(요청이 안 나가므로).
- `retry`: 기본값(3번)이면 404도 세 번 더 요청해서 에러 화면이 늦게 뜬다. 4xx는 재시도하지 않고, 네트워크·5xx만 한 번 재시도한다.
- `queryClient`를 `lib`에 따로 둔 이유: 4주차 로그아웃 때 `queryClient.clear()`를 컴포넌트 밖에서도 부를 수 있다.
- 날짜는 JSON에서 **문자열**로 온다. 저장·비교는 문자열 그대로 하고, 화면에 보여줄 때만 `format.ts`로 바꾼다.

**✔ 확인**: 컴파일 OK.

---

## 5 · 게시글 zod 스키마

**🎯 목표**: 1주차 `PostResponse`와 같은 응답 스키마, 작성·수정 폼 검증 규칙을 만든다.

**🤔 왜 지금**: API 함수(7번)와 폼(11번)이 이 스키마를 쓴다. 백엔드의 DTO를 먼저 만든 것과 같은 순서다.

**📄 파일**: `src/features/post/schema.ts`

```ts
import { z } from 'zod'
import { pageResponseSchema } from '@/lib/api-response'

// 백엔드 PostResponse와 필드명 · 타입을 맞춤
export const postSchema = z.object({
  id: z.number(),
  writerId: z.number(),
  writerNickname: z.string(),
  title: z.string(),
  content: z.string(),
  viewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Post = z.infer<typeof postSchema>

export const postPageSchema = pageResponseSchema(postSchema)
export type PostPage = z.infer<typeof postPageSchema>

// 작성 · 수정 폼 — 백엔드 PostCreateRequest / PostUpdateRequest와 규칙을 맞춤
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
- 규칙 숫자는 **ERD `posts.title VARCHAR(200)` → 백엔드 `@Size(max = 200)` → 프런트 `max(200)`** 세 곳이 같아야 한다. 하나라도 다르면 "화면에서는 통과했는데 서버가 400"이 난다. 메시지 문구도 백엔드와 똑같이 맞췄다.
- `z.infer`로 타입을 뽑으면 **검증 규칙과 타입이 한 곳**에 있다. 필드를 추가할 때 스키마만 고치면 타입도 따라온다. 그래서 `types.ts`를 따로 두지 않는다.
- `.trim()`은 공백만 입력한 값을 빈 값으로 만들어 `min(1)`에 걸리게 한다. 백엔드 `@NotBlank`와 같은 효과다.
- 프런트 검증은 **사용자 편의**, 서버 검증은 **보안**이다. 둘 다 있어야 한다.

**✔ 확인**: 컴파일 OK.

---

## 6 · 목록 쿼리스트링 규칙

**🎯 목표**: 목록 화면의 상태(페이지 · 개수 · 정렬 · 검색 범위 · 검색어)를 **URL 쿼리스트링**으로 관리하는 규칙을 한 파일에 정한다.

**🤔 왜 지금**: 이미 있는 `PostSearchBar`에는 검색 범위 · 정렬 · 개수 선택이 있다. API 함수(7번)와 훅(8번)이 이 파라미터 타입을 쓰므로 먼저 정한다.

**📄 파일**: `src/features/post/search-params.ts`, `src/features/post/usePostListParams.ts`

```ts
// features/post/search-params.ts
import { z } from 'zod'

// 목록 쿼리스트링 규칙. 잘못된 값은 .catch()로 기본값이 된다
export const postListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1), // 화면 기준 1부터
  size: z.enum(['10', '20', '50']).catch('10'),
  sort: z.enum(['id,desc', 'id,asc', 'viewCount,desc']).catch('id,desc'),
  searchType: z.enum(['all', 'title', 'content']).catch('all'),
  keyword: z.string().trim().catch(''),
})
export type PostListParams = z.infer<typeof postListParamsSchema>

export const DEFAULT_POST_LIST_PARAMS = postListParamsSchema.parse({})

export function parsePostListParams(
  searchParams: URLSearchParams,
): PostListParams {
  return postListParamsSchema.parse(Object.fromEntries(searchParams))
}

// 기본값과 같은 항목은 URL에서 뺀다 → /posts?page=2&keyword=spring
export function toPostSearchParams(params: PostListParams) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const isDefault =
      value === DEFAULT_POST_LIST_PARAMS[key as keyof PostListParams]
    if (value !== '' && !isDefault) next.set(key, String(value))
  }
  return next
}
```

```ts
// features/post/usePostListParams.ts
import { useSearchParams } from 'react-router'
import {
  parsePostListParams,
  toPostSearchParams,
  type PostListParams,
} from './search-params'

export function usePostListParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parsePostListParams(searchParams)

  // 검색 조건이 바뀌면 1페이지로. page를 직접 넘기면 그 값이 이긴다
  const setParams = (next: Partial<PostListParams>) =>
    setSearchParams(toPostSearchParams({ ...params, page: 1, ...next }))

  // 페이지 링크의 href용 (새 탭 열기 · 링크 복사가 되도록)
  const toHref = (next: Partial<PostListParams>) =>
    `?${toPostSearchParams({ ...params, ...next })}`

  return { params, setParams, toHref }
}
```

**🔍 원리**
- **URL이 곧 상태**: `useState`에 페이지를 두면 새로고침·뒤로가기·링크 공유 때 사라진다. `?page=2&keyword=점검`에 두면 상세에 갔다 뒤로 와도 그대로다. SI 화면 요구사항 단골이다.
- **URL은 사용자가 마음대로 고칠 수 있는 입력값**이다. `?page=-3&sort=password,asc`를 그대로 서버에 보내면 안 된다. zod 스키마로 한 번 걸러서 **허용한 값만** 쓰고, 나머지는 `.catch()`로 기본값을 쓴다. 특히 `sort`는 화이트리스트여야 한다(없는 컬럼으로 정렬하면 서버 500).
- `size`를 숫자가 아니라 `'10' | '20' | '50'` 문자열로 둔 이유: shadcn `Select`의 값이 문자열이라 변환 없이 바로 연결된다.
- 기본값은 URL에서 뺀다. 첫 화면 주소가 `/posts?page=1&size=10&sort=id,desc...`로 지저분해지지 않는다.
- `setParams`가 기본으로 `page: 1`을 넣는 이유: 검색어나 정렬을 바꿨는데 7페이지에 머물면 "결과 없음"이 뜬다. 조건이 바뀌면 1페이지로 돌아가는 게 맞다.
- 이 규칙은 **화면 기준 값**이다. 서버가 쓰는 0부터 시작하는 페이지 번호로 바꾸는 일은 7번 `api.ts` 한 곳에서만 한다.

**✔ 확인**: 컴파일 OK. (동작은 12번 `search-params.test.ts`로 확인)

---

## 7 · API 함수

**🎯 목표**: 게시글 API 5개를 함수로 만든다.

**🤔 왜 지금**: 8번 훅이 이 함수들을 부른다. 백엔드의 Repository처럼 **데이터 창구**를 먼저 만든다.

**📄 파일**: `src/features/post/api.ts`

```ts
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'
import { apiResponseSchema } from '@/lib/api-response'
import { postPageSchema, postSchema, type PostFormValues } from './schema'
import type { PostListParams } from './search-params'

const idResponseSchema = apiResponseSchema(z.number())

export async function fetchPosts({
  page,
  size,
  sort,
  searchType,
  keyword,
}: PostListParams) {
  const { data } = await apiClient.get('/posts', {
    params: {
      page: page - 1, // 화면은 1부터, Spring Pageable은 0부터
      size,
      sort,
      searchType: searchType === 'all' ? undefined : searchType,
      keyword: keyword || undefined,
    },
  })
  return apiResponseSchema(postPageSchema).parse(data).data
}

export async function fetchPost(id: number) {
  const { data } = await apiClient.get(`/posts/${id}`)
  return apiResponseSchema(postSchema).parse(data).data
}

export async function createPost(body: PostFormValues) {
  const { data } = await apiClient.post('/posts', body)
  return idResponseSchema.parse(data).data
}

export async function updatePost(id: number, body: PostFormValues) {
  const { data } = await apiClient.put(`/posts/${id}`, body)
  return idResponseSchema.parse(data).data
}

export async function deletePost(id: number) {
  await apiClient.delete(`/posts/${id}`)
}
```

**🔍 원리**
- 이 층은 **URL과 메서드, 응답 모양**만 안다. 캐시, 로딩 상태, 화면 이동은 모른다. 역할이 작을수록 테스트와 교체가 쉽다.
- `page - 1`: 화면은 1페이지부터, Spring `Pageable`은 0페이지부터. **변환은 이 함수 한 곳에서만** 한다.
- `sort=id,desc`: Spring `Pageable`이 `sort` 파라미터를 그대로 읽는다. 1주차 컨트롤러의 `@PageableDefault(sort = "id", direction = DESC)`가 기본값이라 최신순은 생략해도 같다.
- `undefined`인 파라미터는 axios가 URL에서 뺀다. `keyword`가 빈 문자열이면 `?keyword=`가 안 붙는다.
- ⚠️ **`searchType`은 1주차 백엔드가 아직 모른다**. 보내도 무시되고 항상 "제목+내용"으로 검색된다. 제목만/내용만 검색은 🚀 선택 과제에서 백엔드 `PostRepository.search`에 조건을 추가해 완성한다. 프런트는 미리 보내 두므로 백엔드만 고치면 바로 동작한다.
- `deletePost`는 응답 본문을 검사하지 않는다. 백엔드 `ApiResponse`가 `@JsonInclude(NON_NULL)`이라 `data: null`이면 키 자체가 빠져서 돌려받을 값이 없다.
- 1주차 Swagger의 `/v3/api-docs`를 AI에게 주고 "이 명세로 api.ts를 만들어줘"라고 하면 거의 이 모양이 나온다. 직접 한 번 쓰고 비교해 보자.

**✔ 확인**: 컴파일 OK.

---

## 8 · Query Key · 훅

**🎯 목표**: 조회는 `useQuery`, 변경은 `useMutation` 훅으로 감싸고, 캐시 이름표(Query Key)를 한 곳에서 관리한다.

**🤔 왜 지금**: 페이지는 이 훅만 쓴다. 등록·수정·삭제 후 "어떤 캐시를 새로 가져올지"를 여기서 한 번만 정의한다.

**📄 파일**: `src/features/post/queries.ts`

```ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createPost, deletePost, fetchPost, fetchPosts, updatePost } from './api'
import type { PostFormValues } from './schema'
import type { PostListParams } from './search-params'

export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (params: PostListParams) => [...postKeys.lists(), params] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: number) => [...postKeys.details(), id] as const,
}

export const isValidPostId = (id: number) => Number.isInteger(id) && id > 0

export function usePostListQuery(params: PostListParams) {
  return useQuery({
    queryKey: postKeys.list(params),
    queryFn: () => fetchPosts(params),
    placeholderData: keepPreviousData, // 페이지를 넘길 때 이전 목록을 잠깐 유지
  })
}

export function usePostQuery(id: number) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => fetchPost(id),
    enabled: isValidPostId(id),
  })
}

export function useCreatePostMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PostFormValues) => createPost(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: postKeys.lists() }),
  })
}

export function useUpdatePostMutation(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PostFormValues) => updatePost(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.lists() })
      queryClient.invalidateQueries({ queryKey: postKeys.detail(id) })
    },
  })
}

export function useDeletePostMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deletePost(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: postKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: postKeys.lists() })
    },
  })
}
```

**🔍 원리**
- **Query Key = 캐시의 주소**다. `['posts', 'list', { page: 1, size: '10', ... }]`처럼 파라미터까지 포함되므로 페이지·정렬·검색어마다 캐시가 따로 저장된다. 6번의 `params`가 바뀌면 키가 바뀌고 → 새 요청이 나간다.
- 키를 **계층 구조**로 만든 이유: `invalidateQueries({ queryKey: ['posts', 'list'] })` 한 번이면 **모든 페이지·모든 검색어의 목록 캐시**가 한꺼번에 "오래됨" 표시가 된다. 키가 앞부분부터 일치하면 다 걸린다.
- `invalidate` = "이 캐시는 낡았으니 지금 화면에 쓰이고 있으면 다시 가져와". 삭제된 글 상세는 다시 가져올 필요가 없으므로 `removeQueries`로 아예 지운다.
- `keepPreviousData`: 2페이지로 넘어갈 때 새 데이터가 올 때까지 1페이지 목록을 보여준다. 이게 없으면 페이지를 넘길 때마다 "불러오는 중…"으로 화면이 깜빡인다.
- **서버 상태는 React Query, 클라이언트 상태는 zustand**. 이번 주는 서버 데이터뿐이라 zustand가 필요 없다. 게시글 목록을 zustand에 복사해 두면 "등록했는데 목록이 안 바뀌는" 캐시 불일치가 생긴다.
- `enabled`: 주소의 id가 숫자가 아니면(`/posts/abc/edit`) 요청 자체를 보내지 않는다. 이때는 `isPending`이 계속 true이므로 페이지가 `isValidPostId`로 먼저 걸러야 한다(10번).
- 이름 규칙: 조회 훅은 `use...Query`, 변경 훅은 `use...Mutation`. 컴포넌트에서 이름만 봐도 서버를 읽는지 바꾸는지 알 수 있다.

**✔ 확인**: 컴파일 OK.

---

## 9 · 목록 (검색 · 정렬 · 개수 · 페이징 · URL 동기화)

**🎯 목표**: 이미 있는 목록 껍데기(`PostSearchBar`, `PostTable`, `PostPagination`)에 props를 뚫고, 페이지에서 데이터를 흘려 넣는다. 로딩·에러·빈 목록 화면을 모두 만든다.

**🤔 왜 지금**: 데이터가 있어야 상세·수정을 확인할 수 있다. 화면은 **목록부터** 만든다(1주차 Swagger로 글을 몇 개 넣어 두자).

**📄 파일**: `features/post/PostSearchBar.tsx`, `PostTable.tsx`, `PostPagination.tsx`, `pages/PostListPage.tsx` (모두 수정)

```tsx
// features/post/PostSearchBar.tsx
import type { FormEvent } from 'react'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PostListParams } from './search-params'

type PostSearchBarProps = {
  params: PostListParams
  onChange: (next: Partial<PostListParams>) => void
}

export function PostSearchBar({ params, onChange }: PostSearchBarProps) {
  // 검색 범위 · 검색어는 [검색] 버튼을 눌렀을 때만 반영
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    onChange({
      searchType: form.get('searchType') as PostListParams['searchType'],
      keyword: String(form.get('keyword') ?? '').trim(),
    })
  }

  return (
    <form
      // 뒤로가기로 URL이 바뀌면 입력창도 URL 값으로 다시 채운다
      key={`${params.searchType}:${params.keyword}`}
      role="search"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="flex gap-2">
        <Select name="searchType" defaultValue={params.searchType}>
          <SelectTrigger className="w-28" aria-label="검색 범위">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">제목+내용</SelectItem>
            <SelectItem value="title">제목</SelectItem>
            <SelectItem value="content">내용</SelectItem>
          </SelectContent>
        </Select>

        {/* 정렬 · 개수는 고르자마자 반영 */}
        <Select
          value={params.sort}
          onValueChange={(sort) =>
            onChange({ sort: sort as PostListParams['sort'] })
          }
        >
          <SelectTrigger className="w-28" aria-label="정렬">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id,desc">최신순</SelectItem>
            <SelectItem value="id,asc">오래된순</SelectItem>
            <SelectItem value="viewCount,desc">조회순</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={params.size}
          onValueChange={(size) =>
            onChange({ size: size as PostListParams['size'] })
          }
        >
          <SelectTrigger className="w-24" aria-label="페이지당 개수">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10개씩</SelectItem>
            <SelectItem value="20">20개씩</SelectItem>
            <SelectItem value="50">50개씩</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 gap-2">
        <Input
          type="search"
          name="keyword"
          defaultValue={params.keyword}
          placeholder="검색어를 입력하세요"
          aria-label="검색어"
          className="flex-1"
        />
        <Button type="submit" variant="outline">
          <SearchIcon />
          검색
        </Button>
      </div>
    </form>
  )
}
```

```tsx
// features/post/PostTable.tsx
import { Link } from 'react-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import { toPostDetail } from '@/routes/paths'
import type { Post } from './schema'

type PostTableProps = {
  posts: Post[]
  emptyMessage: string
  busy?: boolean
}

export function PostTable({ posts, emptyMessage, busy = false }: PostTableProps) {
  return (
    <Table aria-busy={busy}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16 text-center">번호</TableHead>
          <TableHead>제목</TableHead>
          <TableHead className="w-28 text-center">작성자</TableHead>
          <TableHead className="w-28 text-center">작성일</TableHead>
          <TableHead className="w-16 text-center">조회</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={5}
              className="h-32 text-center text-muted-foreground"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          posts.map((post) => (
            <TableRow key={post.id}>
              <TableCell className="text-center">{post.id}</TableCell>
              <TableCell className="max-w-0 truncate">
                <Link to={toPostDetail(post.id)} className="hover:underline">
                  {post.title}
                </Link>
              </TableCell>
              <TableCell className="text-center">
                {post.writerNickname}
              </TableCell>
              <TableCell className="text-center">
                {formatDate(post.createdAt)}
              </TableCell>
              <TableCell className="text-center">
                {post.viewCount.toLocaleString()}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
```

```tsx
// features/post/PostPagination.tsx
import type { MouseEvent } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

const PAGE_WINDOW = 5 // 번호 버튼을 최대 몇 개 보여줄지

type PostPaginationProps = {
  page: number // 1부터
  totalPages: number
  toHref: (page: number) => string
  onPageChange: (page: number) => void
}

export function PostPagination({
  page,
  totalPages,
  toHref,
  onPageChange,
}: PostPaginationProps) {
  if (totalPages <= 1) return null

  // 현재 페이지가 가운데 오도록 [start, start + PAGE_WINDOW) 구간을 잡는다
  const start = Math.max(
    1,
    Math.min(page - Math.floor(PAGE_WINDOW / 2), totalPages - PAGE_WINDOW + 1),
  )
  const pages = Array.from(
    { length: Math.min(PAGE_WINDOW, totalPages) },
    (_, i) => start + i,
  )

  // <a href>는 유지(새 탭 · 링크 복사)하고, 일반 클릭만 SPA 이동으로 바꾼다
  const linkProps = (target: number, disabled = false) => ({
    href: toHref(target),
    'aria-disabled': disabled || undefined,
    className: disabled ? 'pointer-events-none opacity-50' : undefined,
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return
      e.preventDefault()
      onPageChange(target)
    },
  })

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious text="이전" {...linkProps(page - 1, page <= 1)} />
        </PaginationItem>
        {pages.map((p) => (
          <PaginationItem key={p}>
            <PaginationLink isActive={p === page} {...linkProps(p)}>
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            text="다음"
            {...linkProps(page + 1, page >= totalPages)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
```

```tsx
// pages/PostListPage.tsx
import { Link } from 'react-router'
import { PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PostSearchBar } from '@/features/post/PostSearchBar'
import { PostTable } from '@/features/post/PostTable'
import { PostPagination } from '@/features/post/PostPagination'
import { usePostListQuery } from '@/features/post/queries'
import { usePostListParams } from '@/features/post/usePostListParams'
import { ROUTES } from '@/routes/paths'

export function PostListPage() {
  const { params, setParams, toHref } = usePostListParams()
  const { data, isPending, isError, error, refetch, isFetching } =
    usePostListQuery(params)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">게시판</h1>
        <Button asChild>
          <Link to={ROUTES.POST_NEW}>
            <PencilIcon />
            글쓰기
          </Link>
        </Button>
      </div>

      <PostSearchBar params={params} onChange={setParams} />

      {isPending ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          불러오는 중…
        </p>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-destructive">{error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              전체{' '}
              <span className="font-medium text-foreground">
                {data.totalElements.toLocaleString()}
              </span>
              건
            </p>
            <PostTable
              posts={data.content}
              busy={isFetching}
              emptyMessage={
                params.keyword
                  ? `"${params.keyword}" 검색 결과가 없습니다.`
                  : '첫 글을 작성해 보세요.'
              }
            />
          </div>

          <PostPagination
            page={params.page}
            totalPages={data.totalPages}
            toHref={(page) => toHref({ page })}
            onPageChange={(page) => setParams({ page })}
          />
        </>
      )}
    </div>
  )
}
```

**🔍 원리**
- **껍데기 → props**: 퍼블리싱된 컴포넌트의 마크업·클래스는 그대로 두고, 가짜 글자 자리를 props로 바꿨다. 컴포넌트는 데이터를 **받아서 그리기만** 하고, 데이터를 가져오는 일은 페이지가 한다. 그래서 `PostTable`은 React Query를 모르고, 테스트에서 배열만 넘겨도 그려진다.
- **검색 두 종류**: 검색 범위·검색어는 `[검색]` 버튼을 눌렀을 때만 URL에 반영한다(타이핑할 때마다 요청이 나가지 않게). 정렬·개수는 고르는 순간이 곧 "결정"이라 바로 반영한다.
- 검색창은 **비제어 입력**(`defaultValue` + `FormData`)이다. 입력값을 `useState`로 들고 있을 필요가 없다. 대신 뒤로가기로 URL이 바뀌면 입력창을 다시 채워야 하므로 `key`에 URL 값을 넣어 **폼을 새로 만든다**.
- radix `Select`에 `name`을 주면 폼 안에 숨은 `<select>`를 그려서 `FormData`에 값이 들어간다. 그래서 검색 범위도 `form.get('searchType')`로 읽힌다.
- `as PostListParams['sort']`로 타입을 단언해도 안전한 이유: 이 값은 URL로 들어갔다가 6번 zod 스키마를 다시 거친다. 이상한 값이면 기본값이 된다.
- **페이지 링크는 `<a href>` 유지**: shadcn `PaginationLink`는 `<a>`다. `href`를 제대로 넣어 두면 Ctrl+클릭(새 탭)·링크 복사가 된다. 일반 클릭만 `preventDefault` 후 `setParams`로 SPA 이동한다. `href="#"`로 두면 새 탭 열기가 깨진다.
- `isPending`(첫 로딩) / `isError` / 빈 목록 / 정상, **4가지 상태 화면**을 모두 만든다. 실무 QA에서 가장 많이 나오는 결함이 "빈 목록에서 표 머리만 덩그러니" 같은 상태 누락이다. 빈 목록은 검색 여부에 따라 문구를 바꿨다.
- 삼항 연산자 순서(`isPending ? … : isError ? … : …`) 덕분에 마지막 가지에서 TypeScript가 `data`를 "반드시 있음"으로 좁혀 준다. `data?.` 없이 쓸 수 있다.
- `isFetching`: 이전 데이터를 보여주며 뒤에서 새로 가져오는 중일 때 true. `aria-busy`로 접근성 표시만 했다.
- `?page=99`처럼 마지막 페이지를 넘으면 서버가 빈 `content`를 준다 → 빈 목록 문구가 뜬다. 정상 동작이다.

**✔ 확인**
- [ ] `/posts` → 최신 글이 위, 작성자 닉네임·조회수·작성일 표시, "전체 N건"
- [ ] 검색 → 주소에 `?keyword=...`, 결과만 표시 / 결과 없으면 `"검색어" 검색 결과가 없습니다.`
- [ ] 정렬 "조회순" → 즉시 `?sort=viewCount%2Cdesc`, 조회수 큰 글이 위
- [ ] "20개씩" → 한 페이지에 20개, 1페이지로 이동
- [ ] 2페이지로 이동 후 새로고침해도 2페이지 유지, 뒤로가기하면 1페이지
- [ ] 페이지 번호 Ctrl+클릭 → 새 탭에서 그 페이지가 열림
- [ ] 주소창에 `?page=abc&sort=hack` → 에러 없이 기본 목록
- [ ] 백엔드를 끄고 새로고침 → 에러 메시지 + 다시 시도 버튼

---

## 10 · 상세 · 삭제

**🎯 목표**: 글 하나를 보여주고, 삭제하면 목록으로 돌아가며 목록이 갱신되게 한다.

**🤔 왜 지금**: 목록에서 들어갈 곳이 있어야 한다. 삭제는 버튼 하나라 상세에 함께 둔다. 삭제 확인창(`PostDeleteDialog`)은 shadcn `AlertDialog`로 이미 만들어져 있다.

**📄 파일**: `features/post/PostDetail.tsx`(수정), `PostDeleteDialog.tsx`(수정), `PostErrorState.tsx`(새로), `pages/PostViewPage.tsx`(수정)

```tsx
// features/post/PostDetail.tsx
import { EyeIcon, UserIcon, CalendarIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { formatDateTime } from '@/lib/format'
import type { Post } from './schema'

type PostDetailProps = {
  post: Post
}

export function PostDetail({ post }: PostDetailProps) {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold break-words">{post.title}</h1>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <dt>
              <UserIcon className="size-4" aria-label="작성자" />
            </dt>
            <dd>{post.writerNickname}</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt>
              <CalendarIcon className="size-4" aria-label="작성일" />
            </dt>
            <dd>
              <time dateTime={post.createdAt}>
                {formatDateTime(post.createdAt)}
              </time>
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt>
              <EyeIcon className="size-4" aria-label="조회수" />
            </dt>
            <dd>{post.viewCount.toLocaleString()}</dd>
          </div>
        </dl>
      </header>

      <Separator />

      {/* 줄바꿈은 whitespace-pre-wrap으로. HTML로 넣지 않는다(XSS) */}
      <div className="min-h-60 text-sm leading-relaxed break-words whitespace-pre-wrap">
        {post.content}
      </div>
    </article>
  )
}
```

```tsx
// features/post/PostDeleteDialog.tsx
import { Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type PostDeleteDialogProps = {
  onConfirm: () => void
  isPending: boolean
}

export function PostDeleteDialog({ onConfirm, isPending }: PostDeleteDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={isPending}>
          <Trash2Icon />
          {isPending ? '삭제 중…' : '삭제'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>게시글을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            삭제한 게시글은 복구할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

```tsx
// features/post/PostErrorState.tsx — 상세·수정 페이지가 함께 쓰는 "없는 글" 화면
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { ROUTES } from '@/routes/paths'

type PostErrorStateProps = {
  error: Error | null // null = 주소의 id부터 잘못됨
}

export function PostErrorState({ error }: PostErrorStateProps) {
  const notFound =
    error === null || (error instanceof ApiError && error.status === 404)

  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12">
      <p className="text-sm text-muted-foreground">
        {notFound || !error ? '삭제되었거나 없는 게시글입니다.' : error.message}
      </p>
      <Button variant="outline" asChild>
        <Link to={ROUTES.POSTS}>목록으로</Link>
      </Button>
    </div>
  )
}
```

```tsx
// pages/PostViewPage.tsx
import { Link, useNavigate, useParams } from 'react-router'
import { ListIcon, PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PostDetail } from '@/features/post/PostDetail'
import { PostDeleteDialog } from '@/features/post/PostDeleteDialog'
import { PostErrorState } from '@/features/post/PostErrorState'
import {
  isValidPostId,
  useDeletePostMutation,
  usePostQuery,
} from '@/features/post/queries'
import { AttachmentList } from '@/features/file/AttachmentList'
import { CommentSection } from '@/features/comment/CommentSection'
import { ROUTES, toPostEdit } from '@/routes/paths'

export function PostViewPage() {
  const postId = Number(useParams().id)
  const navigate = useNavigate()
  const { data: post, isPending, isError, error } = usePostQuery(postId)
  const deletePost = useDeletePostMutation()

  if (!isValidPostId(postId)) return <PostErrorState error={null} />
  if (isPending)
    return <p className="py-12 text-center text-sm">불러오는 중…</p>
  if (isError) return <PostErrorState error={error} />

  const handleDelete = () =>
    deletePost.mutate(post.id, {
      // replace: 뒤로가기로 삭제된 글에 돌아오지 않게
      onSuccess: () => navigate(ROUTES.POSTS, { replace: true }),
    })

  return (
    <div className="flex flex-col gap-6">
      <PostDetail post={post} />

      {/* 5주차에 연결 */}
      <AttachmentList />

      <Separator />

      {deletePost.isError && (
        <p role="alert" className="text-sm text-destructive">
          {deletePost.error.message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link to={ROUTES.POSTS}>
            <ListIcon />
            목록
          </Link>
        </Button>
        {/* 4주차: 내 글일 때만 수정 · 삭제 버튼 표시 */}
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={toPostEdit(post.id)}>
              <PencilIcon />
              수정
            </Link>
          </Button>
          <PostDeleteDialog
            onConfirm={handleDelete}
            isPending={deletePost.isPending}
          />
        </div>
      </div>

      <Separator />

      {/* 5주차에 연결 */}
      <CommentSection />
    </div>
  )
}
```

**🔍 원리**
- **훅은 항상 먼저, 조기 반환은 그다음**: React 훅은 매 렌더링마다 같은 순서로 불려야 한다. `if (...) return` 아래에 `useDeletePostMutation()`을 두면 "Rendered more hooks than during the previous render" 에러가 난다.
- 조기 반환 순서 `잘못된 id → 로딩 → 에러`: `isPending`·`isError`를 거친 뒤에는 TypeScript가 `post`를 "반드시 있음"으로 좁혀 준다.
- 404를 따로 처리했다. 1주차 백엔드는 **없는 글·숨김 글·삭제된 글을 모두 404 + P001**로 준다. 사용자에게 "에러"보다 "없는 글"이 맞는 안내다. 수정 페이지도 같은 화면을 쓰므로 `PostErrorState`로 뺐다.
- `whitespace-pre-wrap`: 본문의 줄바꿈을 그대로 보여준다. `dangerouslySetInnerHTML`로 HTML을 넣지 않는 이유는 **XSS**(글에 스크립트를 넣는 공격) 때문이다.
- `window.confirm` 대신 **`AlertDialog`**: 브라우저 기본 확인창은 디자인을 바꿀 수 없고 테스트도 어렵다. `AlertDialogAction`을 누르면 창이 닫히며 `onConfirm`이 불린다.
- 삭제 실패는 `alert()`가 아니라 **화면에 한 줄**(`deletePost.error.message`)로 보여준다. 4주차에 "본인 글만 삭제할 수 있습니다"(403)가 이 자리에 뜬다.
- 삭제 성공 후 `replace: true`로 이동: 뒤로가기를 눌러도 삭제된 글 상세로 돌아가지 않는다.
- **"(수정됨)" 표시를 넣지 않은 이유**: 1주차 `increaseViewCount()`가 엔티티 필드를 바꾸므로 **조회할 때마다 `updated_at`도 바뀐다**(JPA 변경 감지 + `@LastModifiedDate`). `updatedAt !== createdAt`으로 판단하면 한 번 읽힌 글이 전부 "수정됨"으로 보인다. 제대로 하려면 조회수를 벌크 UPDATE 쿼리로 올려야 한다(🚀 선택 과제).
- 조회수: 이 페이지를 열 때마다 백엔드가 +1한다. StrictMode 개발 환경에서도 `useQuery`는 요청을 한 번만 보내고, `staleTime` 30초 안에 다시 들어오면 캐시를 쓴다. 운영에서 조회수 중복 방지(같은 사용자 하루 1회 등)는 별도 설계가 필요하다.
- `AttachmentList`, `CommentSection`은 5주차까지 껍데기로 둔다.

**✔ 확인**
- [ ] 목록에서 제목 클릭 → 상세, 작성자·작성일시·조회수 표시
- [ ] `/posts/99999` → "삭제되었거나 없는 게시글입니다." + 목록으로 버튼
- [ ] `/posts/abc` → 요청 없이 같은 안내 (Network 탭 확인)
- [ ] 삭제 → 확인창 → 목록으로 이동, 삭제한 글이 목록에서 사라짐(새로고침 없이)
- [ ] 삭제 후 뒤로가기 → 삭제된 글 상세로 돌아가지 않음

---

## 11 · 공통 폼 · 작성 · 수정

**🎯 목표**: 이미 있는 `PostForm`에 react-hook-form + zod를 연결하고, 서버 400(`fields`)을 입력창 아래에 표시하며, 저장 중 중복 제출을 막는다.

**🤔 왜 지금**: 5번 스키마와 8번 훅이 모두 준비됐다. 폼을 공통으로 쓰면 검증·에러 표시 규칙이 한 곳에 모인다.

**📄 파일**: `features/post/PostForm.tsx`, `pages/PostWritePage.tsx`, `pages/PostEditPage.tsx` (모두 수정)

```tsx
// features/post/PostForm.tsx
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FileUploader } from '@/features/file/FileUploader'
import { ApiError } from '@/lib/api-client'
import { postFormSchema, type PostFormValues } from './schema'

type PostFormProps = {
  mode: 'create' | 'edit'
  cancelTo: string
  defaultValues?: PostFormValues
  onSubmit: (values: PostFormValues) => Promise<unknown>
}

const EMPTY_VALUES: PostFormValues = { title: '', content: '' }

export function PostForm({
  mode,
  cancelTo,
  defaultValues = EMPTY_VALUES,
  onSubmit,
}: PostFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues,
  })

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        // 서버 검증 실패(400) → 해당 입력창 아래에 표시
        for (const [name, message] of Object.entries(e.fields)) {
          setError(name as keyof PostFormValues, { message })
        }
        return
      }
      setError('root', {
        message: e instanceof Error ? e.message : '저장하지 못했습니다.',
      })
    }
  })

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          maxLength={200}
          placeholder="제목을 입력하세요"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          {...register('title')}
        />
        {errors.title && (
          <p id="title-error" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="content">내용</Label>
        <Textarea
          id="content"
          placeholder="내용을 입력하세요"
          className="min-h-80 resize-y"
          aria-invalid={!!errors.content}
          aria-describedby={errors.content ? 'content-error' : undefined}
          {...register('content')}
        />
        {errors.content && (
          <p id="content-error" className="text-sm text-destructive">
            {errors.content.message}
          </p>
        )}
      </div>

      {/* 5주차에 연결 */}
      <FileUploader />

      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link to={cancelTo}>취소</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '저장 중…' : mode === 'create' ? '등록' : '수정'}
        </Button>
      </div>
    </form>
  )
}
```

```tsx
// pages/PostWritePage.tsx
import { useNavigate } from 'react-router'
import { PostForm } from '@/features/post/PostForm'
import { useCreatePostMutation } from '@/features/post/queries'
import { ROUTES, toPostDetail } from '@/routes/paths'

export function PostWritePage() {
  const navigate = useNavigate()
  const createPost = useCreatePostMutation()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">글쓰기</h1>
      <PostForm
        mode="create"
        cancelTo={ROUTES.POSTS}
        onSubmit={async (values) => {
          const id = await createPost.mutateAsync(values)
          navigate(toPostDetail(id), { replace: true })
        }}
      />
    </div>
  )
}
```

```tsx
// pages/PostEditPage.tsx
import { useNavigate, useParams } from 'react-router'
import { PostForm } from '@/features/post/PostForm'
import { PostErrorState } from '@/features/post/PostErrorState'
import {
  isValidPostId,
  usePostQuery,
  useUpdatePostMutation,
} from '@/features/post/queries'
import { toPostDetail } from '@/routes/paths'

export function PostEditPage() {
  const postId = Number(useParams().id)
  const navigate = useNavigate()
  const { data: post, isPending, isError, error } = usePostQuery(postId)
  const updatePost = useUpdatePostMutation(postId)

  if (!isValidPostId(postId)) return <PostErrorState error={null} />
  if (isPending)
    return <p className="py-12 text-center text-sm">불러오는 중…</p>
  if (isError) return <PostErrorState error={error} />

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">글 수정</h1>
      <PostForm
        key={post.id}
        mode="edit"
        cancelTo={toPostDetail(post.id)}
        defaultValues={{ title: post.title, content: post.content }}
        onSubmit={async (values) => {
          await updatePost.mutateAsync(values)
          navigate(toPostDetail(post.id), { replace: true })
        }}
      />
    </div>
  )
}
```

**🔍 원리**
- **`register` vs shadcn `Form`**: 이 프로젝트에는 shadcn `form` 컴포넌트가 없다. 대신 `{...register('title')}`로 `Input`에 직접 연결하고, `Label htmlFor` ↔ `Input id`로 라벨을 잇는다. 에러 문구는 `aria-describedby`로 입력창과 연결하고, `aria-invalid`를 주면 shadcn `Input`이 빨간 테두리를 그린다(`aria-invalid:border-destructive` 클래스가 이미 들어 있음).
- **중복 제출 방지**: `handleSubmit`에 `async` 함수를 넘기면 react-hook-form이 그 Promise가 끝날 때까지 `isSubmitting = true`로 둔다. 버튼을 `disabled`로 묶으면 더블클릭해도 요청이 한 번만 나간다. `mutateAsync`를 `await`해야 이 원리가 동작한다(`mutate`는 기다리지 않음).
- **에러 두 겹**: zod(클라이언트)가 먼저 막고, 통과했는데 서버가 400을 주면 `ApiError.fields`를 `setError`로 **같은 자리**에 표시한다. 사용자는 어느 쪽 검증인지 몰라도 된다. 키 이름(`title`)이 백엔드 DTO 필드명과 같아서 그대로 연결된다.
- 필드 에러가 아닌 서버 에러(500, 네트워크)는 `root` 에러로 폼 아래에 한 줄 표시한다.
- `noValidate`: 브라우저 기본 검증 말풍선을 끄고 zod 메시지만 쓴다.
- `key={post.id}`: 다른 글 수정으로 바로 이동했을 때 폼을 새로 만들어 `defaultValues`가 다시 적용되게 한다. `defaultValues`는 **처음 한 번만** 읽히기 때문이다. 그래서 데이터가 **온 뒤에** 폼을 그린다.
- 수정 페이지도 상세 API를 부르므로 조회수가 오른다. 1주차 설계의 한계로 두고, 필요하면 백엔드에 조회수를 올리지 않는 API를 따로 두는 게 실무 해법이다(선택 과제).
- 등록 성공 후 `replace`로 상세 이동: 뒤로가기 했을 때 빈 글쓰기 폼으로 돌아가지 않는다.
- `FileUploader`는 5주차까지 껍데기로 둔다(파일을 골라도 아직 전송되지 않는다).

**✔ 확인**
- [ ] 제목·내용 입력 후 등록 → 상세로 이동, 목록에도 새 글 반영
- [ ] 빈 제목 제출 → 서버 요청 없이 "제목은 필수입니다.", 입력창 테두리 빨강
- [ ] 개발자도구에서 `maxLength` 속성을 지우고 201자 입력 → zod가 막음
- [ ] zod `max(200)`을 잠시 `max(300)`으로 바꾸고 250자 제출 → **서버 400 메시지가 입력창 아래에** 표시 (확인 후 원래대로)
- [ ] 개발자도구 Network 탭 **Slow 3G**에서 등록 버튼 연타 → 요청 1건만
- [ ] 수정 → 상세에 반영 / 취소 → 상세로

---

## 12 · 테스트 (Vitest + Testing Library)

**🎯 목표**: 스키마·쿼리스트링 단위 테스트, 목록 화면 테스트(정상·쿼리스트링·검색·에러), 폼 테스트(빈 값·서버 400)를 작성한다.

**🤔 왜 지금**: 화면을 다 만들고 수동으로 확인한 내용을 코드로 옮긴다. 1주차 백엔드와 같은 순서다.

**📄 파일**: `src/test/renderWithProviders.tsx`, `features/post/schema.test.ts`, `features/post/search-params.test.ts`, `features/post/PostForm.test.tsx`, `pages/PostListPage.test.tsx`

`vite.config.ts`의 `test` 설정(jsdom, `globals`, `setupFiles`)과 `src/test/setup.ts`는 **이미 있다**. 테스트 파일은 대상 파일 옆에 둔다.

```tsx
// test/renderWithProviders.tsx
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  // 테스트마다 새 캐시. retry: false → 에러 테스트가 재시도로 느려지지 않게
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
```

```ts
// features/post/schema.test.ts
import { describe, expect, it } from 'vitest'
import { postFormSchema } from './schema'

describe('postFormSchema', () => {
  it('공백만 있는 제목은 실패한다', () => {
    const r = postFormSchema.safeParse({ title: '   ', content: '내용' })
    expect(r.success).toBe(false)
  })

  it('제목 201자는 실패한다', () => {
    const r = postFormSchema.safeParse({
      title: 'a'.repeat(201),
      content: '내용',
    })
    expect(r.success).toBe(false)
  })

  it('정상 값은 통과하고 앞뒤 공백을 제거한다', () => {
    const r = postFormSchema.parse({ title: '  제목 ', content: '내용' })
    expect(r.title).toBe('제목')
  })
})
```

```ts
// features/post/search-params.test.ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_POST_LIST_PARAMS,
  parsePostListParams,
  toPostSearchParams,
} from './search-params'

describe('parsePostListParams', () => {
  it('쿼리스트링이 없으면 기본값', () => {
    expect(parsePostListParams(new URLSearchParams())).toEqual({
      page: 1,
      size: '10',
      sort: 'id,desc',
      searchType: 'all',
      keyword: '',
    })
  })

  it('허용하지 않는 값은 기본값으로 바꾼다', () => {
    const params = parsePostListParams(
      new URLSearchParams('page=-3&size=999&sort=password,asc&searchType=x'),
    )
    expect(params).toEqual(DEFAULT_POST_LIST_PARAMS)
  })

  it('올바른 값은 그대로 읽는다', () => {
    const params = parsePostListParams(
      new URLSearchParams(
        'page=2&size=20&sort=viewCount,desc&searchType=title&keyword= spring ',
      ),
    )
    expect(params).toEqual({
      page: 2,
      size: '20',
      sort: 'viewCount,desc',
      searchType: 'title',
      keyword: 'spring',
    })
  })
})

describe('toPostSearchParams', () => {
  it('기본값은 URL에서 뺀다', () => {
    const sp = toPostSearchParams({
      ...DEFAULT_POST_LIST_PARAMS,
      page: 2,
      keyword: '점검',
    })
    expect([...sp.keys()]).toEqual(['page', 'keyword'])
    expect(sp.get('keyword')).toBe('점검')
  })
})
```

```tsx
// pages/PostListPage.test.tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fetchPosts } from '@/features/post/api'
import type { Post } from '@/features/post/schema'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/renderWithProviders'
import { PostListPage } from './PostListPage'

vi.mock('@/features/post/api')

const samplePost: Post = {
  id: 1,
  writerId: 1,
  writerNickname: '테스터',
  title: '첫 글',
  content: '내용',
  viewCount: 3,
  createdAt: '2026-10-06T10:00:00',
  updatedAt: '2026-10-06T10:00:00',
}

const pageOf = (content: Post[]) => ({
  content,
  page: 0,
  size: 10,
  totalElements: content.length,
  totalPages: content.length > 0 ? 1 : 0,
  last: true,
})

describe('PostListPage', () => {
  it('목록을 보여준다', async () => {
    vi.mocked(fetchPosts).mockResolvedValue(pageOf([samplePost]))
    renderWithProviders(<PostListPage />, { route: '/posts' })

    expect(await screen.findByText('첫 글')).toBeInTheDocument()
    expect(screen.getByText('테스터')).toBeInTheDocument()
  })

  it('쿼리스트링을 그대로 API 조건으로 쓴다', async () => {
    vi.mocked(fetchPosts).mockResolvedValue(pageOf([]))
    renderWithProviders(<PostListPage />, {
      route: '/posts?page=2&sort=viewCount,desc&keyword=spring',
    })

    expect(
      await screen.findByText('"spring" 검색 결과가 없습니다.'),
    ).toBeInTheDocument()
    expect(fetchPosts).toHaveBeenLastCalledWith({
      page: 2,
      size: '10',
      sort: 'viewCount,desc',
      searchType: 'all',
      keyword: 'spring',
    })
  })

  it('검색하면 1페이지부터 다시 조회한다', async () => {
    vi.mocked(fetchPosts).mockResolvedValue(pageOf([samplePost]))
    renderWithProviders(<PostListPage />, { route: '/posts?page=3' })

    await userEvent.type(
      await screen.findByRole('searchbox', { name: '검색어' }),
      'spring',
    )
    await userEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() =>
      expect(fetchPosts).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, keyword: 'spring' }),
      ),
    )
  })

  it('서버 에러면 메시지와 다시 시도 버튼을 보여준다', async () => {
    vi.mocked(fetchPosts).mockRejectedValue(
      new ApiError(500, { code: 'C999', message: '서버 오류가 발생했습니다.' }),
    )
    renderWithProviders(<PostListPage />, { route: '/posts' })

    expect(
      await screen.findByText('서버 오류가 발생했습니다.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })
})
```

```tsx
// features/post/PostForm.test.tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { renderWithProviders } from '@/test/renderWithProviders'
import { PostForm } from './PostForm'

describe('PostForm', () => {
  it('빈 값으로 제출하면 에러를 보여주고 onSubmit을 부르지 않는다', async () => {
    const onSubmit = vi.fn()
    renderWithProviders(
      <PostForm mode="create" cancelTo="/posts" onSubmit={onSubmit} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '등록' }))

    expect(await screen.findByText('제목은 필수입니다.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('서버 400의 fields를 입력창 아래에 보여준다', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(400, {
        code: 'C001',
        message: '입력값이 올바르지 않습니다.',
        fields: { title: '금지어가 포함되어 있습니다.' },
      }),
    )
    renderWithProviders(
      <PostForm mode="create" cancelTo="/posts" onSubmit={onSubmit} />,
    )

    await userEvent.type(screen.getByLabelText('제목'), '제목')
    await userEvent.type(screen.getByLabelText('내용'), '내용')
    await userEvent.click(screen.getByRole('button', { name: '등록' }))

    expect(
      await screen.findByText('금지어가 포함되어 있습니다.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('제목')).toHaveAttribute('aria-invalid', 'true')
  })
})
```

**🔍 원리**
- **`vi.mock('@/features/post/api')`**: `api.ts`의 모든 함수를 가짜(`vi.fn()`)로 바꾼다. 컴포넌트 → `queries.ts` → (가짜) `api.ts` 순서로 진짜 코드가 돌고, 서버만 없다. 테스트마다 `mockResolvedValue`/`mockRejectedValue`로 응답을 정한다. 2번에서 "컴포넌트는 훅만, 훅은 api.ts만"으로 층을 나눈 덕분에 **자를 자리가 한 곳**이다.
- `toHaveBeenLastCalledWith(...)`: "쿼리스트링 → zod → Query Key → API 함수" 연결을 한 번에 검증한다. URL을 바꾸는 테스트가 곧 쿼리스트링 규칙 테스트다.
- 테스트마다 **새 QueryClient**를 만드는 이유: 캐시가 테스트끼리 섞이지 않게. `retry: false`가 없으면 에러 테스트가 재시도 때문에 느려진다.
- `findBy...`는 "나타날 때까지 기다린다"(비동기), `getBy...`는 "지금 있어야 한다". 서버 응답 뒤에 그려지는 것은 `findBy`.
- `getByLabelText('제목')`가 동작하는 건 `Label htmlFor="title"`과 `Input id="title"`이 연결돼 있어서다. **테스트하기 쉬운 마크업 = 접근성이 좋은 마크업**이다.
- `search-params.test.ts`처럼 **순수 함수**는 화면 없이 바로 테스트한다. 가장 빠르고 가장 많이 써야 하는 테스트다.
- axios 인터셉터(`ApiError` 변환) 자체를 검증하고 싶으면 MSW(네트워크 가로채기)가 필요하다. 4주차 401 재발급 테스트에서 도입한다.

**✔ 확인**: `pnpm test` → 전부 통과. `pnpm lint`, `pnpm build`도 에러 없이.

---

## 🔧 안 될 때 체크리스트

- **CORS 에러** → `VITE_API_BASE_URL`이 `http://localhost:8080/api`처럼 절대 주소인가? `/api`여야 프록시를 탄다(1번).
- **`/api/posts`가 404 HTML** → `vite.config.ts` 수정 후 dev 서버를 재시작했나? 백엔드가 켜져 있나?
- **환경변수를 바꿨는데 그대로** → `.env.development`는 dev 서버 **시작할 때** 읽는다. 재시작.
- **`ZodError: Invalid input ... path: ["data","content",0,"writerId"]`** → 백엔드 응답 필드명과 `postSchema`가 다르다. 에러의 `path`가 틀린 필드를 알려준다(5번).
- **`erasableSyntaxOnly` 관련 컴파일 에러** → 생성자 매개변수에 `public`/`readonly`를 붙였나(3번)?
- **등록했는데 목록이 그대로** → `onSuccess`의 `invalidateQueries` 키가 `postKeys.lists()`인가? 키 배열 앞부분이 일치해야 한다(8번).
- **정렬을 바꿨는데 500** → `sort` 값이 엔티티 필드명(`id`, `viewCount`)인가? DB 컬럼명(`view_count`)이 아니다(6번).
- **검색 범위 "제목"을 골라도 내용까지 검색됨** → 정상. 1주차 백엔드가 `searchType`을 아직 모른다(7번, 🚀).
- **"Rendered more hooks than during the previous render"** → `if (...) return`보다 아래에서 훅을 불렀다(10번).
- **수정 폼이 비어 있음** → `defaultValues`는 처음 한 번만 적용. 데이터가 온 뒤에 폼을 그리고 `key`를 줬나(11번)?
- **서버 400인데 입력창 아래 표시가 안 됨** → 백엔드 `fields`의 키 이름과 `register('...')` 이름이 같은가?
- **페이지 번호를 누르면 전체 새로고침** → `onClick`에서 `preventDefault` 했나(9번)?

## 🧠 스스로 설명해보기

1. Vite 프록시를 쓰면 왜 CORS가 생기지 않나? 6주차 Nginx와 어떤 점이 같은가?
2. 타입 선언만 있을 때와 zod로 응답을 `parse`할 때, 서버가 필드명을 바꾸면 각각 어떻게 되나?
3. `postKeys.lists()`로 invalidate하면 어떤 캐시들이 새로 고쳐지나?
4. 게시글 목록을 zustand에 저장하면 어떤 문제가 생기나?
5. 페이지·정렬·검색어를 `useState`가 아니라 URL에 둔 이유는? URL 값을 zod로 한 번 더 거르는 이유는?
6. 저장 버튼 더블클릭이 막히는 원리는? `mutate`를 쓰면 왜 안 막히나?
7. 서버 400의 `fields`가 입력창 아래까지 오는 경로를 axios → 폼 순서로 설명해 보자.
8. 조회할 때마다 `updated_at`이 바뀌는 이유는? "(수정됨)" 표시를 제대로 하려면 백엔드를 어떻게 바꿔야 하나?

## 🚀 여유가 있다면

- [ ] **검색 범위 백엔드 연결**: `PostController`에 `@RequestParam(required = false) String searchType` 추가, `PostRepository.search`의 조건을 `searchType`별(title / content / 둘 다)로 분기
- [ ] 조회수를 `@Modifying @Query("update Post p set p.viewCount = p.viewCount + 1 where p.id = :id")`로 올려 `updated_at`이 안 바뀌게 → 상세에 "(수정됨)" 표시
- [ ] 홈(`HomePage`)의 "최근 게시글" 카드에 `usePostListQuery(DEFAULT_POST_LIST_PARAMS)`로 최신 5개 표시
- [ ] 목록 로딩을 스켈레톤 UI로 바꾸기 (퍼블리싱 강점 살리기)
- [ ] 검색어 하이라이트 (`<mark>` 사용, `dangerouslySetInnerHTML` 없이)
- [ ] 목록 응답에서 본문(`content`)을 빼는 `PostSummaryResponse`를 백엔드에 추가하고 스키마 분리
