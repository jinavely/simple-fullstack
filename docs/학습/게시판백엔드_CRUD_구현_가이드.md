# 04. 백엔드 게시판 CRUD 구현 가이드

> 목표: 이 문서만 읽고 **코드를 보지 않고 게시판 CRUD를 처음부터 다시 짤 수 있게** 되는 것.
>
> 순서대로 읽으면 "무엇을 → 어떤 순서로 → 왜 이렇게" 만들었는지 이해할 수 있게 구성했습니다.

---

## 0. 한 장 요약

### 0-1. 요청 하나가 지나가는 길

브라우저(또는 Swagger)가 `GET /api/posts/1` 을 보내면 이렇게 흘러갑니다.

```
[클라이언트]
    │  HTTP 요청 (GET /api/posts/1)
    ▼
[Controller]   PostController     ← "주소(URL)를 받고, 응답을 돌려주는 창구"
    │  postService.get(1)
    ▼
[Service]      PostService        ← "실제 일(비즈니스 로직)을 하는 곳"
    │  postRepository.findByIdAndHiddenFalse(1)
    ▼
[Repository]   PostRepository     ← "DB에 SQL을 대신 날려주는 곳"
    │  SELECT * FROM posts WHERE id = 1 ...
    ▼
[DB]           posts 테이블
    │  한 줄(row)
    ▼
[Entity]       Post 객체           ← "DB 한 줄을 자바 객체로 만든 것"
    │  PostResponse.from(post)
    ▼
[DTO]          PostResponse       ← "클라이언트에게 보여줄 모양으로 담은 상자"
    │  ApiResponse.ok(...)
    ▼
[클라이언트]  { "success": true, "data": { ... } }
```

### 0-2. 식당으로 비유하면

| 계층 | 식당에서는 | 하는 일 | 하지 **않는** 일 |
|---|---|---|---|
| **Controller** | 홀 직원 | 주문(요청)을 받고, 완성된 음식(응답)을 전달 | 요리하지 않음 (로직 X) |
| **Service** | 주방장 | 실제로 요리함 (조회, 검증, 수정, 삭제 판단) | 손님과 직접 대화 안 함 (HTTP 모름) |
| **Repository** | 창고 관리인 | 재료를 꺼내오고 넣어둠 (DB 읽기/쓰기) | 요리 안 함 |
| **Entity** | 창고에 있는 재료 | DB 테이블 한 줄과 1:1로 대응 | 손님 앞에 그대로 안 나감 |
| **DTO** | 주문서 / 접시 | 요청을 받는 모양(Request), 응답으로 내보내는 모양(Response) | DB와 직접 연결되지 않음 |

**왜 이렇게 나누나요?** 한 곳에 다 몰아 쓰면 처음엔 편하지만, 기능이 늘수록 "어디를 고쳐야 하지?"가 됩니다.
역할을 나누면 **"URL 바꾸려면 Controller, 로직 바꾸려면 Service, 쿼리 바꾸려면 Repository"** 처럼 고칠 곳이 딱 정해집니다.

### 0-3. 폴더 구조

```
backend/src/main/java/jinavely/github/io/fullstack/
├── FullstackApplication.java          # 시작점
├── config/
│   ├── SecurityConfig.java            # 보안 설정 (지금은 전부 허용)
│   └── OpenApiConfig.java             # Swagger 문서 제목 설정
├── global/                            # 모든 기능이 같이 쓰는 공통 코드
│   ├── common/
│   │   ├── BaseTimeEntity.java        # created_at, updated_at 자동 기록
│   │   ├── ApiResponse.java           # 모든 응답을 감싸는 공통 모양
│   │   └── PageResponse.java          # 목록(페이지) 응답 모양
│   ├── config/
│   │   └── JpaAuditingConfig.java     # BaseTimeEntity가 동작하게 켜는 스위치
│   └── error/
│       ├── ErrorCode.java             # 에러 종류 목록
│       ├── BusinessException.java     # "우리가 의도해서 던지는" 예외
│       └── GlobalExceptionHandler.java# 예외 → 에러 응답 JSON으로 변환
├── user/                              # 회원 기능
│   ├── entity/User.java
│   └── repository/UserRepository.java
└── post/                              # 게시글 기능
    ├── entity/Post.java
    ├── repository/PostRepository.java
    ├── dto/
    │   ├── PostCreateRequest.java
    │   ├── PostUpdateRequest.java
    │   └── PostResponse.java
    ├── service/PostService.java
    └── controller/PostController.java
```

> **규칙:** 기능(도메인)별로 폴더(`post/`, `user/`)를 만들고, 그 안을 계층(`entity/`, `repository/`, `dto/`, `service/`, `controller/`)으로 나눕니다.
> 여러 기능이 같이 쓰는 건 `global/`에 둡니다.

---

## 1. 작성 순서 — 왜 이 순서인가?

**원칙: "아래(DB)에서 위(HTTP)로" 쌓는다.**

위 계층은 아래 계층을 사용합니다. (Controller → Service → Repository → Entity)
그래서 **아래부터 만들어야, 위를 만들 때 쓸 재료가 이미 준비되어 있습니다.**
거꾸로 Controller부터 만들면 아직 없는 Service, DTO를 import 하느라 빨간 줄 투성이가 됩니다.
(지난번에 봤던 빨간 줄도 대부분 "아직 없거나 import 안 한 클래스" 때문이었습니다.)

| 순서 | 만들 것 | 한 줄 이유 |
|---|---|---|
| 0 | 설정 (`build.gradle`, `application.yml`, DB 테이블) | 재료와 작업장 준비 |
| 1 | `BaseTimeEntity` + `JpaAuditingConfig` | 모든 Entity가 상속할 공통 시간 필드 |
| 2 | Entity (`User`, `Post`) | DB 테이블을 자바로 옮긴 것. 모든 것의 기초 |
| 3 | Repository (`UserRepository`, `PostRepository`) | Entity를 DB에 넣고 빼는 도구 |
| 4 | `ErrorCode` + `BusinessException` | Service에서 "없어요" 에러를 던지려면 먼저 필요 |
| 5 | DTO (`PostCreateRequest`, `PostUpdateRequest`, `PostResponse`) | Service가 받고 돌려줄 모양 |
| 6 | Service (`PostService`) | 실제 CRUD 로직 |
| 7 | `ApiResponse` + `PageResponse` | Controller가 응답을 감쌀 상자 |
| 8 | Controller (`PostController`) | URL 연결 |
| 9 | `GlobalExceptionHandler` | 에러를 예쁜 JSON으로 |
| 10 | 실행 & Swagger로 확인 | 진짜 되는지 테스트 |

---

## 2. 단계별 설명 (코드 + 왜)

### STEP 0. 준비물

**`build.gradle` 에 필요한 것**

| 의존성 | 왜 필요? |
|---|---|
| `spring-boot-starter-webmvc` | `@RestController`, `@GetMapping` 등 웹 기능 |
| `spring-boot-starter-data-jpa` | Entity, Repository (SQL 자동 생성) |
| `spring-boot-starter-validation` | `@NotBlank`, `@Size`, `@Valid` 입력값 검증 |
| `spring-boot-starter-security` | 보안 (지금은 전부 허용 상태) |
| `mysql-connector-j` | MySQL 연결 드라이버 |
| `lombok` | `@Getter`, `@Builder` 등으로 반복 코드 줄이기 |
| `springdoc-openapi-starter-webmvc-ui` | Swagger 화면 (API 테스트 페이지) |

**`application.yml`**

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate   # ★ 중요
    show-sql: true         # 실행되는 SQL을 콘솔에 보여줌 (공부할 때 매우 유용)
```

`ddl-auto` 값의 의미:

| 값 | 의미 |
|---|---|
| `create` | 실행할 때마다 테이블을 **지우고 새로 만듦** (데이터 날아감) |
| `update` | Entity에 맞게 테이블을 **알아서 고침** (편하지만 위험) |
| `validate` | 테이블은 안 건드리고, **Entity와 테이블이 맞는지 검사만** 함 ← 지금 설정 |

우리는 `docs/sql/schema.sql` 로 테이블을 직접 만들고, `validate` 로 "내 Entity가 테이블과 맞는지" 검사받습니다.
→ Entity 필드 이름을 오타 내면(예: `updateAt`) 서버가 **아예 안 뜹니다.** 이게 오히려 실수를 빨리 잡아줍니다.

**DB 준비 순서**

```
docker compose up -d                  # MySQL 켜기 (localhost:3307)
docs/sql/schema.sql 실행              # 테이블 생성
docs/sql/seed_data.sql 실행           # 샘플 데이터 (회원 id=1 이 있어야 글쓰기가 됨)
```

---

### STEP 1. BaseTimeEntity + JpaAuditingConfig — "작성일/수정일 자동 기록"

모든 테이블에 `created_at`, `updated_at`이 있습니다. 매번 Entity마다 쓰기 귀찮으니 **부모 클래스 하나로 뽑아냅니다.**

```java
@Getter
@MappedSuperclass                                  // ① 이건 테이블이 아니라 "부모 틀"이다
@EntityListeners(AuditingEntityListener.class)     // ② 저장/수정 순간을 감시해라
public abstract class BaseTimeEntity {
    @CreatedDate                                   // ③ 처음 저장될 때 시간 자동 입력
    @Column(nullable = false, updatable = false)   //    한 번 넣으면 수정 불가
    private LocalDateTime createdAt;

    @LastModifiedDate                              // ④ 수정될 때마다 시간 자동 갱신
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
```

```java
@Configuration
@EnableJpaAuditing          // ⑤ 이 스위치를 켜야 ③④가 실제로 동작함
public class JpaAuditingConfig {}
```

- **① `@MappedSuperclass`**: "나를 상속한 Entity에 내 필드를 컬럼으로 붙여줘" 라는 뜻. 자기 자신은 테이블이 없습니다.
- **⑤를 빼먹으면**: 에러는 안 나는데 `created_at`이 `null`로 들어가서 DB가 `NOT NULL` 에러를 냅니다.
- **이름 규칙**: 자바 `updatedAt` ↔ DB `updated_at`. Spring이 **카멜케이스를 스네이크케이스로 자동 변환**합니다. 그래서 자바 이름을 틀리면 다른 컬럼을 찾습니다.

---

### STEP 2. Entity — "DB 테이블을 자바 클래스로"

**Entity = 테이블 한 줄(row)을 담는 자바 객체.** 필드 하나 = 컬럼 하나.

#### User (최소한만)

게시글에 "작성자"를 연결하려면 `User`가 필요해서, 지금 쓰는 컬럼만 매핑했습니다.

```java
@Entity                                            // 이 클래스는 DB 테이블과 연결된다
@Table(name = "users")                             // 테이블 이름은 users
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED) // JPA용 빈 생성자 (밖에서 못 쓰게 protected)
public class User extends BaseTimeEntity {

    @Id                                                   // 기본키(PK)
    @GeneratedValue(strategy = GenerationType.IDENTITY)   // AUTO_INCREMENT
    private Long id;

    @Column(nullable = false, length = 20, unique = true)
    private String loginId;

    @Column(nullable = false, length = 20)
    private String nickname;
}
```

> 테이블에 있는 컬럼(`password`, `email` …)을 전부 매핑하지 않아도 `validate`는 통과합니다. **Entity에 적은 필드가 테이블에 존재하는지만** 검사하기 때문입니다.

#### Post

```java
@Entity
@Table(name = "posts")
@SQLRestriction("deleted_at IS NULL")              // ★ 모든 조회에 자동으로 "삭제 안 된 것만" 조건 추가
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Post extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)  // 글 여러 개 : 회원 1명
    @JoinColumn(name = "user_id", nullable = false)       // FK 컬럼 이름
    private User user;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private int viewCount;

    @Column(nullable = false)
    private boolean hidden;

    private LocalDateTime deletedAt;               // null이면 살아있는 글, 값이 있으면 삭제된 글

    @Builder                                       // 생성은 빌더로만
    private Post(User user, String title, String content) {
        this.user = user;
        this.title = title;
        this.content = content;
        this.viewCount = 0;                        // 새 글은 조회수 0
        this.hidden = false;                       // 새 글은 숨김 아님
    }

    public void update(String title, String content) {   // 수정
        this.title = title;
        this.content = content;
    }

    public void increaseViewCount() {              // 조회수 +1
        this.viewCount++;
    }

    public void delete() {                         // 소프트 삭제
        this.deletedAt = LocalDateTime.now();
    }
}
```

**왜 이렇게 짰나?**

| 코드 | 이유 |
|---|---|
| `@Setter` 없음 | 아무 데서나 `post.setTitle()` 하면 어디서 값이 바뀌었는지 추적이 안 됨. 대신 `update()`, `delete()`처럼 **의미 있는 이름의 메서드**로만 바꾸게 함 |
| `@NoArgsConstructor(PROTECTED)` | JPA는 DB에서 꺼낼 때 빈 생성자가 반드시 필요. 하지만 개발자가 `new Post()`로 빈 글을 만들면 안 되니까 `protected`로 숨김 |
| `@Builder` + `private` 생성자 | `Post.builder().title("..").build()` 처럼 **무엇을 넣는지 이름이 보이게** 생성. 조회수·숨김 같은 기본값은 생성자 안에서 강제 |
| `User user` (Long userId 아님) | JPA는 객체끼리 연결. `post.getUser().getNickname()` 처럼 바로 꺼내 쓸 수 있음 |
| `FetchType.LAZY` | 글을 조회할 때 **작성자는 진짜 필요할 때만** 추가로 조회. 기본값(EAGER)이면 쓸데없는 조회가 늘어남 |
| 소프트 삭제 (`deletedAt`) | 진짜 `DELETE` 하지 않고 "삭제 시간"만 기록. 실수로 지워도 복구 가능, 기록 보존 |
| `@SQLRestriction` | 소프트 삭제된 글을 매번 `where deleted_at is null`로 거르기 귀찮으니 **Entity에 한 번만** 적어 둠 |

---

### STEP 3. Repository — "SQL을 대신 써주는 인터페이스"

**인터페이스만 만들면 Spring이 구현체를 자동으로 만들어 줍니다.** 클래스를 직접 만들 필요가 없습니다.

```java
public interface UserRepository extends JpaRepository<User, Long> {
}                       //                        Entity ↑  ↑ PK 타입
```

`JpaRepository`를 상속하는 순간 이미 쓸 수 있는 메서드:

| 메서드 | 하는 일 |
|---|---|
| `save(entity)` | INSERT (또는 UPDATE) |
| `findById(id)` | PK로 한 건 조회 → `Optional`로 반환 |
| `findAll(pageable)` | 전체 조회 + 페이징 |
| `delete(entity)` | DELETE (우리는 소프트 삭제라 안 씀) |

```java
public interface PostRepository extends JpaRepository<Post, Long> {

    // ① 메서드 이름만으로 쿼리 생성
    Optional<Post> findByIdAndHiddenFalse(Long id);

    // ② 직접 쿼리 작성 (검색 + 페이징)
    @EntityGraph(attributePaths = "user")
    @Query("""
            select p from Post p
            where p.hidden = false
              and (:keyword is null
                   or p.title like concat('%', :keyword, '%')
                   or p.content like concat('%', :keyword, '%'))
            """)
    Page<Post> search(@Param("keyword") String keyword, Pageable pageable);
}
```

**① 메서드 이름 쿼리 (Query Method)**

`findByIdAndHiddenFalse` 를 Spring이 **이름을 쪼개서 해석**합니다.

```
find    By   Id        And   HiddenFalse
조회해라  조건:  id = ?    그리고  hidden = false
→ SELECT * FROM posts WHERE id = ? AND hidden = false AND deleted_at IS NULL
                                                         └ @SQLRestriction이 자동 추가
```

→ "숨김 글이나 삭제된 글은 없는 글 취급" 이라는 규칙이 이름 하나로 표현됩니다.

**② `@Query` (JPQL)**

- 조건이 복잡해지면 이름이 너무 길어지니 직접 씁니다.
- `from Post p` — **테이블 이름(posts)이 아니라 Entity 이름(Post)** 을 씁니다. 이게 JPQL.
- `:keyword is null or ...` — 검색어가 없으면 조건을 무시 → 전체 목록. **검색 있을 때/없을 때를 쿼리 하나로 처리**.
- `Pageable` 을 받으면 **정렬(order by)과 페이징(limit/offset)을 Spring이 알아서 붙여줍니다.**
- `@EntityGraph(attributePaths = "user")` — 목록 10개를 가져온 뒤 작성자를 10번 따로 조회하는 문제(**N+1 문제**)를 막으려고, **글과 작성자를 한 번에 join 해서** 가져옵니다.

---

### STEP 4. ErrorCode + BusinessException — "에러도 미리 정해둔다"

Service에서 "글이 없어요"를 알려야 하는데, 그냥 `return null` 하면 Controller가 매번 null 체크를 해야 합니다.
대신 **예외를 던지고, 한 곳(STEP 9)에서 일괄 처리**합니다.

```java
@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // 공통 (C)
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "C001", "입력값이 올바르지 않습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "C999", "서버 오류가 발생했습니다."),

    // 회원 (U)
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "U001", "회원을 찾을 수 없습니다."),

    // 게시글 (P)
    POST_NOT_FOUND(HttpStatus.NOT_FOUND, "P001", "게시글을 찾을 수 없습니다.");

    private final HttpStatus status;   // 몇 번 HTTP 상태로 응답할지
    private final String code;         // 프론트가 구분할 코드
    private final String message;      // 사용자에게 보여줄 메시지
}
```

```java
@Getter
public class BusinessException extends RuntimeException {
    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
```

- **`enum`으로 모아두는 이유**: 에러 종류가 한 파일에 다 보입니다. 새 에러가 필요하면 한 줄만 추가하면 됩니다.
- **`RuntimeException` 상속 이유**: 메서드마다 `throws`를 안 붙여도 됩니다. 그리고 `@Transactional`은 RuntimeException이 나면 **자동으로 롤백**합니다.
- 사용법: `throw new BusinessException(ErrorCode.POST_NOT_FOUND);`

---

### STEP 5. DTO — "들어오는 모양, 나가는 모양"

**DTO(Data Transfer Object) = 계층 사이에 데이터를 옮기는 상자.**

#### 왜 Entity를 그대로 주고받지 않나요?

1. **보안**: Entity를 그대로 받으면 클라이언트가 `viewCount: 99999`, `hidden: true` 같은 값을 몰래 보낼 수 있습니다. DTO는 **허락한 필드(title, content)만** 받습니다.
2. **순환 참조/LAZY 문제**: Entity를 JSON으로 바꾸면 `post.user` 같은 연관 객체 때문에 에러가 나거나 불필요한 조회가 발생합니다.
3. **API 모양 고정**: DB 컬럼이 바뀌어도 API 응답 모양은 그대로 유지할 수 있습니다.

#### record 를 쓴 이유

`record`는 자바 16+ 문법으로, **필드 + 생성자 + getter + equals/toString을 한 줄로** 만들어 줍니다. 값만 담는 DTO에 딱 맞습니다.
(getter 이름은 `getTitle()`이 아니라 `title()` 입니다.)

#### 요청 DTO — 작성

```java
public record PostCreateRequest(

        @NotBlank(message = "제목은 필수입니다.")           // null, "", "   " 모두 거부
        @Size(max = 200, message = "제목은 200자 이하여야 합니다.")  // DB 컬럼 길이와 맞춤
        String title,

        @NotBlank(message = "내용은 필수입니다.")
        String content
) {
    public Post toEntity(User writer) {                  // DTO → Entity 변환
        return Post.builder()
                .user(writer)
                .title(title)
                .content(content)
                .build();
    }
}
```

- `@NotBlank`, `@Size` 는 **Controller에서 `@Valid`를 붙여야** 동작합니다. (STEP 8)
- 작성자(`writer`)는 **요청 본문에서 받지 않습니다.** 클라이언트가 남의 id를 보낼 수 있으니까요. 서버가 알고 있는 로그인 사용자로 넣습니다.

#### 요청 DTO — 수정

```java
public record PostUpdateRequest(
        @NotBlank(message = "제목은 필수입니다.")
        @Size(max = 200, message = "제목은 200자 이하여야 합니다.")
        String title,

        @NotBlank(message = "내용은 필수입니다.")
        String content
) {
}
```

- 작성과 모양이 같지만 **따로 만듭니다.** 나중에 "수정할 때만 필요한 값"이 생기면 서로 영향 없이 바꿀 수 있기 때문입니다.
- `toEntity()`가 없는 이유: 수정은 **새로 만드는 게 아니라 기존 Entity의 `update()`를 호출**하기 때문입니다.

#### 응답 DTO

```java
public record PostResponse(
        Long id,
        Long writerId,
        String writerNickname,
        String title,
        String content,
        int viewCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static PostResponse from(Post post) {         // Entity → DTO 변환
        return new PostResponse(
                post.getId(),
                post.getUser().getId(),
                post.getUser().getNickname(),
                post.getTitle(),
                post.getContent(),
                post.getViewCount(),
                post.getCreatedAt(),
                post.getUpdatedAt()
        );
    }
}
```

> **변환 규칙 외우기**
> - 들어올 때: `요청DTO.toEntity()` → Entity
> - 나갈 때: `응답DTO.from(entity)` → DTO

---

### STEP 6. Service — "실제 일을 하는 곳" ★ 핵심

```java
@Service                              // Spring이 관리하는 서비스 객체로 등록
@RequiredArgsConstructor              // final 필드를 받는 생성자 자동 생성 → 의존성 주입
@Transactional(readOnly = true)       // 기본은 "읽기 전용 트랜잭션"
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;

    // ───────── C: 작성 ─────────
    @Transactional                                           // 쓰기니까 readOnly 해제
    public Long create(Long userId, PostCreateRequest req) {
        User writer = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Post saved = postRepository.save(req.toEntity(writer));
        return saved.getId();
    }

    // ───────── R: 상세 조회 ─────────
    @Transactional                                           // 조회수를 올리니까 쓰기
    public PostResponse get(Long id) {
        Post post = findPost(id);
        post.increaseViewCount();                            // save() 안 불러도 됨! (아래 설명)
        return PostResponse.from(post);
    }

    // 여러 메서드가 같이 쓰는 "찾거나, 없으면 에러"
    private Post findPost(Long id) {
        return postRepository.findByIdAndHiddenFalse(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.POST_NOT_FOUND));
    }

    // ───────── R: 목록 조회 (검색 + 페이징 + 정렬) ─────────
    public PageResponse<PostResponse> getList(String keyword, Pageable pageable) {
        String searchKeyword = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        Page<Post> posts = postRepository.search(searchKeyword, pageable);

        return PageResponse.from(posts.map(PostResponse::from));
    }

    // ───────── U: 수정 ─────────
    @Transactional
    public Long update(Long id, PostUpdateRequest req) {
        Post post = findPost(id);
        post.update(req.title(), req.content());             // 이것도 save() 없음!
        return post.getId();
    }

    // ───────── D: 삭제 ─────────
    @Transactional
    public void delete(Long id) {
        Post post = findPost(id);
        post.delete();   // 소프트 삭제: deleted_at만 기록
    }
}
```

#### 원리 ① 의존성 주입 (`@RequiredArgsConstructor` + `final`)

`PostService`는 `PostRepository`가 필요합니다. 직접 `new` 하지 않고 **Spring이 만들어서 넣어줍니다.**
`final` 필드 + `@RequiredArgsConstructor` = "생성자로 받아라" → Spring이 알아서 채워줌. 이 조합은 거의 공식처럼 씁니다.

#### 원리 ② `@Transactional` — "한 묶음으로 처리"

- 메서드 안의 DB 작업이 **전부 성공하면 반영(commit), 중간에 예외가 나면 전부 취소(rollback)**.
- 클래스에 `readOnly = true`를 기본으로 걸고, **쓰기가 필요한 메서드에만** `@Transactional`을 다시 붙입니다.
  → 읽기 전용이면 JPA가 변경 감시를 생략해서 조금 더 빠르고, "이 메서드는 데이터를 안 바꾼다"는 것이 코드에 드러납니다.
- `get()`은 조회지만 **조회수를 올리므로 쓰기 트랜잭션**입니다.

#### 원리 ③ 변경 감지 (Dirty Checking) — 왜 update에 save()가 없나? ★

이게 JPA에서 가장 헷갈리는 부분입니다.

```
1. findPost(id)          → DB에서 꺼낸 Post를 JPA가 "원본 사진"과 함께 기억해 둠
2. post.update(...)      → 자바 객체의 값만 바꿈
3. 메서드 끝 (commit)     → JPA가 "원본 사진"과 지금 값을 비교
                          → 달라졌네? → UPDATE SQL 자동 실행
```

즉 **트랜잭션 안에서 조회한 Entity는 값만 바꾸면 알아서 저장됩니다.**
그래서 `update()`, `increaseViewCount()`, `delete()`(소프트 삭제) 모두 `save()`를 부르지 않습니다.
(단, `@Transactional`이 없으면 이 기능이 동작하지 않습니다!)

`create()`만 `save()`를 부르는 이유: **새 객체는 JPA가 아직 모르는 객체**라서 "이거 저장해줘"라고 알려줘야 합니다.

#### 원리 ④ `Optional` + `orElseThrow`

`findById`는 결과가 없을 수도 있어서 `Optional<Post>`를 돌려줍니다.
`.orElseThrow(() -> new BusinessException(...))` = "있으면 꺼내고, 없으면 이 에러를 던져라."

#### 원리 ⑤ 목록: `posts.map(PostResponse::from)`

`Page<Post>`(Entity 페이지)를 `Page<PostResponse>`(DTO 페이지)로 한 번에 바꿉니다. 페이지 정보(총 개수 등)는 그대로 유지됩니다.

#### Service가 id(`Long`)만 돌려주는 이유 (create/update)

작성·수정 후 프론트는 보통 상세 페이지(`/posts/{id}`)로 이동합니다. 그러면 **id만 있으면 충분**합니다.

---

### STEP 7. ApiResponse + PageResponse — "응답 모양 통일"

모든 API가 **같은 모양**으로 응답하면 프론트가 처리하기 쉽습니다.

```java
@JsonInclude(JsonInclude.Include.NON_NULL)   // null인 필드는 JSON에서 아예 빼기
public record ApiResponse<T>(
        boolean success,
        T data,
        ErrorBody error
) {
    public static <T> ApiResponse<T> ok(T data) {                 // 성공
        return new ApiResponse<>(true, data, null);
    }

    public static ApiResponse<Void> fail(ErrorCode code) {        // 실패
        return new ApiResponse<>(false, null,
                new ErrorBody(code.getCode(), code.getMessage(), null));
    }

    public static ApiResponse<Void> fail(ErrorCode code, Map<String, String> fields) {  // 검증 실패
        return new ApiResponse<>(false, null,
                new ErrorBody(code.getCode(), code.getMessage(), fields));
    }

    public record ErrorBody(String code, String message, Map<String, String> fields) {
    }
}
```

성공 응답: `{ "success": true, "data": { ... } }`
실패 응답: `{ "success": false, "error": { "code": "P001", "message": "게시글을 찾을 수 없습니다." } }`

- `<T>` (제네릭): `data` 안에 무엇이든(글 하나, 목록, id) 담을 수 있게 합니다.

```java
public record PageResponse<T>(
        List<T> content,       // 이번 페이지 데이터
        int page,              // 현재 페이지 번호 (0부터)
        int size,              // 페이지 크기
        long totalElements,    // 전체 개수
        int totalPages,        // 전체 페이지 수
        boolean last           // 마지막 페이지인지
) {
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isLast()
        );
    }
}
```

**왜 `Page`를 그대로 안 내보내나?** Spring의 `Page` 객체를 JSON으로 바꾸면 쓸데없는 내부 필드가 잔뜩 나오고, Spring 버전에 따라 모양이 바뀝니다. **필요한 6개만** 골라 담습니다.

---

### STEP 8. Controller — "URL과 메서드 연결"

```java
@RestController                       // 이 클래스의 반환값은 JSON으로 응답
@RequestMapping("/api/posts")         // 공통 주소
@RequiredArgsConstructor
public class PostController {

    // TODO 3주차: 로그인한 사용자 id로 교체 (seed_data.sql의 회원 id에 맞추기)
    private static final Long TEMP_USER_ID = 1L;

    private final PostService postService;

    @PostMapping                                                    // POST /api/posts
    public ResponseEntity<ApiResponse<Long>> create(@Valid @RequestBody PostCreateRequest req) {
        Long id = postService.create(TEMP_USER_ID, req);
        return ResponseEntity
                .status(HttpStatus.CREATED)                         // 201
                .body(ApiResponse.ok(id));
    }

    @GetMapping("/{id}")                                            // GET /api/posts/1
    public ApiResponse<PostResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(postService.get(id));
    }

    @GetMapping                                                     // GET /api/posts?keyword=..&page=0
    public ApiResponse<PageResponse<PostResponse>> getList(
            @RequestParam(required = false) String keyword,
            @ParameterObject
            @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(postService.getList(keyword, pageable));
    }

    @PutMapping("/{id}")                                            // PUT /api/posts/1
    public ApiResponse<Long> update(@PathVariable Long id,
                                    @Valid @RequestBody PostUpdateRequest req) {
        return ApiResponse.ok(postService.update(id, req));
    }

    @DeleteMapping("/{id}")                                         // DELETE /api/posts/1
    public ApiResponse<Void> delete(@PathVariable Long id) {
        postService.delete(id);
        return ApiResponse.ok(null);
    }
}
```

#### 어노테이션 정리 — "값을 어디서 꺼내나?"

| 어노테이션 | 값이 있는 곳 | 예시 |
|---|---|---|
| `@PathVariable` | URL 경로 안 | `/api/posts/`**`1`** |
| `@RequestParam` | 쿼리스트링 | `/api/posts?`**`keyword=스프링`** |
| `@RequestBody` | 요청 본문(JSON) | `{ "title": "..", "content": ".." }` |
| `Pageable` | 쿼리스트링 (자동) | `?page=0&size=10&sort=viewCount,desc` |

#### 목록 API — 쿼리스트링에 따라 달라지는 부분

`Pageable` 하나가 `page`, `size`, `sort` 쿼리스트링을 **자동으로** 읽습니다.

```
GET /api/posts                                  → 1페이지, 10개, 최신순 (id desc, @PageableDefault)
GET /api/posts?page=1                           → 2페이지 (0부터 시작!)
GET /api/posts?size=5                           → 5개씩
GET /api/posts?sort=viewCount,desc              → 조회수 높은 순
GET /api/posts?keyword=스프링                     → 제목 또는 내용에 "스프링" 포함
GET /api/posts?keyword=스프링&sort=createdAt,asc&page=0&size=20   → 조합 가능
```

- `@PageableDefault` — 쿼리스트링이 없을 때 쓸 기본값.
- `@ParameterObject` — Swagger 화면에 `page`, `size`, `sort` 입력칸이 예쁘게 나오게 하는 용도 (동작과는 무관).
- `sort`에는 **DB 컬럼명이 아니라 Entity 필드명**(`viewCount`, `createdAt`)을 씁니다.

#### `@Valid` — 이게 없으면 검증이 안 됩니다

`@Valid`가 붙어야 DTO의 `@NotBlank`, `@Size`가 검사됩니다. 실패하면 Controller 메서드는 **실행조차 안 되고** `MethodArgumentNotValidException`이 발생 → STEP 9에서 처리.

#### Controller는 얇게

Controller에는 `if`, 계산, DB 호출이 **없습니다.** 받고 → Service에 넘기고 → 감싸서 돌려줄 뿐입니다.

#### `TEMP_USER_ID = 1L`

아직 로그인 기능이 없어서, 모든 글을 **회원 id 1번이 쓴 것으로** 처리합니다. 그래서 `seed_data.sql`로 1번 회원을 꼭 넣어야 합니다. 로그인 구현 후 "현재 로그인한 사용자 id"로 바꿀 예정입니다.

---

### STEP 9. GlobalExceptionHandler — "에러를 한 곳에서 처리"

```java
@Slf4j
@RestControllerAdvice                 // 모든 Controller에서 터진 예외를 여기서 잡는다
public class GlobalExceptionHandler {

    // 서비스에서 직접 던진 예외 (게시글 없음, 회원 없음 등)
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException e) {
        ErrorCode code = e.getErrorCode();
        return ResponseEntity
                .status(code.getStatus())             // ErrorCode에 적어둔 상태 (예: 404)
                .body(ApiResponse.fail(code));
    }

    // @Valid 검증 실패 (제목 빈 값, 200자 초과 등)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors()
                .forEach(err -> fields.putIfAbsent(err.getField(), err.getDefaultMessage()));

        ErrorCode code = ErrorCode.INVALID_INPUT;
        return ResponseEntity
                .status(code.getStatus())             // 400
                .body(ApiResponse.fail(code, fields));
    }

    // 그 밖에 예상하지 못한 모든 예외
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("Unhandled exception", e);          // 서버 로그에는 자세히 남기고
        ErrorCode code = ErrorCode.INTERNAL_ERROR;
        return ResponseEntity
                .status(code.getStatus())             // 500, 클라이언트에는 간단히
                .body(ApiResponse.fail(code));
    }
}
```

**흐름**

```
Service: throw new BusinessException(POST_NOT_FOUND)
   ↓ (Controller를 뚫고 올라감)
GlobalExceptionHandler.handleBusiness() 가 잡음
   ↓
404 + { "success": false, "error": { "code": "P001", "message": "게시글을 찾을 수 없습니다." } }
```

검증 실패 응답 예시:

```json
{
  "success": false,
  "error": {
    "code": "C001",
    "message": "입력값이 올바르지 않습니다.",
    "fields": { "title": "제목은 필수입니다." }
  }
}
```

→ 이 파일 덕분에 **Controller/Service에는 try-catch가 하나도 없습니다.**

---

### STEP 10. 실행하고 확인하기

```
cd backend
./gradlew bootRun
```

브라우저에서 **http://localhost:8080/swagger-ui/index.html** 을 열면 모든 API를 눌러서 테스트할 수 있습니다.

확인 순서 추천:

1. `POST /api/posts` — `{ "title": "테스트", "content": "내용" }` → `201`, `data`에 새 id
2. `GET /api/posts/{id}` — 방금 만든 글. 여러 번 호출하면 `viewCount`가 올라감
3. `GET /api/posts?keyword=테스트` — 검색
4. `PUT /api/posts/{id}` — 제목 바꾸기 → 다시 조회해서 확인, `updatedAt`도 바뀜
5. `DELETE /api/posts/{id}` → 다시 조회하면 `404 P001` (DB에는 `deleted_at`만 채워진 채 남아 있음)
6. `POST /api/posts` 에 `{ "title": "" }` → `400 C001` + `fields`

콘솔에 찍히는 SQL(`show-sql: true`)을 같이 보면 JPA가 무슨 쿼리를 만들었는지 알 수 있습니다. 특히 4번에서 `save()` 없이 `UPDATE`가 나가는 것을 꼭 확인해 보세요.

---

## 3. 요청 하나 끝까지 따라가기 — "글 수정"

`PUT /api/posts/3` 본문 `{ "title": "새 제목", "content": "새 내용" }`

```
① PostController.update(3, req)
   - @PathVariable → id = 3
   - @RequestBody → JSON을 PostUpdateRequest로 변환
   - @Valid → 제목/내용 검사 (실패하면 여기서 끝, 400)

② PostService.update(3, req)          ← @Transactional 시작
   - findPost(3)
       → PostRepository.findByIdAndHiddenFalse(3)
       → SELECT ... FROM posts WHERE id=3 AND hidden=false AND deleted_at IS NULL
       → 없으면 BusinessException(POST_NOT_FOUND) → 404
   - post.update("새 제목", "새 내용")  ← 자바 객체 값만 바뀜
   - return 3
                                     ← @Transactional 끝: 변경 감지 → UPDATE posts SET ... WHERE id=3
                                        @LastModifiedDate → updated_at 자동 갱신

③ PostController
   - ApiResponse.ok(3) → { "success": true, "data": 3 }
```

---

## 4. 혼자 다시 짜기 — 체크리스트

코드를 지우고 다시 짤 때 이 순서대로 체크하세요. **괄호 안 키워드만 기억하면 됩니다.**

- [ ] **0. 준비** — DB 켜고 `schema.sql`, `seed_data.sql` 실행
- [ ] **1. BaseTimeEntity** — (`@MappedSuperclass`, `@EntityListeners`, `@CreatedDate`, `@LastModifiedDate`) + `@EnableJpaAuditing`
- [ ] **2. Entity** — (`@Entity`, `@Table`, `@Id`, `@GeneratedValue`, `@Column`, `@ManyToOne(LAZY)`, `@JoinColumn`)
  - [ ] `@Getter`, `@NoArgsConstructor(PROTECTED)`, `@Setter` 금지
  - [ ] `@Builder` 생성자에 기본값
  - [ ] 변경 메서드: `update()`, `increaseViewCount()`, `delete()`
  - [ ] 소프트 삭제: `deletedAt` + `@SQLRestriction("deleted_at IS NULL")`
- [ ] **3. Repository** — `extends JpaRepository<Entity, Long>`
  - [ ] `findByIdAndHiddenFalse` (이름 쿼리)
  - [ ] `search` (`@Query` + `Pageable` + `@EntityGraph`)
- [ ] **4. 에러** — `ErrorCode` enum(status, code, message) + `BusinessException extends RuntimeException`
- [ ] **5. DTO** — `record`
  - [ ] CreateRequest: `@NotBlank`, `@Size`, `toEntity(User)`
  - [ ] UpdateRequest: 검증만
  - [ ] Response: `static from(Entity)`
- [ ] **6. Service** — `@Service`, `@RequiredArgsConstructor`, 클래스에 `@Transactional(readOnly = true)`
  - [ ] create: 작성자 찾기 → `toEntity` → `save` → id 반환
  - [ ] get: `findPost` → 조회수+1 → `from` (쓰기 트랜잭션!)
  - [ ] getList: keyword 정리 → `search` → `map(from)` → `PageResponse.from`
  - [ ] update: `findPost` → `update()` (save 없음)
  - [ ] delete: `findPost` → `delete()` (save 없음)
- [ ] **7. 응답 상자** — `ApiResponse.ok / fail`, `PageResponse.from(Page)`
- [ ] **8. Controller** — `@RestController`, `@RequestMapping("/api/posts")`
  - [ ] `@PostMapping`(201) / `@GetMapping("/{id}")` / `@GetMapping` / `@PutMapping("/{id}")` / `@DeleteMapping("/{id}")`
  - [ ] `@Valid @RequestBody`, `@PathVariable`, `@RequestParam`, `@PageableDefault`
- [ ] **9. GlobalExceptionHandler** — `@RestControllerAdvice` + `@ExceptionHandler` 3개
- [ ] **10. Swagger로 테스트**

### 연습 방법 추천

1. **1회차**: 이 문서를 옆에 켜 두고 따라 치기
2. **2회차**: 체크리스트(4장)만 보고 치기. 막히면 해당 STEP만 다시 보기
3. **3회차**: 아무것도 안 보고 치기. 다 쓰고 `./gradlew compileJava`로 확인
4. **응용**: 같은 방식으로 **댓글(comments)** CRUD 만들어 보기 — 구조가 거의 똑같습니다
   (Comment Entity에 `@ManyToOne Post post` 하나가 더 있을 뿐)

---

## 5. 자주 만나는 에러와 원인

실제로 이 프로젝트에서 겪었던 것들입니다.

| 증상 | 원인 | 해결 |
|---|---|---|
| `cannot find symbol: class User` | import 누락 | IntelliJ에서 `Alt + Enter` → import |
| `cannot find symbol: class Pageable` | import 누락 (`org.springframework.data.domain.Pageable`) | 같은 이름의 다른 패키지를 고르지 않게 주의 |
| `cannot find symbol: method getUpdatedAt()` | 필드명 오타 (`updateAt`) | 필드명 = 컬럼명의 카멜케이스. `updated_at` → `updatedAt` |
| `cannot find symbol: variable USER_NOT_FOUND` | `ErrorCode`에 항목을 안 만듦 | enum에 추가 |
| 서버 시작 시 `Schema-validation: missing column [...]` | Entity 필드와 테이블 컬럼 불일치 (`ddl-auto: validate`) | 필드명 오타 확인, 또는 `schema.sql` 확인 |
| 서버 시작 시 `Schema-validation: missing table [posts]` | 테이블을 안 만듦 | `docs/sql/schema.sql` 실행 |
| 글 작성 시 `U001 회원을 찾을 수 없습니다` | users 테이블에 id=1 회원이 없음 | `docs/sql/seed_data.sql` 실행 |
| 수정했는데 DB가 안 바뀜 | Service 메서드에 `@Transactional` 누락 (readOnly 상태) | 쓰기 메서드에 `@Transactional` |
| 검증 어노테이션이 동작 안 함 | Controller 파라미터에 `@Valid` 누락 | `@Valid @RequestBody` |
| 에러가 전부 500으로 나감 | `GlobalExceptionHandler`가 비어 있거나 `@RestControllerAdvice` 누락 | STEP 9 참고 |

---

## 6. 명세서(02_API_명세서.md) 대비 아직 안 한 것

지금 코드는 **기본 CRUD 뼈대**입니다. 명세서와 비교하면 다음이 남아 있습니다.

| 항목 | 명세 | 현재 |
|---|---|---|
| 목록 `searchType` | `TITLE`, `CONTENT`, `TITLE_CONTENT`, `NICKNAME` | 제목+내용 검색만 |
| 목록 `userId` 필터 | 특정 작성자 글만 | 없음 |
| 목록 정렬 파라미터 | `sort=createdAt&order=desc` 두 개로 분리 | Spring 기본 방식 `sort=createdAt,desc` 하나 |
| 목록 기본 크기 | 20 | 10 |
| 목록 항목 | `commentCount`, `hasAttachment` 포함 | 없음 (상세와 같은 `PostResponse` 사용) |
| 첨부파일 | `fileIds`, `files[]` | 없음 |
| 인증/권한 | 작성·수정·삭제는 로그인 필요, 본인/ADMIN만 | `TEMP_USER_ID = 1` 고정, 권한 체크 없음 (`POST_FORBIDDEN` 미구현) |
| 삭제 응답 | `204 No Content` | `200` + `{ "success": true }` |
| 에러 코드 형식 | `POST_NOT_FOUND`, `COMMON_INVALID_INPUT` | `P001`, `C001` |

다음 단계로는 **로그인(인증) → 작성자 본인만 수정/삭제 → 목록 검색 조건 확장** 순서를 추천합니다.
