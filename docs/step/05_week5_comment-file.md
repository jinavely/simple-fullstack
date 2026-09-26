# 5주차 · 댓글 + 파일/이미지 (10/26~11/1 · 12h)

> 1~4주차 구조를 복습하며 댓글을 완성하고, 파일 업로드·다운로드·썸네일·게시글 첨부·프로필 이미지를 만든다.
> 스키마 기준: `docs/01_ERD.md`의 `comments`, `upload_files`, `post_files`, `users.profile_file_id`.
> 분량이 많다. 밀리면 **썸네일 생성(11번 일부)**부터 뺀다.

---

## 🗺 전체 흐름

```text
[댓글]  Post와 같은 구조를 복제한다
  Comment(엔티티) → CommentRepository → dto → CommentService(권한) → CommentController
  GET  /api/posts/{postId}/comments     (로그인 불필요 — 3주차 GET /api/posts/** permitAll)
  POST /api/posts/{postId}/comments     PUT·DELETE /api/comments/{id}

[파일]
  React(드래그앤드롭) ─multipart─▶ FileController
                                    │ FileService: 검증(확장자·MIME·용량) → UUID 저장명 → 디스크 저장
                                    │               → 이미지면 썸네일 생성 → upload_files INSERT
  ◀── { id, originalName, thumbnailUrl ... }

  게시글 첨부: posts ─< post_files >─ upload_files   (sort_order로 순서)
  프로필:      users.profile_file_id → upload_files.id (FK 없음 → 서비스에서 검증)
```

**핵심 한 줄**: 파일은 **디스크에 UUID 이름으로**, 원래 이름과 정보는 **DB에**. 사용자가 보낸 파일명·확장자·MIME은 전부 의심한다.

## 📋 순서표

| # | 할 일 | 파일 | 끝나면 확인할 것 |
|---|---|---|---|
| 1 | 댓글 에러 코드 · 엔티티 | `ErrorCode`, `Comment` | validate 통과 |
| 2 | 댓글 Repository · DTO | `CommentRepository`, `dto/*` | 컴파일 OK |
| 3 | 댓글 Service · Controller | `CommentService`, `CommentController` | Swagger CRUD |
| 4 | 댓글 프런트 | `features/comments/*` | 상세 하단 댓글 동작 |
| 5 | 업로드 설정 · 파일 에러 코드 | `application.yml`, `FileProperties`, `ErrorCode` | 앱 실행 |
| 6 | UploadFile 엔티티 · Repository | `UploadFile`, `UploadFileRepository` | validate 통과 |
| 7 | 파일 검증 | `FileValidator` | 단위 테스트 |
| 8 | 저장 · 썸네일 | `FileStorage` | 폴더에 파일 생성 |
| 9 | 업로드 · 목록 · 삭제 서비스 | `FileService` | 컴파일 OK |
| 10 | 다운로드 · 썸네일 응답 | `FileController` | 한글 파일명 다운로드 |
| 11 | 게시글 첨부 (`post_files`) | `PostFile`, `PostService` 수정 | 글에 첨부 표시 |
| 12 | 프로필 이미지 | `UserService`, `UserController` | 마이페이지 이미지 |
| 13 | 파일 프런트 | `features/files/*` | 드래그앤드롭·진행률·그리드 |
| 14 | 테스트 | `CommentControllerTest`, `FileControllerTest` | 통과 |

---

## 1 · 댓글 에러 코드 · 엔티티

**🎯 목표**: ERD `comments` 그대로 엔티티를 만든다. 1주차 `Post`를 복제하는 연습이다.

**🤔 왜 지금**: 층 순서(Entity → Repository → DTO → Service → Controller)는 1주차와 같다.

**📄 파일**: `global/error/ErrorCode.java`, `comment/Comment.java`

```java
// ErrorCode 추가 — 댓글(CM)
COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "CM001", "댓글을 찾을 수 없습니다."),
```

```java
@Entity
@Table(name = "comments")
@SQLRestriction("deleted_at IS NULL")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Comment extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 1000)
    private String content;

    private LocalDateTime deletedAt;

    public Comment(Post post, User user, String content) {
        this.post = post;
        this.user = user;
        this.content = content;
    }

    public void update(String content) {
        this.content = content;
    }

    public void delete() {
        this.deletedAt = LocalDateTime.now();
    }

    public boolean isWrittenBy(Long userId) {
        return user.getId().equals(userId);
    }
}
```

**🔍 원리**
- `Post`와 거의 같다. 다른 점은 **부모가 둘**(게시글, 작성자)이라는 것뿐이다. 1주차 코드를 기준으로 만들면 일관성이 유지된다.
- `Post`에 `@OneToMany List<Comment>`를 두지 않는다. 필요한 건 "게시글별 댓글 목록 조회"뿐이고, 이건 `CommentRepository`에서 `post_id`로 조회하면 된다. 양방향 연관관계는 편의보다 관리 비용(무한 참조, 불필요한 로딩)이 커서 실무에서는 **꼭 필요할 때만** 쓴다.
- `length = 1000`: ERD `VARCHAR(1000)`. DTO `@Size(max = 1000)`과 맞춘다.
- 소프트 삭제와 `@SQLRestriction`은 `Post`와 같다.

**✔ 확인**: 앱 실행 → validate 통과.

---

## 2 · 댓글 Repository · DTO

**📄 파일**: `comment/CommentRepository.java`, `comment/dto/CommentRequest.java`, `CommentResponse.java`

```java
public interface CommentRepository extends JpaRepository<Comment, Long> {

    @EntityGraph(attributePaths = "user")
    List<Comment> findByPostIdOrderByCreatedAtAsc(Long postId);
}
```

```java
public record CommentRequest(
        @NotBlank(message = "댓글 내용을 입력하세요.")
        @Size(max = 1000, message = "댓글은 1000자 이하입니다.")
        String content
) {
}

public record CommentResponse(
        Long id, Long postId, Long writerId, String writerNickname,
        String content, LocalDateTime createdAt, LocalDateTime updatedAt
) {
    public static CommentResponse from(Comment c) {
        return new CommentResponse(c.getId(), c.getPost().getId(), c.getUser().getId(),
                c.getUser().getNickname(), c.getContent(), c.getCreatedAt(), c.getUpdatedAt());
    }
}
```

**🔍 원리**
- `findByPostIdOrderByCreatedAtAsc`: `post_id` 조건 + `created_at` 정렬이 ERD 인덱스 `idx_comments_post_created (post_id, created_at)`과 **컬럼 순서까지 일치**한다. 인덱스가 정렬까지 해 주므로 별도 정렬 작업(filesort)이 없다. `EXPLAIN`으로 `Using filesort`가 없는지 확인해 보자.
- 댓글은 페이징 없이 전체를 가져온다(게시글 하나의 댓글은 보통 수십 개). 수백 개가 넘는 서비스라면 "더보기" 페이징을 붙인다.
- `@EntityGraph("user")`: 댓글 20개의 작성자 닉네임을 쿼리 1번으로. 1주차 목록과 같은 N+1 방지다.
- `c.getPost().getId()`는 LAZY 프록시에서 id만 꺼내므로 추가 쿼리가 없다.
- 등록·수정 요청이 같은 모양(`content`만)이라 DTO 하나로 둔다. 달라지면 그때 나눈다.

**✔ 확인**: 컴파일 OK.

---

## 3 · 댓글 Service · Controller

**📄 파일**: `comment/CommentService.java`, `comment/CommentController.java`

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;

    public List<CommentResponse> getList(Long postId) {
        findVisiblePost(postId);   // 없는·숨김·삭제된 글이면 404
        return commentRepository.findByPostIdOrderByCreatedAtAsc(postId).stream()
                .map(CommentResponse::from)
                .toList();
    }

    @Transactional
    public Long create(Long userId, Long postId, CommentRequest req) {
        Post post = findVisiblePost(postId);
        User user = userRepository.getReferenceById(userId);
        return commentRepository.save(new Comment(post, user, req.content())).getId();
    }

    @Transactional
    public Long update(LoginUser loginUser, Long commentId, CommentRequest req) {
        Comment comment = findComment(commentId);
        checkOwner(comment, loginUser);
        comment.update(req.content());
        return comment.getId();
    }

    @Transactional
    public void delete(LoginUser loginUser, Long commentId) {
        Comment comment = findComment(commentId);
        checkOwner(comment, loginUser);
        comment.delete();
    }

    private Post findVisiblePost(Long postId) {
        return postRepository.findByIdAndHiddenFalse(postId)
                .orElseThrow(() -> new BusinessException(ErrorCode.POST_NOT_FOUND));
    }

    private Comment findComment(Long id) {
        return commentRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.COMMENT_NOT_FOUND));
    }

    private void checkOwner(Comment comment, LoginUser loginUser) {
        if (!comment.isWrittenBy(loginUser.id()) && !loginUser.isAdmin()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }
}
```

```java
@RestController
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping("/api/posts/{postId}/comments")
    public ApiResponse<List<CommentResponse>> list(@PathVariable Long postId) {
        return ApiResponse.ok(commentService.getList(postId));
    }

    @PostMapping("/api/posts/{postId}/comments")
    public ResponseEntity<ApiResponse<Long>> create(@AuthenticationPrincipal LoginUser loginUser,
                                                    @PathVariable Long postId,
                                                    @Valid @RequestBody CommentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(commentService.create(loginUser.id(), postId, req)));
    }

    @PutMapping("/api/comments/{id}")
    public ApiResponse<Long> update(@AuthenticationPrincipal LoginUser loginUser,
                                    @PathVariable Long id, @Valid @RequestBody CommentRequest req) {
        return ApiResponse.ok(commentService.update(loginUser, id, req));
    }

    @DeleteMapping("/api/comments/{id}")
    public ApiResponse<Void> delete(@AuthenticationPrincipal LoginUser loginUser, @PathVariable Long id) {
        commentService.delete(loginUser, id);
        return ApiResponse.ok(null);
    }
}
```

**🔍 원리**
- **URL 설계**: 목록·작성은 "어느 게시글의 댓글"이 중요하므로 `/posts/{postId}/comments`(중첩). 수정·삭제는 댓글 id만으로 충분하므로 `/comments/{id}`(평평). 깊은 중첩(`/posts/1/comments/5`)은 쓸모없이 postId를 요구한다.
- 보안 규칙은 3주차 설정 그대로: `GET /api/posts/**` permitAll → 댓글 목록은 공개, 나머지는 `anyRequest().authenticated()`로 자동 보호.
- **삭제·숨김된 게시글의 댓글**: 게시글은 소프트 삭제라 댓글 행이 남는다. `findVisiblePost`로 부모를 확인하므로 삭제·숨김 글에는 댓글 조회·작성이 404가 된다. 댓글까지 `deleted_at`을 찍을지는 선택이다(관리자가 게시글을 복구할 가능성이 있으면 그대로 두는 게 낫다).
- `getReferenceById(userId)`: DB 조회 없이 **id만 가진 프록시**를 만든다. 댓글 INSERT에는 `user_id`만 필요하므로 SELECT를 아낀다. 인증된 사용자이므로 존재가 보장된다.
- 권한 체크 구조가 게시글(3주차 11번)과 같다. 두 번째로 쓰는 코드는 더 빨리 써진다 — 그게 이번 주의 목적이다.

**✔ 확인**
- [ ] 비로그인 `GET /api/posts/1/comments` → 200 / 작성 → 401
- [ ] A 댓글을 B가 수정 → 403 C403 / 없는 게시글에 작성 → 404 P001
- [ ] 삭제 후 목록에서 사라지고 DB `deleted_at` 기록
- [ ] 콘솔: 댓글 목록 조회가 쿼리 1번(users JOIN)

---

## 4 · 댓글 프런트

**📄 파일**: `src/features/comments/api.ts`, `queries.ts`, `CommentSection.tsx`, `PostDetailPage.tsx`(하단에 추가)

```ts
// features/comments/api.ts
export type Comment = {
  id: number; postId: number; writerId: number; writerNickname: string
  content: string; createdAt: string; updatedAt: string
}

export const commentApi = {
  list: (postId: number) => unwrap(api.get<ApiResponse<Comment[]>>(`/posts/${postId}/comments`)),
  create: (postId: number, content: string) =>
    unwrap(api.post<ApiResponse<number>>(`/posts/${postId}/comments`, { content })),
  update: (id: number, content: string) => unwrap(api.put<ApiResponse<number>>(`/comments/${id}`, { content })),
  remove: (id: number) => unwrap(api.delete<ApiResponse<void>>(`/comments/${id}`)),
}
```

```ts
// features/comments/queries.ts
export const commentKeys = {
  list: (postId: number) => ['comments', postId] as const,
}

export const useComments = (postId: number) =>
  useQuery({ queryKey: commentKeys.list(postId), queryFn: () => commentApi.list(postId) })

export function useCommentMutations(postId: number) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: commentKeys.list(postId) })
  return {
    create: useMutation({ mutationFn: (content: string) => commentApi.create(postId, content), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, content }: { id: number; content: string }) => commentApi.update(id, content),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: number) => commentApi.remove(id), onSuccess: refresh }),
  }
}
```

```tsx
// features/comments/CommentSection.tsx (핵심)
export default function CommentSection({ postId }: { postId: number }) {
  const me = useAuthStore((s) => s.user)
  const { data: comments = [], isPending } = useComments(postId)
  const { create, update, remove } = useCommentMutations(postId)
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    await create.mutateAsync(text.trim())
    setText('')
  }

  return (
    <section aria-label="댓글">
      <h2>댓글 {comments.length}</h2>
      {isPending && <p>불러오는 중...</p>}
      {!isPending && comments.length === 0 && <p>첫 댓글을 남겨 보세요.</p>}

      <ul>
        {comments.map((c) => {
          const mine = me && (me.id === c.writerId || me.role === 'ADMIN')
          return (
            <li key={c.id}>
              <strong>{c.writerNickname}</strong>
              {editingId === c.id ? (
                <>
                  <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={1000} />
                  <Button onClick={() => update.mutate({ id: c.id, content: editText },
                    { onSuccess: () => setEditingId(null) })}>저장</Button>
                  <Button variant="ghost" onClick={() => setEditingId(null)}>취소</Button>
                </>
              ) : (
                <p style={{ whiteSpace: 'pre-wrap' }}>{c.content}</p>
              )}
              {mine && editingId !== c.id && (
                <>
                  <Button variant="ghost" onClick={() => { setEditingId(c.id); setEditText(c.content) }}>수정</Button>
                  <Button variant="ghost" onClick={() => confirm('삭제할까요?') && remove.mutate(c.id)}>삭제</Button>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {me ? (
        <form onSubmit={onCreate}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000}
                    aria-label="댓글 입력" placeholder="댓글을 입력하세요" />
          <span>{text.length} / 1000</span>
          <Button type="submit" disabled={create.isPending || !text.trim()}>등록</Button>
        </form>
      ) : (
        <p><Link to="/login" state={{ from: `/posts/${postId}` }}>로그인</Link> 후 댓글을 남길 수 있습니다.</p>
      )}
    </section>
  )
}
```

**🔍 원리**
- 댓글은 한 줄 입력이라 react-hook-form 없이 `useState`로 충분하다. 검증은 `maxLength`와 빈 값 체크, 서버 400은 `mutate`의 `onError`로 알림 처리.
- **invalidate 방식**: 등록 → 서버 저장 → 목록 다시 조회. 단순하고 확실하다. 서버가 준 id·작성일·닉네임이 정확히 반영된다.
- **낙관적 업데이트**(선택): `onMutate`에서 캐시에 임시 댓글을 먼저 넣고, 실패하면 `onError`에서 되돌린다. 체감 속도는 빠르지만 코드가 세 배로 늘어난다. 댓글처럼 실패가 드문 곳에 쓴다.
- 비로그인 사용자에게는 입력창 대신 로그인 링크 + `state.from`으로 돌아올 곳을 알려준다(4주차 로그인 복귀).
- 게시글 삭제 시 댓글 캐시: 상세에서 나가므로 따로 처리하지 않아도 된다.

**✔ 확인**: 상세 하단에서 댓글 작성 → 즉시 목록 반영 / 내 댓글에만 수정·삭제 / 비로그인은 로그인 안내.

---

## 5 · 업로드 설정 · 파일 에러 코드

**🎯 목표**: 업로드 용량 제한, 저장 폴더, 파일 관련 에러를 정한다.

**📄 파일**: `application.yml`, `global/config/FileProperties.java`, `ErrorCode`

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 50MB

app:
  file:
    upload-dir: ${UPLOAD_DIR:./uploads}
    max-size-bytes: 10485760
```

```java
@ConfigurationProperties(prefix = "app.file")
public record FileProperties(String uploadDir, long maxSizeBytes) {
}
// BoardApplication 또는 설정 클래스에 @EnableConfigurationProperties(FileProperties.class)
// 또는 @ConfigurationPropertiesScan
```

```java
// ErrorCode — 파일(F)
FILE_NOT_FOUND(HttpStatus.NOT_FOUND, "F001", "파일을 찾을 수 없습니다."),
FILE_EMPTY(HttpStatus.BAD_REQUEST, "F002", "빈 파일은 올릴 수 없습니다."),
FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "F003", "파일은 10MB 이하만 올릴 수 있습니다."),
FILE_TYPE_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "F004", "허용되지 않는 파일 형식입니다."),
FILE_NOT_IMAGE(HttpStatus.BAD_REQUEST, "F005", "이미지 파일만 사용할 수 있습니다."),
FILE_STORE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "F006", "파일 저장에 실패했습니다."),
```

```java
// GlobalExceptionHandler 추가 — Spring이 용량 초과 시 던지는 예외
@ExceptionHandler(MaxUploadSizeExceededException.class)
public ResponseEntity<ApiResponse<Void>> handleMaxSize(MaxUploadSizeExceededException e) {
    return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(ApiResponse.fail(ErrorCode.FILE_TOO_LARGE));
}
```

**🔍 원리**
- **용량 제한은 세 군데**: ① 여기(Spring) ② 6주차 Nginx `client_max_body_size` ③ 프런트 사전 검증. 하나라도 작으면 그게 실제 제한이다. Nginx 기본값은 **1MB**라 배포 후 "로컬에선 됐는데 413"이 흔하다.
- `max-file-size`는 파일 하나, `max-request-size`는 한 요청 전체(다중 업로드 합계).
- `MaxUploadSizeExceededException`은 **Controller에 들어가기 전**(멀티파트 파싱 단계)에 난다. 그래도 `@RestControllerAdvice`가 잡을 수 있어서 공통 JSON으로 바꿀 수 있다.
- 저장 경로를 환경변수(`UPLOAD_DIR`)로 뺀 이유: 6주차 Docker에서 볼륨 경로(`/app/uploads`)로 바꾼다.
- `.gitignore`에 `uploads/`를 추가하자.

**✔ 확인**: 앱 실행.

---

## 6 · UploadFile 엔티티 · Repository

**📄 파일**: `file/UploadFile.java`, `file/UploadFileRepository.java`

```java
@Entity
@Table(name = "upload_files")
@SQLRestriction("deleted_at IS NULL")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UploadFile extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 255)
    private String originalName;

    @Column(nullable = false, length = 100, unique = true)
    private String storedName;

    @Column(nullable = false, length = 10)
    private String extension;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private long fileSize;

    @Column(length = 100)
    private String thumbnailName;

    private LocalDateTime deletedAt;

    @Builder
    private UploadFile(User user, String originalName, String storedName, String extension,
                       String contentType, long fileSize, String thumbnailName) {
        this.user = user;
        this.originalName = originalName;
        this.storedName = storedName;
        this.extension = extension;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.thumbnailName = thumbnailName;
    }

    public boolean isImage() {
        return contentType.startsWith("image/");
    }

    public boolean isOwnedBy(Long userId) {
        return user.getId().equals(userId);
    }

    public void delete() {
        this.deletedAt = LocalDateTime.now();
    }
}
```

```java
public interface UploadFileRepository extends JpaRepository<UploadFile, Long> {

    Page<UploadFile> findByUserId(Long userId, Pageable pageable);

    List<UploadFile> findByIdInAndUserId(Collection<Long> ids, Long userId);
}
```

**🔍 원리**
- ERD 컬럼 그대로다. `file_size BIGINT` → `long`, `thumbnail_name`은 NULL 허용(이미지가 아니면 없음).
- `findByUserId`: 내 파일 목록. `user_id` + `created_at` 정렬이 `idx_upload_files_user_created`와 맞는다.
- `findByIdInAndUserId`: 게시글 첨부(11번) 때 "보낸 파일 id들이 **전부 내 파일인지**" 한 번에 확인한다.

**✔ 확인**: validate 통과.

---

## 7 · 파일 검증 (`FileValidator`)

**🎯 목표**: 빈 파일, 용량, **확장자와 MIME 둘 다** 화이트리스트로 검사한다.

**🤔 왜 지금**: 저장보다 검증이 먼저다. 한번 디스크에 들어간 파일은 이미 위험하다.

**📄 파일**: `file/FileValidator.java`

```java
@Component
@RequiredArgsConstructor
public class FileValidator {

    // 확장자 → 허용 MIME (둘 다 맞아야 통과)
    private static final Map<String, Set<String>> ALLOWED = Map.of(
            "jpg", Set.of("image/jpeg"),
            "jpeg", Set.of("image/jpeg"),
            "png", Set.of("image/png"),
            "gif", Set.of("image/gif"),
            "webp", Set.of("image/webp"),
            "pdf", Set.of("application/pdf"),
            "txt", Set.of("text/plain"),
            "xlsx", Set.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            "zip", Set.of("application/zip", "application/x-zip-compressed")
    );

    private final FileProperties properties;

    /** 통과하면 소문자 확장자를 돌려준다 */
    public String validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.FILE_EMPTY);
        }
        if (file.getSize() > properties.maxSizeBytes()) {
            throw new BusinessException(ErrorCode.FILE_TOO_LARGE);
        }
        String ext = extractExtension(file.getOriginalFilename());
        Set<String> mimes = ALLOWED.get(ext);
        if (mimes == null || file.getContentType() == null || !mimes.contains(file.getContentType())) {
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED);
        }
        return ext;
    }

    public static String extractExtension(String filename) {
        if (filename == null) return "";
        String name = Paths.get(filename).getFileName().toString();   // 경로 부분 제거
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
```

**🔍 원리**
- **블랙리스트(`exe` 금지)가 아니라 화이트리스트(`jpg`만 허용)**: 금지 목록은 항상 빠뜨린다(`.jsp`, `.php`, `.html`, `.svg`...). 허용 목록은 빠뜨려도 "업로드 안 됨"일 뿐 보안 사고가 아니다.
- **확장자 + MIME 둘 다**: `virus.exe`를 `virus.jpg`로 이름만 바꾸면 확장자는 통과한다. 브라우저가 보낸 MIME도 조작 가능하므로 둘을 맞춰 보는 건 **1차 방어**다. 더 엄격하게는 Apache Tika로 **파일 앞부분 바이트(매직 넘버)**를 읽어 실제 형식을 확인한다(선택 과제).
- `svg`를 넣지 않은 이유: SVG는 XML이라 `<script>`를 담을 수 있다(업로드 XSS 단골).
- 원본 파일명에 `../../etc/passwd` 같은 경로가 들어올 수 있다. `Paths.get(...).getFileName()`으로 경로를 떼어 낸다. 어차피 저장은 UUID로 하므로 원본 이름은 **표시용**으로만 쓴다.
- 용량은 5번 Spring 설정이 먼저 막지만, 설정을 실수로 늘려도 여기서 한 번 더 막는다.

**✔ 확인**: 14번 테스트에서 검증.

---

## 8 · 저장 · 썸네일 (`FileStorage`)

**🎯 목표**: UUID 이름으로 디스크에 저장하고, 이미지면 300px 썸네일을 만든다.

**📄 파일**: `build.gradle`(Thumbnailator), `file/FileStorage.java`

```groovy
implementation 'net.coobird:thumbnailator:0.4.20'
```

```java
@Slf4j
@Component
public class FileStorage {

    private final Path root;

    public FileStorage(FileProperties properties) throws IOException {
        this.root = Paths.get(properties.uploadDir()).toAbsolutePath().normalize();
        Files.createDirectories(root.resolve("thumbnails"));
    }

    public String store(MultipartFile file, String ext) {
        String storedName = UUID.randomUUID() + "." + ext;     // 36 + 1 + 확장자 ≤ 100
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, resolve(storedName), StandardCopyOption.REPLACE_EXISTING);
            return storedName;
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_STORE_FAILED);
        }
    }

    /** 실패해도 업로드 자체는 성공으로 둔다 (썸네일은 부가 기능) */
    public String createThumbnail(String storedName) {
        String thumbName = "thumb_" + storedName;
        try {
            Thumbnails.of(resolve(storedName).toFile())
                    .size(300, 300)
                    .toFile(root.resolve("thumbnails").resolve(thumbName).toFile());
            return thumbName;
        } catch (IOException | UnsupportedOperationException e) {
            log.warn("썸네일 생성 실패: {}", storedName, e);
            return null;
        }
    }

    public Resource load(String storedName) {
        return new FileSystemResource(resolve(storedName));
    }

    public Resource loadThumbnail(String thumbName) {
        return new FileSystemResource(root.resolve("thumbnails").resolve(thumbName).normalize());
    }

    private Path resolve(String name) {
        Path p = root.resolve(name).normalize();
        if (!p.startsWith(root)) {                 // 경로 조작 방지 (이중 안전장치)
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        return p;
    }
}
```

**🔍 원리**
- **저장 파일명 = UUID**: ① 같은 이름 파일이 덮어써지지 않는다 ② 한글·공백·특수문자 인코딩 문제가 없다 ③ 사용자가 파일명으로 경로를 조작할 수 없다 ④ 파일명을 추측해 남의 파일에 접근할 수 없다. 원본 이름은 DB `original_name`에만 둔다.
- `normalize()` + `startsWith(root)`: 어떤 이유로든 `../`가 섞인 이름이 들어와도 업로드 폴더 밖을 가리키면 거부한다.
- 썸네일 실패는 **경고 로그만** 남기고 null: 원본은 이미 저장됐으므로 썸네일 때문에 업로드 전체를 실패시키지 않는다. 화면은 썸네일이 없으면 원본 또는 아이콘을 보여준다.
- 파일은 DB가 아니라 **디스크**에 둔다. DB에 BLOB으로 넣으면 백업·복제가 무거워진다. 실무에서는 디스크 대신 S3 같은 객체 스토리지를 쓰고, 이 클래스의 구현만 바꾼다(인터페이스로 분리해 두면 좋다).

**✔ 확인**: 9번 이후 업로드하면 `uploads/`에 UUID 이름 파일, `uploads/thumbnails/`에 `thumb_` 파일.

---

## 9 · 업로드 · 목록 · 삭제 서비스

**📄 파일**: `file/dto/FileResponse.java`, `file/FileService.java`

```java
public record FileResponse(Long id, String originalName, String extension, String contentType,
                           long fileSize, boolean image, String thumbnailUrl, String downloadUrl,
                           LocalDateTime createdAt) {
    public static FileResponse from(UploadFile f) {
        return new FileResponse(f.getId(), f.getOriginalName(), f.getExtension(), f.getContentType(),
                f.getFileSize(), f.isImage(),
                f.getThumbnailName() == null ? null : "/api/files/" + f.getId() + "/thumbnail",
                "/api/files/" + f.getId() + "/download",
                f.getCreatedAt());
    }
}
```

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FileService {

    private final UploadFileRepository fileRepository;
    private final UserRepository userRepository;
    private final FileValidator validator;
    private final FileStorage storage;

    @Transactional
    public List<FileResponse> upload(Long userId, List<MultipartFile> files) {
        User user = userRepository.getReferenceById(userId);
        return files.stream().map(file -> {
            String ext = validator.validate(file);
            String storedName = storage.store(file, ext);
            String thumb = file.getContentType().startsWith("image/") ? storage.createThumbnail(storedName) : null;

            UploadFile saved = fileRepository.save(UploadFile.builder()
                    .user(user)
                    .originalName(Paths.get(file.getOriginalFilename()).getFileName().toString())
                    .storedName(storedName)
                    .extension(ext)
                    .contentType(file.getContentType())
                    .fileSize(file.getSize())
                    .thumbnailName(thumb)
                    .build());
            return FileResponse.from(saved);
        }).toList();
    }

    public PageResponse<FileResponse> myFiles(Long userId, Pageable pageable) {
        return PageResponse.from(fileRepository.findByUserId(userId, pageable).map(FileResponse::from));
    }

    public UploadFile getFile(Long id) {
        return fileRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.FILE_NOT_FOUND));
    }

    @Transactional
    public void delete(LoginUser loginUser, Long id) {
        UploadFile file = getFile(id);
        if (!file.isOwnedBy(loginUser.id()) && !loginUser.isAdmin()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        file.delete();   // 소프트 삭제 — 디스크 파일은 남긴다
    }
}
```

**🔍 원리**
- 다중 업로드: 파일마다 **검증 → 저장 → DB** 순서. 3개 중 2번째가 검증에 실패하면 예외 → 트랜잭션 롤백으로 **DB 행은 모두 취소**된다. 단, 1번째 파일은 **디스크에 이미 저장**돼 있다(DB는 롤백되지만 디스크는 안 됨). 실무에서는 ① 전부 검증을 먼저 끝내고 저장하거나 ② 주기적으로 "DB에 없는 디스크 파일"을 청소한다. 이 코드를 "검증을 전부 먼저" 방식으로 고치는 것이 선택 과제다.
- 소프트 삭제 후에도 디스크 파일을 남기는 이유: 게시글 복구·감사 대응. 실제 삭제는 일정 기간 뒤 배치로 한다.
- 응답에 URL을 넣어 두면 프런트가 경로 규칙을 몰라도 된다.

**✔ 확인**: 10번 컨트롤러와 함께 확인.

---

## 10 · 다운로드 · 썸네일 응답 (`FileController`)

**🎯 목표**: 업로드·목록·삭제 API와, **한글 파일명이 깨지지 않는** 다운로드, 이미지 썸네일 응답을 만든다.

**📄 파일**: `file/FileController.java`, `SecurityConfig`(썸네일 공개)

```java
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;
    private final FileStorage storage;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<List<FileResponse>>> upload(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestPart("files") List<MultipartFile> files) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(fileService.upload(loginUser.id(), files)));
    }

    @GetMapping
    public ApiResponse<PageResponse<FileResponse>> myFiles(
            @AuthenticationPrincipal LoginUser loginUser,
            @ParameterObject @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(fileService.myFiles(loginUser.id(), pageable));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable Long id) {
        UploadFile file = fileService.getFile(id);
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(file.getOriginalName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(file.getFileSize())
                .body(storage.load(file.getStoredName()));
    }

    @GetMapping("/{id}/thumbnail")
    public ResponseEntity<Resource> thumbnail(@PathVariable Long id) {
        UploadFile file = fileService.getFile(id);
        if (file.getThumbnailName() == null) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        return ResponseEntity.ok()
                // Thumbnailator는 원본 형식(jpg/png/gif...)을 유지하므로 파일명으로 타입을 정한다
                .contentType(MediaTypeFactory.getMediaType(file.getThumbnailName())
                        .orElse(MediaType.APPLICATION_OCTET_STREAM))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .body(storage.loadThumbnail(file.getThumbnailName()));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@AuthenticationPrincipal LoginUser loginUser, @PathVariable Long id) {
        fileService.delete(loginUser, id);
        return ApiResponse.ok(null);
    }
}
```

```java
// SecurityConfig — 썸네일은 <img src>로 불러야 하므로 공개
.requestMatchers(HttpMethod.GET, "/api/files/*/thumbnail").permitAll()
```

**🔍 원리**
- **한글 파일명**: HTTP 헤더는 원래 ASCII만 안전하다. `ContentDisposition.filename(name, UTF_8)`은 `filename*=UTF-8''%EB%B3%B4%EA%B3%A0%EC%84%9C.pdf` 형식(RFC 5987)을 만들어 준다. 직접 문자열로 `filename="보고서.pdf"`를 쓰면 브라우저마다 깨진다.
- `APPLICATION_OCTET_STREAM` + `attachment` + `nosniff`: 브라우저가 파일을 **실행·렌더링하지 않고 무조건 저장**하게 한다. 누가 HTML 파일을 올려도 우리 도메인에서 열리지 않는다(저장형 XSS 방어).
- **썸네일은 공개, 다운로드는 로그인 필요**: `<img src>`는 `Authorization` 헤더를 보낼 수 없다. 썸네일(작은 미리보기)은 공개로 두고, 원본 다운로드는 13번에서 axios(토큰 포함)로 blob을 받는다. 파일 id가 1, 2, 3처럼 순서대로라 썸네일은 **추측 가능**하다는 점을 기억하자 — 민감한 이미지 서비스라면 서명된 URL을 쓴다.
- `@RequestPart("files") List<MultipartFile>`: 프런트 `FormData`에서 같은 이름 `files`로 여러 번 `append`하면 리스트로 받는다.
- `CacheControl 7일`: 썸네일은 바뀌지 않으므로 브라우저가 다시 받지 않게 한다.

**✔ 확인** (Swagger: 파일 선택 UI가 뜬다)
- [ ] jpg 업로드 → 201, `uploads/`에 UUID 파일 + 썸네일, DB `upload_files` 행
- [ ] `test.exe`를 `test.jpg`로 이름만 바꿔 업로드 → Swagger는 MIME을 `image/jpeg`로 보낼 수 있어 **통과할 수 있다** → 매직 넘버 검사가 필요한 이유(선택 과제)
- [ ] 11MB 파일 → 413 F003
- [ ] `보고서 최종(1).pdf` 다운로드 → 저장된 파일명이 한글 그대로
- [ ] 브라우저에서 `/api/files/1/thumbnail` 직접 열기 → 이미지 표시

---

## 11 · 게시글 첨부 (`post_files`)

**🎯 목표**: 게시글 작성 시 업로드한 파일 id를 보내 `post_files`로 연결하고, 상세에서 첨부 목록을 보여준다.

**📄 파일**: `post/PostFile.java`, `PostFileRepository.java`, `PostCreateRequest`, `PostService`, `PostResponse`

```java
@Entity
@Table(name = "post_files")
@EntityListeners(AuditingEntityListener.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PostFile {     // updated_at 없음 → BaseTimeEntity 상속 안 함

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "file_id", nullable = false)
    private UploadFile file;

    @Column(nullable = false)
    private int sortOrder;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public PostFile(Post post, UploadFile file, int sortOrder) {
        this.post = post;
        this.file = file;
        this.sortOrder = sortOrder;
    }
}

public interface PostFileRepository extends JpaRepository<PostFile, Long> {
    @EntityGraph(attributePaths = "file")
    List<PostFile> findByPostIdOrderBySortOrderAsc(Long postId);
}
```

```java
// PostCreateRequest에 필드 추가
@Size(max = 10, message = "첨부는 10개까지 가능합니다.")
List<Long> fileIds

// PostService.create 끝부분
Post saved = postRepository.save(req.toEntity(writer));
attachFiles(saved, userId, req.fileIds());
return saved.getId();

private void attachFiles(Post post, Long userId, List<Long> fileIds) {
    if (fileIds == null || fileIds.isEmpty()) return;
    List<Long> distinctIds = fileIds.stream().distinct().toList();
    Map<Long, UploadFile> mine = uploadFileRepository.findByIdInAndUserId(distinctIds, userId).stream()
            .collect(Collectors.toMap(UploadFile::getId, f -> f));
    if (mine.size() != distinctIds.size()) {
        throw new BusinessException(ErrorCode.FILE_NOT_FOUND);   // 남의 파일이거나 없는 파일
    }
    for (int i = 0; i < distinctIds.size(); i++) {
        postFileRepository.save(new PostFile(post, mine.get(distinctIds.get(i)), i));
    }
}

// PostService.get — 상세 응답에 첨부 추가 (PostDetailResponse를 새로 두거나 PostResponse에 files 필드 추가)
List<FileResponse> files = postFileRepository.findByPostIdOrderBySortOrderAsc(id).stream()
        .map(pf -> FileResponse.from(pf.getFile()))
        .toList();
```

**🔍 원리**
- **중간 테이블을 엔티티로**: `post_files`에 `sort_order`, `created_at` 같은 **추가 정보**가 있어서 `@ManyToMany`로는 표현할 수 없다. 중간 테이블을 엔티티로 두는 게 실무 표준이다.
- 업로드와 글 작성을 **두 단계로** 분리: ① 파일을 먼저 올려 id를 받고 ② 글 작성 시 id 목록을 보낸다. 글 작성 요청이 JSON으로 유지되고, 업로드 진행률도 따로 보여줄 수 있다.
- **남의 파일 첨부 방지**: id만 받으면 남이 올린 파일 id를 넣을 수 있다. `findByIdInAndUserId`로 "전부 내 파일인지"를 한 쿼리로 확인한다.
- `distinct()`: 같은 id를 두 번 보내면 `uk_post_files (post_id, file_id)` UNIQUE 위반이 난다. 미리 걸러 낸다.
- 리스트 순서 = `sort_order`. 프런트에서 드래그로 순서를 바꾸면 그대로 반영된다.
- 수정 시 첨부 변경(추가·제거)은 선택 과제로 둔다: "기존 post_files 삭제 후 다시 저장"이 가장 단순하다.

**✔ 확인**: 파일 2개 업로드 → id로 글 작성 → `post_files` 2행(sort_order 0, 1) → 상세 응답에 `files` 배열.

---

## 12 · 프로필 이미지

**🎯 목표**: 업로드한 이미지를 `users.profile_file_id`에 연결한다. ERD에 FK가 없으므로 **서비스에서 검증**한다.

**📄 파일**: `User.java`, `UserService.java`, `UserController.java`

```java
// User
public void changeProfileFile(Long fileId) {
    this.profileFileId = fileId;
}

// UserService
@Transactional
public MyInfoResponse changeProfileImage(Long userId, Long fileId) {
    UploadFile file = uploadFileRepository.findById(fileId)      // @SQLRestriction → 삭제된 파일 제외
            .orElseThrow(() -> new BusinessException(ErrorCode.FILE_NOT_FOUND));
    if (!file.isOwnedBy(userId)) {
        throw new BusinessException(ErrorCode.FORBIDDEN);
    }
    if (!file.isImage() || file.getThumbnailName() == null) {
        throw new BusinessException(ErrorCode.FILE_NOT_IMAGE);
    }
    User user = findUser(userId);
    user.changeProfileFile(fileId);
    return MyInfoResponse.from(user);
}

// UserController
public record ProfileImageRequest(@NotNull Long fileId) {}

@PatchMapping("/profile-image")
public ApiResponse<MyInfoResponse> changeProfileImage(@AuthenticationPrincipal LoginUser loginUser,
                                                      @Valid @RequestBody ProfileImageRequest req) {
    return ApiResponse.ok(userService.changeProfileImage(loginUser.id(), req.fileId()));
}
```

**🔍 원리**
- **FK가 없으면 DB가 지켜 주지 않는다**. 없는 파일 id, 남의 파일 id, PDF 파일 id를 넣어도 DB는 저장한다. 그래서 ① 존재 ② 소유자 ③ 이미지 여부 세 가지를 서비스가 확인한다. ERD 설계 결정(순환 참조 회피)의 대가가 이 코드다.
- 프런트에서는 `MyInfo.profileFileId`로 `/api/files/{id}/thumbnail`을 이미지 주소로 쓴다. 없으면 기본 아바타.
- 프로필 파일을 나중에 삭제하면 `profile_file_id`가 삭제된 파일을 가리킨다. 썸네일 조회가 404가 되므로 프런트는 `onError`에서 기본 아바타로 바꾼다(또는 삭제 시 서비스에서 `profile_file_id`를 null로).

**✔ 확인**: 이미지 업로드 → 프로필 변경 → 마이페이지 이미지 / PDF id로 변경 → 400 F005 / 남의 파일 id → 403.

---

## 13 · 파일 프런트

**🎯 목표**: 드래그앤드롭 다중 업로드, 선택 즉시 미리보기, 업로드 진행률, 썸네일 그리드, 인증 다운로드를 만든다.

**📄 파일**: `src/features/files/api.ts`, `queries.ts`, `pages/FilePage.tsx`, `FileDropzone.tsx`, `downloadFile.ts`

```ts
// features/files/api.ts
export type UploadedFile = {
  id: number; originalName: string; extension: string; contentType: string
  fileSize: number; image: boolean; thumbnailUrl: string | null; downloadUrl: string; createdAt: string
}

export const fileApi = {
  upload: (files: File[], onProgress?: (percent: number) => void) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return unwrap(
      api.post<ApiResponse<UploadedFile[]>>('/files', form, {
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      }),
    )
  },
  list: (page: number) =>
    unwrap(api.get<ApiResponse<PageResponse<UploadedFile>>>('/files', { params: { page, size: 20 } })),
  remove: (id: number) => unwrap(api.delete<ApiResponse<void>>(`/files/${id}`)),
}
```

```ts
// features/files/downloadFile.ts — 토큰이 필요한 다운로드는 blob으로
export async function downloadFile(file: UploadedFile) {
  const res = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = file.originalName          // 응답 헤더 파싱 대신 이미 아는 원본명 사용
  a.click()
  URL.revokeObjectURL(url)
}
```

```tsx
// features/files/FileDropzone.tsx
const MAX = 10 * 1024 * 1024
const ALLOWED = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'xlsx', 'zip']

export default function FileDropzone({ onUploaded }: { onUploaded: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null })),
    [files],
  )
  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews])

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next = Array.from(list)
    const bad = next.find((f) => f.size > MAX || !ALLOWED.includes(f.name.split('.').pop()?.toLowerCase() ?? ''))
    if (bad) return setError(`${bad.name}: 10MB 이하의 허용된 형식만 올릴 수 있습니다.`)
    setError(null)
    setFiles((prev) => [...prev, ...next])
  }

  const upload = async () => {
    setProgress(0)
    try {
      await fileApi.upload(files, setProgress)
      setFiles([])
      onUploaded()
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div>
      <label
        className={dragging ? styles.dropActive : styles.drop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
      >
        파일을 끌어다 놓거나 클릭해서 선택 (10MB 이하)
        <input type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </label>

      {error && <p role="alert">{error}</p>}

      <ul className={styles.previewGrid}>
        {previews.map(({ file, url }) => (
          <li key={file.name + file.size}>
            {url ? <img src={url} alt="" /> : <span>{file.name.split('.').pop()}</span>}
            <small>{file.name}</small>
          </li>
        ))}
      </ul>

      {progress !== null && <progress value={progress} max={100} aria-label="업로드 진행률" />}
      <Button onClick={upload} disabled={files.length === 0 || progress !== null}>
        {files.length}개 업로드
      </Button>
    </div>
  )
}
```

```tsx
// features/files/pages/FilePage.tsx — 업로드 후 목록 갱신, 썸네일 그리드
export default function FilePage() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['files', 0], queryFn: () => fileApi.list(0) })

  return (
    <section>
      <h1>내 파일</h1>
      <FileDropzone onUploaded={() => qc.invalidateQueries({ queryKey: ['files'] })} />
      <ul className={styles.grid}>
        {data?.content.map((f) => (
          <li key={f.id}>
            {f.thumbnailUrl ? <img src={f.thumbnailUrl} alt={f.originalName} loading="lazy" /> : <span>{f.extension}</span>}
            <p>{f.originalName} · {(f.fileSize / 1024).toFixed(0)}KB</p>
            <Button variant="ghost" onClick={() => downloadFile(f)}>다운로드</Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
// router: ProtectedRoute 아래에 { path: 'files', element: <FilePage /> }
```

**🔍 원리**
- **미리보기는 업로드 전에**: `URL.createObjectURL(file)`은 브라우저 메모리의 파일을 가리키는 임시 주소를 만든다. 서버에 보내지 않고 바로 볼 수 있다. 다 쓴 주소는 `revokeObjectURL`로 해제하지 않으면 메모리가 샌다(`useEffect` 정리 함수).
- **진행률**: axios `onUploadProgress`가 전송된 바이트를 알려준다. `FormData`를 넘기면 axios가 `Content-Type: multipart/form-data; boundary=...`를 **자동으로** 붙인다. 직접 `Content-Type`을 쓰면 boundary가 빠져서 서버가 파싱하지 못한다.
- **프런트 검증은 편의**: 10MB·확장자를 미리 막아 쓸데없는 업로드 시간을 줄인다. 진짜 검증은 7번 서버.
- `<label>` + 숨긴 `<input type="file">`: 클릭하면 파일 선택창이 열리고 드롭 영역 역할도 한다. 퍼블리싱 강점을 살려 디자인하자.
- 다운로드를 blob으로 받는 이유: `<a href="/api/files/1/download">`는 토큰을 보낼 수 없어 401이 난다. 응답이 blob이면 에러도 blob으로 오므로, 에러 메시지를 읽으려면 `await (err.response.data as Blob).text()`로 JSON을 다시 읽어야 한다(8주차 엑셀 다운로드에서 다룬다).
- 게시글 첨부: 글쓰기 폼에 `FileDropzone`을 넣고, 업로드 응답의 id 배열을 폼 값 `fileIds`에 담아 함께 보내면 11번과 연결된다.

**✔ 확인**
- [ ] 이미지 3개 드래그 → 미리보기 3개 → 업로드 → 진행률 → 그리드에 썸네일
- [ ] 11MB 파일 드롭 → 서버 요청 없이 안내
- [ ] 한글 이름 파일 다운로드 → 정상 저장·열림
- [ ] Network를 Slow 3G로 두면 진행률이 천천히 오르는지

---

## 14 · 테스트

```java
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@ActiveProfiles("test")
class FileControllerTest {

    @Container @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4").withInitScript("schema.sql");

    @Autowired MockMvc mvc;
    @Autowired TestAuthHelper auth;   // 가입 + 로그인 후 토큰을 돌려주는 테스트용 헬퍼 (3주차 코드를 옮겨 만들기)

    @Test
    @DisplayName("jpg 업로드 성공")
    void uploadJpg() throws Exception {
        MockMultipartFile file = new MockMultipartFile("files", "사진.jpg", "image/jpeg", sampleJpegBytes());
        mvc.perform(multipart("/api/files").file(file).header(AUTHORIZATION, auth.bearer("uploader1")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data[0].originalName").value("사진.jpg"));
    }

    @Test
    @DisplayName("exe는 거부")
    void rejectExe() throws Exception {
        MockMultipartFile file = new MockMultipartFile("files", "a.exe", "application/octet-stream", new byte[]{1, 2});
        mvc.perform(multipart("/api/files").file(file).header(AUTHORIZATION, auth.bearer("uploader2")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("F004"));
    }

    @Test
    @DisplayName("다운로드 헤더에 UTF-8 인코딩된 한글 파일명")
    void koreanFilename() throws Exception {
        // 업로드 후 id를 꺼내 /download 호출
        mvc.perform(get("/api/files/{id}/download", uploadedId))
                .andExpect(header().string(CONTENT_DISPOSITION, containsString("filename*=UTF-8''")));
    }
}
// 용량 초과 테스트: application-test.yml에서 max-file-size를 1KB로 낮추고 2KB 파일 업로드 → 413 F003
// sampleJpegBytes(): BufferedImage로 10x10 이미지를 만들어 ImageIO.write(img, "jpg", out)
```

```java
// CommentControllerTest 핵심
// ① 토큰 없이 작성 → 401  ② B가 A 댓글 수정 → 403  ③ 없는 게시글(9999)에 작성 → 404 P001
```

**🔍 원리**: `MockMultipartFile`의 첫 인자(`"files"`)가 `@RequestPart("files")`와 같아야 한다. 테스트용 이미지는 `ImageIO`로 즉석에서 만들면 썸네일 생성까지 실제로 검증된다.

**✔ 확인**: `./gradlew test` 통과.

---

## 🔧 안 될 때 체크리스트

- **업로드가 400 "Required part 'files' is not present"** → FormData 키 이름이 `files`인가? `Content-Type`을 직접 지정하지 않았나(13번)?
- **업로드가 413** → Spring `max-file-size`(5번), 운영이면 Nginx `client_max_body_size`(6주차).
- **다운로드 파일명이 `download`나 깨진 글자** → `ContentDisposition...filename(name, UTF_8)`(10번).
- **썸네일 `<img>`가 401** → `SecurityConfig`에 썸네일 `permitAll`(10번).
- **다운로드 버튼이 401** → `<a href>`가 아니라 axios blob으로 받았나(13번)?
- **`Schema-validation` post_files** → `PostFile`이 `BaseTimeEntity`를 상속했나? `updated_at` 없음(11번).
- **댓글 목록 쿼리가 N+1** → `@EntityGraph(attributePaths = "user")`(2번).
- **미리보기 메모리 증가** → `revokeObjectURL` 정리(13번).

## 🧠 스스로 설명해보기

1. `Post`에 `List<Comment>`를 두지 않은 이유는?
2. 댓글 URL을 목록·작성은 중첩, 수정·삭제는 평평하게 설계한 이유는?
3. 저장 파일명을 UUID로 하면 막아지는 문제 네 가지는?
4. 확장자 화이트리스트 + MIME 검사로도 막지 못하는 공격은? 어떻게 보강하나?
5. 다운로드 응답에 `attachment`, `octet-stream`, `nosniff`를 함께 주는 이유는?
6. `post_files`를 `@ManyToMany`가 아니라 엔티티로 만든 이유는?
7. `profile_file_id`에 FK가 없어서 서비스가 대신 확인해야 하는 것 세 가지는?
8. 다중 업로드 중 하나가 실패하면 DB와 디스크는 각각 어떤 상태가 되나?

## 🚀 여유가 있다면

- [ ] Apache Tika로 매직 넘버 검사 (`new Tika().detect(inputStream)`)
- [ ] 다중 업로드를 "전부 검증 후 저장"으로 바꾸기
- [ ] 댓글 낙관적 업데이트 (`onMutate` / `onError` 롤백 / `onSettled` invalidate)
- [ ] 게시글 수정 시 첨부 추가·삭제·순서 변경
- [ ] 이미지 업로드 전 브라우저에서 리사이즈(canvas)해서 용량 줄이기
