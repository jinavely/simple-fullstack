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
