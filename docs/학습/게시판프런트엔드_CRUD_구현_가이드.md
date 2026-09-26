# 게시판 프런트엔드 CRUD 구현 가이드

> 목표: 이 문서만 읽고 **코드를 보지 않고 게시판 화면(목록·상세·작성·수정·삭제)을 처음부터 다시 짤 수 있게** 되는 것.
>
> 백엔드 가이드(`게시판백엔드_CRUD_구현_가이드.md`)와 같은 방식으로, **"무엇을 → 어떤 순서로 → 왜 이렇게"** 를 설명합니다.
> 백엔드에서 배운 개념과 **짝을 맞춰서** 설명하니, 백엔드 가이드를 먼저 읽으면 훨씬 쉽습니다.

---

## 0. 한 장 요약

### 0-1. 버튼 하나 눌렀을 때 일어나는 일

사용자가 목록 화면에 들어오면 이렇게 흘러갑니다.

```
[페이지 컴포넌트]   PostListPage           ← "무엇을 보여줄지"만 앎
      │ ① usePostList({ page: 0, size: 10 })   훅 호출
      ▼
[React Query 훅]    queries.ts             ← "언제 가져올지, 캐시에 있으면 재사용할지"
      │ ② postApi.list(...)
      ▼
[API 함수]          api.ts                 ← "어느 URL에 어떤 메서드로 보낼지"만 앎
      │ ③ apiClient.get('/posts')
      ▼
[axios 인스턴스]    lib/api-client.ts      ← "주소 앞부분, 에러 모양 통일"
      │ ④ GET /api/posts   (Vite 프록시가 8080으로 전달)
      ▼
[Spring Boot]       PostController (백엔드)
      │ ⑤ { success: true, data: { content: [...], page: 0, ... } }
      ▼
  다시 거꾸로 올라와서 → 화면에 표 그리기
```

### 0-2. 백엔드와 짝 맞추기 ★

프런트엔드도 **백엔드와 똑같이 역할을 나눕니다.** 이름만 다를 뿐 생각하는 방식이 같습니다.

| 프런트엔드 | 하는 일 | 백엔드의 짝 |
|---|---|---|
| **페이지** (`PostListPage`) | 화면 그리기, 버튼 처리 | **Controller** (요청 받고 응답 주는 창구) |
| **Query 훅** (`queries.ts`) | 언제 서버에 물어볼지, 결과를 기억(캐시) | **Service** (일의 흐름 관리) |
| **API 함수** (`api.ts`) | URL·메서드만 알고 요청을 보냄 | **Repository** (DB에 쿼리 보내는 창구) |
| **타입** (`types.ts`) | 서버가 주는 데이터 모양 | **Response DTO** |
| **zod 스키마** (`schema.ts`) | 입력값 검증 규칙 | **Request DTO + `@NotBlank`, `@Size`** |
| **axios 인스턴스** (`api-client.ts`) | 모든 에러를 한 모양(`ApiError`)으로 | **GlobalExceptionHandler** |
| **공통 응답 타입** (`api-types.ts`) | `{ success, data, error }` 모양 | **ApiResponse, PageResponse** |

> **핵심 한 줄:** 페이지는 "무엇을 보여줄지", React Query는 "언제 다시 가져올지", axios는 "어떻게 요청하고 에러를 어떤 모양으로 바꿀지"만 책임진다.

### 0-3. 폴더 구조

```
frontend/
├── vite.config.ts                     # 프록시 설정 (/api → 8080)
├── .env.development                   # VITE_API_BASE_URL=/api
└── src/
    ├── main.tsx                       # 앱 시작점: QueryClient + Router 연결
    ├── app/
    │   └── router.tsx                 # 주소 ↔ 페이지 연결표
    ├── components/
    │   ├── layout/RootLayout.tsx      # 공통 헤더 + 페이지 자리(Outlet)
    │   └── ui/                        # shadcn 컴포넌트 (button, input, textarea, label)
    ├── lib/                           # 모든 기능이 같이 쓰는 것 (백엔드의 global/)
    │   ├── api-types.ts               # ApiResponse, PageResponse 타입
    │   ├── api-client.ts              # axios 인스턴스 + ApiError + unwrap
    │   └── queryClient.ts             # React Query 설정
    ├── features/
    │   └── posts/                     # 게시글 기능 (백엔드의 post/)
    │       ├── types.ts               # Post 타입
    │       ├── schema.ts              # 작성/수정 폼 검증 규칙
    │       ├── api.ts                 # 서버 요청 함수 5개
    │       ├── queries.ts             # React Query 훅 5개
    │       └── components/
    │           └── PostForm.tsx       # 작성·수정이 같이 쓰는 폼
    └── pages/                         # 주소 하나 = 페이지 하나
        ├── PostListPage.tsx           # /posts
        ├── PostDetailPage.tsx         # /posts/:id
        ├── PostWritePage.tsx          # /posts/new
        └── PostEditPage.tsx           # /posts/:id/edit
```

> **규칙:**
> - 기능별로 `features/posts/`에 모읍니다. 나중에 댓글은 `features/comments/`가 옆에 생깁니다.
> - `lib/`, `components/ui/`는 공통 부품입니다. `features`는 `lib`을 가져다 쓸 수 있지만, **`lib`은 `features`를 import하지 않습니다.** (공통 부품이 특정 기능에 묶이지 않게)
> - 페이지는 **훅만** 씁니다. 페이지에서 `axios`나 `api.ts`를 직접 부르지 않습니다.

---

## 1. 먼저 알아야 할 개념 6가지

코드보다 이 6개를 먼저 이해하면, 코드는 "그 개념을 적은 것"일 뿐이 됩니다.

### 개념 ① 컴포넌트 = 화면을 그리는 함수

```tsx
function Hello({ name }: { name: string }) {
  return <p>안녕 {name}</p>
}
```

- React 컴포넌트는 **데이터를 받아 화면(JSX)을 돌려주는 함수**입니다.
- 데이터가 바뀌면 React가 함수를 **다시 실행**해서 화면을 새로 그립니다. 우리가 직접 DOM을 고치지 않습니다.
- `useState`, `useQuery`처럼 `use`로 시작하는 함수를 **훅(Hook)** 이라고 합니다. "이 컴포넌트에 기능을 걸어준다"는 뜻입니다.

### 개념 ② 서버 상태 vs 클라이언트 상태

| 종류 | 예시 | 누가 관리? |
|---|---|---|
| **서버 상태** | 게시글 목록, 게시글 상세 | **React Query** |
| **클라이언트 상태** | 검색창에 치고 있는 글자, 모달 열림 여부 | `useState` (여러 화면이 공유하면 Zustand) |

게시글은 **원본이 서버(DB)에 있습니다.** 화면은 "잠깐 빌려온 복사본"을 보여줄 뿐입니다.
복사본은 언제든 낡을 수 있으니(다른 사람이 글을 썼을 수도), **"언제 다시 가져올지"를 관리해 주는 도구**가 필요합니다. 그게 React Query입니다.

> 게시글 목록을 `useState`나 Zustand에 복사해 두면 "글을 등록했는데 목록이 안 바뀌어요" 문제가 생깁니다. 서버 데이터는 React Query에 맡깁니다.

### 개념 ③ React Query의 캐시와 Query Key

React Query는 서버에서 가져온 데이터를 **이름표(Query Key)를 붙여서 기억(캐시)** 해 둡니다.

```
['posts', 'list', { page: 0, size: 10 }]   → 1페이지 목록 데이터
['posts', 'list', { page: 1, size: 10 }]   → 2페이지 목록 데이터
['posts', 'detail', 3]                     → 3번 글 상세 데이터
```

- 같은 이름표로 다시 요청하면 **서버에 안 가고 기억해 둔 것을 바로** 보여줍니다. (빠름)
- 글을 등록/수정/삭제하면 "이 이름표 데이터는 이제 낡았어" 라고 알려줘야 합니다 → **`invalidateQueries`**
- 이름표가 **배열의 앞부분부터 일치**하면 한꺼번에 걸립니다.
  `invalidateQueries({ queryKey: ['posts', 'list'] })` → 1페이지, 2페이지, 검색 결과… **모든 목록**이 낡음 처리.

| 용어 | 뜻 |
|---|---|
| `useQuery` | **읽기** (GET). 자동으로 요청하고 로딩/에러/데이터 상태를 줌 |
| `useMutation` | **쓰기** (POST/PUT/DELETE). 버튼 누를 때 실행 |
| `invalidateQueries` | "이 캐시는 낡았다. 화면에 쓰이고 있으면 다시 가져와" |
| `removeQueries` | "이 캐시는 아예 지워" (삭제된 글 상세처럼 다시 가져올 필요 없을 때) |

### 개념 ④ axios 인터셉터 = 요청/응답 중간에 끼어드는 함수

```
요청 → [요청 인터셉터] → 서버 → [응답 인터셉터] → 우리 코드
```

- 응답 인터셉터에서 **실패 응답을 전부 `ApiError` 하나의 모양으로** 바꿉니다.
- 그러면 화면 코드는 `error.status`, `error.message`, `error.fields`만 보면 됩니다.
- 백엔드의 `GlobalExceptionHandler`와 같은 역할입니다. (4주차 로그인 때는 여기에 "토큰 붙이기"만 추가하면 됩니다.)

### 개념 ⑤ URL이 곧 상태 (페이지 번호, 검색어)

```
/posts?page=2&keyword=스프링
```

- 페이지 번호·검색어를 `useState`에 두면 **새로고침, 뒤로가기, 링크 공유 때 사라집니다.**
- **URL 쿼리스트링**에 두면 상세 페이지 갔다가 뒤로 와도 그대로 2페이지·검색 결과입니다.
- 백엔드의 `@RequestParam`, `Pageable`이 쿼리스트링을 읽었던 것처럼, 프런트도 쿼리스트링을 읽어서 그대로 서버에 넘깁니다.

### 개념 ⑥ 검증은 두 겹 (zod + 서버)

| 위치 | 도구 | 목적 |
|---|---|---|
| 프런트 | zod + react-hook-form | **사용자 편의** — 서버 가기 전에 바로 알려줌 |
| 백엔드 | `@Valid` + `@NotBlank` | **보안** — 개발자도구로 프런트 검증을 우회해도 막음 |

둘 중 하나만 있으면 안 됩니다. 그리고 **규칙 숫자가 같아야** 합니다.
`DB VARCHAR(200)` = 백엔드 `@Size(max = 200)` = 프런트 `max(200)`

---

## 2. 작성 순서 — 왜 이 순서인가?

**원칙: "통신 → 데이터 → 화면" 순서로, 아래에서 위로 쌓는다.**

백엔드에서 Entity → Repository → Service → Controller 순서로 쌓았던 것과 같습니다.
화면(페이지)부터 만들면 아직 없는 훅, 타입을 import 하느라 빨간 줄 투성이가 됩니다.

| 순서 | 만들 것 | 한 줄 이유 | 백엔드의 짝 |
|---|---|---|---|
| 0 | 패키지 · 프록시 · 환경변수 | 서버랑 대화가 되어야 뭐든 확인 가능 | build.gradle, application.yml |
| 1 | 공통 응답 타입 + axios 인스턴스 | 모든 요청이 이걸 사용 | ApiResponse, GlobalExceptionHandler |
| 2 | QueryClient + 라우터 + 레이아웃 | 페이지를 만들자마자 주소로 들어가 확인하려고 | — |
| 3 | 타입 + zod 스키마 | API 함수와 폼이 사용 | DTO |
| 4 | API 함수 (`api.ts`) | 훅이 사용 | Repository |
| 5 | Query 훅 (`queries.ts`) | 페이지가 사용 | Service |
| 6 | 목록 페이지 | 데이터가 보여야 나머지 확인 가능 | Controller |
| 7 | 상세 + 삭제 | 목록에서 들어갈 곳 | |
| 8 | 공통 폼 + 작성 + 수정 | 스키마와 훅이 다 준비됨 | |
| 9 | 테스트 | 손으로 확인한 걸 코드로 | |

---

## 3. 단계별 설명 (코드 + 왜)

### STEP 0. 준비 — 패키지, 프록시, 환경변수

#### 0-1. 필요한 도구

이 프로젝트에는 대부분 이미 설치되어 있습니다. 없는 것만 추가합니다.

```bash
cd frontend
pnpm dlx shadcn@latest add input textarea label    # 입력창 UI 컴포넌트 (button은 이미 있음)
pnpm add -D msw                                     # 테스트용 가짜 서버 (STEP 9)
```

| 도구 | 역할 |
|---|---|
| `react-router` | 주소(URL)에 따라 다른 페이지 보여주기 |
| `@tanstack/react-query` | 서버 데이터 가져오기 + 캐시 |
| `axios` | HTTP 요청 보내기 |
| `react-hook-form` | 폼 입력값·제출·에러 상태 관리 |
| `zod` + `@hookform/resolvers` | 검증 규칙 작성 + react-hook-form에 연결 |
| shadcn/ui | 버튼, 입력창 같은 UI 부품 (코드가 `components/ui/`에 복사됨) |

> **react-router 버전 주의:** 이 프로젝트는 react-router 8이라 `react-router-dom`이 아니라 **`react-router`** 에서 import 합니다.

#### 0-2. Vite 프록시 — 왜 필요한가? (CORS)

```ts
// vite.config.ts — 기존 server 설정에 proxy 추가
server: {
  port: 5175,
  proxy: {
    '/api': { target: 'http://localhost:8080', changeOrigin: true },
  },
},
```

```bash
# .env.development
VITE_API_BASE_URL=/api
```

**원리**

- 브라우저는 **출처(프로토콜 + 주소 + 포트)가 다른 서버**로 요청하는 걸 막습니다. 이걸 **CORS** 라고 합니다.
- 프런트는 `localhost:5175`, 백엔드는 `localhost:8080` → 포트가 달라서 **다른 출처** → 막힘.
- 프록시를 쓰면:
  ```
  브라우저 → localhost:5175/api/posts   (같은 출처라 안 막힘)
               └ Vite 개발 서버가 뒤에서 → localhost:8080/api/posts 로 대신 전달
  ```
- 그래서 axios 주소는 `http://localhost:8080/api`(절대 주소)가 아니라 **`/api`(상대 주소)** 여야 합니다. 절대 주소를 쓰면 프록시를 안 타고 CORS에 걸립니다.
- `VITE_`로 시작하는 환경변수만 브라우저 코드에서 `import.meta.env.VITE_API_BASE_URL`로 읽을 수 있습니다. (비밀값이 실수로 화면 코드에 들어가지 않게 하는 규칙)
- `.env`나 `vite.config.ts`를 고치면 **dev 서버를 껐다 켜야** 반영됩니다.

**확인:** 백엔드를 켜고 `pnpm dev` → 주소창에 `http://localhost:5175/api/posts` → `{"success":true,"data":{...}}`가 보이면 성공.

---

### STEP 1. 공통 응답 타입 + axios 인스턴스 — "서버와 대화하는 규칙"

#### 1-1. 공통 응답 타입

백엔드 `ApiResponse`, `PageResponse`와 **필드 이름을 똑같이** 적습니다.

```ts
// lib/api-types.ts
export type ApiErrorBody = {
  code: string
  message: string
  fields?: Record<string, string>   // 검증 실패 시 { title: '제목은 필수입니다.' }
}

export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: ApiErrorBody
}

export type PageResponse<T> = {
  content: T[]
  page: number          // 0부터 시작 (Spring 기준)
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}
```

- `<T>`(제네릭): "data 안에 뭐가 들어갈지는 쓸 때 정한다." `ApiResponse<Post>`, `ApiResponse<number>`처럼.
- `?`: 있을 수도 없을 수도 있는 필드. 성공이면 `error`가 없고, 실패면 `data`가 없습니다. (백엔드 `@JsonInclude(NON_NULL)` 때문)
- `Record<string, string>`: "키도 문자열, 값도 문자열인 객체".

#### 1-2. axios 인스턴스

```ts
// lib/api-client.ts
import axios, { AxiosError } from 'axios'
import type { ApiResponse } from './api-types'

// 화면이 다룰 에러는 딱 이 모양 하나
export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

// 실패 응답을 전부 ApiError 하나로 통일
apiClient.interceptors.response.use(
  (response) => response,                          // 성공은 그대로 통과
  (error: AxiosError<ApiResponse<unknown>>) => {
    const body = error.response?.data
    return Promise.reject(
      new ApiError(
        error.response?.status ?? 0,               // 서버가 꺼져 있으면 응답 자체가 없음 → 0
        body?.error?.code ?? 'NETWORK_ERROR',
        body?.error?.message ?? '서버에 연결할 수 없습니다.',
        body?.error?.fields,
      ),
    )
  },
)

// 성공 응답 { success, data } 에서 data만 꺼내는 도우미
export async function unwrap<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const response = await request
  return response.data.data as T
}
```

**왜 이렇게 짰나?**

| 코드 | 이유 |
|---|---|
| `axios.create` | 주소 앞부분(`/api`), 헤더, 타임아웃을 **한 번만** 설정. 모든 요청이 이 인스턴스를 씀 |
| 응답 인터셉터 | axios 원래 에러는 `err.response.data.error.fields`처럼 깊이 파고들어야 함. 페이지마다 이걸 쓰면 지옥. **한 곳에서 평평하게** 펴 줌 |
| `?.` 와 `??` | `?.` = 없으면 멈추고 undefined, `??` = 왼쪽이 null/undefined면 오른쪽 값. 서버가 꺼져서 `response`가 없어도 안 터짐 |
| `unwrap` | axios 응답은 `response.data` 안에 우리 `{ success, data }`가 있어서 `response.data.data`가 됨. 매번 쓰기 귀찮으니 함수로 |
| `extends Error` | `error.message`를 그대로 화면에 쓸 수 있고, `instanceof ApiError`로 구분 가능 |

> 헷갈리는 `data.data` 정리:
> ```
> axios 응답 객체.data  = 서버가 보낸 JSON 전체 { success: true, data: {...} }
>                .data  = 그 안의 진짜 데이터 {...}
> ```

---

### STEP 2. QueryClient + 라우터 + 레이아웃 — "앱의 뼈대"

#### 2-1. QueryClient 설정

```ts
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,                      // 실패하면 1번만 재시도
      staleTime: 30_000,             // 30초 동안은 "신선한 데이터"로 취급
      refetchOnWindowFocus: false,   // 다른 탭 갔다 와도 자동으로 다시 안 가져옴
    },
  },
})
```

- `retry: 1` — 기본값은 3번. 404(없는 글)도 3번 더 요청해서 에러 화면이 늦게 뜹니다.
- `refetchOnWindowFocus: false` — **백엔드 상세 조회가 조회수를 +1 하기 때문**에 끕니다. 켜두면 탭만 왔다 갔다 해도 조회수가 계속 오릅니다.
- `staleTime` — 이 시간 안에는 같은 데이터를 다시 요청하지 않습니다.

#### 2-2. main.tsx — 앱에 연결

```tsx
// main.tsx (이미 이렇게 되어 있음)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>   {/* ① 모든 컴포넌트가 같은 캐시 공유 */}
      <RouterProvider router={router} />         {/* ② 주소에 맞는 페이지 보여주기 */}
      <ReactQueryDevtools initialIsOpen={false} /> {/* 캐시 상태 구경하는 개발 도구 */}
    </QueryClientProvider>
  </StrictMode>,
)
```

- **Provider**는 "아래 모든 컴포넌트에게 이걸 나눠준다"는 뜻입니다. `QueryClientProvider`로 감싸야 어느 컴포넌트에서든 `useQuery`를 쓸 수 있습니다.
- 화면 오른쪽 아래 꽃 모양 아이콘(Devtools)을 누르면 **캐시에 뭐가 들어 있는지** 볼 수 있습니다. 공부할 때 매우 유용합니다.

#### 2-3. 라우터 — 주소와 페이지 연결표

```tsx
// app/router.tsx
import { createBrowserRouter, Navigate } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PostListPage } from '@/pages/PostListPage'
import { PostDetailPage } from '@/pages/PostDetailPage'
import { PostWritePage } from '@/pages/PostWritePage'
import { PostEditPage } from '@/pages/PostEditPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,                    // 모든 페이지를 감싸는 틀
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <Navigate to="/posts" replace /> },   // / → /posts
      { path: 'posts', element: <PostListPage /> },
      { path: 'posts/new', element: <PostWritePage /> },
      { path: 'posts/:id', element: <PostDetailPage /> },
      { path: 'posts/:id/edit', element: <PostEditPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
```

| 주소 | 페이지 | 백엔드 API |
|---|---|---|
| `/posts` | 목록 | `GET /api/posts` |
| `/posts/new` | 작성 | `POST /api/posts` |
| `/posts/3` | 상세 (+ 삭제 버튼) | `GET /api/posts/3`, `DELETE /api/posts/3` |
| `/posts/3/edit` | 수정 | `GET /api/posts/3`, `PUT /api/posts/3` |

- `:id` — 주소의 이 자리 값을 `useParams()`로 꺼냅니다. 백엔드 `@PathVariable`과 같습니다.
- `posts/new`와 `posts/:id` — "new"도 `:id`에 들어갈 수 있을 것 같지만, React Router는 **고정 경로를 먼저** 고릅니다. 걱정 없습니다.
- `replace` — 히스토리에 `/`를 남기지 않습니다. 안 그러면 뒤로가기 → `/` → 다시 `/posts`로 튕겨서 못 나갑니다.

> **팁:** 아직 안 만든 페이지는 `export function PostListPage() { return null }` 처럼 빈 껍데기로 먼저 만들어 두면 빨간 줄이 안 뜹니다.

#### 2-4. 레이아웃 — 공통 헤더

```tsx
// components/layout/RootLayout.tsx
import { Link, Outlet } from 'react-router'

export function RootLayout() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col">
      <header className="flex items-center border-b p-4">
        <Link to="/posts" className="font-bold">
          게시판
        </Link>
        {/* 4주차: 로그인 상태 · 로그아웃 버튼 자리 */}
      </header>
      <main className="flex-1 p-4">
        <Outlet />      {/* ← 자식 페이지가 여기 들어옴 */}
      </main>
    </div>
  )
}
```

- **`Outlet`** = "자식 라우트 페이지가 들어갈 자리". 헤더는 그대로 두고 가운데만 바뀝니다.
- **`<Link>`** vs `<a>` — `<a href>`는 페이지 전체를 새로 불러옵니다(캐시 날아감). `<Link to>`는 **화면만 바꿉니다.**

---

### STEP 3. 타입 + zod 스키마 — "데이터 모양과 검증 규칙"

#### 3-1. 타입 = 서버 응답 모양

```ts
// features/posts/types.ts — 백엔드 PostResponse와 필드명·타입을 똑같이
export type Post = {
  id: number
  writerId: number
  writerNickname: string
  title: string
  content: string
  viewCount: number
  createdAt: string    // LocalDateTime은 JSON에서 문자열 "2026-10-06T10:15:00"
  updatedAt: string
}

export type PostListParams = {
  page: number         // 서버 기준 0부터
  size: number
  keyword?: string
}
```

- 자바 `Long`, `int` → TS `number` / 자바 `String` → `string` / 자바 `LocalDateTime` → **`string`**
- 필드 이름을 한 글자라도 틀리면 화면에 `undefined`가 나옵니다. **백엔드 DTO를 옆에 켜 놓고** 적으세요.
- 타입은 **개발할 때만** 존재합니다. 실행 중에 검사하지 않습니다. (자동완성과 빨간 줄로 실수를 잡아주는 용도)

#### 3-2. zod 스키마 = 폼 검증 규칙

```ts
// features/posts/schema.ts
import { z } from 'zod'

export const postFormSchema = z.object({
  title: z
    .string()
    .trim()                                     // 앞뒤 공백 제거 → "   " 는 "" 가 됨
    .min(1, '제목은 필수입니다.')               // 백엔드 @NotBlank 와 같은 효과
    .max(200, '제목은 200자 이하여야 합니다.'), // 백엔드 @Size(max = 200) 와 같은 숫자
  content: z.string().trim().min(1, '내용은 필수입니다.'),
})

export type PostFormValues = z.infer<typeof postFormSchema>
// → { title: string; content: string } 이 자동으로 만들어짐
```

- **`z.infer`**: 스키마에서 타입을 자동으로 뽑아냅니다. 규칙과 타입이 한 곳에 있으니 필드를 추가할 때 스키마만 고치면 됩니다.
- 메시지를 **백엔드 메시지와 똑같이** 쓰면 사용자는 프런트 검증인지 서버 검증인지 구분할 필요가 없습니다.
- 백엔드 `PostCreateRequest`와 `PostUpdateRequest`가 모양이 같아서, 프런트는 **스키마 하나로 둘 다** 씁니다.

---

### STEP 4. API 함수 — "URL과 메서드만 아는 얇은 층"

```ts
// features/posts/api.ts
import { apiClient, unwrap } from '@/lib/api-client'
import type { ApiResponse, PageResponse } from '@/lib/api-types'
import type { Post, PostListParams } from './types'
import type { PostFormValues } from './schema'

export const postApi = {
  list: ({ page, size, keyword }: PostListParams) =>
    unwrap(
      apiClient.get<ApiResponse<PageResponse<Post>>>('/posts', {
        params: { page, size, keyword: keyword || undefined },
      }),
    ),

  get: (id: number) => unwrap(apiClient.get<ApiResponse<Post>>(`/posts/${id}`)),

  create: (body: PostFormValues) => unwrap(apiClient.post<ApiResponse<number>>('/posts', body)),

  update: (id: number, body: PostFormValues) =>
    unwrap(apiClient.put<ApiResponse<number>>(`/posts/${id}`, body)),

  remove: (id: number) => unwrap(apiClient.delete<ApiResponse<void>>(`/posts/${id}`)),
}
```

**백엔드 Controller와 1:1로 맞춰 보기**

| 프런트 함수 | HTTP | 백엔드 메서드 | 돌려받는 것 |
|---|---|---|---|
| `postApi.list` | `GET /posts?page=0&size=10&keyword=..` | `getList` | `PageResponse<Post>` |
| `postApi.get` | `GET /posts/{id}` | `get` | `Post` |
| `postApi.create` | `POST /posts` + body | `create` | `number` (새 글 id) |
| `postApi.update` | `PUT /posts/{id}` + body | `update` | `number` |
| `postApi.remove` | `DELETE /posts/{id}` | `delete` | 없음 |

- `params: {...}` — axios가 `?page=0&size=10` 쿼리스트링으로 바꿔 줍니다. → 백엔드 `Pageable`, `@RequestParam`이 받음
- `keyword || undefined` — 빈 문자열이면 파라미터를 아예 빼서 `?keyword=`가 안 붙습니다.
- `apiClient.get<ApiResponse<Post>>` — `< >` 안에 응답 모양을 적어주면 `unwrap` 결과가 **자동으로 `Post` 타입**이 됩니다.
- `body` — axios가 자동으로 JSON으로 바꿔서 보냅니다. → 백엔드 `@RequestBody`가 받음
- **이 파일은 캐시도, 로딩도, 화면 이동도 모릅니다.** 역할이 작을수록 고치기 쉽습니다.

---

### STEP 5. Query 훅 — "언제 가져오고, 무엇을 새로 고칠지" ★ 핵심

```ts
// features/posts/queries.ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { postApi } from './api'
import type { PostListParams } from './types'
import type { PostFormValues } from './schema'

// ① 캐시 이름표를 한 곳에서 관리
export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (params: PostListParams) => [...postKeys.lists(), params] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: number) => [...postKeys.details(), id] as const,
}

// ② 읽기: 목록
export function usePostList(params: PostListParams) {
  return useQuery({
    queryKey: postKeys.list(params),
    queryFn: () => postApi.list(params),
    placeholderData: keepPreviousData,   // 페이지 넘길 때 이전 목록을 잠깐 유지 (깜빡임 방지)
  })
}

// ③ 읽기: 상세
export function usePost(id: number) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => postApi.get(id),
    enabled: Number.isFinite(id),        // id가 숫자가 아니면 요청 자체를 안 보냄
  })
}

// ④ 쓰기: 작성
export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PostFormValues) => postApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.lists() }),
  })
}

// ⑤ 쓰기: 수정
export function useUpdatePost(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PostFormValues) => postApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.lists() })
      queryClient.invalidateQueries({ queryKey: postKeys.detail(id) })
    },
  })
}

// ⑥ 쓰기: 삭제
export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => postApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: postKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: postKeys.lists() })
    },
  })
}
```

#### 원리 ① Query Key를 "계층"으로 만든 이유

```
postKeys.all          = ['posts']
postKeys.lists()      = ['posts', 'list']
postKeys.list({...})  = ['posts', 'list', { page: 0, size: 10, keyword: '' }]
postKeys.detail(3)    = ['posts', 'detail', 3]
```

- 목록은 페이지·검색어마다 **따로** 캐시됩니다. (`params`가 키에 들어가니까)
- 글을 하나 쓰면 **모든 페이지, 모든 검색어의 목록**이 낡습니다. → `postKeys.lists()` 로 invalidate 하면 앞부분 `['posts', 'list']`가 일치하는 캐시가 전부 걸립니다.
- 키를 문자열로 여기저기 직접 쓰면 오타 하나로 "등록했는데 목록이 안 바뀜" 버그가 납니다. **한 곳(`postKeys`)에서만** 만듭니다.
- `as const` — 배열을 "읽기 전용, 정확한 값" 타입으로 고정. React Query가 키 타입을 정확히 알게 해 줍니다.

#### 원리 ② 쓰기 후 "무엇을 새로 고칠지" 표

| 동작 | 목록 캐시 | 그 글 상세 캐시 |
|---|---|---|
| 작성 | invalidate (새 글 보여야 함) | 없음 (새 글이라 캐시 없음) |
| 수정 | invalidate (제목 바뀜) | invalidate (내용 바뀜) |
| 삭제 | invalidate (목록에서 빠져야 함) | **remove** (다시 가져오면 404니까 아예 지움) |

#### 원리 ③ `useQuery`가 돌려주는 것

```ts
const { data, isPending, isError, error, refetch, isFetching } = usePostList(...)
```

| 값 | 뜻 |
|---|---|
| `data` | 서버에서 받은 데이터 (처음엔 `undefined`) |
| `isPending` | 아직 데이터가 한 번도 안 옴 (첫 로딩) |
| `isError` / `error` | 실패 여부 / 실패 내용 (우리가 만든 `ApiError`) |
| `isFetching` | 뒤에서 가져오는 중 (이전 데이터를 보여주면서) |
| `refetch()` | 지금 다시 가져와 ("다시 시도" 버튼용) |

#### 원리 ④ `useMutation`이 돌려주는 것

| 값 | 뜻 |
|---|---|
| `mutate(값, { onSuccess, onError })` | 실행 (기다리지 않음) |
| `mutateAsync(값)` | 실행 + **Promise를 돌려줌** (`await` 가능) |
| `isPending` | 실행 중 (버튼 비활성화에 사용) |

---

### STEP 6. 목록 페이지 — 페이징 · 검색 · URL 동기화

```tsx
// pages/PostListPage.tsx
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePostList } from '@/features/posts/queries'

const PAGE_SIZE = 10

export function PostListPage() {
  // ① URL에서 상태 읽기
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))   // 화면은 1부터
  const keyword = searchParams.get('keyword') ?? ''

  // ② 검색창에 치고 있는 글자 (아직 검색 안 누름)
  const [input, setInput] = useState(keyword)

  // ③ 서버 데이터
  const { data, isPending, isError, error, refetch, isFetching } = usePostList({
    page: page - 1,          // 서버는 0부터
    size: PAGE_SIZE,
    keyword,
  })

  // ④ 검색 버튼 → URL 바꾸기
  const onSearch = (e: FormEvent) => {
    e.preventDefault()                               // form 제출 시 페이지 새로고침 막기
    const next = new URLSearchParams()
    if (input.trim()) next.set('keyword', input.trim())
    next.set('page', '1')                            // 새로 검색하면 1페이지부터
    setSearchParams(next)
  }

  // ⑤ 페이지 이동 → URL 바꾸기 (검색어는 유지)
  const goPage = (p: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(p))
    setSearchParams(next)
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">게시판</h1>

      <div className="flex justify-between gap-3">
        <form onSubmit={onSearch} className="flex max-w-md flex-1 gap-2">
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

      {/* 상태 1: 첫 로딩 */}
      {isPending && <p className="py-12 text-center text-muted-foreground">불러오는 중...</p>}

      {/* 상태 2: 에러 */}
      {isError && (
        <div role="alert" className="flex flex-col items-center gap-2 py-12">
          <p>{error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      )}

      {/* 상태 3: 빈 목록 */}
      {data && data.content.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          {keyword ? `"${keyword}" 검색 결과가 없습니다.` : '첫 글을 작성해 보세요.'}
        </p>
      )}

      {/* 상태 4: 정상 */}
      {data && data.content.length > 0 && (
        <>
          <table className="w-full text-sm" aria-busy={isFetching}>
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">번호</th>
                <th className="p-2">제목</th>
                <th className="p-2">작성자</th>
                <th className="p-2">조회</th>
                <th className="p-2">작성일</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((post) => (
                <tr key={post.id} className="border-b">
                  <td className="p-2">{post.id}</td>
                  <td className="p-2">
                    <Link to={`/posts/${post.id}`} className="hover:underline">
                      {post.title}
                    </Link>
                  </td>
                  <td className="p-2">{post.writerNickname}</td>
                  <td className="p-2">{post.viewCount}</td>
                  <td className="p-2">{new Date(post.createdAt).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <nav className="flex items-center justify-center gap-3" aria-label="페이지">
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

#### 원리 ① 검색 한 번에 일어나는 연쇄 반응

```
검색 버튼 클릭
 → setSearchParams  → URL이 /posts?keyword=스프링&page=1 로 바뀜
 → 컴포넌트 다시 실행 → keyword = '스프링'
 → usePostList의 queryKey가 바뀜  ['posts','list',{page:0,size:10,keyword:'스프링'}]
 → 처음 보는 키니까 React Query가 자동으로 서버 요청
 → data가 도착 → 화면 다시 그림
```

**우리는 "URL만 바꿨을 뿐"** 인데 요청은 React Query가 알아서 보냅니다. 이게 React Query를 쓰는 이유입니다.

#### 원리 ② 두 개의 검색어

- `input` (useState): 타이핑 중인 글자. 칠 때마다 요청이 나가면 안 되니까 따로 둡니다.
- `keyword` (URL): 진짜 검색어. **검색 버튼을 눌렀을 때만** 바뀝니다.

#### 원리 ③ 1부터 vs 0부터

사람은 1페이지부터, Spring은 0페이지부터 셉니다. **변환은 이 페이지 한 곳에서만** (`page - 1`) 합니다. 여기저기서 변환하면 반드시 한 곳이 틀립니다.

#### 원리 ④ 화면 상태 4가지를 전부 만든다

로딩 / 에러 / 빈 목록 / 정상. 실무 QA에서 가장 많이 나오는 결함이 "빈 목록인데 표 머리만 덩그러니" 같은 **상태 누락**입니다.

#### 원리 ⑤ 기타 문법

- `{조건 && <화면/>}` — 조건이 참일 때만 그림. JSX의 if문.
- `.map((post) => <tr key={post.id}>…)` — 배열을 화면 줄로 바꿈. **`key`는 필수**, React가 어떤 줄이 바뀌었는지 구분하는 이름표.
- `<Button asChild><Link/></Button>` — 버튼 **모양**의 **링크**. 페이지 이동은 링크여야 새 탭 열기·접근성이 맞습니다.
- `new Date(문자열).toLocaleDateString('ko-KR')` — 서버의 날짜 문자열을 `2026. 10. 6.` 로 보여줌. 화면에 보여줄 때만 변환.

---

### STEP 7. 상세 + 삭제

```tsx
// pages/PostDetailPage.tsx
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { useDeletePost, usePost } from '@/features/posts/queries'

export function PostDetailPage() {
  const postId = Number(useParams().id)          // 주소 /posts/3 의 "3" (문자열 → 숫자)
  const navigate = useNavigate()
  const { data: post, isPending, isError, error } = usePost(postId)
  const deletePost = useDeletePost()

  if (isPending) return <p>불러오는 중...</p>

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div role="alert" className="flex flex-col gap-2">
        <p>{notFound ? '삭제되었거나 없는 게시글입니다.' : error.message}</p>
        <Link to="/posts" className="underline">
          목록으로
        </Link>
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
    <article className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{post.title}</h1>
      <p className="text-sm text-muted-foreground">
        {post.writerNickname} · 조회 {post.viewCount} ·{' '}
        {new Date(post.createdAt).toLocaleString('ko-KR')}
        {post.updatedAt !== post.createdAt && ' (수정됨)'}
      </p>
      <div className="whitespace-pre-wrap border-y py-6">{post.content}</div>

      <div className="flex gap-2">
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

**왜 이렇게 짰나?**

| 코드 | 이유 |
|---|---|
| `if (isPending) return …` (early return) | 로딩·에러를 먼저 걸러내면, 아래 코드에서는 `post`가 **반드시 있다고** TS가 알아줍니다. `post?.title` 같은 물음표가 필요 없어짐 |
| 404 따로 처리 | 백엔드는 없는 글·숨김 글·삭제된 글을 **모두 404**로 줍니다. 사용자에겐 "에러"보다 "없는 글"이 맞는 안내 |
| `whitespace-pre-wrap` | 본문 줄바꿈을 그대로 표시. `dangerouslySetInnerHTML`로 HTML을 넣지 않는 이유는 **XSS**(글에 스크립트를 심는 공격) 방지 |
| `navigate(..., { replace: true })` | 삭제 후 뒤로가기를 눌러도 **삭제된 글로 돌아가지 않게** 히스토리를 덮어씀 |
| `disabled={deletePost.isPending}` | 삭제 요청 중에 또 누르지 못하게 |
| `Number(useParams().id)` | 주소에서 꺼낸 값은 **항상 문자열**. `/posts/abc`면 `NaN` → `usePost`의 `enabled`가 요청을 막음 |

> **조회수 주의:** 이 페이지가 열릴 때마다 백엔드가 조회수 +1 합니다. 그래서 STEP 2에서 `refetchOnWindowFocus: false`를 줬습니다.

---

### STEP 8. 공통 폼 + 작성 + 수정

작성과 수정은 **입력칸이 똑같습니다.** 폼을 한 번만 만들고, "처음 값"과 "제출하면 할 일"만 바꿔 끼웁니다.

#### 8-1. 공통 폼

```tsx
// features/posts/components/PostForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api-client'
import { postFormSchema, type PostFormValues } from '../schema'

type Props = {
  defaultValues?: PostFormValues                         // 수정일 때 기존 값
  submitLabel: string                                    // '등록' 또는 '수정'
  onSubmit: (values: PostFormValues) => Promise<unknown> // 제출하면 할 일 (밖에서 정함)
}

export function PostForm({
  defaultValues = { title: '', content: '' },
  submitLabel,
  onSubmit,
}: Props) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),   // 검증은 zod 스키마로
    defaultValues,
  })

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        // 서버 400 → 해당 입력창 아래에 표시
        Object.entries(e.fields).forEach(([name, message]) =>
          setError(name as keyof PostFormValues, { message }),
        )
      } else if (e instanceof Error) {
        // 500, 네트워크 에러 → 폼 아래 한 줄
        setError('root', { message: e.message })
      }
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="title">제목</Label>
        <Input id="title" maxLength={200} {...register('title')} />
        {errors.title && (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="content">내용</Label>
        <Textarea id="content" rows={12} {...register('content')} />
        {errors.content && (
          <p role="alert" className="text-sm text-destructive">
            {errors.content.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? '저장 중...' : submitLabel}
      </Button>
    </form>
  )
}
```

#### 8-2. 작성 페이지

```tsx
// pages/PostWritePage.tsx
import { useNavigate } from 'react-router'
import { PostForm } from '@/features/posts/components/PostForm'
import { useCreatePost } from '@/features/posts/queries'

export function PostWritePage() {
  const navigate = useNavigate()
  const createPost = useCreatePost()

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">글쓰기</h1>
      <PostForm
        submitLabel="등록"
        onSubmit={async (values) => {
          const id = await createPost.mutateAsync(values)   // 서버가 새 글 id를 돌려줌
          navigate(`/posts/${id}`, { replace: true })        // 그 글 상세로 이동
        }}
      />
    </section>
  )
}
```

#### 8-3. 수정 페이지

```tsx
// pages/PostEditPage.tsx
import { useNavigate, useParams } from 'react-router'
import { PostForm } from '@/features/posts/components/PostForm'
import { usePost, useUpdatePost } from '@/features/posts/queries'

export function PostEditPage() {
  const postId = Number(useParams().id)
  const navigate = useNavigate()
  const { data: post, isPending, isError, error } = usePost(postId)
  const updatePost = useUpdatePost(postId)

  if (isPending) return <p>불러오는 중...</p>
  if (isError) return <p role="alert">{error.message}</p>

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">글 수정</h1>
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

#### 원리 ① react-hook-form 기본 3종

| 이름 | 하는 일 |
|---|---|
| `register('title')` | 입력창을 폼에 **등록**. `{...register('title')}`로 펼치면 `name`, `onChange`, `ref`가 자동으로 붙음 |
| `handleSubmit(함수)` | 제출 시 **zod 검증 먼저** → 통과해야 함수 실행. 실패하면 `errors`에 메시지 |
| `formState.errors` | 필드별 에러 메시지. `errors.title?.message` |

#### 원리 ② 더블클릭 방지 (중복 제출)

```
handleSubmit(async 함수)
 → react-hook-form이 이 Promise가 끝날 때까지 isSubmitting = true
 → 버튼 disabled={isSubmitting}
 → 연타해도 요청 1번
```

- 여기서 **`mutateAsync` + `await`** 가 중요합니다. `mutate`는 기다리지 않고 바로 끝나서, `isSubmitting`이 즉시 false가 되고 → 연타가 뚫립니다.

#### 원리 ③ 에러 두 겹이 같은 자리에 뜨는 경로

```
[클라이언트 검증 실패]
 zod → errors.title → 입력창 아래

[서버 검증 실패]
 백엔드 400 { error: { fields: { title: '제목은 필수입니다.' } } }
  → axios 인터셉터 → ApiError(fields 포함)
  → mutateAsync가 throw
  → PostForm의 catch → setError('title', …)
  → errors.title → 입력창 아래 (같은 자리!)
```

**서버 `fields`의 키(`title`) = 백엔드 DTO 필드명 = 폼 필드명** 이라서 그대로 연결됩니다. 이름을 똑같이 맞추는 이유입니다.

#### 원리 ④ 폼은 "무엇을 할지" 모른다

`PostForm`은 제출하면 `onSubmit`을 부를 뿐, 그게 작성인지 수정인지 모릅니다. **바깥(페이지)이 정해서 넘겨줍니다.** 그래서 폼 하나로 두 페이지가 해결됩니다. (백엔드에서 Service가 HTTP를 모르는 것과 같은 원리)

#### 원리 ⑤ 기타

- **`noValidate`** — 브라우저 기본 검증 말풍선을 끄고 zod 메시지만 씀.
- **`<Label htmlFor="title">` + `<Input id="title">`** — 라벨 클릭 시 입력창에 커서가 가고, 스크린리더와 테스트(`getByLabelText('제목')`)가 입력창을 찾을 수 있음.
- **`key={post.id}`** — `defaultValues`는 **처음 한 번만** 읽힙니다. 다른 글 수정으로 바로 넘어가도 `key`가 바뀌면 React가 폼을 새로 만들어서 새 값이 들어갑니다.
- **데이터가 온 뒤에 폼을 그림** — `isPending`일 때 early return 했기 때문에, 폼이 처음 만들어질 때 이미 `post`가 있습니다. 그래서 `defaultValues`가 제대로 들어갑니다.
- **`replace: true`** — 등록 후 뒤로가기를 눌러도 빈 글쓰기 폼으로 돌아가지 않음.
- 수정 페이지도 상세 API를 부르므로 **조회수가 오릅니다.** 지금 백엔드 설계의 한계입니다(나중에 개선 과제).

---

### STEP 9. 테스트 (Vitest + Testing Library + MSW)

손으로 확인한 것을 코드로 옮겨, 나중에 코드를 고쳐도 망가지지 않았는지 자동으로 확인합니다.

#### 9-1. MSW = 가짜 백엔드

```ts
// test/handlers.ts
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
  http.get('*/api/posts', () =>
    HttpResponse.json({
      success: true,
      data: { content: [samplePost], page: 0, size: 10, totalElements: 1, totalPages: 1, last: true },
    }),
  ),
]
```

```ts
// test/setup.ts
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))   // 핸들러 없는 요청은 실패 처리
afterEach(() => {
  cleanup()
  server.resetHandlers()                                            // 테스트마다 원래 응답으로
})
afterAll(() => server.close())
```

- **MSW**는 네트워크 요청을 **중간에 가로채서** 가짜 응답을 줍니다. 컴포넌트·axios·React Query는 **진짜 그대로** 동작하고 서버만 가짜입니다.
- `*/api/posts` — 주소 앞부분이 무엇이든(`http://localhost/api/posts`) 매칭.

#### 9-2. 테스트용 렌더 도우미

```tsx
// test/renderWithProviders.tsx
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
```

- 페이지는 `useQuery`, `useSearchParams`를 쓰니까 **Provider와 Router로 감싸야** 동작합니다. `main.tsx`에서 했던 걸 테스트에서도 해 주는 것.
- 테스트마다 **새 QueryClient** — 캐시가 테스트끼리 섞이지 않게. `retry: false` — 에러 테스트가 재시도로 느려지지 않게.

#### 9-3. 테스트 예시

```ts
// features/posts/schema.test.ts
import { describe, expect, it } from 'vitest'
import { postFormSchema } from './schema'

describe('postFormSchema', () => {
  it('공백만 있는 제목은 실패한다', () => {
    expect(postFormSchema.safeParse({ title: '   ', content: '내용' }).success).toBe(false)
  })

  it('제목 201자는 실패한다', () => {
    expect(postFormSchema.safeParse({ title: 'a'.repeat(201), content: '내용' }).success).toBe(false)
  })
})
```

```tsx
// pages/PostListPage.test.tsx
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/setup'
import { renderWithProviders } from '@/test/renderWithProviders'
import { PostListPage } from './PostListPage'

describe('PostListPage', () => {
  it('목록을 보여준다', async () => {
    renderWithProviders(<PostListPage />, { route: '/posts' })
    expect(await screen.findByText('첫 글')).toBeInTheDocument()
  })

  it('서버 에러면 메시지와 다시 시도 버튼을 보여준다', async () => {
    server.use(   // 이 테스트에서만 응답 바꾸기
      http.get('*/api/posts', () =>
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

- **`findBy…`** = 나타날 때까지 **기다림** (서버 응답 뒤에 그려지는 것). **`getBy…`** = 지금 **있어야 함**.
- `getByRole('button', { name: '다시 시도' })` — 사용자가 보는 방식(역할 + 글자)으로 찾습니다. **테스트하기 쉬운 마크업 = 접근성 좋은 마크업**.

실행: `pnpm test`

---

## 4. 처음부터 끝까지 따라가기 — "글쓰기"

`/posts/new`에서 제목·내용 입력 후 **등록** 클릭:

```
① PostForm: handleSubmit
   - zod 검증 (제목 비었나? 200자 넘나?) → 실패하면 입력창 아래 메시지, 여기서 끝
   - 통과 → isSubmitting = true → 버튼 "저장 중..." + 비활성화

② PostWritePage의 onSubmit
   - createPost.mutateAsync({ title, content })

③ queries.ts useCreatePost
   - mutationFn → postApi.create(body)

④ api.ts
   - apiClient.post('/posts', body)

⑤ api-client.ts (axios)
   - baseURL '/api' 붙여서 → POST /api/posts
   - Vite 프록시 → localhost:8080/api/posts

⑥ 백엔드
   - PostController.create → @Valid → PostService.create → DB INSERT
   - 201 { success: true, data: 7 }

⑦ 돌아오는 길
   - unwrap → 7
   - useCreatePost onSuccess → invalidateQueries(['posts','list'])  ← 목록 캐시 "낡음" 표시
   - mutateAsync 결과 7 → navigate('/posts/7', { replace: true })

⑧ /posts/7
   - usePost(7) → 캐시 없음 → GET /api/posts/7 → 상세 화면

⑨ "목록" 클릭
   - 목록 캐시가 낡음 표시되어 있으니 → 다시 가져옴 → 새 글이 맨 위에!
```

---

## 5. 혼자 다시 짜기 — 체크리스트

코드를 지우고 다시 짤 때 이 순서대로 체크하세요. **괄호 안 키워드만 기억하면 됩니다.**

- [ ] **0. 준비** — 백엔드 켜기, (`vite.config.ts` proxy `/api` → 8080), (`.env.development` `VITE_API_BASE_URL=/api`), shadcn `input textarea label` 추가
  - [ ] 확인: `localhost:5175/api/posts` 에서 JSON 보임
- [ ] **1. 통신 규칙**
  - [ ] `api-types.ts`: `ApiResponse<T>` (success, data?, error?), `PageResponse<T>` (content, page, size, totalElements, totalPages, last)
  - [ ] `api-client.ts`: `ApiError`(status, code, message, fields) + `axios.create` + **응답 인터셉터** + `unwrap`
- [ ] **2. 뼈대**
  - [ ] `queryClient`: `retry: 1`, `refetchOnWindowFocus: false`
  - [ ] `router.tsx`: `/` → `Navigate /posts`, `posts`, `posts/new`, `posts/:id`, `posts/:id/edit`
  - [ ] `RootLayout`: 헤더 + `<Outlet />`
  - [ ] 페이지 4개 빈 껍데기
- [ ] **3. 데이터 모양**
  - [ ] `types.ts`: `Post` (백엔드 PostResponse와 똑같이), `PostListParams`
  - [ ] `schema.ts`: `z.object` + `.trim().min(1).max(200)` + `z.infer`
- [ ] **4. `api.ts`** — `postApi` { list, get, create, update, remove }, `unwrap(apiClient.메서드<ApiResponse<T>>(...))`
- [ ] **5. `queries.ts`**
  - [ ] `postKeys` (all → lists → list(params) / details → detail(id))
  - [ ] `usePostList` (`keepPreviousData`), `usePost` (`enabled`)
  - [ ] `useCreatePost` / `useUpdatePost` / `useDeletePost` + `onSuccess`에서 invalidate / remove
- [ ] **6. 목록** — `useSearchParams`, `input`(useState) vs `keyword`(URL), `page - 1`, **4가지 상태**, 이전/다음
- [ ] **7. 상세** — `useParams` → `Number`, early return, 404 안내, `confirm` → `mutate` → `navigate(replace)`
- [ ] **8. 폼**
  - [ ] `PostForm`: `useForm` + `zodResolver`, `register`, `handleSubmit(async)`, catch → `setError`, `isSubmitting`
  - [ ] 작성: `mutateAsync` → 받은 id로 이동
  - [ ] 수정: `usePost` → early return → `PostForm key defaultValues` → `mutateAsync` → 이동
- [ ] **9. 테스트** — MSW `handlers` + `setupServer`, `renderWithProviders`, `findBy` / `getByRole`

### 연습 방법 추천

1. **1회차**: 이 문서를 옆에 켜 두고 따라 치기
2. **2회차**: 체크리스트(5장)만 보고 치기. 막히면 해당 STEP만 다시 보기
3. **3회차**: 아무것도 안 보고 치기. 다 쓰고 `pnpm build`(타입 검사)와 브라우저로 확인
4. **응용**: 같은 방식으로 **댓글** 화면 만들어 보기 — `features/comments/`에 types → schema → api → queries 순서 그대로

---

## 6. 자주 막히는 문제와 원인

| 증상 | 원인 | 해결 |
|---|---|---|
| 콘솔에 **CORS 에러** | axios `baseURL`이 `http://localhost:8080/api` 같은 절대 주소 | `/api`로 바꿔서 프록시를 타게 |
| `/api/posts`가 JSON 대신 **HTML/404** | 프록시 설정 후 dev 서버 재시작 안 함, 또는 백엔드 꺼짐 | `pnpm dev` 재시작, 백엔드 `bootRun` 확인 |
| `import.meta.env.VITE_...`가 `undefined` | `.env.development` 위치가 `package.json` 옆이 아님 / 이름이 `VITE_`로 안 시작 / 재시작 안 함 | 위치·이름 확인 후 재시작 |
| `'react-router-dom'` 모듈을 찾을 수 없음 | react-router 8은 패키지가 합쳐짐 | `from 'react-router'` |
| `@/components/ui/input` 을 찾을 수 없음 | shadcn 컴포넌트를 추가 안 함 | `pnpm dlx shadcn@latest add input textarea label` |
| 화면에 **`undefined`** 가 뜸 | 타입의 필드명이 백엔드 DTO와 다름 (예: `nickname` vs `writerNickname`) | 백엔드 `PostResponse`와 비교 |
| **등록했는데 목록이 그대로** | `onSuccess`에서 invalidate 안 함 / 키가 다름 | `postKeys.lists()` 로 invalidate |
| 2페이지 누르면 **3번째 글부터** 나옴 | 1부터/0부터 변환을 두 번 함 | 변환은 목록 페이지에서 `page - 1` 한 번만 |
| **조회수가 계속 오름** | `refetchOnWindowFocus` 켜져 있음 / 수정 페이지도 조회 | `false`로. 수정 페이지는 현재 설계상 한계 |
| **수정 폼이 비어 있음** | 데이터 오기 전에 폼을 그림 (`defaultValues`는 처음 한 번만) | `isPending` early return + `key={post.id}` |
| **더블클릭하면 글이 2개** | `mutate`를 씀 (기다리지 않음) | `await mutateAsync` |
| 서버 400인데 **입력창 아래 표시 안 됨** | 서버 `fields` 키와 폼 필드 이름이 다름 / `GlobalExceptionHandler`가 `fields`를 안 보냄 | 이름 맞추기, 백엔드 응답 확인 |
| 삭제 후 목록으로 갔다가 **뒤로가기하면 404** | `navigate`에 `replace` 안 줌 | `navigate('/posts', { replace: true })` |

---

## 7. 백엔드와 반드시 맞춰야 하는 것 (계약)

프런트와 백엔드는 **약속(계약)** 으로 연결됩니다. 한쪽을 바꾸면 다른 쪽도 바꿔야 합니다.

| 항목 | 백엔드 | 프런트 |
|---|---|---|
| 기본 주소 | `@RequestMapping("/api/posts")` | `baseURL: '/api'` + `'/posts'` |
| 응답 껍데기 | `ApiResponse { success, data, error }` | `ApiResponse<T>` 타입 + `unwrap` |
| 페이지 응답 | `PageResponse { content, page, size, totalElements, totalPages, last }` | `PageResponse<T>` 타입 |
| 페이지 번호 | 0부터 | 화면 1부터 → 보낼 때 `-1` |
| 글 필드 | `PostResponse` (id, writerId, writerNickname, title, content, viewCount, createdAt, updatedAt) | `Post` 타입 |
| 제목 길이 | `@Size(max = 200)` | `z.string().max(200)` |
| 필수값 | `@NotBlank` | `.trim().min(1)` |
| 에러 필드 | `error.fields { 필드명: 메시지 }` | `ApiError.fields` → `setError(필드명)` |
| 작성 응답 | `201`, `data: 새 글 id` | `mutateAsync` 결과로 상세 이동 |
| 없는 글 | `404`, `P001` | `error.status === 404` → "없는 게시글" |

> 이 표가 머릿속에 있으면, 프런트 코드는 **"백엔드가 주는 모양을 받아서 화면에 그린다"** 라는 한 문장으로 정리됩니다.
