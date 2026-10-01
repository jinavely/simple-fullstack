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
