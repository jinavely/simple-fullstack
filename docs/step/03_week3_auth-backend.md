# 3주차 · 회원·로그인 백엔드 (10/14~18 · 12h)

> 회원가입, JWT 로그인, 토큰 재발급·로그아웃, 작성자 권한을 만든다. 1주차 `TEMP_USER_ID`를 로그인 사용자로 바꾼다.
> 스키마 기준: `docs/01_ERD.md`의 `users`, `refresh_tokens`. `ddl-auto: validate`는 그대로.
> 각 단계는 **🎯 목표 → 🤔 왜 지금 → 📄 파일 → ⌨️ 코드 → 🔍 원리 → ✔ 확인** 순서.

> ⚠️ **Spring Security 의존성을 추가하는 순간 모든 API가 401(또는 로그인 페이지 HTML)로 막힌다.** 10번 `SecurityConfig`까지 한 번에 가는 게 부담이면, 1번에서 의존성을 넣고 바로 10번의 `permitAll` 부분만 먼저 만들어 두자.

---

## 🗺 전체 흐름

```text
[로그인]
React ──POST /api/auth/login {loginId, password}──▶ AuthController
                                                     │ AuthService.login
                                                     │  ① 비밀번호 BCrypt 비교  ② status 확인
                                                     │  ③ Access(JWT, 30분) 발급
                                                     │  ④ Refresh(랜덤 문자열, 7일) 발급 → SHA-256 해시만 DB 저장
React ◀── body: { accessToken, user }  +  Set-Cookie: refresh_token=원문 (httpOnly)

[API 호출]
React ──Authorization: Bearer <access>──▶ JwtAuthenticationFilter (서명·만료 검증)
                                          │ OK → SecurityContext에 LoginUser 저장
                                          ▼
                                     SecurityFilterChain (URL별 permitAll / authenticated)
                                          │ 통과 → Controller (@AuthenticationPrincipal LoginUser)
                                          │ 실패 → EntryPoint(401) / AccessDeniedHandler(403) → 공통 JSON

[재발급]  Access 만료(401) → POST /api/auth/reissue (쿠키 자동 전송)
          → 해시로 DB 조회 → 이전 토큰 revoked_at 기록 → 새 Access + 새 Refresh(Rotation)
```

**핵심 한 줄**: Access는 **서버가 기억하지 않는 짧은 출입증(JWT)**, Refresh는 **서버가 DB로 기억하는 긴 재발급권**이다. 짧은 쪽은 빠르고, 긴 쪽은 언제든 폐기할 수 있다.

## 📋 순서표

| # | 할 일 | 파일 | 끝나면 확인할 것 |
|---|---|---|---|
| 1 | 의존성 · 설정값 | `build.gradle`, `application.yml` | Gradle 새로고침 성공 |
| 2 | 에러 코드 추가 | `ErrorCode` | 컴파일 OK |
| 3 | User 엔티티 완성 · enum | `User`, `Role`, `UserStatus` | validate 통과 |
| 4 | UserRepository 조회 메서드 | `UserRepository` | 컴파일 OK |
| 5 | JWT 발급·검증 | `JwtProvider` | 단위 테스트 통과 |
| 6 | Refresh 토큰 엔티티 · 해시 | `RefreshToken`, `RefreshTokenRepository`, `TokenHasher` | validate 통과 |
| 7 | 인증 사용자 · 필터 | `LoginUser`, `JwtAuthenticationFilter` | 컴파일 OK |
| 8 | 401·403 JSON 응답 | `JsonAuthenticationEntryPoint`, `JsonAccessDeniedHandler` | 컴파일 OK |
| 9 | Security 설정 | `SecurityConfig` | 목록 조회 200, 글쓰기 401 |
| 10 | 회원가입 · 로그인 · 재발급 · 로그아웃 | `auth/dto/*`, `AuthService`, `AuthController` | Swagger로 전체 흐름 |
| 11 | 게시글 작성자 연결 · 권한 | `PostController`, `PostService` | 남의 글 수정 403 |
| 12 | Swagger 인증 버튼 | `SwaggerConfig` | Authorize로 토큰 입력 |
| 13 | 테스트 | `JwtProviderTest`, `AuthIntegrationTest` | 전부 통과 |

## 📁 추가·변경 파일

```text
src/main/java/com/example/board
 ├─ global
 │   ├─ config
 │   │   ├─ SecurityConfig.java              (9)
 │   │   └─ SwaggerConfig.java               (12)
 │   ├─ error/ErrorCode.java                 (2 수정)
 │   └─ security
 │       ├─ JwtProvider.java                 (5)
 │       ├─ TokenHasher.java                 (6)
 │       ├─ LoginUser.java                   (7)
 │       ├─ JwtAuthenticationFilter.java     (7)
 │       ├─ JsonAuthenticationEntryPoint.java(8)
 │       └─ JsonAccessDeniedHandler.java     (8)
 ├─ user
 │   ├─ User.java · Role.java · UserStatus.java (3)
 │   └─ UserRepository.java                  (4 수정)
 ├─ auth
 │   ├─ RefreshToken.java                    (6)
 │   ├─ RefreshTokenRepository.java          (6)
 │   ├─ AuthService.java · AuthController.java (10)
 │   └─ dto/SignupRequest · LoginRequest · TokenResponse · UserSummary · AuthResult (10)
 └─ post
     ├─ PostService.java · PostController.java (11 수정)
```

---

## 1 · 의존성 · 설정값

**🎯 목표**: Spring Security와 jjwt 0.12를 추가하고, JWT 비밀키·만료 시간을 설정 파일로 뺀다.

**🤔 왜 지금**: 이후 모든 클래스가 이 라이브러리와 설정값을 쓴다.

**📄 파일**: `build.gradle`, `application.yml`, `.gitignore`

```groovy
dependencies {
    // ...1주차 의존성 유지
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
    runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
    runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'

    testImplementation 'org.springframework.security:spring-security-test'
}
```

```yaml
# application.yml (추가)
jwt:
  secret: ${JWT_SECRET}          # Base64 인코딩된 32바이트 이상 키
  access-exp-minutes: 30
  refresh-exp-days: 7

app:
  cookie-secure: false           # 운영(HTTPS)에서는 true
```

```bash
# 키 만들기 (Git Bash / macOS / Linux)
openssl rand -base64 32
# IntelliJ Run Configuration → Environment variables에 JWT_SECRET=만든값 입력
```

**🔍 원리**
- jjwt는 **api(인터페이스) / impl(구현) / jackson(JSON 변환)** 세 개로 나뉜다. 코드는 api만 보고, 나머지는 실행 시에만 필요해서 `runtimeOnly`.
- HS256 서명 키는 **최소 256비트(32바이트)**여야 한다. 짧으면 jjwt가 `WeakKeyException`을 던진다.
- 비밀키를 yml에 직접 쓰면 Git에 올라간다. `${JWT_SECRET}`처럼 **환경변수로 주입**하는 게 실무 기본이다. 6주차 `.env`와 연결된다.
- AI에게 질문할 때 이 키 값은 절대 붙여넣지 않는다.

**✔ 확인**: Gradle 새로고침 성공. (이 시점에 앱을 켜면 모든 API가 막히는 게 정상 → 9번에서 해결)

---

## 2 · 에러 코드 추가

**🎯 목표**: 인증·회원 관련 에러를 `ErrorCode`에 추가한다.

**🤔 왜 지금**: 1주차처럼 **던질 에러를 먼저 정해 두면** 이후 코드가 처음부터 규약대로 에러를 던진다.

**📄 파일**: `global/error/ErrorCode.java`

```java
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // 공통 (C)
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "C001", "입력값이 올바르지 않습니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "C401", "로그인이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "C403", "권한이 없습니다."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "C999", "서버 오류가 발생했습니다."),

    // 인증 (A)
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "A001", "토큰이 만료되었습니다."),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "A002", "다시 로그인해 주세요."),
    LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "A003", "아이디 또는 비밀번호가 올바르지 않습니다."),
    ACCOUNT_SUSPENDED(HttpStatus.FORBIDDEN, "A004", "이용이 정지된 계정입니다."),

    // 게시글 (P)
    POST_NOT_FOUND(HttpStatus.NOT_FOUND, "P001", "게시글을 찾을 수 없습니다."),

    // 회원 (U)
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "U001", "회원을 찾을 수 없습니다."),
    DUPLICATE_LOGIN_ID(HttpStatus.CONFLICT, "U002", "이미 사용 중인 아이디입니다."),
    DUPLICATE_EMAIL(HttpStatus.CONFLICT, "U003", "이미 사용 중인 이메일입니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
```

**🔍 원리**
- **401 vs 403**: 401은 "누구인지 모름(로그인 필요)", 403은 "누구인지는 알지만 권한 없음". 4주차 프런트는 **401일 때만 재발급**을 시도하므로 이 구분이 정확해야 한다.
- 중복은 **409 Conflict**: 요청 형식은 맞는데 현재 데이터와 충돌한다는 뜻이다. 400(형식 오류)과 구분한다.
- `LOGIN_FAILED` 메시지를 하나로 통일: "아이디가 없습니다"와 "비밀번호가 틀렸습니다"를 나누면 **가입된 아이디인지** 알려주게 된다(계정 수집 공격).
- `TOKEN_EXPIRED`를 따로 둔 이유: 프런트가 "만료 → 조용히 재발급"과 "위조 → 로그아웃"을 구분할 수 있다. 이번 설계에선 둘 다 재발급을 시도하지만, 로그로 원인을 알 수 있다.

**✔ 확인**: 컴파일 OK.

---

## 3 · User 엔티티 완성 · enum

**🎯 목표**: 1주차 최소 `User`에 ERD `users`의 나머지 컬럼을 모두 매핑한다.

**🤔 왜 지금**: 회원가입은 INSERT다. ERD에서 NOT NULL인 컬럼(`password`, `email`, `role`, `status`)이 엔티티에 없으면 저장이 실패한다.

**📄 파일**: `user/Role.java`, `user/UserStatus.java`, `user/User.java`

```java
public enum Role { USER, ADMIN }

public enum UserStatus { ACTIVE, SUSPENDED, WITHDRAWN }
```

```java
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20, unique = true)
    private String loginId;

    @Column(nullable = false, length = 100)
    private String password;          // BCrypt 해시 (60자)

    @Column(nullable = false, length = 20)
    private String nickname;

    @Column(nullable = false, length = 100, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "VARCHAR(20)")
    private UserStatus status;

    private Long profileFileId;       // FK 제약 없음 (ERD 참고) → 5주차에 서비스에서 검증

    private LocalDateTime lastLoginAt;

    private LocalDateTime deletedAt;

    @Builder
    private User(String loginId, String password, String nickname, String email) {
        this.loginId = loginId;
        this.password = password;
        this.nickname = nickname;
        this.email = email;
        this.role = Role.USER;
        this.status = UserStatus.ACTIVE;
    }

    public boolean isActive() {
        return status == UserStatus.ACTIVE;
    }

    public void recordLogin() {
        this.lastLoginAt = LocalDateTime.now();
    }
}
```

**🔍 원리**
- `@Enumerated(EnumType.STRING)`: DB에 `"USER"`처럼 **이름**으로 저장. 기본값(ORDINAL)은 순서 번호(0, 1)로 저장해서, enum 순서만 바꿔도 데이터 의미가 뒤바뀌는 대형 사고가 난다.
- `columnDefinition = "VARCHAR(20)"`: Hibernate 6.2+는 MySQL에서 enum을 **MySQL `ENUM` 타입**으로 기대한다. ERD는 `VARCHAR(20)`이라 그냥 두면 `validate`가 "found varchar, expecting enum"으로 실패한다. 타입을 명시해서 맞춘다.
- `profileFileId`를 `@ManyToOne UploadFile`이 아니라 **숫자(Long)**로 둔 이유: ERD가 순환 참조(users ↔ upload_files)를 피하려고 FK를 걸지 않았기 때문이다. 엔티티도 설계를 따라간다.
- 생성자에서 `role = USER`, `status = ACTIVE`: ERD 기본값과 같다. 가입 요청으로 `role`을 받지 않으므로 **스스로 ADMIN이 되는 길**이 없다.
- `User`에 `@SQLRestriction("deleted_at IS NULL")`을 **붙이지 않는다**. 탈퇴 회원의 옛 게시글도 작성자 닉네임은 보여야 하기 때문이다. 로그인 가능 여부는 `status`로 판단한다.
- 필드명 `password`: 이 클래스를 절대 응답으로 반환하지 않는다(DTO 사용). 1주차에 엔티티를 그대로 반환하지 않기로 한 이유가 여기서 드러난다.

**✔ 확인**: 앱 실행 → `Schema-validation` 에러 없이 시작.

---

## 4 · UserRepository 조회 메서드

**🎯 목표**: 로그인·중복 체크에 필요한 조회 메서드를 추가한다.

**📄 파일**: `user/UserRepository.java`

```java
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByLoginId(String loginId);

    boolean existsByLoginId(String loginId);

    boolean existsByEmail(String email);
}
```

**🔍 원리**
- `existsBy...`는 `SELECT ... LIMIT 1` 형태로 **있는지만** 확인한다. 엔티티 전체를 꺼내는 `findBy`보다 가볍다.
- 중복 체크를 해도 **동시에 같은 아이디로 가입**하면 둘 다 통과할 수 있다. 최종 방어선은 ERD의 `uk_users_login_id` UNIQUE 제약이다(10번에서 처리).

**✔ 확인**: 컴파일 OK.

---

## 5 · JWT 발급·검증 (`JwtProvider`)

**🎯 목표**: Access Token을 만들고, 서명과 만료를 검증한다.

**🤔 왜 지금**: 필터(7번)와 로그인(10번)이 모두 이 클래스를 쓴다.

**📄 파일**: `global/security/JwtProvider.java`

```java
@Component
public class JwtProvider {

    private final SecretKey key;
    private final Duration accessTtl;

    public JwtProvider(@Value("${jwt.secret}") String secret,
                       @Value("${jwt.access-exp-minutes}") long accessMinutes) {
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        this.accessTtl = Duration.ofMinutes(accessMinutes);
    }

    public String createAccessToken(Long userId, Role role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("role", role.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(key)
                .compact();
    }

    /** 서명이 틀리거나 만료되면 JwtException 계열 예외를 던진다 */
    public LoginUser parse(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return new LoginUser(
                Long.valueOf(claims.getSubject()),
                Role.valueOf(claims.get("role", String.class)));
    }

    public long accessTtlSeconds() {
        return accessTtl.toSeconds();
    }
}
```

**🔍 원리**
- JWT = `헤더.내용(claims).서명` 세 조각을 Base64로 이어 붙인 문자열이다. **내용은 암호화가 아니라 인코딩**이라 누구나 jwt.io에서 읽을 수 있다. 그래서 비밀번호·이메일 같은 정보는 넣지 않고 **id와 role만** 넣는다.
- **서명**은 비밀키로 만든 도장이다. 누가 내용의 `role`을 `ADMIN`으로 바꾸면 서명이 맞지 않아 `parseSignedClaims`가 예외를 던진다.
- 서버는 Access Token을 **저장하지 않는다**. 서명만 확인하면 되므로 DB 조회 없이 빠르다. 대신 발급한 토큰을 중간에 취소할 수 없어서 **수명을 짧게(30분)** 둔다.
- jjwt 0.12 문법: `setSubject` → `subject`, `parserBuilder()` → `parser()`, `parseClaimsJws` → `parseSignedClaims`. AI가 옛 문법을 주면 컴파일 에러가 나므로 "jjwt 0.12 API만"이라고 명시하자.
- `LoginUser`는 7번에서 만든다. 지금 빨간 줄이 나면 7번 record를 먼저 만들어도 된다.

**✔ 확인**: 13번 `JwtProviderTest`를 먼저 작성해 돌려 봐도 좋다.

---

## 6 · Refresh 토큰 엔티티 · 해시

**🎯 목표**: Refresh Token을 **원문이 아니라 SHA-256 해시로** `refresh_tokens`에 저장하는 구조를 만든다.

**🤔 왜 지금**: 로그인(10번)이 Access와 함께 Refresh를 발급·저장한다.

**📄 파일**: `global/security/TokenHasher.java`, `auth/RefreshToken.java`, `auth/RefreshTokenRepository.java`

```java
public final class TokenHasher {

    private static final SecureRandom RANDOM = new SecureRandom();

    private TokenHasher() {}

    /** 추측 불가능한 랜덤 문자열 (쿠키로 전달할 원문) */
    public static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** DB에 저장할 64자 hex 해시 (ERD token_hash CHAR(64)) */
    public static String sha256(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
```

```java
@Entity
@Table(name = "refresh_tokens")
@EntityListeners(AuditingEntityListener.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {   // updated_at이 없으므로 BaseTimeEntity를 상속하지 않음

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true, columnDefinition = "CHAR(64)")
    private String tokenHash;

    @Column(length = 255)
    private String userAgent;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    private LocalDateTime revokedAt;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public RefreshToken(User user, String tokenHash, String userAgent, LocalDateTime expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.userAgent = userAgent == null ? null : userAgent.substring(0, Math.min(255, userAgent.length()));
        this.expiresAt = expiresAt;
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public boolean isExpired(LocalDateTime now) {
        return expiresAt.isBefore(now);
    }

    public void revoke() {
        if (revokedAt == null) {
            this.revokedAt = LocalDateTime.now();
        }
    }
}
```

```java
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    @EntityGraph(attributePaths = "user")
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying(clearAutomatically = true)
    @Query("""
            update RefreshToken r set r.revokedAt = :now
            where r.user.id = :userId and r.revokedAt is null
            """)
    int revokeAllByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);
}
```

**🔍 원리**
- **왜 Refresh는 JWT가 아니라 랜덤 문자열인가**: Refresh는 어차피 DB에서 조회해 폐기 여부를 확인해야 한다. 그렇다면 내용을 담을 필요가 없고, 추측 불가능한 난수면 충분하다.
- **왜 해시로 저장하나**: DB가 유출돼도 해시로는 원래 토큰을 만들 수 없다. 비밀번호를 BCrypt로 저장하는 것과 같은 원리다. 비밀번호와 달리 SHA-256(빠른 해시)을 쓰는 건, 토큰 원문이 이미 **32바이트 난수**라 대입 공격이 불가능하기 때문이다.
- 조회할 때: 쿠키로 받은 원문 → `sha256` → `findByTokenHash`. 원문은 서버 어디에도 남지 않는다.
- `columnDefinition = "CHAR(64)"`: ERD가 고정 길이 `CHAR(64)`라서 validate 타입을 맞춘다.
- `BaseTimeEntity`를 상속하지 않고 `@CreatedDate`만 직접 둔 이유: ERD에 `updated_at`이 없다(1주차 4번에서 설명).
- `revokeAllByUserId`: 탈퇴·정지·토큰 탈취 감지 때 **그 회원의 모든 기기**를 한 번에 로그아웃시킨다. 벌크 UPDATE라 영속성 컨텍스트와 어긋나지 않게 `clearAutomatically = true`.
- `userAgent`를 저장하는 이유: 마이페이지에서 "로그인된 기기 목록"을 보여주거나, 이상한 기기를 찾는 데 쓴다. 255자를 넘으면 잘라서 저장.

**✔ 확인**: 앱 실행 → validate 통과.

---

## 7 · 인증 사용자 · JWT 필터

**🎯 목표**: 요청 헤더의 Access Token을 검증해서, 통과하면 "지금 요청한 사람"을 Security에 등록한다.

**🤔 왜 지금**: 9번 `SecurityConfig`가 이 필터를 체인에 끼운다.

**📄 파일**: `global/security/LoginUser.java`, `global/security/JwtAuthenticationFilter.java`

```java
/** 컨트롤러에서 @AuthenticationPrincipal로 받는 로그인 사용자 */
public record LoginUser(Long id, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
```

```java
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String JWT_ERROR_ATTR = "jwtError";

    private final JwtProvider jwtProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.startsWith("Bearer ")) {
            try {
                LoginUser loginUser = jwtProvider.parse(header.substring(7));
                var authentication = new UsernamePasswordAuthenticationToken(
                        loginUser,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + loginUser.role().name())));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (ExpiredJwtException e) {
                request.setAttribute(JWT_ERROR_ATTR, ErrorCode.TOKEN_EXPIRED);
            } catch (JwtException | IllegalArgumentException e) {
                request.setAttribute(JWT_ERROR_ATTR, ErrorCode.UNAUTHORIZED);
            }
        }

        chain.doFilter(request, response);
    }
}
```

**🔍 원리**
- **필터는 Controller보다 먼저** 실행된다. 요청 → 필터들 → DispatcherServlet → Controller 순서다. 그래서 여기서 막으면 Controller 코드는 실행조차 안 된다.
- 필터는 **토큰이 틀려도 직접 에러를 응답하지 않는다**. 인증 정보를 안 넣고 통과시킬 뿐이다. 그 뒤 `SecurityFilterChain`이 "이 URL은 인증 필요"라고 판단하면 8번 EntryPoint가 401을 응답한다. 그래서 목록 조회처럼 `permitAll`인 API는 **만료된 토큰을 달고 와도** 정상 응답한다.
- 만료인지 위조인지를 `request` 속성에 남겨 두면 EntryPoint가 A001/C401을 골라 응답할 수 있다.
- `ROLE_` 접두사: Spring Security의 `hasRole('ADMIN')`은 내부적으로 `ROLE_ADMIN` 권한을 찾는다. 7주차 `@PreAuthorize`가 이걸 쓴다.
- `@Component`를 붙이지 않은 이유: 붙이면 스프링이 이 필터를 **일반 서블릿 필터로도 자동 등록**해서 두 번 실행된다. 9번에서 `new`로 만들어 Security 체인에만 넣는다.
- **이름 충돌 주의**: Spring Security에도 `org.springframework.security.core.userdetails.User`가 있다. 우리 엔티티와 이름이 같아서 import가 엉뚱하게 잡히기 쉽다. 인증 객체 이름을 `LoginUser`로 따로 지은 이유다.

**✔ 확인**: 컴파일 OK.

---

## 8 · 401 · 403도 공통 JSON으로

**🎯 목표**: Security가 막은 요청도 1주차 `ApiResponse` 모양으로 응답한다.

**🤔 왜 지금**: 1주차 `GlobalExceptionHandler`는 **Controller 안에서** 난 예외만 잡는다. 필터 단계에서 막힌 요청은 거기까지 가지 않아서, 그냥 두면 Spring 기본 에러(빈 본문 또는 HTML)가 나간다.

**📄 파일**: `global/security/JsonAuthenticationEntryPoint.java`, `global/security/JsonAccessDeniedHandler.java`

```java
@Component
@RequiredArgsConstructor
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        ErrorCode code = request.getAttribute(JwtAuthenticationFilter.JWT_ERROR_ATTR) instanceof ErrorCode c
                ? c
                : ErrorCode.UNAUTHORIZED;
        write(response, code);
    }

    private void write(HttpServletResponse response, ErrorCode code) throws IOException {
        response.setStatus(code.getStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), ApiResponse.fail(code));
    }
}
```

```java
@Component
@RequiredArgsConstructor
public class JsonAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException e) throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), ApiResponse.fail(ErrorCode.FORBIDDEN));
    }
}
```

**🔍 원리**
- **EntryPoint** = "로그인 안 한 사람이 보호된 곳에 들어왔을 때(401)", **AccessDeniedHandler** = "로그인은 했지만 권한 없는 곳에 들어왔을 때(403, 7주차 관리자 API)".
- `ObjectMapper`를 주입받아 쓰는 이유: 스프링이 설정한 것과 같은 규칙(날짜 형식, `@JsonInclude`)으로 JSON을 만들기 위해서다. `new ObjectMapper()`를 쓰면 설정이 달라진다.
- `setCharacterEncoding(UTF-8)`이 없으면 한글 메시지가 `???`로 깨진다.
- 남의 글 수정처럼 **Service에서 판단하는 403**은 1주차처럼 `BusinessException(FORBIDDEN)`을 던지면 `GlobalExceptionHandler`가 처리한다. URL 규칙으로 막는 403만 이 핸들러가 처리한다.

**✔ 확인**: 컴파일 OK.

---

## 9 · Security 설정 (`SecurityConfig`)

**🎯 목표**: URL별로 누가 들어올 수 있는지 정하고, 7·8번을 체인에 연결한다.

**🤔 왜 지금**: 이게 있어야 앱이 다시 정상적으로 응답한다. 2주차 화면(목록·상세)도 다시 동작한다.

**📄 파일**: `global/config/SecurityConfig.java`

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtProvider jwtProvider;
    private final JsonAuthenticationEntryPoint authenticationEntryPoint;
    private final JsonAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/actuator/health").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts", "/api/posts/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterBefore(new JwtAuthenticationFilter(jwtProvider),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

**🔍 원리**
- Spring Security 6은 **람다 DSL**만 쓴다. `WebSecurityConfigurerAdapter`, `antMatchers`, `.and()`는 옛 문법이다(AI가 자주 섞어 준다).
- `STATELESS`: 서버 세션(JSESSIONID)을 만들지 않는다. 로그인 상태는 매 요청의 토큰이 증명한다.
- `formLogin`·`httpBasic`을 끄지 않으면 401 대신 **로그인 HTML 페이지**나 브라우저 기본 로그인 창이 뜬다.
- **CSRF를 끈 이유와 대신 막는 방법**: Access Token은 헤더(`Authorization`)로 보내므로 다른 사이트가 자동으로 실어 보낼 수 없다(CSRF 대상 아님). 쿠키로 가는 Refresh는 `SameSite=Strict` + `path=/api/auth`로 범위를 좁혀 막는다(10번).
- 규칙은 **위에서부터** 검사한다. 마지막 `anyRequest().authenticated()`가 "나머지는 전부 로그인 필요"라는 기본값이다. 새 API를 만들면 자동으로 보호된다(안전한 기본값).
- `GET /api/posts/**` permitAll: 2주차 목록·상세, 5주차 댓글 목록(`/api/posts/{id}/comments`)이 로그인 없이 보인다.
- CORS 설정이 없는 이유: 개발은 Vite 프록시, 운영은 Nginx가 같은 출처로 만들어 준다(2주차 1번, 6주차).
- `BCryptPasswordEncoder`: 같은 비밀번호도 매번 다른 해시가 나온다(salt 포함). 그래서 비교는 `encode` 결과끼리가 아니라 반드시 `matches(원문, 해시)`로 한다.

**✔ 확인**
- [ ] `GET /api/posts` → 200 (2주차 화면 정상)
- [ ] `POST /api/posts` (토큰 없음) → **401**, `{"success":false,"error":{"code":"C401",...}}`
- [ ] Swagger 화면 열림

---

## 10 · 회원가입 · 로그인 · 재발급 · 로그아웃

**🎯 목표**: 인증 API 4개를 만든다. Access는 응답 본문으로, Refresh는 httpOnly 쿠키로 준다.

**🤔 왜 지금**: 모든 부품(5~9번)이 준비됐다. 이제 조립한다.

**📄 파일**: `auth/dto/*.java`, `auth/AuthService.java`, `auth/AuthController.java`

```java
// auth/dto/SignupRequest.java — ERD 길이와 맞춤
public record SignupRequest(
        @NotBlank(message = "아이디는 필수입니다.")
        @Pattern(regexp = "^[a-z0-9]{4,20}$", message = "아이디는 영문 소문자·숫자 4~20자입니다.")
        String loginId,

        @NotBlank(message = "비밀번호는 필수입니다.")
        @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,20}$",
                message = "비밀번호는 영문과 숫자를 포함해 8~20자입니다.")
        String password,

        @NotBlank(message = "닉네임은 필수입니다.")
        @Size(min = 2, max = 20, message = "닉네임은 2~20자입니다.")
        String nickname,

        @NotBlank(message = "이메일은 필수입니다.")
        @Email(message = "이메일 형식이 아닙니다.")
        @Size(max = 100, message = "이메일은 100자 이하입니다.")
        String email
) {
}

// auth/dto/LoginRequest.java
public record LoginRequest(
        @NotBlank(message = "아이디를 입력하세요.") String loginId,
        @NotBlank(message = "비밀번호를 입력하세요.") String password
) {
}

// auth/dto/UserSummary.java — 프런트가 헤더·권한 표시에 쓰는 최소 정보
public record UserSummary(Long id, String loginId, String nickname, Role role) {
    public static UserSummary from(User user) {
        return new UserSummary(user.getId(), user.getLoginId(), user.getNickname(), user.getRole());
    }
}

// auth/dto/TokenResponse.java — 응답 본문 (Refresh는 여기 없음!)
public record TokenResponse(String accessToken, long expiresIn, UserSummary user) {
}

// auth/dto/AuthResult.java — Service → Controller 내부 전달용
public record AuthResult(String accessToken, String refreshToken, UserSummary user) {
}
```

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    @Value("${jwt.refresh-exp-days}")
    private long refreshDays;

    @Transactional
    public Long signup(SignupRequest req) {
        if (userRepository.existsByLoginId(req.loginId())) {
            throw new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID);
        }
        if (userRepository.existsByEmail(req.email())) {
            throw new BusinessException(ErrorCode.DUPLICATE_EMAIL);
        }
        User user = User.builder()
                .loginId(req.loginId())
                .password(passwordEncoder.encode(req.password()))
                .nickname(req.nickname())
                .email(req.email())
                .build();
        try {
            return userRepository.saveAndFlush(user).getId();
        } catch (DataIntegrityViolationException e) {
            // 동시에 같은 아이디로 가입한 경우 → UNIQUE 제약이 최종 방어
            throw new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID);
        }
    }

    @Transactional
    public AuthResult login(LoginRequest req, String userAgent) {
        User user = userRepository.findByLoginId(req.loginId())
                .filter(u -> passwordEncoder.matches(req.password(), u.getPassword()))
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_FAILED));

        checkLoginable(user);
        user.recordLogin();
        return issueTokens(user, userAgent);
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public AuthResult reissue(String rawRefreshToken, String userAgent) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }
        RefreshToken saved = refreshTokenRepository.findByTokenHash(TokenHasher.sha256(rawRefreshToken))
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN));

        if (saved.isRevoked()) {
            // 이미 폐기된 토큰이 다시 왔다 = 탈취 의심 → 그 회원의 모든 토큰 폐기
            refreshTokenRepository.revokeAllByUserId(saved.getUser().getId(), LocalDateTime.now());
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }
        if (saved.isExpired(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }

        User user = saved.getUser();
        checkLoginable(user);
        saved.revoke();                         // Rotation: 쓴 토큰은 즉시 폐기
        return issueTokens(user, userAgent);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null) return;
        refreshTokenRepository.findByTokenHash(TokenHasher.sha256(rawRefreshToken))
                .ifPresent(RefreshToken::revoke);
    }

    private void checkLoginable(User user) {
        switch (user.getStatus()) {
            case ACTIVE -> { }
            case SUSPENDED -> throw new BusinessException(ErrorCode.ACCOUNT_SUSPENDED);
            case WITHDRAWN -> throw new BusinessException(ErrorCode.LOGIN_FAILED);
        }
    }

    private AuthResult issueTokens(User user, String userAgent) {
        String access = jwtProvider.createAccessToken(user.getId(), user.getRole());
        String refresh = TokenHasher.newToken();
        refreshTokenRepository.save(new RefreshToken(
                user,
                TokenHasher.sha256(refresh),
                userAgent,
                LocalDateTime.now().plusDays(refreshDays)));
        return new AuthResult(access, refresh, UserSummary.from(user));
    }
}
```

```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String REFRESH_COOKIE = "refresh_token";

    private final AuthService authService;
    private final JwtProvider jwtProvider;

    @Value("${jwt.refresh-exp-days}")
    private long refreshDays;

    @Value("${app.cookie-secure}")
    private boolean cookieSecure;

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<Long>> signup(@Valid @RequestBody SignupRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(authService.signup(req)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<TokenResponse>> login(
            @Valid @RequestBody LoginRequest req,
            @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        return withTokens(authService.login(req, userAgent));
    }

    @PostMapping("/reissue")
    public ResponseEntity<ApiResponse<TokenResponse>> reissue(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
            @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent) {
        return withTokens(authService.reissue(refreshToken, userAgent));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .body(ApiResponse.ok(null));
    }

    private ResponseEntity<ApiResponse<TokenResponse>> withTokens(AuthResult result) {
        TokenResponse body = new TokenResponse(result.accessToken(), jwtProvider.accessTtlSeconds(), result.user());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(result.refreshToken(), Duration.ofDays(refreshDays)).toString())
                .body(ApiResponse.ok(body));
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(maxAge)
                .build();
    }
}
```

**🔍 원리**
- **토큰 저장 위치**: Access는 응답 본문 → 프런트가 **메모리(zustand)**에만 보관. Refresh는 `httpOnly` 쿠키 → **자바스크립트가 읽을 수 없어** XSS로 훔칠 수 없다. localStorage에 토큰을 두면 스크립트 한 줄로 털린다.
- 쿠키 옵션 하나씩:
  - `httpOnly`: JS 접근 차단.
  - `secure`: HTTPS에서만 전송(운영에서 true).
  - `sameSite=Strict`: 다른 사이트에서 시작된 요청에는 쿠키를 안 실어 보낸다(CSRF 방어).
  - `path=/api/auth`: 게시글 API 등 다른 요청에는 쿠키가 아예 안 붙는다. 노출 범위 최소화.
  - 로그아웃은 같은 이름·경로에 `maxAge=0` 쿠키를 보내 브라우저에서 지우게 한다.
- **Refresh Token Rotation**: 재발급할 때마다 새 Refresh를 주고 쓴 것은 `revoked_at`을 찍는다. 누가 토큰을 훔쳐서 먼저 써도, 진짜 사용자가 옛 토큰으로 재발급하는 순간 "폐기된 토큰 재사용"이 감지돼 **그 회원 토큰 전체가 폐기**된다.
- `noRollbackFor = BusinessException.class`: 재사용 감지 시 `revokeAllByUserId`를 실행한 뒤 예외를 던진다. 예외 때문에 트랜잭션이 롤백되면 전체 폐기도 취소되므로, 이 메서드에서는 비즈니스 예외로 롤백하지 않게 한다.
- 로그인 실패 처리: 아이디가 없거나 비밀번호가 틀려도 **같은 `LOGIN_FAILED`**. 탈퇴 계정도 같은 메시지(존재 여부 노출 방지). 정지 계정은 비밀번호가 맞은 뒤에만 "정지"를 알려준다.
- `saveAndFlush`: 바로 INSERT를 실행해서 UNIQUE 위반을 **이 try 안에서** 잡는다. `save`만 쓰면 INSERT가 트랜잭션 끝에 나가서 catch를 벗어난다.
- 응답에 `user`를 같이 주는 이유: 프런트가 앱을 새로 열 때 `reissue` 한 번으로 **토큰과 사용자 정보를 동시에 복원**한다(4주차).

**✔ 확인** (Swagger 또는 Postman — Postman은 쿠키가 자동 저장되어 편하다)
- [ ] 회원가입 → 201, 같은 아이디 다시 → **409 U002**, 비밀번호 `1234` → 400 + `fields.password`
- [ ] MySQL `SELECT login_id, password, role, status FROM users;` → 비밀번호가 `$2a$10$...` 해시, role `USER`, status `ACTIVE`
- [ ] 로그인 → 200, 본문에 `accessToken`, 응답 헤더에 `Set-Cookie: refresh_token=...; HttpOnly; SameSite=Strict`
- [ ] `SELECT token_hash, expires_at FROM refresh_tokens;` → 64자 해시(쿠키 값과 다름), 7일 뒤 만료
- [ ] 재발급 → 새 accessToken, DB에 이전 행 `revoked_at` 기록 + 새 행 추가
- [ ] 이전 Refresh 쿠키 값으로 다시 재발급 → **401 A002**, 그 회원 토큰 전부 `revoked_at` 기록
- [ ] 틀린 비밀번호 → 401 A003 / `UPDATE users SET status='SUSPENDED'` 후 로그인 → 403 A004

---

## 11 · 게시글 작성자 연결 · 권한

**🎯 목표**: 1주차 `TEMP_USER_ID`를 로그인 사용자로 바꾸고, 본인 글만 수정·삭제하게 한다.

**🤔 왜 지금**: 인증이 완성돼야 "누가 요청했는지"를 알 수 있다.

**📄 파일**: `post/PostController.java`, `post/PostService.java` (수정)

```java
// PostController — TEMP_USER_ID 삭제, @AuthenticationPrincipal 추가
@PostMapping
public ResponseEntity<ApiResponse<Long>> create(@AuthenticationPrincipal LoginUser loginUser,
                                                @Valid @RequestBody PostCreateRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.ok(postService.create(loginUser.id(), req)));
}

@PutMapping("/{id}")
public ApiResponse<Long> update(@AuthenticationPrincipal LoginUser loginUser,
                                @PathVariable Long id,
                                @Valid @RequestBody PostUpdateRequest req) {
    return ApiResponse.ok(postService.update(loginUser, id, req));
}

@DeleteMapping("/{id}")
public ApiResponse<Void> delete(@AuthenticationPrincipal LoginUser loginUser,
                                @PathVariable Long id) {
    postService.delete(loginUser, id);
    return ApiResponse.ok(null);
}
```

```java
// PostService — update/delete에 권한 체크 추가
@Transactional
public Long update(LoginUser loginUser, Long id, PostUpdateRequest req) {
    Post post = findPost(id);
    checkOwner(post, loginUser);
    post.update(req.title(), req.content());
    return post.getId();
}

@Transactional
public void delete(LoginUser loginUser, Long id) {
    Post post = findPost(id);
    checkOwner(post, loginUser);
    post.delete();
}

private void checkOwner(Post post, LoginUser loginUser) {
    boolean owner = post.getUser().getId().equals(loginUser.id());
    if (!owner && !loginUser.isAdmin()) {
        throw new BusinessException(ErrorCode.FORBIDDEN);
    }
}
```

**🔍 원리**
- `@AuthenticationPrincipal`: 7번 필터가 `SecurityContext`에 넣은 `LoginUser`를 꺼내 준다. **클라이언트가 보낸 값이 아니라 서명 검증된 토큰에서 나온 값**이라 조작할 수 없다. 그래서 작성자 id를 요청 JSON으로 받지 않는다.
- 권한 체크는 **Service**에서: 프런트가 버튼을 숨겨도 Postman으로 직접 호출할 수 있다. URL 규칙(9번)은 "로그인 여부"만, "누구 글인지"는 데이터를 봐야 알 수 있으므로 Service에서 판단한다.
- 관리자(`isAdmin`)는 남의 글도 수정·삭제 가능. 7주차 관리자 기능의 기초다.
- `post.getUser().getId()`는 LAZY 프록시에서 **id만 꺼낼 때는 추가 SELECT가 나가지 않는다**(프록시가 id를 이미 알고 있음). 콘솔에서 확인해 보자.
- 1주차 테스트는 이제 인증이 필요하다. MockMvc 테스트에 `.with(authentication(...))` 또는 13번 방식으로 토큰을 붙이도록 고친다.

**✔ 확인**
- [ ] A로 로그인해 글쓰기 → `posts.user_id`가 A의 id
- [ ] B의 토큰으로 A의 글 수정 → **403 C403** / 삭제 → 403
- [ ] 토큰 없이 수정 → 401

---

## 12 · Swagger 인증 버튼

**🎯 목표**: Swagger 화면에서 토큰을 한 번 입력하면 모든 요청에 `Authorization` 헤더가 붙게 한다.

**📄 파일**: `global/config/SwaggerConfig.java`

```java
@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        String scheme = "bearerAuth";
        return new OpenAPI()
                .info(new Info().title("Board API").version("v1"))
                .addSecurityItem(new SecurityRequirement().addList(scheme))
                .components(new Components().addSecuritySchemes(scheme,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
```

**🔍 원리**: Swagger 오른쪽 위 **Authorize** 버튼에 로그인 응답의 `accessToken`만 붙여 넣으면(`Bearer ` 없이) 이후 모든 요청 헤더에 자동으로 붙는다. 30분 뒤 만료되면 다시 로그인해서 바꾼다.

**✔ 확인**: Authorize 후 글쓰기 → 201.

---

## 13 · 테스트

**🎯 목표**: JWT 단위 테스트와 "가입 → 로그인 → 글쓰기" 통합 테스트를 만든다.

**📄 파일**: `src/test/.../JwtProviderTest.java`, `AuthIntegrationTest.java`, `src/test/resources/application-test.yml`

```java
class JwtProviderTest {

    private static final String SECRET = Base64.getEncoder()
            .encodeToString("test-secret-key-which-is-long-enough-32b".getBytes());

    @Test
    @DisplayName("발급한 토큰을 검증하면 id와 권한을 돌려준다")
    void createAndParse() {
        JwtProvider provider = new JwtProvider(SECRET, 30);
        String token = provider.createAccessToken(7L, Role.USER);

        LoginUser user = provider.parse(token);

        assertThat(user.id()).isEqualTo(7L);
        assertThat(user.role()).isEqualTo(Role.USER);
    }

    @Test
    @DisplayName("만료된 토큰은 ExpiredJwtException")
    void expired() {
        JwtProvider provider = new JwtProvider(SECRET, -1);   // 이미 지난 만료 시간
        String token = provider.createAccessToken(1L, Role.USER);

        assertThatThrownBy(() -> provider.parse(token)).isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    @DisplayName("다른 키로 서명한 토큰은 SignatureException")
    void forged() {
        String otherSecret = Base64.getEncoder()
                .encodeToString("another-secret-key-which-is-long-32bytes".getBytes());
        String forged = new JwtProvider(otherSecret, 30).createAccessToken(1L, Role.ADMIN);

        assertThatThrownBy(() -> new JwtProvider(SECRET, 30).parse(forged))
                .isInstanceOf(SignatureException.class);
    }
}
```

```java
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@ActiveProfiles("test")
class AuthIntegrationTest {

    @Container
    @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4")
            .withInitScript("schema.sql");   // src/test/resources/schema.sql (docs/sql/schema.sql 복사)

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    @Test
    @DisplayName("회원가입 → 로그인 → 받은 토큰으로 글쓰기 201")
    void signupLoginWrite() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType(APPLICATION_JSON)
                        .content("""
                                {"loginId":"tester1","password":"pass1234","nickname":"테스터","email":"t1@test.com"}
                                """))
                .andExpect(status().isCreated());

        MvcResult login = mvc.perform(post("/api/auth/login").contentType(APPLICATION_JSON)
                        .content("""
                                {"loginId":"tester1","password":"pass1234"}
                                """))
                .andExpect(status().isOk())
                .andExpect(cookie().httpOnly("refresh_token", true))
                .andReturn();

        String token = om.readTree(login.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();

        mvc.perform(post("/api/posts").contentType(APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .content("""
                                {"title":"제목","content":"내용"}
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("토큰 없이 글쓰기 401, 목록 조회는 200")
    void noToken() throws Exception {
        mvc.perform(post("/api/posts").contentType(APPLICATION_JSON)
                        .content("{\"title\":\"t\",\"content\":\"c\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("C401"));

        mvc.perform(get("/api/posts")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("같은 아이디로 두 번 가입하면 409")
    void duplicate() throws Exception {
        String body = """
                {"loginId":"dup01","password":"pass1234","nickname":"중복","email":"dup@test.com"}
                """;
        mvc.perform(post("/api/auth/signup").contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/auth/signup").contentType(APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("U002"));
    }
}
```

```yaml
# src/test/resources/application-test.yml
jwt:
  secret: dGVzdC1zZWNyZXQta2V5LXdoaWNoLWlzLWxvbmctZW5vdWdoLTMyYg==
  access-exp-minutes: 30
  refresh-exp-days: 7
app:
  cookie-secure: false
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

**🔍 원리**
- **단위 테스트**(JwtProviderTest)는 스프링 없이 `new`로 만든다. 1초 안에 끝나므로 자주 돌린다.
- **통합 테스트**는 진짜 MySQL(Testcontainers) + 진짜 Security 필터를 모두 거친다. "필터 순서가 틀려서 401" 같은 설정 실수는 통합 테스트만 잡을 수 있다.
- `@ServiceConnection`(Boot 3.1+): 컨테이너 접속 정보를 `spring.datasource`에 자동 연결한다.
- `withInitScript("schema.sql")`: 운영과 **같은 DDL**로 테스트 DB를 만든다. validate가 테스트에서도 ERD 일치를 보장한다.
- 남은 과제: "남의 글 수정 403"은 사용자 둘을 가입시켜 위 방식으로 직접 작성해 보자. `@WithMockUser`는 `LoginUser`가 아니라 스프링 기본 User를 넣으므로 `@AuthenticationPrincipal LoginUser`가 null이 된다. 그래서 이 프로젝트에서는 **실제 토큰 방식**이 더 정확하다.

**✔ 확인**: `./gradlew test` 전부 통과.

---

## 🔧 안 될 때 체크리스트

- **모든 요청이 401 또는 로그인 HTML** → `SecurityConfig` 빈이 등록됐나? `formLogin` 비활성화했나(9번)?
- **`Schema-validation: wrong column type ... role ... expecting [enum]`** → `columnDefinition = "VARCHAR(20)"`(3번).
- **`token_hash` 타입 불일치** → `columnDefinition = "CHAR(64)"`(6번).
- **`WeakKeyException`** → 비밀키가 32바이트 미만이거나 Base64가 아님(1번).
- **토큰을 넣었는데도 401** → 헤더가 `Bearer ` + 토큰(공백 한 칸)인가? Swagger Authorize에는 `Bearer` 없이 토큰만.
- **필터가 두 번 실행됨** → 필터 클래스에 `@Component`를 붙였나(7번)?
- **`@AuthenticationPrincipal`이 null** → `permitAll` URL에 토큰 없이 호출했거나, 필터에서 principal로 `LoginUser`를 넣었나?
- **재발급이 항상 401** → 쿠키 `path=/api/auth`인데 다른 경로로 호출했나? 브라우저라면 `withCredentials`(4주차).
- **403인데 JSON이 아님** → `AccessDeniedHandler` 등록(8·9번).
- **한글 에러 메시지 깨짐** → EntryPoint의 `setCharacterEncoding`(8번).

## 🧠 스스로 설명해보기

1. Access Token을 DB에 저장하지 않는 이유와 그 대가는?
2. Refresh를 원문이 아니라 해시로 저장하면 무엇이 좋아지나? 왜 BCrypt가 아니라 SHA-256이어도 되나?
3. Refresh Token Rotation에서 "폐기된 토큰이 다시 오면 전체 폐기"하는 이유는?
4. `httpOnly`, `SameSite=Strict`, `path=/api/auth`가 각각 막는 것은?
5. JWT 필터가 토큰이 틀려도 직접 401을 응답하지 않는 이유는?
6. 401과 403의 차이, 그리고 프런트가 이 구분을 필요로 하는 이유는?
7. 작성자 id를 요청 JSON으로 받으면 어떤 문제가 생기나?
8. `@Enumerated(EnumType.ORDINAL)`을 쓰면 어떤 사고가 날 수 있나?

## 🚀 여유가 있다면

- [ ] `GET /api/auth/sessions`: 내 로그인 기기 목록(`user_agent`, 발급일) + 특정 기기 로그아웃
- [ ] 로그인 5회 연속 실패 시 10분 잠금 (실패 횟수는 메모리 또는 Redis — 스키마 변경 없이)
- [ ] 만료된 `refresh_tokens` 행을 매일 새벽 지우는 `@Scheduled` 작업 (`idx_refresh_tokens_expires` 활용)
