// lib/format.ts
// LocalDateTime 문자열("2026-10-06T10:15:00.123456") → 화면 표시용
export const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('ko-KR')
  
  export const formatDateTime = (value: string) =>
    new Date(value).toLocaleString('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  