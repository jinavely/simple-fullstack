import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function MyPostTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>제목</TableHead>
          <TableHead className="w-28 text-center">작성일</TableHead>
          <TableHead className="w-16 text-center">조회</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell
            colSpan={3}
            className="h-32 text-center text-muted-foreground"
          >
            작성한 게시글이 없습니다.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
