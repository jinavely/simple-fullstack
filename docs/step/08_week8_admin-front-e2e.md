# 8주차 · 관리자 화면 + E2E + 재배포 + 회고 (11/16~21 · 12h)

> 7주차 관리자 API를 화면으로 만들고, Playwright로 핵심 흐름을 자동 검증한 뒤 재배포하고 회고한다.
> 각 단계는 **🎯 목표 → 🤔 왜 지금 → 📄 파일 → ⌨️ 코드 → 🔍 원리 → ✔ 확인** 순서.

---

## 🗺 전체 흐름

```text
/admin (AdminRoute: role === 'ADMIN' 아니면 차단)
 └ AdminLayout (사이드바)
    ├ /admin               대시보드 카드         GET /api/admin/dashboard
    ├ /admin/users         회원 관리 Data Table  GET /api/admin/users?조건
    │     검색 폼 ⇄ URL 쿼리스트링(useSearchParams) ⇄ Query Key
    │     행 선택 → 정지/해제 (확인 다이얼로그) → invalidate
    │     엑셀 버튼 → 같은 조건으로 blob 다운로드
    └ /admin/posts         게시글 관리           체크박스 일괄 숨김/공개/삭제

E2E (Playwright): 실제 브라우저 + 실제 백엔드(docker compose)로
  ① 회원가입 → 로그인 → 글쓰기 → 댓글 → 로그아웃
  ② 관리자 로그인 → 회원 검색 → 새로고침 후 조건 유지 → 엑셀 다운로드
```

**핵심 한 줄**: 관리자 목록 화면의 상태(검색 조건·페이지·정렬)는 **전부 URL**에 둔다. URL → Query Key → API 파라미터가 한 줄로 이어지면 새로고침·뒤로가기·링크 공유가 공짜로 된다.

## 📋 순서표

| # | 할 일 | 파일 | 끝나면 확인할 것 |
|---|---|---|---|
| 1 | 관리자 라우트 가드 · 레이아웃 | `AdminRoute.tsx`, `AdminLayout.tsx`, `router.tsx` | 일반 사용자 차단 |
| 2 | 관리자 API · 타입 | `features/admin/api.ts`, `types.ts` | 컴파일 OK |
| 3 | URL ⇄ 검색 조건 훅 | `useSearchCondition.ts` | 조건이 URL에 반영 |
| 4 | 대시보드 카드 | `AdminDashboardPage.tsx` | 숫자 8개 |
| 5 | 회원 검색 폼 | `UserSearchForm.tsx` | 검색·초기화 |
| 6 | Data Table · 행 선택 | `DataTable.tsx`, `userColumns.tsx` | 정렬·전체 선택 |
| 7 | 확인 다이얼로그 · 상태 변경 | `ConfirmDialog.tsx`, `AdminUsersPage.tsx` | 정지 후 목록 갱신 |
| 8 | 게시글 일괄 처리 | `AdminPostsPage.tsx` | 3건 숨김 → 선택 해제 |
| 9 | 엑셀 다운로드 (blob) | `downloadBlob.ts` | 한글 파일명 · 에러 처리 |
| 10 | Playwright E2E | `e2e/*.spec.ts` | 2개 시나리오 통과 |
| 11 | 재배포 · 회귀 테스트 | `deploy.sh`, `smoke.sh` | 운영 통과 |
| 12 | 함정 노트 · 전체 회고 · 포트폴리오 | 노션 · README | 문서 완성 |

---

## 1 · 관리자 라우트 가드 · 레이아웃

**🎯 목표**: `/admin` 아래는 ADMIN만 들어가고, 사이드바 레이아웃을 공유한다.

**📄 파일**: `src/features/admin/AdminRoute.tsx`, `AdminLayout.tsx`, `AdminLayout.module.css`, `src/app/router.tsx`

```tsx
// features/admin/AdminRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/authStore'

export default function AdminRoute() {
  const { status, user } = useAuthStore()
  const location = useLocation()

  if (status === 'checking') return <p>권한 확인 중...</p>
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (user?.role !== 'ADMIN') return <p role="alert">접근 권한이 없습니다.</p>
  return <Outlet />
}
```

```tsx
// features/admin/AdminLayout.tsx
import { NavLink, Outlet } from 'react-router-dom'
import styles from './AdminLayout.module.css'

const menus = [
  { to: '/admin', label: '대시보드', end: true },
  { to: '/admin/users', label: '회원 관리' },
  { to: '/admin/posts', label: '게시글 관리' },
]

export default function AdminLayout() {
  return (
    <div className={styles.wrap}>
      <aside className={styles.side}>
        <nav aria-label="관리자 메뉴">
          {menus.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end}
              className={({ isActive }) => (isActive ? styles.active : styles.link)}>
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className={styles.content}>
        <Outlet />
      </section>
    </div>
  )
}
```

```tsx
// app/router.tsx — Layout children에 추가
{
  path: 'admin',
  element: <AdminRoute />,
  children: [
    {
      element: <AdminLayout />,
      children: [
        { index: true, element: <AdminDashboardPage /> },
        { path: 'users', element: <AdminUsersPage /> },
        { path: 'posts', element: <AdminPostsPage /> },
      ],
    },
  ],
},
```

**🔍 원리**
- 4주차 `ProtectedRoute`에 **권한 한 단계**를 더한 것이다: 확인 중 → 비로그인 → 권한 없음 → 통과.
- 권한 없음은 로그인 페이지로 보내지 않는다. 이미 로그인했으므로 로그인 페이지는 의미가 없다. 403 안내가 맞다.
- **화면 가드는 편의, 보안은 서버**(7주차 `@PreAuthorize`). 개발자도구로 zustand의 role을 ADMIN으로 바꿔도 API는 403이다.
- `NavLink`의 `end`: `/admin`이 `/admin/users`에서도 활성 표시되지 않게 정확히 일치할 때만 활성.
- 헤더(`Layout.tsx`)에 `user.role === 'ADMIN'`일 때만 "관리자" 링크를 보여준다.

**✔ 확인**: 일반 사용자로 `/admin` → "접근 권한이 없습니다", 관리자는 사이드바 표시.

---

## 2 · 관리자 API · 타입

**📄 파일**: `src/features/admin/types.ts`, `src/features/admin/api.ts`

```ts
// features/admin/types.ts — 7주차 DTO와 필드명 일치
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN'

export type AdminUser = {
  id: number; loginId: string; nickname: string; email: string
  role: 'USER' | 'ADMIN'; status: UserStatus
  createdAt: string; lastLoginAt: string | null; deletedAt: string | null
}

export type AdminUserCondition = {
  keyword?: string; status?: UserStatus; role?: 'USER' | 'ADMIN'
  joinedFrom?: string; joinedTo?: string   // 'YYYY-MM-DD'
}

export type AdminPost = {
  id: number; title: string; writerId: number; writerLoginId: string; writerNickname: string
  viewCount: number; hidden: boolean; createdAt: string
}

export type AdminPostCondition = {
  keyword?: string; writer?: string; hidden?: 'true' | 'false'; from?: string; to?: string
}

export type Paging = { page: number; size: number; sort?: string } // sort: 'createdAt,desc'

export type DashboardSummary = {
  totalUsers: number; activeUsers: number; suspendedUsers: number; newUsersToday: number
  totalPosts: number; hiddenPosts: number; newPostsToday: number; newCommentsToday: number
}
```

```ts
// features/admin/api.ts
const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) // 빈 값은 파라미터에서 제외

export const adminApi = {
  dashboard: () => unwrap(api.get<ApiResponse<DashboardSummary>>('/admin/dashboard')),

  users: (cond: AdminUserCondition, paging: Paging) =>
    unwrap(api.get<ApiResponse<PageResponse<AdminUser>>>('/admin/users', { params: clean({ ...cond, ...paging }) })),
  suspend: (id: number) => unwrap(api.patch<ApiResponse<void>>(`/admin/users/${id}/suspend`)),
  activate: (id: number) => unwrap(api.patch<ApiResponse<void>>(`/admin/users/${id}/activate`)),
  changeRole: (id: number, role: 'USER' | 'ADMIN') =>
    unwrap(api.patch<ApiResponse<void>>(`/admin/users/${id}/role`, { role })),
  usersExcel: (cond: AdminUserCondition) =>
    api.get<Blob>('/admin/users/excel', { params: clean(cond), responseType: 'blob' }),

  posts: (cond: AdminPostCondition, paging: Paging) =>
    unwrap(api.get<ApiResponse<PageResponse<AdminPost>>>('/admin/posts', { params: clean({ ...cond, ...paging }) })),
  hidePosts: (ids: number[]) => unwrap(api.patch<ApiResponse<number>>('/admin/posts/hidden', { ids })),
  showPosts: (ids: number[]) => unwrap(api.patch<ApiResponse<number>>('/admin/posts/visible', { ids })),
  deletePosts: (ids: number[]) => unwrap(api.post<ApiResponse<number>>('/admin/posts/delete', { ids })),
}
```

**🔍 원리**
- `clean()`: `status=` 같은 빈 파라미터를 보내면 Spring이 빈 문자열을 enum으로 바꾸려다 400이 난다. **값이 있는 조건만** 보낸다. 백엔드의 "null이면 조건 제외"와 짝을 이룬다.
- 엑셀은 `unwrap`을 쓰지 않는다. 응답이 JSON이 아니라 **파일(blob)**이기 때문이다(9번).
- 날짜는 문자열 `'YYYY-MM-DD'`로 주고받는다. `<input type="date">`의 값 형식과 백엔드 `@DateTimeFormat(iso = DATE)`가 정확히 같아서 변환이 필요 없다.

**✔ 확인**: 컴파일 OK.

---

## 3 · URL ⇄ 검색 조건 훅

**🎯 목표**: 검색 조건·페이지·정렬을 URL 쿼리스트링과 양방향으로 연결하는 **재사용 훅**을 만든다.

**🤔 왜 지금**: 회원·게시글 두 화면이 똑같은 로직을 쓴다. 2주차 목록에서 직접 짰던 코드를 일반화한다.

**📄 파일**: `src/shared/hooks/useSearchCondition.ts`

```ts
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

type Options = { defaultSize?: number; defaultSort?: string }

export function useSearchCondition<C extends Record<string, string | undefined>>(
  keys: (keyof C & string)[],
  { defaultSize = 20, defaultSort = 'createdAt,desc' }: Options = {},
) {
  const [params, setParams] = useSearchParams()

  const condition = useMemo(() => {
    const c = {} as C
    keys.forEach((k) => {
      const v = params.get(k)
      if (v) (c as Record<string, string>)[k] = v
    })
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const paging = useMemo(
    () => ({
      page: Math.max(0, Number(params.get('page') ?? 1) - 1), // URL 1부터, 서버 0부터
      size: Number(params.get('size') ?? defaultSize),
      sort: params.get('sort') ?? defaultSort,
    }),
    [params, defaultSize, defaultSort],
  )

  /** 새 조건으로 검색: 페이지는 1로 초기화 */
  const search = useCallback(
    (next: Partial<C>) => {
      const p = new URLSearchParams()
      Object.entries(next).forEach(([k, v]) => v && p.set(k, String(v)))
      if (params.get('sort')) p.set('sort', params.get('sort')!)
      p.set('page', '1')
      setParams(p)
    },
    [params, setParams],
  )

  const setPage = useCallback(
    (page: number) => {
      const p = new URLSearchParams(params)
      p.set('page', String(page + 1))
      setParams(p)
    },
    [params, setParams],
  )

  const setSort = useCallback(
    (sort: string) => {
      const p = new URLSearchParams(params)
      p.set('sort', sort)
      p.set('page', '1')
      setParams(p)
    },
    [params, setParams],
  )

  const reset = useCallback(() => setParams(new URLSearchParams()), [setParams])

  return { condition, paging, search, setPage, setSort, reset }
}
```

**🔍 원리**
- **URL이 유일한 진실**: 조건을 `useState`와 URL 두 곳에 두면 어긋난다. URL만 두고, 화면은 URL을 읽어서 그린다. 검색 버튼 → URL 변경 → `condition`·`paging`이 새로 계산 → Query Key가 바뀜 → 자동 재조회. 한 방향으로만 흐른다.
- **새 검색이면 1페이지로**: 5페이지에서 조건을 바꿨는데 페이지가 5로 남으면 "결과 없음"이 뜨는 결함이 흔하다.
- **정렬 바꾸면 1페이지로**: 같은 이유.
- `useMemo`: URL이 같으면 같은 객체를 돌려줘서 Query Key가 불필요하게 바뀌지 않는다.
- 이 훅이 SI 화면 요구사항 단골인 "상세 갔다 뒤로 오면 검색 조건 유지"를 해결한다.

**✔ 확인**: 5·6번과 함께 확인.

---

## 4 · 대시보드 카드

**📄 파일**: `src/features/admin/pages/AdminDashboardPage.tsx`

```tsx
export default function AdminDashboardPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.dashboard,
    refetchInterval: 60_000, // 1분마다 자동 갱신
  })

  if (isPending) return <div className={styles.grid}>{Array.from({ length: 8 }, (_, i) => <div key={i} className={styles.skeleton} />)}</div>
  if (isError) return <Button onClick={() => refetch()}>다시 시도</Button>

  const cards = [
    { label: '전체 회원', value: data.totalUsers },
    { label: '활성 회원', value: data.activeUsers },
    { label: '정지 회원', value: data.suspendedUsers, link: '/admin/users?status=SUSPENDED' },
    { label: '오늘 가입', value: data.newUsersToday },
    { label: '전체 게시글', value: data.totalPosts },
    { label: '숨김 게시글', value: data.hiddenPosts, link: '/admin/posts?hidden=true' },
    { label: '오늘 게시글', value: data.newPostsToday },
    { label: '오늘 댓글', value: data.newCommentsToday },
  ]

  return (
    <div className={styles.grid}>
      {cards.map((c) => {
        const body = (<><span>{c.label}</span><strong>{c.value.toLocaleString()}</strong></>)
        return c.link
          ? <Link key={c.label} to={c.link} className={styles.card}>{body}</Link>
          : <div key={c.label} className={styles.card}>{body}</div>
      })}
    </div>
  )
}
```

**🔍 원리**
- 카드 링크가 **검색 조건이 담긴 URL**이다(`?status=SUSPENDED`). 3번 훅 덕분에 목록 페이지가 그 조건으로 바로 열린다. URL이 상태라서 가능한 연결이다.
- 로딩은 스켈레톤(회색 상자)으로: 레이아웃이 튀지 않는다. 퍼블리싱 강점 포인트.
- "밀릴 때 줄이는 순서" 1순위 기능이다.

**✔ 확인**: 정지 회원 카드 클릭 → 회원 관리가 "정지" 조건으로 열림.

---

## 5 · 회원 검색 폼

**📄 파일**: `src/features/admin/components/UserSearchForm.tsx`

```tsx
type Props = { value: AdminUserCondition; onSearch: (c: AdminUserCondition) => void; onReset: () => void }

export default function UserSearchForm({ value, onSearch, onReset }: Props) {
  const [form, setForm] = useState<AdminUserCondition>(value)
  useEffect(() => setForm(value), [value])   // 뒤로가기 등으로 URL이 바뀌면 폼도 따라감

  const set = (k: keyof AdminUserCondition) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value || undefined }))

  return (
    <form className={styles.form} onSubmit={(e) => { e.preventDefault(); onSearch(form) }}>
      <Input aria-label="검색어" placeholder="아이디·닉네임·이메일" value={form.keyword ?? ''} onChange={set('keyword')} />
      <select aria-label="상태" value={form.status ?? ''} onChange={set('status')}>
        <option value="">상태 전체</option>
        <option value="ACTIVE">정상</option>
        <option value="SUSPENDED">정지</option>
        <option value="WITHDRAWN">탈퇴</option>
      </select>
      <select aria-label="권한" value={form.role ?? ''} onChange={set('role')}>
        <option value="">권한 전체</option>
        <option value="USER">일반</option>
        <option value="ADMIN">관리자</option>
      </select>
      <input type="date" aria-label="가입일 시작" value={form.joinedFrom ?? ''} onChange={set('joinedFrom')} />
      <span>~</span>
      <input type="date" aria-label="가입일 종료" value={form.joinedTo ?? ''} onChange={set('joinedTo')}
             min={form.joinedFrom} />
      <Button type="submit">검색</Button>
      <Button type="button" variant="outline" onClick={onReset}>초기화</Button>
    </form>
  )
}
```

**🔍 원리**
- 폼 입력값(로컬 `useState`)과 적용된 조건(URL)을 분리: 타이핑 중에는 요청이 나가지 않고 **검색 버튼**에서만 URL이 바뀐다.
- `useEffect(() => setForm(value), [value])`: 뒤로가기로 URL 조건이 바뀌면 **입력창도 그 값으로** 돌아간다. 이게 없으면 목록은 이전 조건인데 입력창은 새 값인 어긋남이 생긴다.
- `min={form.joinedFrom}`: 종료일이 시작일보다 앞서지 않게 브라우저가 막는다.
- 빈 선택(`''`)은 `undefined`로 바꿔 `clean()`에서 빠지게 한다.

**✔ 확인**: 조건 입력 → 검색 → URL에 조건 반영 → 새로고침 → **입력창과 결과 모두 유지**.

---

## 6 · Data Table · 행 선택

**🎯 목표**: TanStack Table + shadcn Table로 정렬·체크박스 선택이 되는 표를 만든다.

**📄 파일**: `npx shadcn@latest add table checkbox`, `npm i @tanstack/react-table`, `src/shared/ui/DataTable.tsx`, `src/features/admin/userColumns.tsx`

```tsx
// shared/ui/DataTable.tsx — 서버 페이징·정렬용 공통 표
import { type ColumnDef, flexRender, getCoreRowModel, type RowSelectionState, useReactTable } from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

type Props<T> = {
  data: T[]
  columns: ColumnDef<T>[]
  getRowId: (row: T) => string
  rowSelection: RowSelectionState
  onRowSelectionChange: (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void
  sort?: string                          // 'createdAt,desc'
  onSortChange?: (sort: string) => void
  emptyText?: string
}

export function DataTable<T>({ data, columns, getRowId, rowSelection, onRowSelectionChange,
                               sort, onSortChange, emptyText = '결과가 없습니다.' }: Props<T>) {
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { rowSelection },
    onRowSelectionChange,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,              // 페이징은 서버가
    manualSorting: true,                 // 정렬도 서버가
  })

  const [sortField, sortDir] = (sort ?? '').split(',')

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => {
              const sortable = h.column.columnDef.meta?.sortField as string | undefined
              const active = sortable && sortable === sortField
              return (
                <TableHead key={h.id}
                  aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {sortable && onSortChange ? (
                    <button type="button"
                      onClick={() => onSortChange(`${sortable},${active && sortDir === 'desc' ? 'asc' : 'desc'}`)}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  ) : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow><TableCell colSpan={columns.length}>{emptyText}</TableCell></TableRow>
        ) : table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

```tsx
// features/admin/userColumns.tsx
export const selectColumn = <T,>(): ColumnDef<T> => ({
  id: 'select',
  header: ({ table }) => (
    <Checkbox aria-label="현재 페이지 전체 선택"
      checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && 'indeterminate')}
      onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)} />
  ),
  cell: ({ row }) => (
    <Checkbox aria-label="행 선택" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />
  ),
})

const statusLabel = { ACTIVE: '정상', SUSPENDED: '정지', WITHDRAWN: '탈퇴' } as const
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('ko-KR') : '-')

export const userColumns: ColumnDef<AdminUser>[] = [
  selectColumn<AdminUser>(),
  { accessorKey: 'loginId', header: '아이디', meta: { sortField: 'loginId' } },
  { accessorKey: 'nickname', header: '닉네임', meta: { sortField: 'nickname' } },
  { accessorKey: 'email', header: '이메일' },
  { accessorKey: 'role', header: '권한' },
  { accessorKey: 'status', header: '상태', cell: ({ row }) => statusLabel[row.original.status] },
  { accessorKey: 'createdAt', header: '가입일', meta: { sortField: 'createdAt' }, cell: ({ row }) => fmt(row.original.createdAt) },
  { accessorKey: 'lastLoginAt', header: '마지막 로그인', meta: { sortField: 'lastLoginAt' }, cell: ({ row }) => fmt(row.original.lastLoginAt) },
]
```

**🔍 원리**
- **TanStack Table은 "머리 없는(headless)" 라이브러리**다. 정렬·선택 **상태와 로직**만 주고 마크업은 우리가 그린다. 그래서 shadcn `Table`(마크업)과 조합한다. 퍼블리셔 입장에서는 스타일을 완전히 통제할 수 있다.
- `manualPagination`·`manualSorting`: 데이터 전체가 브라우저에 있지 않으므로 표가 직접 자르거나 정렬하지 않는다. 정렬 헤더를 누르면 `onSortChange` → URL `sort` 변경 → 서버 재조회.
- 정렬 가능한 컬럼은 `meta.sortField`에만 둔다. 7주차 서버 화이트리스트(`createdAt`, `lastLoginAt`, `loginId`, `nickname`)와 **같은 목록**이다. 이메일 헤더는 정렬 버튼이 없다.
- `getRowId`: 선택 상태를 **행 번호가 아니라 데이터 id**로 기억한다. 기본값(0, 1, 2)이면 정렬이 바뀔 때 엉뚱한 행이 선택된 채로 남는다.
- 전체 선택 체크박스의 `indeterminate`(일부 선택): 접근성 속성 `aria-sort`와 함께 목록 화면 완성도를 높이는 디테일이다.
- 요구사항 결정: **페이지를 넘기면 선택을 해제**한다(7번). 여러 페이지에 걸친 선택은 "몇 건이 선택됐는지" 사용자가 잊기 쉬워 사고가 난다. 이런 규칙을 먼저 목록으로 정리해 AI에게 주면 빠진 동작 없이 만들어 준다.

**✔ 확인**: 헤더 클릭 → ▼/▲ 전환 + URL `sort` 변경, 전체 선택·일부 선택 표시.

---

## 7 · 확인 다이얼로그 · 상태 변경

**📄 파일**: `npx shadcn@latest add alert-dialog`, `src/shared/ui/ConfirmDialog.tsx`, `src/features/admin/pages/AdminUsersPage.tsx`

```tsx
// shared/ui/ConfirmDialog.tsx
type Props = {
  open: boolean; title: string; description: string; confirmLabel?: string
  destructive?: boolean; pending?: boolean
  onConfirm: () => void; onOpenChange: (open: boolean) => void
}

export function ConfirmDialog({ open, title, description, confirmLabel = '확인', destructive, pending, onConfirm, onOpenChange }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={(e) => { e.preventDefault(); onConfirm() }}
            className={destructive ? 'bg-destructive text-destructive-foreground' : undefined}>
            {pending ? '처리 중...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

```tsx
// features/admin/pages/AdminUsersPage.tsx
const KEYS = ['keyword', 'status', 'role', 'joinedFrom', 'joinedTo'] as const

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const { condition, paging, search, setPage, setSort, reset } =
    useSearchCondition<Record<(typeof KEYS)[number], string | undefined>>([...KEYS])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [action, setAction] = useState<'suspend' | 'activate' | null>(null)

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin', 'users', condition, paging],
    queryFn: () => adminApi.users(condition as AdminUserCondition, paging),
    placeholderData: keepPreviousData,
  })

  // 조건·페이지·정렬이 바뀌면 선택 해제
  useEffect(() => setRowSelection({}), [condition, paging])

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number)
  const me = useAuthStore((s) => s.user)

  const mutation = useMutation({
    mutationFn: async (kind: 'suspend' | 'activate') => {
      const fn = kind === 'suspend' ? adminApi.suspend : adminApi.activate
      const results = await Promise.allSettled(selectedIds.map((id) => fn(id)))
      return { ok: results.filter((r) => r.status === 'fulfilled').length, total: results.length }
    },
    onSuccess: ({ ok, total }) => {
      toastOrAlert(`${total}건 중 ${ok}건 처리되었습니다.`)
      setRowSelection({})
      setAction(null)
      qc.invalidateQueries({ queryKey: ['admin'] })   // 목록 + 대시보드
    },
  })

  return (
    <section>
      <h1>회원 관리</h1>
      <UserSearchForm value={condition as AdminUserCondition} onSearch={(c) => search(c)} onReset={reset} />

      <div className={styles.toolbar}>
        <span>총 {data?.totalElements.toLocaleString() ?? 0}명 · {selectedIds.length}명 선택</span>
        <Button disabled={!selectedIds.length || selectedIds.includes(me!.id)} onClick={() => setAction('suspend')}>정지</Button>
        <Button variant="outline" disabled={!selectedIds.length} onClick={() => setAction('activate')}>정지 해제</Button>
        <ExcelButton condition={condition as AdminUserCondition} />   {/* 9번 */}
      </div>

      {isPending ? <p>불러오는 중...</p> : (
        <div aria-busy={isFetching}>
          <DataTable data={data!.content} columns={userColumns} getRowId={(u) => String(u.id)}
            rowSelection={rowSelection} onRowSelectionChange={setRowSelection}
            sort={paging.sort} onSortChange={setSort} />
          <Pager page={paging.page} totalPages={data!.totalPages} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(o) => !o && setAction(null)}
        title={action === 'suspend' ? '계정 정지' : '정지 해제'}
        description={`선택한 ${selectedIds.length}명을 ${action === 'suspend' ? '정지' : '정지 해제'}하시겠습니까?`
          + (action === 'suspend' ? ' 해당 회원은 모든 기기에서 즉시 로그아웃됩니다.' : '')}
        confirmLabel={action === 'suspend' ? '정지' : '해제'}
        destructive={action === 'suspend'}
        pending={mutation.isPending}
        onConfirm={() => action && mutation.mutate(action)}
      />
    </section>
  )
}
```

**🔍 원리**
- **일괄 처리 UX 한 세트**: ① 몇 건 선택했는지 표시 ② 실행 전 "N명을 정지하시겠습니까?" ③ 처리 중 버튼 잠금 ④ 결과 "N건 중 M건 처리" ⑤ 선택 해제 ⑥ 목록 갱신. 하나라도 빠지면 QA에서 결함으로 나온다.
- 회원 정지는 7주차 API가 **1건씩**이라 `Promise.allSettled`로 병렬 호출했다. `all`이 아니라 `allSettled`인 이유: 하나가 실패해도(예: 탈퇴 회원) 나머지 결과를 모두 받아 "10건 중 9건"을 보여주기 위해서다. 건수가 많아지면 게시글처럼 **일괄 API**를 백엔드에 만드는 게 맞다(선택 과제).
- 자기 자신이 선택에 포함되면 정지 버튼을 막는다(서버도 AD001로 막는다 — 이중 방어).
- `invalidateQueries({ queryKey: ['admin'] })`: 목록과 대시보드 캐시가 모두 `['admin', ...]`로 시작하므로 한 번에 갱신된다(2주차 계층형 Query Key).
- `AlertDialogAction`의 `e.preventDefault()`: 기본 동작은 클릭 즉시 창을 닫는다. 처리 중 표시를 보여주고 **성공한 뒤에 닫기** 위해 막았다.
- `toastOrAlert`: `npx shadcn@latest add sonner`로 토스트를 붙이거나, 우선 `alert`로 대체한다.

**✔ 확인**: 2명 선택 → 정지 → 확인창 → "2건 중 2건" → 선택 해제, 상태 컬럼 "정지", 대시보드 숫자 변경.

---

## 8 · 게시글 일괄 처리

**📄 파일**: `src/features/admin/pages/AdminPostsPage.tsx`, `postColumns.tsx`

```tsx
// 7번과 같은 구조. 다른 점만:
const KEYS = ['keyword', 'writer', 'hidden', 'from', 'to'] as const

const mutation = useMutation({
  mutationFn: (kind: 'hide' | 'show' | 'delete') =>
    ({ hide: adminApi.hidePosts, show: adminApi.showPosts, delete: adminApi.deletePosts })[kind](selectedIds),
  onSuccess: (count) => {
    toastOrAlert(`${selectedIds.length}건 중 ${count}건 처리되었습니다.`)
    setRowSelection({})
    setAction(null)
    qc.invalidateQueries({ queryKey: ['admin'] })
    qc.invalidateQueries({ queryKey: ['posts'] })   // 일반 게시판 목록도 갱신
  },
})

// postColumns: 선택 / 제목(링크: /posts/:id, 숨김이면 '숨김' 배지) / 작성자(loginId · nickname) / 조회수 / 작성일
// 검색 폼: 키워드, 작성자, 숨김 여부 select(전체/숨김/공개), 기간
// 삭제 확인 문구: "선택한 N건을 삭제하시겠습니까? 삭제한 글은 목록에서 복구할 수 없습니다."
```

**🔍 원리**
- 게시글은 7주차에 **일괄 API**(`ids` 배열, 쿼리 1번)가 있어서 요청이 한 번이다. 서버가 돌려준 **실제 처리 건수**(`count`)를 보여주면 "5건 선택했는데 이미 삭제된 2건이 있었다"를 사용자가 알 수 있다.
- 관리자 작업이 일반 화면에도 영향을 주므로 `['posts']` 캐시도 무효화한다. 캐시 키를 기능별로 설계해 둔 덕분에 영향 범위를 정확히 지정할 수 있다.
- 숨김 글 제목을 클릭하면 일반 상세(`/posts/:id`)는 404다(1주차 `findByIdAndHiddenFalse`). 관리자 상세가 필요하면 `/api/admin/posts/{id}`를 따로 만든다(선택 과제).
- 삭제는 **되돌릴 수 없다고 안내**한다(관리 화면에서 삭제 글을 볼 수 없으므로). 숨김은 되돌릴 수 있다 — 운영자에게 "먼저 숨김" 정책을 권하는 이유다.

**✔ 확인**: 3건 체크 → 숨김 → 확인 → 3건 처리, 선택 해제, 숨김 배지, 일반 게시판 목록에서 사라짐 → 다시 공개.

---

## 9 · 엑셀 다운로드 (blob)

**🎯 목표**: 현재 검색 조건 그대로 엑셀을 받고, 파일명을 헤더에서 읽으며, **에러 응답(blob)도 메시지로** 보여준다.

**📄 파일**: `src/shared/api/downloadBlob.ts`, `src/features/admin/components/ExcelButton.tsx`

```ts
// shared/api/downloadBlob.ts
import type { AxiosResponse } from 'axios'
import { ApiError } from './client'

/** Content-Disposition에서 파일명 추출 (filename*=UTF-8'' 우선) */
export function parseFilename(disposition?: string, fallback = 'download') {
  if (!disposition) return fallback
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (star) return decodeURIComponent(star[1])
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  return plain ? plain[1] : fallback
}

export function saveBlob(res: AxiosResponse<Blob>, fallback: string) {
  const name = parseFilename(res.headers['content-disposition'], fallback)
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** responseType: 'blob'이면 에러 JSON도 Blob으로 온다 → 다시 읽어서 메시지 추출 */
export async function readBlobError(e: unknown): Promise<string> {
  const data = (e as { response?: { data?: unknown } })?.response?.data
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text())
      return json?.error?.message ?? '다운로드에 실패했습니다.'
    } catch {
      return '다운로드에 실패했습니다.'
    }
  }
  return e instanceof ApiError ? e.message : '다운로드에 실패했습니다.'
}
```

```tsx
// features/admin/components/ExcelButton.tsx
export default function ExcelButton({ condition }: { condition: AdminUserCondition }) {
  const [loading, setLoading] = useState(false)

  const onClick = async () => {
    setLoading(true)
    try {
      const res = await adminApi.usersExcel(condition)
      saveBlob(res, '회원목록.xlsx')
    } catch (e) {
      alert(await readBlobError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={loading}>
      {loading ? '엑셀 생성 중...' : '엑셀 다운로드'}
    </Button>
  )
}
```

```ts
// ⚠️ 4주차 client.ts의 응답 인터셉터 보완: blob 에러는 body가 Blob이라 error.code를 못 읽는다.
//    ApiError 생성 전에 원본 에러를 보관해 readBlobError가 읽을 수 있게 한다.
const apiError = new ApiError(status ?? 0, body?.error?.code ?? 'NETWORK_ERROR', body?.error?.message ?? '...', body?.error?.fields)
;(apiError as ApiError & { response?: unknown }).response = err.response
return Promise.reject(apiError)
```

**🔍 원리**
- `<a href="/api/admin/users/excel">`로는 **토큰을 보낼 수 없다**(401). axios로 blob을 받아 `URL.createObjectURL` → 가짜 `<a>` 클릭으로 저장한다(5주차 다운로드와 같은 원리).
- **파일명**: 서버가 준 `Content-Disposition`의 `filename*=UTF-8''...`를 `decodeURIComponent`로 푼다. 서버에서 날짜가 들어간 이름(`회원목록_2026-11-16.xlsx`)을 정하므로 프런트는 읽기만 한다.
- **blob 에러 함정**: `responseType: 'blob'`이면 서버가 403 JSON을 보내도 axios는 그것을 **Blob으로** 준다. 그냥 두면 에러 메시지가 `[object Blob]`이거나 비어 있다. `blob.text()` → `JSON.parse`로 다시 읽어야 한다.
- 인터셉터 보완은 blob 응답을 위해 원본 응답을 에러 객체에 붙여 두는 것이다. JSON 응답 처리에는 영향이 없다.
- 로딩 표시: 5만 건 엑셀은 몇 초 걸린다. 버튼을 잠그지 않으면 여러 번 눌러 서버에 같은 작업이 쌓인다.

**✔ 확인**
- [ ] 조건 "정지" 검색 → 엑셀 → 파일명 `회원목록_날짜.xlsx`, 행 수 = 화면 총 건수
- [ ] 일반 사용자 토큰으로 강제 호출(개발자도구) → alert에 "권한이 없습니다."

---

## 10 · Playwright E2E

**🎯 목표**: 실제 브라우저로 **사용자 관점의 핵심 흐름 두 개**를 자동 검증한다.

**🤔 왜 지금**: 모든 기능이 붙은 마지막 주다. 단위·통합 테스트가 못 잡는 "화면 + 쿠키 + 라우팅 + 서버" 연결 문제를 잡는다.

**📄 파일**: `npm init playwright@latest`, `playwright.config.ts`, `e2e/user-flow.spec.ts`, `e2e/admin-flow.spec.ts`

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost',   // docker compose로 띄운 전체 스택
    trace: 'on-first-retry',
    locale: 'ko-KR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

```ts
// e2e/user-flow.spec.ts — 시나리오를 한국어로 먼저 적고 코드로 옮긴다
import { test, expect } from '@playwright/test'

test('회원가입 → 로그인 → 글쓰기 → 댓글 → 새로고침 유지 → 로그아웃', async ({ page }) => {
  const id = `e2e${Date.now().toString().slice(-8)}`

  // 1. 회원가입
  await page.goto('/signup')
  await page.getByLabel('아이디').fill(id)
  await page.getByLabel('비밀번호', { exact: true }).fill('pass1234')
  await page.getByLabel('비밀번호 확인').fill('pass1234')
  await page.getByLabel('닉네임').fill('E2E테스터')
  await page.getByLabel('이메일').fill(`${id}@e2e.test`)
  await page.getByRole('button', { name: '가입' }).click()
  await expect(page).toHaveURL(/\/login/)

  // 2. 로그인 (글쓰기로 바로 가서 로그인 후 복귀하는지도 함께 확인)
  await page.goto('/posts/new')
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('아이디').fill(id)
  await page.getByLabel('비밀번호').fill('pass1234')
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/posts\/new/)

  // 3. 글쓰기
  await page.getByLabel('제목').fill('E2E 제목')
  await page.getByLabel('내용').fill('E2E 내용')
  await page.getByRole('button', { name: '등록' }).click()
  await expect(page.getByRole('heading', { name: 'E2E 제목' })).toBeVisible()

  // 4. 댓글
  await page.getByLabel('댓글 입력').fill('E2E 댓글')
  await page.getByRole('button', { name: '등록' }).click()
  await expect(page.getByText('E2E 댓글')).toBeVisible()

  // 5. 새로고침해도 로그인 유지 (httpOnly 쿠키 + reissue)
  await page.reload()
  await expect(page.getByText('E2E테스터님')).toBeVisible()

  // 6. 로그아웃
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible()
})
```

```ts
// e2e/admin-flow.spec.ts
test('관리자: 회원 검색 → 새로고침 후 조건 유지 → 엑셀 다운로드', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('아이디').fill(process.env.E2E_ADMIN_ID ?? 'admin01')
  await page.getByLabel('비밀번호').fill(process.env.E2E_ADMIN_PW ?? '')
  await page.getByRole('button', { name: '로그인' }).click()

  await page.goto('/admin/users')
  await page.getByLabel('검색어').fill('e2e')
  await page.getByLabel('상태').selectOption('ACTIVE')
  await page.getByRole('button', { name: '검색' }).click()
  await expect(page).toHaveURL(/keyword=e2e/)
  await expect(page).toHaveURL(/status=ACTIVE/)

  await page.reload()
  await expect(page.getByLabel('검색어')).toHaveValue('e2e')
  await expect(page.getByLabel('상태')).toHaveValue('ACTIVE')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '엑셀 다운로드' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^회원목록_.*\.xlsx$/)
})

test('일반 사용자는 /admin에 접근할 수 없다', async ({ page }) => {
  // user-flow에서 만든 계정 또는 seed 계정으로 로그인 후
  await page.goto('/admin')
  await expect(page.getByText('접근 권한이 없습니다.')).toBeVisible()
})
```

```bash
docker compose up -d --build          # 운영과 같은 구성으로 전체 스택
E2E_ADMIN_PW='***' npx playwright test
npx playwright show-report            # 실패 시 스크린샷·trace 확인
```

**🔍 원리**
- **테스트 피라미드의 꼭대기**: 단위(많이·빠르게) → 통합(적당히) → **E2E(조금·핵심만)**. E2E는 느리고 깨지기 쉬워서 "깨지면 서비스가 안 되는 흐름"만 둔다. 이 두 시나리오가 과정 전체를 관통한다.
- **로케이터는 역할·라벨로**: `getByRole('button', { name: '로그인' })`, `getByLabel('아이디')`. CSS 클래스(`.btn-primary`)에 의존하면 디자인만 바꿔도 테스트가 깨진다. 2주차부터 `aria-label`, 라벨 연결을 챙긴 것이 여기서 보상받는다.
- **자동 대기**: Playwright의 `expect(...).toBeVisible()`은 나타날 때까지 기다린다. `sleep(2000)`을 쓰지 않는다.
- 새로고침 로그인 유지(쿠키), 로그인 후 복귀(`state.from`), 새로고침 후 검색 조건 유지(URL)처럼 **여러 주차의 설계가 맞물려야** 통과하는 항목을 일부러 넣었다.
- 관리자 비밀번호는 환경변수로. 테스트 코드에도 비밀값을 쓰지 않는다.
- AI 활용: "관리자로 로그인해서 '김'이 들어간 회원을 검색하고, 새로고침해도 검색어가 남아 있는지 확인" 같은 **한국어 시나리오**를 주면 Playwright 코드로 거의 그대로 바뀐다. 시나리오 문서가 곧 테스트 명세서다.

**✔ 확인**: `npx playwright test` → 3개 통과.

---

## 11 · 재배포 · 회귀 테스트

```bash
# 1) 배포 전: 로컬에서 전체 테스트
cd backend && ./gradlew test && cd ..
cd frontend && npm run test && cd ..
docker compose up -d --build && npx playwright test

# 2) 서버에서 6주차 스크립트 그대로
./scripts/deploy.sh           # git pull → build → up → health → smoke

# 3) 운영 주소로 E2E (선택 — 운영 DB에 테스트 데이터가 생긴다)
E2E_BASE_URL=https://도메인 E2E_ADMIN_PW='***' npx playwright test e2e/admin-flow.spec.ts

# 4) 운영 관리자 계정 만들기 (가입 후 서버에서)
docker compose exec mysql mysql -u root -p board -e "UPDATE users SET role='ADMIN' WHERE login_id='admin01';"
```

**🔍 원리**
- **회귀 테스트**: 새 기능(관리자)이 기존 기능(로그인·게시판·파일)을 망가뜨리지 않았는지 확인하는 것. 6주차 `smoke.sh`와 E2E를 **다시 돌리는 것**이 곧 회귀 테스트다. 한 번 만든 스크립트를 재사용하는 가치가 여기서 나온다.
- 배포 순서: **테스트 통과한 것만 배포**한다. 서버에서 문제가 생기면 `git checkout <이전 커밋> && ./scripts/deploy.sh`로 되돌린다(롤백).
- 7주차 관리자 API가 추가됐지만 **스키마 변경이 없으므로** DB 마이그레이션이 필요 없다. ERD를 처음에 잘 잡아 둔 효과다.

**✔ 확인**: 운영에서 smoke 통과 + 관리자 로그인 → 검색 → 엑셀.

---

## 12 · 함정 노트 · 전체 회고 · 포트폴리오

**🎯 목표**: 8주 동안의 막힘을 패턴으로 정리하고, MES 과정으로 가져갈 것과 이력서용 설명을 만든다.

**📄 결과물**: 노션 상위 페이지 "함정 노트", 7주차 페이지(또는 README) "전체 회고", 저장소 `README.md`

```markdown
<!-- 함정 노트 한 줄 형식 -->
| 주차 | 증상 | 원인 | 해결 | 다시 안 겪으려면 |
|---|---|---|---|---|
| 3 | validate: expecting enum | Hibernate 6가 enum을 MySQL ENUM으로 기대 | columnDefinition="VARCHAR(20)" | 엔티티 작성 직후 앱 기동으로 스키마 검증 |
| 4 | 가끔 강제 로그아웃 | StrictMode로 reissue 2회 → Rotation 재사용 감지 | Promise 공유로 1회 | 재발급은 항상 단일 진입점 |
| 6 | 상세 새로고침 404 | Nginx try_files 누락 | try_files ... /index.html | smoke.sh에 SPA 경로 포함 |
```

```text
AI에게 회고 정리 요청 예시:
"아래 함정 노트와 주차별 회고를 보고
 ① 반복된 실수 패턴 3가지
 ② MES 과정(Spring Boot + React)에서 미리 대비할 점
 ③ 다음에 AI에게 처음부터 줘야 할 규칙 목록(규칙 파일용)을 정리해줘"
(비밀값·서버 주소는 지우고 붙여넣기)
```

```markdown
<!-- README.md 포트폴리오 뼈대 -->
# Simple Fullstack Board
게시판·회원·파일·관리자 기능을 백엔드부터 배포까지 혼자 구현한 풀스택 프로젝트 (2026.09 ~ 11)

## 기술 스택
Spring Boot 3 · Spring Security 6 · JPA/QueryDSL · MySQL 8.4 · React · React Query · zustand · Docker · Nginx

## 담당 · 구현
- ERD 기반 스키마(validate)와 공통 응답·에러 규약 설계
- JWT(Access 30분·메모리) + Refresh(7일·httpOnly 쿠키·해시 저장·Rotation) 인증
- 동시 401 재발급 대기열(axios 인터셉터), 새로고침 로그인 복원
- 파일 업로드 보안(화이트리스트·UUID·RFC 5987 한글 파일명), 썸네일
- 관리자 동적 검색(QueryDSL)·일괄 처리·SXSSF 엑셀(수식 인젝션 방지)
- Docker 멀티스테이지·Nginx 리버스 프록시 배포, 스모크·E2E 자동화

## 해결한 문제
- (함정 노트에서 가장 어려웠던 3개를 "문제 → 원인 분석 → 해결 → 결과"로)

## 테스트
단위(Mockito·Vitest) · 통합(MockMvc + Testcontainers MySQL) · E2E(Playwright)

## 실행
docker compose up -d --build  →  http://localhost
```

**🔍 원리**
- 함정 노트는 **증상으로 검색할 수 있게** 적는다. 다음에 같은 에러 메시지를 봤을 때 찾을 수 있어야 한다.
- 포트폴리오는 "무엇을 썼나"보다 **"무슨 문제를 어떻게 풀었나"**가 설득력이 있다. SI 면접에서는 인증·파일 보안·엑셀·배포 경험이 특히 질문을 많이 받는다.
- 이 README가 이번 과정의 **완료 기준을 그대로 요약한 것**이다. 쓰다가 설명할 수 없는 줄이 있다면 그 부분을 다시 공부할 곳이다.

**✔ 확인**: 함정 노트 5개 이상, 전체 회고 3칸(잘된 점·막힌 점·MES로 가져갈 것), README 완성.

---

## 🔧 안 될 때 체크리스트

- **관리자인데 "접근 권한 없음"** → DB에서 ADMIN으로 바꾼 뒤 **다시 로그인**했나? 토큰의 role은 발급 시점 값(7주차 2번).
- **새로고침하면 검색 조건이 사라짐** → 조건을 `useState`에만 두었나? URL에 넣었나(3번)?
- **뒤로가기하면 목록은 바뀌는데 입력창은 그대로** → 폼에 `useEffect(() => setForm(value), [value])`(5번).
- **정렬하면 선택이 엉뚱한 행으로** → `getRowId`(6번).
- **페이지 넘겨도 선택이 남음** → 조건·페이지 변경 시 `setRowSelection({})`(7번).
- **상태 select에서 "전체"로 검색하면 400** → 빈 값을 파라미터에서 뺐나(`clean`, 2번)?
- **엑셀 에러 메시지가 `[object Blob]`** → `readBlobError`로 blob → JSON(9번).
- **E2E가 가끔 실패** → `waitForTimeout`을 썼나? `expect(...).toBeVisible()` 자동 대기 사용. 테스트 아이디 중복이면 매번 새 아이디.
- **E2E에서 라벨을 못 찾음** → `aria-label`/`<label>` 연결 확인. 찾기 어려운 요소 = 접근성이 부족한 요소.

## 🧠 스스로 설명해보기

1. 관리자 화면 가드가 있는데도 서버의 `@PreAuthorize`가 반드시 필요한 이유는?
2. 검색 조건을 URL에 두면 어떤 요구사항들이 한 번에 해결되나?
3. 조건이 바뀌거나 정렬이 바뀌면 왜 1페이지로 돌아가야 하나?
4. TanStack Table의 `manualSorting`과 서버 정렬 화이트리스트는 어떻게 짝을 이루나?
5. `Promise.all` 대신 `allSettled`를 쓴 이유는?
6. `responseType: 'blob'`에서 에러 메시지를 읽기 어려운 이유와 해결 방법은?
7. E2E에서 CSS 클래스 대신 역할·라벨로 요소를 찾는 이유는?
8. 8주 과정에서 한 기능(예: 새로고침 로그인 유지)이 동작하기 위해 맞물린 설계를 주차별로 이어서 설명해 보자.

## 🚀 여유가 있다면

- [ ] 회원 일괄 정지 API(`PATCH /api/admin/users/suspend { ids }`)를 백엔드에 추가하고 `allSettled` 대신 사용
- [ ] 관리자 게시글 상세(숨김 글도 조회)
- [ ] GitHub Actions에서 PR마다 `gradle test` + `npm run test`, main 머지 시 자동 배포 + smoke
- [ ] Playwright를 CI에서 docker compose와 함께 실행
