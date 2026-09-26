import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function PostTable() {
  return (
    <Table>
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
        <TableRow>
          <TableCell
            colSpan={5}
            className="h-32 text-center text-muted-foreground"
          >
            게시글이 없습니다.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
