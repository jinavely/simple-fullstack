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
