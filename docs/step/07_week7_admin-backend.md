# 7주차 · 관리자 백엔드 (11/9~15 · 12h)

> 실무 목록 화면의 백엔드 패턴 — **조건이 바뀌는 동적 검색, 일괄 처리, 엑셀 다운로드, 권한** — 을 익힌다.
> ERD에 이미 있는 `users.role`·`status`·`last_login_at`, `posts.hidden`·`deleted_at`, 인덱스를 그대로 활용한다(스키마 변경 없음).
> 각 단계는 **🎯 목표 → 🤔 왜 지금 → 📄 파일 → ⌨️ 코드 → 🔍 원리 → ✔ 확인** 순서.

---

## 🗺 전체 흐름

```text
관리자 화면(8주차) ── GET /api/admin/users?keyword=김&status=ACTIVE&joinedFrom=2026-10-01&page=0&sort=createdAt,desc
                          │
                          ▼
  @PreAuthorize("hasRole('ADMIN')")  ── 일반 사용자면 403 (3주차 AccessDeniedHandler)
  AdminUserController
      │  조건 DTO(AdminUserSearchCondition) ── 목록과 엑셀이 같은 DTO를 공유
      ▼
  AdminUserQueryRepository (QueryDSL)
      │  where( keywordContains(), statusEq(), roleEq(), joinedBetween() )
      │         ↑ 값이 null이면 null을 돌려줘 조건에서 자동 제외
      ▼
  MySQL (idx_users_status_created 인덱스)

일괄 처리:  PATCH /api/admin/posts/hidden  { ids: [3,5,9], hidden: true }  → UPDATE ... WHERE id IN (...)
엑셀:      GET /api/admin/users/excel?같은조건  → SXSSFWorkbook 스트리밍
```

**핵심 한 줄**: 검색 조건은 **DTO 하나**, 조건 하나는 **메서드 하나**. 목록·엑셀·건수가 모두 같은 조건 메서드를 쓰면 "화면과 엑셀 데이터가 다르다"는 결함이 생길 수 없다.

## 📋 순서표

| # | 할 일 | 파일 | 끝나면 확인할 것 |
|---|---|---|---|
| 1 | QueryDSL 설정 | `build.gradle`, `QuerydslConfig` | Q클래스 생성 |
| 2 | 메서드 보안 · 관리자 계정 | `SecurityConfig`, SQL | 관리자 로그인 |
| 3 | 검색 조건 DTO · 응답 DTO | `admin/dto/*` | 컴파일 OK |
| 4 | 회원 동적 검색 | `AdminUserQueryRepository` | 조건 조합별 건수 |
| 5 | 게시글 동적 검색 | `AdminPostQueryRepository` | 숨김 포함 검색 |
| 6 | 권한 변경 · 정지 · 해제 | `User`, `AdminUserService` | 정지 즉시 토큰 폐기 |
| 7 | 게시글 일괄 숨김 · 삭제 | `PostRepository`, `AdminPostService` | 3건 한 번에 |
| 8 | 컨트롤러 | `AdminUserController`, `AdminPostController` | 일반 사용자 403 |
| 9 | 엑셀 다운로드 | `ExcelWriter`, 컨트롤러 | 조건 적용된 xlsx |
| 10 | 대시보드 요약 | `AdminDashboardService` | 숫자 카드 API |
| 11 | 성능 확인 · 인덱스 | `EXPLAIN`, 테스트 데이터 | 인덱스 사용 확인 |
| 12 | 테스트 | `AdminUserQueryRepositoryTest`, `AdminApiTest` | 통과 |

---

## 1 · QueryDSL 설정

**🎯 목표**: 조건이 바뀌는 쿼리를 **자바 코드로 타입 안전하게** 조립할 수 있게 한다.

**🤔 왜 지금**: 1주차 `@Query` JPQL은 조건이 고정일 때 좋다. 관리자 검색처럼 "이름만, 상태만, 기간+상태+권한..." 조합이 수십 가지면 문자열 JPQL로는 감당이 안 된다.

**📄 파일**: `build.gradle`, `global/config/QuerydslConfig.java`

```groovy
dependencies {
    implementation 'com.querydsl:querydsl-jpa:5.1.0:jakarta'
    annotationProcessor 'com.querydsl:querydsl-apt:5.1.0:jakarta'
    annotationProcessor 'jakarta.annotation:jakarta.annotation-api'
    annotationProcessor 'jakarta.persistence:jakarta.persistence-api'

    implementation 'org.apache.poi:poi-ooxml:5.3.0'   // 9번 엑셀
}

// 생성된 Q클래스 위치를 명확히 (선택)
def querydslDir = layout.buildDirectory.dir("generated/querydsl").get().asFile
tasks.withType(JavaCompile).configureEach {
    options.generatedSourceOutputDirectory = querydslDir
}
clean { delete querydslDir }
```

```java
@Configuration
public class QuerydslConfig {

    @PersistenceContext
    private EntityManager em;

    @Bean
    public JPAQueryFactory jpaQueryFactory() {
        return new JPAQueryFactory(em);
    }
}
```

**🔍 원리**
- QueryDSL은 컴파일할 때 엔티티마다 **Q클래스**(`QUser`, `QPost`)를 만든다. `user.nickname.contains("김")`처럼 쓰면 필드명 오타가 **컴파일 에러**로 잡힌다. JPQL 문자열의 오타는 실행해야 알 수 있다.
- `:jakarta` 분류자: Spring Boot 3는 `javax.persistence`가 아니라 `jakarta.persistence`를 쓴다. 분류자 없이 받으면 javax용 Q클래스가 생겨서 컴파일이 깨진다. **AI가 가장 자주 틀리는 설정**이다.
- 참고: 원조 QueryDSL 5.x는 업데이트가 뜸해서, 실무에서는 활발히 관리되는 포크 `io.github.openfeign.querydsl`(6.x)로 넘어가는 추세다. 문법은 거의 같다.
- `JPAQueryFactory`를 빈으로 등록해 두면 Repository마다 주입받아 쓴다.

**✔ 확인**: `./gradlew compileJava` → `build/generated/querydsl`에 `QUser.java`, `QPost.java`가 생성되면 성공. IntelliJ에서 빨간 줄이 남으면 Gradle 새로고침 → **Build → Rebuild Project**.

---

## 2 · 메서드 보안 · 관리자 계정

**🎯 목표**: `@PreAuthorize`를 켜고, 관리자 계정을 하나 만든다.

**📄 파일**: `global/config/SecurityConfig.java`, SQL

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity          // ← 추가: @PreAuthorize 사용
@RequiredArgsConstructor
public class SecurityConfig {
    // ...3주차 그대로. URL 규칙에도 한 줄 추가(이중 방어)
    //   .requestMatchers("/api/admin/**").hasRole("ADMIN")
    // anyRequest() 보다 위에 둔다
}
```

```sql
-- 가입 API로 admin01 계정을 만든 뒤 권한만 올린다 (비밀번호 해시를 SQL로 만들 필요 없음)
UPDATE users SET role = 'ADMIN' WHERE login_id = 'admin01';
```

**🔍 원리**
- **이중 방어**: URL 규칙(`/api/admin/**` → ADMIN)과 메서드 규칙(`@PreAuthorize`)을 둘 다 둔다. 누가 관리자 API를 `/api/admin` 밖에 실수로 만들어도 메서드 규칙이 막는다.
- `hasRole('ADMIN')`은 `ROLE_ADMIN` 권한을 찾는다. 3주차 JWT 필터가 `"ROLE_" + role`로 넣어 둔 이유다.
- 권한은 **토큰 안의 role**을 본다. DB에서 role을 바꿔도 **이미 발급된 Access Token(최대 30분)**에는 옛 role이 남는다. 그래서 권한 변경 시 6번에서 그 회원의 Refresh를 폐기해 다음 재발급 때 새 role이 반영되게 한다.
- 관리자 가입 API를 따로 만들지 않는다. 관리자는 **DB 작업으로만** 만들 수 있어야 안전하다.

**✔ 확인**: admin01로 로그인 → 응답 `user.role`이 `ADMIN`.

---

## 3 · 검색 조건 DTO · 응답 DTO

**🎯 목표**: 화면의 검색 폼을 그대로 옮긴 조건 DTO와, 관리자용 응답 DTO를 만든다.

**📄 파일**: `admin/dto/AdminUserSearchCondition.java`, `AdminUserResponse.java`, `AdminPostSearchCondition.java`, `AdminPostResponse.java`, `IdsRequest.java`

```java
// 회원 검색 조건 — 모든 필드가 선택(null 가능)
public record AdminUserSearchCondition(
        String keyword,            // 아이디·닉네임·이메일 중 포함
        UserStatus status,
        Role role,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate joinedFrom,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate joinedTo,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate lastLoginBefore  // 휴면 후보 찾기
) {
}

public record AdminUserResponse(
        Long id, String loginId, String nickname, String email,
        Role role, UserStatus status,
        LocalDateTime createdAt, LocalDateTime lastLoginAt, LocalDateTime deletedAt) {

    @QueryProjection   // QueryDSL이 이 생성자로 바로 DTO를 만든다
    public AdminUserResponse {
    }
}
```

```java
public record AdminPostSearchCondition(
        String keyword,            // 제목·내용
        String writer,             // 작성자 아이디·닉네임
        Boolean hidden,            // null=전체, true=숨김만, false=공개만
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
) {
}

public record AdminPostResponse(
        Long id, String title, Long writerId, String writerLoginId, String writerNickname,
        int viewCount, boolean hidden, LocalDateTime createdAt) {

    @QueryProjection
    public AdminPostResponse {
    }
}

// 일괄 처리 요청
public record IdsRequest(
        @NotEmpty(message = "대상을 선택하세요.")
        @Size(max = 100, message = "한 번에 100건까지 처리할 수 있습니다.")
        List<@NotNull Long> ids) {
}
```

**🔍 원리**
- 컨트롤러에서 `@ModelAttribute`(생략 가능)로 받으면 `?keyword=김&status=ACTIVE`가 record 필드에 자동으로 들어간다. 없는 파라미터는 **null**이 된다 — 이 null이 4번 "조건 자동 제외"의 핵심이다.
- `Boolean hidden`(대문자): 소문자 `boolean`은 null이 될 수 없어서 "전체"를 표현할 수 없다.
- `@QueryProjection`: 엔티티를 전부 꺼낸 뒤 DTO로 바꾸는 대신, **필요한 컬럼만 SELECT**해서 바로 DTO를 만든다. 목록·엑셀처럼 행이 많을 때 효과가 크다. 대가로 DTO가 QueryDSL에 의존하게 된다(관리자 전용 DTO라서 허용).
- 관리자 응답에는 일반 응답에 없는 `status`, `deletedAt`, `hidden`, `loginId`가 있다. **같은 엔티티라도 보는 사람에 따라 DTO를 나눈다**(1주차 원칙의 확장).
- 일괄 처리 최대 100건: 실수로 전체 선택 후 삭제하는 사고, 한 트랜잭션이 너무 커지는 문제를 막는다.

**✔ 확인**: 컴파일 → `QAdminUserResponse`, `QAdminPostResponse` 생성.

---

## 4 · 회원 동적 검색 (`AdminUserQueryRepository`)

**🎯 목표**: 조건이 있으면 넣고 없으면 빼는 검색 + 페이징 + 정렬을 만든다.

**🤔 왜 지금**: 이번 주의 핵심 패턴이다. 게시글 검색(5번)과 엑셀(9번)이 이 구조를 그대로 따른다.

**📄 파일**: `admin/repository/AdminUserQueryRepository.java`

```java
@Repository
@RequiredArgsConstructor
public class AdminUserQueryRepository {

    private final JPAQueryFactory query;

    public Page<AdminUserResponse> search(AdminUserSearchCondition cond, Pageable pageable) {
        List<AdminUserResponse> content = query
                .select(projection())
                .from(user)
                .where(conditions(cond))
                .orderBy(orderSpecifiers(pageable.getSort()))
                .offset(pageable.getOffset())
                .limit(pageable.getPageSize())
                .fetch();

        JPAQuery<Long> countQuery = query
                .select(user.count())
                .from(user)
                .where(conditions(cond));

        return PageableExecutionUtils.getPage(content, pageable, countQuery::fetchOne);
    }

    /** 엑셀용: 페이징 없이 최대 maxRows건 */
    public List<AdminUserResponse> searchAll(AdminUserSearchCondition cond, int maxRows) {
        return query.select(projection())
                .from(user)
                .where(conditions(cond))
                .orderBy(user.createdAt.desc())
                .limit(maxRows)
                .fetch();
    }

    private QAdminUserResponse projection() {
        return new QAdminUserResponse(user.id, user.loginId, user.nickname, user.email,
                user.role, user.status, user.createdAt, user.lastLoginAt, user.deletedAt);
    }

    /** 목록·건수·엑셀이 모두 이 메서드 하나를 쓴다 */
    private Predicate[] conditions(AdminUserSearchCondition c) {
        return new Predicate[]{
                keywordContains(c.keyword()),
                statusEq(c.status()),
                roleEq(c.role()),
                joinedFrom(c.joinedFrom()),
                joinedTo(c.joinedTo()),
                lastLoginBefore(c.lastLoginBefore())
        };
    }

    // ── 조건 하나 = 메서드 하나. 값이 없으면 null → where에서 무시됨 ─────────
    private BooleanExpression keywordContains(String keyword) {
        if (!StringUtils.hasText(keyword)) return null;
        String k = keyword.trim();
        return user.loginId.contains(k).or(user.nickname.contains(k)).or(user.email.contains(k));
    }

    private BooleanExpression statusEq(UserStatus status) {
        return status == null ? null : user.status.eq(status);
    }

    private BooleanExpression roleEq(Role role) {
        return role == null ? null : user.role.eq(role);
    }

    private BooleanExpression joinedFrom(LocalDate from) {
        return from == null ? null : user.createdAt.goe(from.atStartOfDay());
    }

    private BooleanExpression joinedTo(LocalDate to) {
        return to == null ? null : user.createdAt.lt(to.plusDays(1).atStartOfDay());
    }

    private BooleanExpression lastLoginBefore(LocalDate date) {
        return date == null ? null
                : user.lastLoginAt.isNull().or(user.lastLoginAt.lt(date.atStartOfDay()));
    }

    // ── 정렬: 허용한 필드만 (화이트리스트) ──────────────────────────────────
    private static final Map<String, ComparableExpressionBase<?>> SORTABLE = Map.of(
            "createdAt", user.createdAt,
            "lastLoginAt", user.lastLoginAt,
            "loginId", user.loginId,
            "nickname", user.nickname
    );

    private OrderSpecifier<?>[] orderSpecifiers(Sort sort) {
        List<OrderSpecifier<?>> orders = new ArrayList<>();
        for (Sort.Order o : sort) {
            ComparableExpressionBase<?> path = SORTABLE.get(o.getProperty());
            if (path != null) {
                orders.add(o.isAscending() ? path.asc() : path.desc());
            }
        }
        if (orders.isEmpty()) orders.add(user.createdAt.desc());
        orders.add(user.id.desc());   // 같은 값일 때 순서 고정 (페이지 넘길 때 중복·누락 방지)
        return orders.toArray(OrderSpecifier[]::new);
    }
}
// import static com.example.board.user.QUser.user;
```

**🔍 원리**
- **null이면 조건에서 빠진다**: QueryDSL `where(a, b, c)`는 null인 조건을 **무시**한다. 그래서 `if (status != null) query.where(...)` 같은 분기 없이, 조건마다 "값이 없으면 null을 돌려주는 메서드"만 만들면 된다. 실무 표준 패턴이다.
- 조건 메서드를 **이름 있는 부품**으로 만들면 재사용·조합이 쉽다. `statusEq(ACTIVE).and(joinedFrom(...))`처럼 다른 쿼리에서도 쓸 수 있다.
- **날짜 범위는 `>= 시작일 00:00` 그리고 `< 다음날 00:00`**: `<= 2026-10-31`로 쓰면 `2026-10-31 00:00:00`까지만 포함돼 그날 가입자가 빠진다. `created_at`이 `DATETIME(6)`이라 흔한 결함이다.
- **count 쿼리 분리 + `PageableExecutionUtils`**: 마지막 페이지이거나 첫 페이지 내용이 페이지 크기보다 적으면 전체 건수를 이미 알 수 있어서 **count 쿼리를 생략**한다.
- **정렬 화이트리스트**: 클라이언트가 보낸 `sort=password,asc`를 그대로 쓰면 비밀번호 순 정렬로 정보를 추측할 수 있다. 허용한 필드만 정렬한다.
- `user.id.desc()` 보조 정렬: 가입일이 같은 회원이 여럿이면 DB가 순서를 보장하지 않아, 페이지를 넘길 때 같은 사람이 두 번 나오거나 빠진다.
- 탈퇴 회원(`WITHDRAWN`)도 검색된다. 관리자는 모든 회원을 봐야 한다(`User`에 `@SQLRestriction`을 걸지 않은 3주차 결정).
- `keyword`의 `contains`는 `LIKE '%김%'`라서 **인덱스를 못 탄다**. 11번에서 확인한다.

**✔ 확인**: 12번 Repository 테스트 또는 8번 이후 Swagger.

---

## 5 · 게시글 동적 검색 (`AdminPostQueryRepository`)

**🎯 목표**: 관리자는 **숨김 글까지** 검색한다. 작성자 조건을 위해 users를 조인한다.

**📄 파일**: `admin/repository/AdminPostQueryRepository.java`

```java
@Repository
@RequiredArgsConstructor
public class AdminPostQueryRepository {

    private final JPAQueryFactory query;

    public Page<AdminPostResponse> search(AdminPostSearchCondition c, Pageable pageable) {
        List<AdminPostResponse> content = query
                .select(new QAdminPostResponse(post.id, post.title, user.id, user.loginId, user.nickname,
                        post.viewCount, post.hidden, post.createdAt))
                .from(post)
                .join(post.user, user)
                .where(keywordContains(c.keyword()), writerContains(c.writer()),
                        hiddenEq(c.hidden()), createdFrom(c.from()), createdTo(c.to()))
                .orderBy(post.createdAt.desc(), post.id.desc())
                .offset(pageable.getOffset())
                .limit(pageable.getPageSize())
                .fetch();

        JPAQuery<Long> count = query.select(post.count())
                .from(post)
                .join(post.user, user)
                .where(keywordContains(c.keyword()), writerContains(c.writer()),
                        hiddenEq(c.hidden()), createdFrom(c.from()), createdTo(c.to()));

        return PageableExecutionUtils.getPage(content, pageable, count::fetchOne);
    }

    private BooleanExpression keywordContains(String k) {
        return StringUtils.hasText(k) ? post.title.contains(k).or(post.content.contains(k)) : null;
    }

    private BooleanExpression writerContains(String w) {
        return StringUtils.hasText(w) ? user.loginId.contains(w).or(user.nickname.contains(w)) : null;
    }

    private BooleanExpression hiddenEq(Boolean hidden) {
        return hidden == null ? null : post.hidden.eq(hidden);
    }

    private BooleanExpression createdFrom(LocalDate from) {
        return from == null ? null : post.createdAt.goe(from.atStartOfDay());
    }

    private BooleanExpression createdTo(LocalDate to) {
        return to == null ? null : post.createdAt.lt(to.plusDays(1).atStartOfDay());
    }
}
```

**🔍 원리**
- 일반 사용자용 1주차 `search`는 `hidden = false`가 **고정**이었다. 관리자용은 `hidden`이 **선택 조건**이다. 같은 테이블이라도 사용자에 따라 쿼리를 분리한다.
- **삭제된 글**: `Post`의 `@SQLRestriction("deleted_at IS NULL")`은 QueryDSL 쿼리에도 자동으로 붙는다. 관리자가 삭제 글까지 봐야 한다면 엔티티 쿼리가 아니라 native SQL이나 별도 조회용 엔티티가 필요하다(선택 과제). "삭제는 복구 불가, 숨김은 복구 가능"으로 운영 정책을 나누는 게 보통이다.
- 작성자 조건이 없을 때도 `join`을 하는 이유: 응답에 작성자 아이디·닉네임이 필요하기 때문이다. `@QueryProjection`으로 필요한 컬럼만 가져오므로 N+1도 없다.
- 본문 `content`(TEXT)는 SELECT하지 않는다. 목록에 필요 없는 큰 컬럼을 빼는 것만으로 응답이 크게 가벼워진다.

**✔ 확인**: 숨김 글 하나 만들고(`UPDATE posts SET hidden=1 WHERE id=1`) → `hidden=true` 검색에 그 글만.

---

## 6 · 권한 변경 · 정지 · 해제

**🎯 목표**: 회원 권한 변경, 계정 정지·해제를 만든다. **정지 즉시 모든 기기 로그아웃**까지 해야 완결이다.

**📄 파일**: `user/User.java`(메서드), `admin/service/AdminUserService.java`, `ErrorCode`

```java
// User
public void changeRole(Role role) { this.role = role; }

public void suspend() {
    if (status == UserStatus.WITHDRAWN) throw new BusinessException(ErrorCode.INVALID_INPUT);
    this.status = UserStatus.SUSPENDED;
}

public void activate() {
    if (status == UserStatus.WITHDRAWN) throw new BusinessException(ErrorCode.INVALID_INPUT);
    this.status = UserStatus.ACTIVE;
}

// ErrorCode
CANNOT_CHANGE_SELF(HttpStatus.BAD_REQUEST, "AD001", "자기 자신의 권한·상태는 바꿀 수 없습니다."),
```

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminUserService {

    private final AdminUserQueryRepository userQueryRepository;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    public PageResponse<AdminUserResponse> search(AdminUserSearchCondition cond, Pageable pageable) {
        return PageResponse.from(userQueryRepository.search(cond, pageable));
    }

    @Transactional
    public void changeRole(Long adminId, Long userId, Role role) {
        User user = findTarget(adminId, userId);
        user.changeRole(role);
        revokeAll(userId);   // 다음 재발급 때 새 role이 토큰에 반영되도록
    }

    @Transactional
    public void suspend(Long adminId, Long userId) {
        User user = findTarget(adminId, userId);
        user.suspend();
        revokeAll(userId);   // 정지 즉시 모든 기기에서 재발급 불가
    }

    @Transactional
    public void activate(Long adminId, Long userId) {
        findTarget(adminId, userId).activate();
    }

    private User findTarget(Long adminId, Long userId) {
        if (adminId.equals(userId)) {
            throw new BusinessException(ErrorCode.CANNOT_CHANGE_SELF);
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    private void revokeAll(Long userId) {
        refreshTokenRepository.revokeAllByUserId(userId, LocalDateTime.now());
    }
}
```

**🔍 원리**
- **정지의 완결 조건**: `status = SUSPENDED`만 바꾸면 ① 이미 받은 Access Token은 최대 30분 유효 ② Refresh로 7일간 계속 재발급된다. 3주차 `reissue`가 `checkLoginable`로 정지 계정을 막지만, **Refresh 폐기까지 해야** 모든 기기에서 즉시 재발급이 끊긴다. 남은 Access 30분이 문제라면 Access 수명을 줄이거나, 민감 API에서 DB 상태를 한 번 더 확인한다.
- **자기 자신 변경 금지**: 관리자가 실수로 자기 권한을 USER로 내리면 관리자 화면에서 쫓겨나고 되돌릴 수 없다. 마지막 관리자를 잃는 사고를 막는다.
- 상태 전이 규칙(탈퇴 회원은 정지·해제 불가)을 **엔티티 메서드 안에** 둔다. 서비스 여러 곳에서 상태를 바꿔도 규칙이 한 곳에서 지켜진다.

**✔ 확인**: B 정지 → B의 `refresh_tokens` 전부 revoked → B 브라우저에서 30분 안에 재발급 실패로 로그아웃, B 로그인 시 403 A004.

---

## 7 · 게시글 일괄 숨김 · 삭제

**🎯 목표**: 체크한 여러 글을 **쿼리 한 번**으로 숨김/공개/삭제한다.

**📄 파일**: `post/PostRepository.java`, `admin/service/AdminPostService.java`

```java
// PostRepository 추가 — 벌크 UPDATE
@Modifying(clearAutomatically = true, flushAutomatically = true)
@Query("update Post p set p.hidden = :hidden, p.updatedAt = :now where p.id in :ids")
int bulkUpdateHidden(@Param("ids") List<Long> ids, @Param("hidden") boolean hidden,
                     @Param("now") LocalDateTime now);

@Modifying(clearAutomatically = true, flushAutomatically = true)
@Query("update Post p set p.deletedAt = :now, p.updatedAt = :now where p.id in :ids")
int bulkSoftDelete(@Param("ids") List<Long> ids, @Param("now") LocalDateTime now);
```

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminPostService {

    private final AdminPostQueryRepository postQueryRepository;
    private final PostRepository postRepository;

    public PageResponse<AdminPostResponse> search(AdminPostSearchCondition cond, Pageable pageable) {
        return PageResponse.from(postQueryRepository.search(cond, pageable));
    }

    @Transactional
    public int changeHidden(List<Long> ids, boolean hidden) {
        return postRepository.bulkUpdateHidden(distinct(ids), hidden, LocalDateTime.now());
    }

    @Transactional
    public int delete(List<Long> ids) {
        return postRepository.bulkSoftDelete(distinct(ids), LocalDateTime.now());
    }

    private List<Long> distinct(List<Long> ids) {
        return ids.stream().distinct().toList();
    }
}
```

**🔍 원리**
- **변경 감지 vs 벌크 UPDATE**: 1주차 수정은 엔티티를 꺼내 값만 바꾸는 변경 감지였다. 100건을 그렇게 하면 SELECT 1번 + UPDATE **100번**이 나간다. 벌크 UPDATE는 `WHERE id IN (...)` **1번**이다.
- 벌크 UPDATE는 영속성 컨텍스트(1차 캐시)를 **건너뛰고 DB를 직접 바꾼다**. 같은 트랜잭션에서 이미 꺼낸 엔티티는 옛 값을 들고 있게 된다. `clearAutomatically = true`로 실행 후 캐시를 비워 불일치를 막는다.
- **Auditing이 동작하지 않는다**: `@LastModifiedDate`는 엔티티 저장 이벤트로 채워지는데 벌크 쿼리는 이벤트가 없다. 그래서 `updatedAt`을 **직접** 넣었다.
- 반환값(`int`)은 실제로 바뀐 행 수다. 화면에 "3건 처리되었습니다"로 보여준다. 요청 5건인데 3건이면 이미 삭제된 글이 섞여 있다는 뜻이다.
- JPQL 벌크 쿼리에는 `@SQLRestriction`이 붙지 않을 수 있다. 이미 삭제된 글을 다시 삭제해도 `deleted_at`만 갱신되므로 큰 문제는 없지만, 정확히 하려면 `and p.deletedAt is null`을 조건에 추가한다.

**✔ 확인**: 3건 선택 숨김 → 콘솔에 UPDATE **1번**, 반환 3, 일반 목록에서 사라짐.

---

## 8 · 컨트롤러

**📄 파일**: `admin/AdminUserController.java`, `admin/AdminPostController.java`

```java
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public ApiResponse<PageResponse<AdminUserResponse>> search(
            @ParameterObject AdminUserSearchCondition cond,
            @ParameterObject @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(adminUserService.search(cond, pageable));
    }

    public record RoleRequest(@NotNull Role role) {}

    @PatchMapping("/{id}/role")
    public ApiResponse<Void> changeRole(@AuthenticationPrincipal LoginUser admin, @PathVariable Long id,
                                        @Valid @RequestBody RoleRequest req) {
        adminUserService.changeRole(admin.id(), id, req.role());
        return ApiResponse.ok(null);
    }

    @PatchMapping("/{id}/suspend")
    public ApiResponse<Void> suspend(@AuthenticationPrincipal LoginUser admin, @PathVariable Long id) {
        adminUserService.suspend(admin.id(), id);
        return ApiResponse.ok(null);
    }

    @PatchMapping("/{id}/activate")
    public ApiResponse<Void> activate(@AuthenticationPrincipal LoginUser admin, @PathVariable Long id) {
        adminUserService.activate(admin.id(), id);
        return ApiResponse.ok(null);
    }
}
```

```java
@RestController
@RequestMapping("/api/admin/posts")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminPostController {

    private final AdminPostService adminPostService;

    @GetMapping
    public ApiResponse<PageResponse<AdminPostResponse>> search(
            @ParameterObject AdminPostSearchCondition cond,
            @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(adminPostService.search(cond, pageable));
    }

    @PatchMapping("/hidden")
    public ApiResponse<Integer> hide(@Valid @RequestBody IdsRequest req) {
        return ApiResponse.ok(adminPostService.changeHidden(req.ids(), true));
    }

    @PatchMapping("/visible")
    public ApiResponse<Integer> show(@Valid @RequestBody IdsRequest req) {
        return ApiResponse.ok(adminPostService.changeHidden(req.ids(), false));
    }

    @PostMapping("/delete")   // 본문이 있는 일괄 삭제는 POST로 (DELETE 본문을 버리는 프록시 대비)
    public ApiResponse<Integer> delete(@Valid @RequestBody IdsRequest req) {
        return ApiResponse.ok(adminPostService.delete(req.ids()));
    }
}
```

**🔍 원리**
- 클래스에 `@PreAuthorize`를 붙이면 **모든 메서드**에 적용된다. 메서드를 추가할 때 깜빡해도 보호된다.
- 권한이 없으면 Spring이 `AccessDeniedException`을 던지고, 3주차 `JsonAccessDeniedHandler`가 403 JSON으로 바꾼다. 단, `@PreAuthorize`의 예외는 **Controller 안에서** 발생하므로 1주차 `GlobalExceptionHandler`의 `Exception.class`(500) 핸들러가 먼저 잡아 버릴 수 있다. 아래처럼 `AccessDeniedException`을 따로 처리하자.

```java
// GlobalExceptionHandler 추가
@ExceptionHandler(AccessDeniedException.class)
public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException e) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.fail(ErrorCode.FORBIDDEN));
}
```

- 일괄 삭제를 `POST /delete`로 둔 것은 실무 타협이다. REST 원칙보다 **확실히 동작하는 것**을 고른다.
- `@ParameterObject`를 조건 DTO에도 붙여야 Swagger에 검색 조건이 입력칸으로 풀려 보인다.

**✔ 확인**
- [ ] 일반 사용자 토큰으로 `GET /api/admin/users` → **403 C403** (500이면 위 핸들러 누락)
- [ ] 관리자: `?keyword=김&status=ACTIVE&joinedFrom=2026-10-01` 조합 검색
- [ ] 자기 자신 정지 → 400 AD001

---

## 9 · 엑셀 다운로드

**🎯 목표**: 목록과 **같은 검색 조건**으로 회원 목록을 xlsx로 내려준다. 대용량에서도 메모리가 터지지 않게 스트리밍한다.

**📄 파일**: `admin/excel/ExcelWriter.java`, `AdminUserController`(메서드 추가)

```java
@Component
public class ExcelWriter {

    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public void writeUsers(List<AdminUserResponse> rows, OutputStream out) throws IOException {
        try (SXSSFWorkbook wb = new SXSSFWorkbook(100)) {   // 메모리에 100행만 유지
            Sheet sheet = wb.createSheet("회원목록");

            CellStyle header = wb.createCellStyle();
            Font bold = wb.createFont();
            bold.setBold(true);
            header.setFont(bold);
            header.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            String[] titles = {"번호", "아이디", "닉네임", "이메일", "권한", "상태", "가입일", "마지막 로그인"};
            Row head = sheet.createRow(0);
            for (int i = 0; i < titles.length; i++) {
                Cell c = head.createCell(i);
                c.setCellValue(titles[i]);
                c.setCellStyle(header);
                sheet.setColumnWidth(i, (i == 3 ? 30 : 15) * 256);
            }

            int r = 1;
            for (AdminUserResponse u : rows) {
                Row row = sheet.createRow(r++);
                row.createCell(0).setCellValue(u.id());
                row.createCell(1).setCellValue(u.loginId());
                row.createCell(2).setCellValue(safe(u.nickname()));
                row.createCell(3).setCellValue(safe(u.email()));
                row.createCell(4).setCellValue(u.role().name());
                row.createCell(5).setCellValue(u.status().name());
                row.createCell(6).setCellValue(u.createdAt().format(DT));
                row.createCell(7).setCellValue(u.lastLoginAt() == null ? "-" : u.lastLoginAt().format(DT));
            }
            sheet.createFreezePane(0, 1);   // 머리글 고정
            wb.write(out);
            wb.dispose();                   // 임시 파일 삭제
        }
    }

    /** =, +, -, @ 로 시작하면 엑셀이 수식으로 실행한다 → 앞에 ' 붙여 문자로 */
    private String safe(String v) {
        if (v == null || v.isEmpty()) return v;
        char f = v.charAt(0);
        return (f == '=' || f == '+' || f == '-' || f == '@') ? "'" + v : v;
    }
}
```

```java
// AdminUserController 추가
private static final int EXCEL_MAX_ROWS = 50_000;
private final AdminUserQueryRepository userQueryRepository;
private final ExcelWriter excelWriter;

@GetMapping("/excel")
public void excel(@ParameterObject AdminUserSearchCondition cond, HttpServletResponse response) throws IOException {
    List<AdminUserResponse> rows = userQueryRepository.searchAll(cond, EXCEL_MAX_ROWS);

    String filename = "회원목록_" + LocalDate.now() + ".xlsx";
    response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString());
    excelWriter.writeUsers(rows, response.getOutputStream());
}
```

**🔍 원리**
- **같은 조건 DTO, 같은 조건 메서드**: 엑셀은 `searchAll`을 쓰는데, 4번의 `conditions(cond)`를 그대로 공유한다. 화면에서 "가입일 10월, 정지 회원"으로 검색하고 엑셀을 누르면 **정확히 같은 결과**가 파일로 나온다. SI 검수에서 "화면은 37건인데 엑셀은 40건" 결함이 나오는 건 두 쿼리를 따로 짰기 때문이다.
- **XSSF vs SXSSF**: XSSF는 모든 행을 메모리에 올린다(수만 건이면 수백 MB). SXSSF는 **최근 100행만 메모리**에 두고 나머지는 임시 파일로 흘려보낸다. 끝나면 `dispose()`로 임시 파일을 지운다.
- **최대 행 제한**: 조건 없이 전체를 내려받으려는 요청이 서버를 멈추지 않게 5만 건으로 자른다. 실무에서는 "5만 건 초과 시 조건을 좁혀 달라"는 안내를 주거나, 비동기로 파일을 만들어 알림으로 보낸다.
- **CSV/수식 인젝션**: 닉네임을 `=HYPERLINK("http://악성사이트")`로 가입하면, 관리자가 엑셀을 열 때 수식이 실행된다. 첫 글자가 수식 기호면 `'`를 붙여 문자로 만든다. 보안 점검 단골 항목이다.
- 응답 본문을 직접 쓰므로 `ApiResponse`를 쓰지 않는다. 에러가 나면 1주차 핸들러가 JSON을 준다 — 프런트는 blob으로 받은 에러를 다시 JSON으로 읽어야 한다(8주차).
- 한글 파일명은 5주차 다운로드와 같은 `ContentDisposition` 방식.

**✔ 확인**: Swagger에서 조건 넣고 호출 → 다운로드된 xlsx를 열어 **행 수가 같은 조건의 목록 `totalElements`와 같은지**, 머리글 고정, 한글 파일명.

---

## 10 · 대시보드 요약

**📄 파일**: `admin/service/AdminDashboardService.java`, `admin/dto/DashboardSummary.java`, 컨트롤러

```java
public record DashboardSummary(
        long totalUsers, long activeUsers, long suspendedUsers, long newUsersToday,
        long totalPosts, long hiddenPosts, long newPostsToday, long newCommentsToday) {
}

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminDashboardService {

    private final JPAQueryFactory query;

    public DashboardSummary summary() {
        LocalDateTime today = LocalDate.now().atStartOfDay();
        return new DashboardSummary(
                count(query.select(user.count()).from(user)),
                count(query.select(user.count()).from(user).where(user.status.eq(UserStatus.ACTIVE))),
                count(query.select(user.count()).from(user).where(user.status.eq(UserStatus.SUSPENDED))),
                count(query.select(user.count()).from(user).where(user.createdAt.goe(today))),
                count(query.select(post.count()).from(post)),
                count(query.select(post.count()).from(post).where(post.hidden.isTrue())),
                count(query.select(post.count()).from(post).where(post.createdAt.goe(today))),
                count(query.select(comment.count()).from(comment).where(comment.createdAt.goe(today))));
    }

    private long count(JPAQuery<Long> q) {
        Long v = q.fetchOne();
        return v == null ? 0 : v;
    }
}

// AdminDashboardController (@PreAuthorize("hasRole('ADMIN')"))
@GetMapping("/api/admin/dashboard")
public ApiResponse<DashboardSummary> summary() { return ApiResponse.ok(dashboardService.summary()); }
```

**🔍 원리**
- 카운트 8개 = 쿼리 8개다. 데이터가 적을 때는 충분히 빠르다. 느려지면 ① `CASE WHEN`으로 테이블당 쿼리 1개로 합치거나 ② 결과를 1분간 캐시(`@Cacheable`)한다.
- `status` 조건 카운트는 `idx_users_status_created (status, created_at)` 인덱스만으로 계산된다(테이블을 읽지 않는 커버링 인덱스). `created_at >= 오늘` 조건은 `idx_posts_created`를 탄다.
- "밀릴 때 줄이는 순서" 1순위가 이 기능이다. 시간이 없으면 건너뛴다.

**✔ 확인**: `GET /api/admin/dashboard` → 숫자 8개.

---

## 11 · 성능 확인 · 인덱스 (`EXPLAIN`)

**🎯 목표**: 테스트 데이터 1만 건을 넣고, 검색 쿼리가 인덱스를 타는지 눈으로 확인한다.

```sql
-- 회원 1만 명 생성 (비밀번호는 아무 BCrypt 해시 하나를 복사해 사용)
SET @hash = (SELECT password FROM users WHERE login_id = 'admin01');
INSERT INTO users (login_id, password, nickname, email, role, status, created_at, updated_at)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 10000)
SELECT CONCAT('user', n), @hash, CONCAT('회원', n), CONCAT('user', n, '@test.com'), 'USER',
       IF(n % 20 = 0, 'SUSPENDED', 'ACTIVE'),
       NOW(6) - INTERVAL (n % 365) DAY, NOW(6)
FROM seq;
-- (재귀 깊이 에러가 나면: SET SESSION cte_max_recursion_depth = 20000;)

-- ① 상태 + 가입일 범위 → idx_users_status_created 사용 기대
EXPLAIN SELECT id, login_id FROM users
WHERE status = 'SUSPENDED' AND created_at >= '2026-10-01' ORDER BY created_at DESC LIMIT 20;

-- ② 키워드 LIKE '%김%' → 인덱스 사용 불가 (type=ALL, 전체 스캔)
EXPLAIN SELECT id FROM users WHERE nickname LIKE '%회원12%';
```

**🔍 원리 — `EXPLAIN` 읽는 법**
- `type`: `ref`/`range`면 인덱스를 탄 것, **`ALL`이면 테이블 전체 스캔**.
- `key`: 실제로 쓴 인덱스 이름. ①에서 `idx_users_status_created`가 보여야 한다.
- `rows`: 읽을 것으로 예상한 행 수. 작을수록 좋다.
- `Extra`에 `Using filesort`: 정렬을 인덱스가 아니라 따로 했다는 뜻. ①은 `(status, created_at)` 순서라 `status`가 같은 행 안에서 `created_at`이 이미 정렬돼 있어 filesort가 없다. **복합 인덱스는 컬럼 순서가 핵심**이다.
- ②처럼 **앞에 `%`가 붙은 LIKE**는 B-Tree 인덱스를 쓸 수 없다(사전에서 "가운데 글자가 '회'인 단어"를 찾는 것과 같다). 회원 수십만 명이면 느려진다. 해결책: `LIKE '김%'`(앞부분 일치)로 요구사항 조정, MySQL FULLTEXT(ngram) 인덱스, 검색 엔진. 인덱스를 **추가**하는 건 ERD 변경이므로 이번 과정에서는 **측정과 이해**까지만 한다.
- 로그의 SQL과 `EXPLAIN` 결과를 AI에게 주고 "성능 문제와 인덱스 제안"을 물어보면 좋은 DB 공부가 된다.

**✔ 확인**: ①은 `key = idx_users_status_created`, ②는 `type = ALL`을 직접 확인하고 차이를 설명할 수 있다.

---

## 12 · 테스트

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
@Import({QuerydslConfig.class, JpaAuditingConfig.class, AdminUserQueryRepository.class})  // Auditing 없으면 created_at NOT NULL 위반
class AdminUserQueryRepositoryTest {

    @Container @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4").withInitScript("schema.sql");

    @Autowired EntityManager em;
    @Autowired AdminUserQueryRepository repository;

    @BeforeEach
    void setUp() {
        persist("kim01", "김철수", UserStatus.ACTIVE);
        persist("kim02", "김영희", UserStatus.SUSPENDED);
        persist("lee01", "이민수", UserStatus.ACTIVE);
        em.flush();
        em.clear();
    }

    @Test
    @DisplayName("조건이 없으면 전체")
    void noCondition() {
        var page = repository.search(new AdminUserSearchCondition(null, null, null, null, null, null), PageRequest.of(0, 10));
        assertThat(page.getTotalElements()).isEqualTo(3);
    }

    @Test
    @DisplayName("키워드만")
    void keywordOnly() {
        var page = repository.search(new AdminUserSearchCondition("김", null, null, null, null, null), PageRequest.of(0, 10));
        assertThat(page.getTotalElements()).isEqualTo(2);
    }

    @Test
    @DisplayName("키워드 + 상태 조합")
    void keywordAndStatus() {
        var page = repository.search(
                new AdminUserSearchCondition("김", UserStatus.SUSPENDED, null, null, null, null), PageRequest.of(0, 10));
        assertThat(page.getContent()).extracting(AdminUserResponse::loginId).containsExactly("kim02");
    }

    @Test
    @DisplayName("가입일 종료일은 그날 하루 전체를 포함한다")
    void joinedToIncludesWholeDay() {
        var page = repository.search(
                new AdminUserSearchCondition(null, null, null, null, LocalDate.now(), null), PageRequest.of(0, 10));
        assertThat(page.getTotalElements()).isEqualTo(3);
    }

    private void persist(String loginId, String nickname, UserStatus status) {
        User u = User.builder().loginId(loginId).password("x").nickname(nickname).email(loginId + "@t.com").build();
        if (status == UserStatus.SUSPENDED) u.suspend();
        em.persist(u);
    }
}
```

```java
// AdminApiTest (MockMvc 통합) 핵심 케이스
// ① 일반 사용자 토큰으로 /api/admin/users → 403 C403
// ② 정지된 계정 로그인 → 403 A004 (3주차 AuthIntegrationTest에 추가해도 됨)
// ③ 엑셀: status 200, Content-Type이 spreadsheetml, Content-Disposition에 filename*=UTF-8
//    받은 바이트를 new XSSFWorkbook(new ByteArrayInputStream(bytes))로 다시 열어
//    sheet.getLastRowNum()이 같은 조건 목록의 totalElements와 같은지 검증
```

**🔍 원리**
- `@DataJpaTest`: JPA 관련 빈만 띄우는 **슬라이스 테스트**. 전체 앱보다 훨씬 빠르다. QueryDSL 설정과 우리 Repository는 `@Import`로 추가한다.
- `replace = NONE`: 기본값은 내장 DB(H2)로 바꿔치기하는데, 우리는 **진짜 MySQL**(Testcontainers)로 검증해야 한다. `LIKE`, 날짜 함수, 정렬 규칙이 DB마다 다르기 때문이다.
- 테스트 이름 자체가 **기능 명세서**다. "가입일 종료일은 그날 하루 전체를 포함한다"는 4번의 날짜 범위 결함을 영원히 막는다.
- 엑셀은 "파일이 만들어졌다"가 아니라 **POI로 다시 열어 행 수를 확인**해야 의미가 있다.

**✔ 확인**: `./gradlew test` 통과.

---

## 🔧 안 될 때 체크리스트

- **`QUser`를 찾을 수 없음** → `:jakarta` 분류자, annotationProcessor 3줄(1번). Rebuild Project.
- **`@PreAuthorize`가 무시됨(일반 사용자도 통과)** → `@EnableMethodSecurity`(2번).
- **권한 없는데 500** → `GlobalExceptionHandler`의 `Exception` 핸들러가 `AccessDeniedException`을 먼저 잡음. 전용 핸들러 추가(8번).
- **ADMIN으로 바꿨는데 403** → 토큰 안의 role은 옛 값. 로그아웃 후 다시 로그인(2번).
- **검색 결과 페이지마다 같은 회원이 중복** → 보조 정렬 `id desc`(4번).
- **10월 31일 가입자가 빠짐** → 종료일 `< 다음날 00:00`(4번).
- **벌크 수정 후 조회 결과가 옛 값** → `clearAutomatically = true`(7번).
- **엑셀이 깨지거나 0바이트** → `response.getOutputStream()`에 쓰기 전에 다른 응답을 쓰지 않았나? 컨트롤러 반환 타입이 `void`인가(9번)?
- **엑셀 다운로드 중 OutOfMemory** → `XSSFWorkbook`을 썼나? `SXSSFWorkbook`으로(9번).

## 🧠 스스로 설명해보기

1. QueryDSL `where()`에 null을 넘기면 어떻게 되나? 이 성질을 이용한 패턴은?
2. 목록과 엑셀이 같은 조건 메서드를 공유해야 하는 이유는?
3. 날짜 검색 종료일을 `<=`가 아니라 `< 다음날`로 쓰는 이유는?
4. 정렬 필드를 화이트리스트로 제한하는 이유는?
5. 계정 정지 시 `status` 변경 외에 무엇을 해야 "즉시 차단"이 되나? 그래도 남는 30분은?
6. 벌크 UPDATE가 변경 감지보다 빠른 이유, 그리고 벌크 UPDATE 후 주의할 점 두 가지는?
7. SXSSF가 XSSF보다 메모리를 적게 쓰는 원리는?
8. `EXPLAIN`에서 `type=ALL`과 `Using filesort`는 각각 무엇을 뜻하나? `LIKE '%김%'`이 인덱스를 못 타는 이유는?

## 🚀 여유가 있다면

- [ ] 대시보드 카운트를 `CASE WHEN`으로 테이블당 쿼리 1개로 합치고 속도 비교
- [ ] 관리자 작업 이력(누가 누구를 언제 정지했나) — 로그 파일로 남기기 (`log.info("[ADMIN] {} suspended {}", ...)`)
- [ ] 엑셀 업로드(POI로 읽기)로 회원 일괄 상태 변경
- [ ] 휴면 회원 조회: `lastLoginBefore` = 90일 전 조건으로 목록 → 엑셀
