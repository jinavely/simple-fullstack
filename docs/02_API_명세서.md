# 02. API 명세서

- Base URL: `{VITE_API_BASE_URL}` (예: `http://localhost:8080/api`)
- 인증: `Authorization: Bearer {accessToken}` 헤더. Access Token 만료 시 `/auth/refresh`로 재발급
- 응답 포맷(공통 래퍼 예시)

```json
{
  "success": true,
  "data": { },
  "error": null
}
```

실패 시 `success: false`, `data: null`, `error: { "code": "...", "message": "..." }`. 코드 목록은 [03_에러코드_정의서.md](03_에러코드_정의서.md) 참고.

- Soft delete: `deleted_at`이 있는 리소스는 삭제 후에도 레코드가 남으며, 목록/조회 API는 기본적으로 `deleted_at IS NULL`인 것만 반환
- 페이지네이션 공통 응답: `{ "content": [...], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0 }`

---

## 1. 인증 (Auth)

### 1.1 회원가입
`POST /api/auth/signup`

| 구분 | 내용 |
|---|---|
| 인증 | 불필요 |
| Request Body | `{ "loginId": string, "password": string, "nickname": string, "email": string }` |
| Response | `201 Created` — `{ "id": number, "loginId": string, "nickname": string, "email": string }` |
| 에러 | `AUTH_LOGIN_ID_DUPLICATED`, `AUTH_EMAIL_DUPLICATED`, `COMMON_INVALID_INPUT` |

### 1.2 로그인
`POST /api/auth/login`

| 구분 | 내용 |
|---|---|
| 인증 | 불필요 |
| Request Body | `{ "loginId": string, "password": string }` |
| Response | `200 OK` — `{ "accessToken": string, "refreshToken": string, "user": { "id": number, "nickname": string, "role": string } }` |
| 에러 | `AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_SUSPENDED`, `AUTH_ACCOUNT_WITHDRAWN` |

### 1.3 토큰 재발급
`POST /api/auth/refresh`

| 구분 | 내용 |
|---|---|
| 인증 | 불필요 (Body의 refreshToken으로 검증) |
| Request Body | `{ "refreshToken": string }` |
| Response | `200 OK` — `{ "accessToken": string, "refreshToken": string }` (Refresh Token Rotation) |
| 에러 | `AUTH_INVALID_TOKEN`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_REVOKED` |

### 1.4 로그아웃
`POST /api/auth/logout`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 |
| Request Body | `{ "refreshToken": string }` |
| Response | `204 No Content` (해당 refresh_tokens 행 `revoked_at` 갱신) |
| 에러 | `AUTH_INVALID_TOKEN` |

---

## 2. 회원 (Users)

### 2.1 내 정보 조회
`GET /api/users/me`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 |
| Response | `200 OK` — `{ "id", "loginId", "nickname", "email", "role", "status", "profileFileUrl", "createdAt" }` |
| 에러 | `AUTH_UNAUTHORIZED` |

### 2.2 내 정보 수정
`PATCH /api/users/me`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 |
| Request Body | `{ "nickname"?: string, "profileFileId"?: number }` |
| Response | `200 OK` — 수정된 사용자 정보 |
| 에러 | `USER_NOT_FOUND`, `COMMON_INVALID_INPUT` |

### 2.3 비밀번호 변경
`PATCH /api/users/me/password`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 |
| Request Body | `{ "currentPassword": string, "newPassword": string }` |
| Response | `204 No Content` |
| 에러 | `AUTH_INVALID_CREDENTIALS`, `COMMON_INVALID_INPUT` |

### 2.4 회원 탈퇴
`DELETE /api/users/me`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 |
| Response | `204 No Content` (`status = WITHDRAWN`, `deleted_at` 기록, 보유 refresh_tokens 전량 폐기) |
| 에러 | `AUTH_UNAUTHORIZED` |

---

## 3. 게시글 (Posts)

### 3.1 목록 조회
`GET /api/posts`

검색·정렬·필터는 모두 쿼리스트링으로 제어한다.

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| page | number | 0 | 페이지 번호 (0-base) |
| size | number | 20 | 페이지 크기 |
| keyword | string | - | 검색어 |
| searchType | string | `TITLE_CONTENT` | `TITLE`, `CONTENT`, `TITLE_CONTENT`, `NICKNAME` |
| sort | string | `createdAt` | `createdAt`, `viewCount` |
| order | string | `desc` | `asc`, `desc` |
| userId | number | - | 특정 작성자 글만 필터 |

| 구분 | 내용 |
|---|---|
| 인증 | 불필요 |
| Response | `200 OK` — 페이지네이션 래퍼, `content[]` 항목: `{ "id", "title", "nickname", "viewCount", "commentCount", "hasAttachment", "createdAt" }` |
| 에러 | `COMMON_INVALID_INPUT` (page/size/sort 값 이상) |

### 3.2 상세 조회
`GET /api/posts/{postId}`

| 구분 | 내용 |
|---|---|
| 인증 | 불필요 (조회 시 `view_count` 1 증가) |
| Response | `200 OK` — `{ "id", "title", "content", "nickname", "userId", "viewCount", "files": [{ "id", "originalName", "fileSize" }], "createdAt", "updatedAt" }` |
| 에러 | `POST_NOT_FOUND` |

### 3.3 작성
`POST /api/posts`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 |
| Request Body | `{ "title": string, "content": string, "fileIds"?: number[] }` |
| Response | `201 Created` — 생성된 게시글 |
| 에러 | `COMMON_INVALID_INPUT`, `FILE_NOT_FOUND` |

### 3.4 수정
`PUT /api/posts/{postId}`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 (작성자 본인) |
| Request Body | `{ "title": string, "content": string, "fileIds"?: number[] }` |
| Response | `200 OK` — 수정된 게시글 |
| 에러 | `POST_NOT_FOUND`, `POST_FORBIDDEN`, `COMMON_INVALID_INPUT` |

### 3.5 삭제
`DELETE /api/posts/{postId}`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 (작성자 본인 또는 `ADMIN`) |
| Response | `204 No Content` (소프트 삭제) |
| 에러 | `POST_NOT_FOUND`, `POST_FORBIDDEN` |

---

## 4. 댓글 (Comments)

### 4.1 목록 조회
`GET /api/posts/{postId}/comments`

| 구분 | 내용 |
|---|---|
| 인증 | 불필요 |
| Query | `page`, `size` (기본 `createdAt asc`) |
| Response | `200 OK` — 페이지네이션 래퍼, 항목: `{ "id", "nickname", "userId", "content", "createdAt" }` |
| 에러 | `POST_NOT_FOUND` |

### 4.2 작성
`POST /api/posts/{postId}/comments`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 |
| Request Body | `{ "content": string }` |
| Response | `201 Created` — 생성된 댓글 |
| 에러 | `POST_NOT_FOUND`, `COMMON_INVALID_INPUT` |

### 4.3 수정
`PUT /api/comments/{commentId}`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 (작성자 본인) |
| Request Body | `{ "content": string }` |
| Response | `200 OK` — 수정된 댓글 |
| 에러 | `COMMENT_NOT_FOUND`, `COMMENT_FORBIDDEN` |

### 4.4 삭제
`DELETE /api/comments/{commentId}`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 (작성자 본인 또는 `ADMIN`) |
| Response | `204 No Content` (소프트 삭제) |
| 에러 | `COMMENT_NOT_FOUND`, `COMMENT_FORBIDDEN` |

---

## 5. 파일 (Files)

### 5.1 업로드
`POST /api/files` (`multipart/form-data`)

| 구분 | 내용 |
|---|---|
| 인증 | 필요 |
| Request | form field `file` |
| Response | `201 Created` — `{ "id", "originalName", "extension", "contentType", "fileSize", "url" }` |
| 에러 | `FILE_TOO_LARGE`, `FILE_UNSUPPORTED_TYPE` |

### 5.2 다운로드/조회
`GET /api/files/{fileId}`

| 구분 | 내용 |
|---|---|
| 인증 | 불필요 |
| Response | `200 OK` — 파일 바이너리 스트림 |
| 에러 | `FILE_NOT_FOUND` |

### 5.3 삭제
`DELETE /api/files/{fileId}`

| 구분 | 내용 |
|---|---|
| 인증 | 필요 (업로더 본인) |
| Response | `204 No Content` (소프트 삭제) |
| 에러 | `FILE_NOT_FOUND`, `FILE_FORBIDDEN` |
