# 6주차 · Docker 1차 배포 (11/2~8 · 12h)

> 지금까지 만든 백엔드·프런트·MySQL을 컨테이너로 묶어 클라우드 VM에 올리고, 외부 주소에서 스모크 테스트를 통과시킨다.
> 폴더 가정: 저장소 루트에 `backend/`(Spring), `frontend/`(Vite + **pnpm**), `docs/sql/schema.sql`이 있다.
> 📌 루트의 `docker-compose.yml`은 **로컬 개발용 MySQL만** 띄운다(`fullstack-mysql`, 3307 → 3306, DB `fullstack`). 이 파일은 그대로 두고, 운영용 전체 구성은 **`docker-compose.prod.yml`**로 따로 만든다. 환경변수 이름(`MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD`)과 DB 이름(`fullstack`)은 개발용과 똑같이 맞춘다.
> ⛔ 이번 주 AI 질문에는 `.env`, DB 비밀번호, `JWT_SECRET`, 서버 IP·접속 키를 **절대** 붙여넣지 않는다(`***`로 가리기).

---

## 🗺 전체 구조

```text
            인터넷 (http://서버IP  또는 https://도메인)
                         │ :80 / :443
                         ▼
 ┌──────── docker compose -f docker-compose.prod.yml ──────┐
 │  frontend (Nginx)                                        │
 │   ├ /           → React 빌드 결과(index.html, js, css)   │
 │   └ /api/**     → proxy_pass http://backend:8080         │
 │                         │                                │
 │  backend (Spring Boot, JRE 21)  ── profile: prod         │
 │   ├ /app/uploads  ◀── volume: uploads                    │
 │   └ jdbc:mysql://mysql:3306/fullstack                    │
 │                         │                                │
 │  mysql 8.4                                               │
 │   ├ /var/lib/mysql ◀── volume: db-data                   │
 │   └ /docker-entrypoint-initdb.d/01_schema.sql (최초 1회) │
 └──────────────────────────────────────────────────────────┘
```

**핵심 한 줄**: 브라우저는 **Nginx 하나만** 본다. Nginx가 `/api`를 백엔드로 넘기므로 프런트와 백엔드가 **같은 출처**가 되고, 2주차 Vite 프록시와 똑같은 구조가 운영에서도 유지된다.

## 📋 순서표

| # | 할 일 | 파일 | 끝나면 확인할 것 |
|---|---|---|---|
| 1 | 운영 설정 분리 | `application-prod.yml` | 로컬에서 prod 프로필 기동 |
| 2 | 헬스체크 | `build.gradle`(actuator), `SecurityConfig` | `/actuator/health` UP |
| 3 | 백엔드 Dockerfile | `backend/Dockerfile`, `.dockerignore` | 이미지 빌드 |
| 4 | Nginx 설정 | `frontend/nginx.conf` | 문법 OK |
| 5 | 프런트 Dockerfile | `frontend/Dockerfile`, `.dockerignore` | 이미지 빌드 |
| 6 | compose · 환경변수 | `docker-compose.prod.yml`, `.env.example` | 로컬에서 운영 구성 전체 동작 |
| 7 | 로컬 스모크 테스트 | `scripts/smoke.sh` | 전 항목 통과 |
| 8 | 클라우드 VM 준비 | 서버 | Docker 설치, 방화벽 |
| 9 | 배포 · 재배포 스크립트 | `scripts/deploy.sh` | 외부 접속 |
| 10 | 운영 스모크 · 볼륨 검증 | — | 재시작 후 데이터 유지 |
| 11 | (선택) 도메인 · HTTPS | `nginx.conf`, certbot | https 접속, 쿠키 secure |

---

## 1 · 운영 설정 분리 (`application-prod.yml`)

**🎯 목표**: 운영에서만 다른 값(DB 주소, 로그, 쿠키 secure)을 프로필로 분리하고, 비밀값은 전부 환경변수로 받는다.

**🤔 왜 지금**: 컨테이너 안에서는 DB 주소가 `localhost`가 아니다. 설정을 먼저 나눠야 이미지 하나로 로컬·운영을 모두 돌릴 수 있다.

**📄 파일**: `backend/src/main/resources/application-prod.yml`

```yaml
spring:
  datasource:
    url: jdbc:mysql://${DB_HOST:mysql}:3306/${DB_NAME:fullstack}?serverTimezone=Asia/Seoul&characterEncoding=UTF-8
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    open-in-view: false

springdoc:
  swagger-ui:
    enabled: false          # 운영에서 API 문서 숨김
  api-docs:
    enabled: false

management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      probes:
        enabled: true

app:
  cookie-secure: ${COOKIE_SECURE:false}   # HTTPS 적용(11번) 후 true
  file:
    upload-dir: /app/uploads

logging:
  level:
    root: INFO
    org.hibernate.SQL: WARN
```

**🔍 원리**
- 스프링은 `application.yml`을 먼저 읽고, `SPRING_PROFILES_ACTIVE=prod`면 `application-prod.yml`로 **덮어쓴다**. 공통 값은 기본 파일에, 운영 전용 값만 prod에 둔다. `application.yml`의 `spring.profiles.active: local`보다 **환경변수가 우선**하므로 컨테이너에서는 `local`(localhost:3307)이 켜지지 않는다.
- `application.properties`(3306을 가리키는 옛 기본 설정)는 쓰이지 않는다. 헷갈리지 않게 이번에 지우는 것을 권한다.
- **`ddl-auto: validate`는 1주차부터 이미 그대로**다. 운영에서 `update`가 스키마를 멋대로 바꾸는 사고를 이 프로젝트는 원천적으로 피해 왔다.
- `show-sql: false`: SQL 로그가 운영 로그를 뒤덮고, 파라미터가 찍히면 개인정보 노출이 된다.
- `open-in-view: false`: 요청이 끝날 때까지 DB 커넥션을 붙잡지 않는다. 지금까지 모든 응답을 **Service 안에서 DTO로 변환**했기 때문에 끄더라도 LAZY 에러가 나지 않는다(1주차 DTO 원칙의 보상).
- `${DB_HOST:mysql}`: 환경변수가 없으면 `mysql`. compose에서 **서비스 이름이 곧 호스트명**이다.
- 비밀값(`DB_PASSWORD`, `JWT_SECRET`)은 파일에 값을 쓰지 않는다. 6번 `.env`에서 주입한다.

**✔ 확인**: 로컬 MySQL(3307)로 기동해 본다. prod 설정은 포트가 3306 고정이므로 잠깐 `url`을 3307로 바꾸거나 `DB_HOST=localhost`와 함께 포트도 변수로 빼서 `DB_USER=*** DB_PASSWORD=*** JWT_SECRET=*** SPRING_PROFILES_ACTIVE=prod ./gradlew bootRun` → 기동.

---

## 2 · 헬스체크 (actuator)

**🎯 목표**: "서버가 살아 있고 DB에 붙어 있는가"를 한 URL로 확인한다.

**📄 파일**: `backend/build.gradle`(Actuator 이미 포함), `SecurityConfig`(3주차에 `/actuator/health` permitAll 이미 있음)

`spring-boot-starter-actuator`는 프로젝트 생성 때부터 들어 있다. 추가 설치 없이 1번의 `management` 설정만 확인한다.

**🔍 원리**
- `/actuator/health`는 앱 상태와 **DB 연결 상태**까지 확인해 `{"status":"UP"}`을 준다. compose의 healthcheck, 배포 스크립트, 스모크 테스트가 모두 이 URL을 본다.
- 1번에서 `health`만 노출했다. `env`, `beans` 같은 엔드포인트가 열리면 설정값·비밀키가 새어 나간다.

**✔ 확인**: `curl localhost:8080/actuator/health` → `{"status":"UP"}`.

---

## 3 · 백엔드 Dockerfile (멀티스테이지)

**🎯 목표**: Gradle로 빌드하는 단계와 JRE로 실행하는 단계를 나눠 **작고 안전한 이미지**를 만든다.

**📄 파일**: `backend/Dockerfile`, `backend/.dockerignore`

```dockerfile
# ---------- 1단계: 빌드 ----------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

# 의존성 목록이 안 바뀌면 이 레이어는 캐시 재사용 → 재빌드가 빨라짐
COPY gradlew .
COPY gradle gradle
COPY build.gradle settings.gradle ./
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon > /dev/null

COPY src src
RUN ./gradlew bootJar -x test --no-daemon

# ---------- 2단계: 실행 ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd --system app && useradd --system --gid app app \
    && mkdir -p /app/uploads && chown -R app:app /app
COPY --from=build /workspace/build/libs/*.jar app.jar

USER app
EXPOSE 8080
ENV TZ=Asia/Seoul
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
```

```text
# backend/.dockerignore
build
.gradle
.idea
uploads
*.iml
```

**🔍 원리**
- **멀티스테이지**: 1단계 이미지에는 JDK·Gradle·소스·캐시가 다 있다(수백 MB). 2단계는 **JRE + jar 하나**만 복사한다. 최종 이미지가 작아지고, 공격자가 쓸 수 있는 도구(컴파일러 등)가 서버에 없다.
- **레이어 캐시**: Docker는 명령 한 줄마다 결과를 저장한다. `build.gradle`을 소스보다 **먼저** 복사해서 의존성을 받아 두면, 소스만 고쳤을 때 의존성 다운로드를 건너뛴다.
- `-x test`: 이미지 빌드에서는 테스트를 건너뛴다. 테스트는 배포 전에 로컬(또는 CI)에서 `./gradlew test`로 따로 돌린다. Testcontainers 테스트는 Docker 안에서 Docker를 띄워야 해서 이미지 빌드 중에는 돌지 않는다.
- `USER app`: 컨테이너 안에서도 **root로 실행하지 않는다**. 앱이 뚫려도 권한이 제한된다. 업로드 폴더 소유자를 `app`으로 맞춰야 쓰기가 된다.
- `MaxRAMPercentage=75`: 컨테이너 메모리 제한의 75%까지 힙으로 쓴다. 작은 VM에서 OOM으로 죽는 걸 줄인다.

**✔ 확인**: `docker build -t fullstack-backend ./backend` 성공, `docker images`에서 크기가 JDK 이미지보다 훨씬 작은지.

---

## 4 · Nginx 설정

**🎯 목표**: 정적 파일 서빙, `/api` 프록시, SPA 새로고침 대응, 업로드 용량, 캐시·보안 헤더를 한 파일로 정리한다.

**📄 파일**: `frontend/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    client_max_body_size 50m;          # 5주차 Spring max-request-size와 맞춤 (기본 1m!)

    # ── API는 백엔드로 ────────────────────────────────
    location /api/ {
        proxy_pass http://backend:8080;        # compose 서비스 이름
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location = /actuator/health {
        proxy_pass http://backend:8080;
    }

    # ── 빌드 결과물: 파일명에 해시가 있으므로 오래 캐시 ──
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ── SPA: 없는 경로는 index.html로 ─────────────────
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ /index.html;
    }

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

**🔍 원리**
- **SPA 새로고침 404**: `/posts/3`, `/mypage?tab=posts`는 React Router가 만든 **가짜 경로**라 서버에 그런 파일이 없다. `try_files ... /index.html`이 "파일이 없으면 index.html을 주라"고 해서 React가 경로를 다시 해석한다. 이 줄이 없으면 상세에서 새로고침할 때 404가 난다.
- **`client_max_body_size`**: Nginx 기본값이 **1MB**다. 5주차에 10MB를 허용해도 여기서 413으로 막힌다. 업로드 용량 제한 세 군데(Spring·Nginx·프런트) 중 두 번째.
- `proxy_pass http://backend:8080;` 뒤에 `/`를 붙이지 않았다. 붙이면 `/api/` 부분이 잘려서 백엔드가 `/posts`를 받는다. 지금 백엔드 URL은 `/api/...`로 시작하므로 **그대로 넘긴다**.
- `X-Forwarded-*`: 백엔드가 진짜 클라이언트 IP와 https 여부를 알 수 있게 한다(로그, 11번 HTTPS).
- 캐시 전략: Vite 빌드 파일은 `index-3f9a2c.js`처럼 **내용이 바뀌면 이름도 바뀐다** → 1년 캐시해도 안전. `index.html`은 `no-cache`로 매번 확인 → 배포하면 바로 새 js를 가리킨다.
- 보안 헤더: `X-Frame-Options DENY`는 다른 사이트가 우리 페이지를 iframe으로 감싸 클릭을 유도하는 공격(클릭재킹)을 막는다.

**✔ 확인**: 5번 이미지 빌드 후 `docker run --rm fullstack-frontend nginx -t` → `syntax is ok`. (backend 호스트가 없어 경고가 나면 compose에서 확인)

---

## 5 · 프런트 Dockerfile

**📄 파일**: `frontend/Dockerfile`, `frontend/.dockerignore`

```dockerfile
# ---------- 1단계: 빌드 ----------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable                       # pnpm 사용 (package.json의 packageManager 버전을 따름)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build                            # tsc -b && vite build → dist/

# ---------- 2단계: 서빙 ----------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

```text
# frontend/.dockerignore
node_modules
dist
coverage
playwright-report
test-results
e2e
.env
.env.*
```

**🔍 원리**
- 최종 이미지에는 Node도 소스도 없다. **빌드된 정적 파일 + Nginx**뿐이다. React 앱은 결국 html·js·css 파일이다.
- `pnpm install --frozen-lockfile`: `pnpm-lock.yaml`을 **그대로** 설치하고, lock과 `package.json`이 어긋나면 실패한다. 누가 빌드해도 같은 버전. `corepack enable`은 Node에 들어 있는 pnpm 실행기를 켜고, `package.json`의 `packageManager` 필드에 적힌 버전을 쓴다. **지금 `package.json`에는 이 필드가 없으므로** 로컬 `frontend/`에서 `corepack use pnpm@$(pnpm -v)`를 한 번 실행해 필드를 추가하고 커밋하자(내 PC와 이미지의 pnpm 버전이 같아진다).
- `pnpm build`는 `tsc -b`(타입 검사)부터 하므로 **타입 에러가 있으면 이미지가 만들어지지 않는다**. 배포 전 마지막 안전장치다.
- `VITE_` 환경변수는 **빌드할 때 번들에 박힌다**(런타임이 아님). 우리는 `.env*`를 이미지에서 전부 빼서 `VITE_API_BASE_URL`이 없게 만들고, `lib/api-client.ts`의 기본값 **`'/api'`**를 쓴다. 상대 경로라 서버 주소가 바뀌어도 다시 빌드할 필요가 없다 — 2주차에 상대 경로로 둔 이유.
- `.env*`를 제외하는 또 다른 이유: `frontend/.env`처럼 개인 PC 설정 파일이 섞여 들어가 운영 번들에 엉뚱한 주소가 박히는 사고를 막는다. (`.gitignore`도 `.env.*`를 제외하므로 서버에서 `git clone`하면 어차피 없다)
- e2e·테스트 결과 폴더는 빌드에 필요 없으므로 제외해 빌드 컨텍스트를 줄인다.

**✔ 확인**: `docker build -t fullstack-frontend ./frontend` 성공.

---

## 6 · docker-compose · 환경변수

**🎯 목표**: 세 컨테이너를 한 번에 띄우고, 데이터(DB·업로드)를 볼륨에 남기며, 비밀값을 `.env`로 주입한다.

**📄 파일**: 루트 `docker-compose.prod.yml`(새로), `.env.example`, `.env`(Git 제외), `.gitignore`

```yaml
# docker-compose.prod.yml — 개발용 docker-compose.yml과 별개
services:
  mysql:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: fullstack
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      TZ: Asia/Seoul
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci   # 개발용 compose와 같게
    volumes:
      - db-data:/var/lib/mysql
      - ./docs/sql/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 10
    # ports를 열지 않는다 → 외부에서 DB 직접 접속 불가

  backend:
    build: ./backend
    image: fullstack-backend
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DB_HOST: mysql
      DB_NAME: fullstack
      DB_USER: ${MYSQL_USER}
      DB_PASSWORD: ${MYSQL_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      COOKIE_SECURE: ${COOKIE_SECURE:-false}
      TZ: Asia/Seoul
    volumes:
      - uploads:/app/uploads
    healthcheck:
      test: ["CMD-SHELL", "bash -c 'exec 3<>/dev/tcp/localhost/8080 && echo -e \"GET /actuator/health HTTP/1.0\\r\\n\\r\\n\" >&3 && grep -q UP <&3'"]
      interval: 15s
      timeout: 5s
      start_period: 40s
      retries: 5

  frontend:
    build: ./frontend
    image: fullstack-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "80:80"

volumes:
  db-data:
  uploads:
```

```bash
# .env.example  (Git에 올림 — 값은 비워 둠. 개발용 compose와 같은 이름)
MYSQL_ROOT_PASSWORD=
MYSQL_USER=fullstack
MYSQL_PASSWORD=
JWT_SECRET=
COOKIE_SECURE=false

# .env  (Git에 올리지 않음 — 루트 .gitignore에 .env가 있는지 확인)
# 각 값은 openssl rand -base64 32 로 생성
```

```bash
# 매번 -f를 쓰기 번거로우면 (서버의 셸에서)
export COMPOSE_FILE=docker-compose.prod.yml
```

**🔍 원리**
- **개발용과 운영용 compose를 나눈 이유**: 개발용은 MySQL만 3307로 열어서 IDE의 Spring과 `pnpm dev`가 붙는다. 운영용은 세 컨테이너를 묶고 DB 포트를 열지 않는다. 한 파일에 섞으면 로컬 개발 흐름이 깨진다. `-f docker-compose.prod.yml`로 어느 쪽인지 **명시**한다.
- 볼륨 이름이 다르므로(`mysql-data` vs `db-data`) 로컬에서 운영 구성을 띄워도 개발 DB 데이터와 섞이지 않는다. 단, 둘 다 켜면 개발용이 3307, 운영용 frontend가 80을 쓰므로 포트 충돌은 없다.
- **컨테이너 간 접속은 서비스 이름으로**: compose는 서비스끼리 같은 가상 네트워크에 두고, `mysql`, `backend`라는 이름을 DNS로 풀어 준다. 컨테이너 안의 `localhost`는 **자기 자신**이라서 DB 주소로 쓰면 안 된다.
- **포트는 Nginx(80)만 연다**: DB(3306)·백엔드(8080)는 외부에 노출하지 않는다. 외부에서 들어올 수 있는 문은 Nginx 하나뿐이다.
- **볼륨**: 컨테이너는 지우면 안의 파일이 사라진다. `db-data`, `uploads`는 컨테이너 밖(Docker가 관리하는 저장소)에 둬서 **컨테이너를 새로 만들어도 데이터가 남는다**.
- **`initdb.d`는 최초 1회만**: MySQL 이미지는 `/var/lib/mysql`이 **비어 있을 때만** 이 폴더의 SQL을 실행한다. 볼륨에 데이터가 생긴 뒤에는 `schema.sql`을 고쳐도 다시 실행되지 않는다. 스키마 변경은 별도 마이그레이션 SQL(또는 Flyway)로 해야 한다. seed 데이터는 운영에 넣지 않는다.
- **`depends_on` + `service_healthy`**: 그냥 `depends_on`은 "컨테이너가 시작됐다"만 기다린다. MySQL이 뜨는 데 10~30초가 걸리므로, 헬스체크 통과까지 기다리지 않으면 백엔드가 "DB 연결 실패"로 죽는다.
- 백엔드 healthcheck에 curl 대신 bash `/dev/tcp`를 쓴 이유: JRE 이미지에 curl이 없을 수 있다. 어렵게 느껴지면 3번 Dockerfile 실행 단계에 `RUN apt-get update && apt-get install -y curl`을 넣고 `curl -f localhost:8080/actuator/health`로 바꿔도 된다.
- `restart: unless-stopped`: 서버 재부팅이나 컨테이너 크래시 후 자동으로 다시 뜬다.

**✔ 확인**
- [ ] `cp .env.example .env` 후 값 채우기
- [ ] `docker compose -f docker-compose.prod.yml up -d --build` → `docker compose -f docker-compose.prod.yml ps`에서 세 개 모두 `healthy`/`running`
- [ ] `http://localhost` → 홈 화면, `http://localhost/posts?page=2` 새로고침 → 게시판 2페이지
- [ ] `docker compose -f docker-compose.prod.yml exec mysql mysql -u fullstack -p fullstack -e "SHOW TABLES;"` → 6개 테이블

---

## 7 · 로컬 스모크 테스트

**🎯 목표**: "배포 후 반드시 확인할 핵심 흐름"을 스크립트로 만든다. 8주차 재배포 때 그대로 재사용한다.

**📄 파일**: `scripts/smoke.sh`

```bash
#!/usr/bin/env bash
# 사용: ./scripts/smoke.sh http://localhost   (운영: ./scripts/smoke.sh http://서버주소)
set -euo pipefail
BASE="${1:-http://localhost}"
JAR="$(mktemp)"
ID="smoke$(date +%s | tail -c 7)"
PW="pass1234"
pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

curl -fsS "$BASE/actuator/health" | grep -q '"UP"' && pass "health UP" || fail "health"

curl -fsS -o /dev/null -w '%{http_code}' "$BASE/posts/1" | grep -q 200 && pass "SPA 새로고침(/posts/1)" || fail "SPA try_files"
curl -fsS -o /dev/null -w '%{http_code}' "$BASE/mypage?tab=posts" | grep -q 200 && pass "SPA 쿼리스트링(/mypage?tab=posts)" || fail "SPA try_files"

curl -fsS "$BASE/api/auth/check-login-id?loginId=$ID" | grep -q '"available":true' \
  && pass "아이디 중복 확인" || fail "아이디 중복 확인"

curl -fsS -X POST "$BASE/api/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"loginId\":\"$ID\",\"password\":\"$PW\",\"nickname\":\"스모크\",\"email\":\"$ID@smoke.test\"}" > /dev/null \
  && pass "회원가입" || fail "회원가입"

TOKEN=$(curl -fsS -c "$JAR" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"loginId\":\"$ID\",\"password\":\"$PW\"}" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
[ -n "$TOKEN" ] && pass "로그인" || fail "로그인"

curl -fsS -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/reissue" | grep -q accessToken \
  && pass "재발급(새로고침 로그인 유지)" || fail "재발급"

printf '\xff\xd8\xff' > /tmp/smoke.jpg   # 최소 jpg 헤더 (썸네일은 실패해도 업로드는 성공)
FILE_ID=$(curl -fsS -X POST "$BASE/api/files" -H "Authorization: Bearer $TOKEN" \
  -F "files=@/tmp/smoke.jpg;type=image/jpeg;filename=스모크.jpg" | sed -E 's/.*"id":([0-9]+).*/\1/')
[ -n "$FILE_ID" ] && pass "파일 업로드 #$FILE_ID" || fail "업로드"

# 글쓰기 화면과 같은 흐름: 업로드한 파일 id를 fileIds로 첨부
POST_ID=$(curl -fsS -X POST "$BASE/api/posts" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"스모크 테스트\",\"content\":\"배포 확인\",\"fileIds\":[$FILE_ID]}" | sed -E 's/.*"data":([0-9]+).*/\1/')
[ -n "$POST_ID" ] && pass "글쓰기(첨부 포함) #$POST_ID" || fail "글쓰기"

curl -fsS "$BASE/api/posts/$POST_ID" | grep -q "\"id\":$FILE_ID" && pass "상세 첨부 목록" || fail "상세 첨부"

curl -fsS -X POST "$BASE/api/posts/$POST_ID/comments" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"content":"댓글"}' > /dev/null && pass "댓글" || fail "댓글"

curl -fsS -D - -o /dev/null "$BASE/api/files/$FILE_ID/download" -H "Authorization: Bearer $TOKEN" \
  | grep -qi "filename\*=UTF-8" && pass "한글 파일명 다운로드" || fail "다운로드"

echo "🎉 스모크 테스트 통과 ($BASE)"
```

**🔍 원리**
- **스모크 테스트** = "전원을 켰을 때 연기가 나는지"만 보는 빠른 확인. 기능 전체가 아니라 **깨지면 서비스가 안 되는 핵심 흐름**만 5분 안에 돈다.
- 새로고침 SPA(`/posts/1` HTML 200), 재발급 쿠키, 한글 다운로드처럼 **운영에서만 깨지는 것들**(Nginx·쿠키·헤더)을 일부러 포함했다.
- 매번 새 아이디(`smoke` + 시간)로 가입해서 반복 실행해도 중복 에러가 안 난다. 운영 DB에 테스트 데이터가 쌓이므로, 정리하려면 관리자 기능(7주차)으로 정지·숨김 처리한다.
- AI에게 "이 체크리스트를 curl 스크립트로"라고 요청하면 빠르게 만들 수 있다. 단, 비밀번호·서버 주소는 넣지 않는다.

**✔ 확인**: `chmod +x scripts/smoke.sh && ./scripts/smoke.sh http://localhost` → 전부 ✅.

---

## 8 · 클라우드 VM 준비

**🎯 목표**: 서버 한 대에 Docker를 설치하고, 필요한 포트만 연다.

**📄 대상**: 클라우드 콘솔(AWS Lightsail/EC2, 네이버 클라우드, Oracle Cloud 등), 서버 터미널

```bash
# 권장 사양: 2 vCPU / 4GB RAM / Ubuntu 24.04 LTS  (MySQL + Spring이 함께 뜨므로 2GB는 빠듯)

# 1) 방화벽(보안 그룹): 22(SSH, 내 IP만), 80, 443만 허용. 3306·8080은 열지 않는다.

# 2) 서버 접속 후 Docker 설치
sudo apt-get update
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER     # 로그아웃 후 재접속하면 sudo 없이 docker 사용
docker compose version

# 3) (메모리 4GB 미만이면) 스왑 2GB 추가
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 4) 코드 받기
git clone https://github.com/<내계정>/simple-fullstack.git ~/app
cd ~/app && cp .env.example .env && nano .env   # 운영용 새 비밀값으로 채우기 (로컬과 다르게!)
```

**🔍 원리**
- **보안 그룹이 1차 방화벽**이다. compose에서 포트를 안 열어도, 서버 자체의 불필요한 포트는 여기서 다시 막는다. SSH(22)는 **내 IP만** 허용해야 무차별 대입 공격을 줄인다.
- 운영 `.env`는 **로컬과 다른 값**으로 새로 만든다. 로컬 `JWT_SECRET`이 새어 나가도 운영이 안전하다.
- 서버에서 Gradle·pnpm 빌드까지 하면 메모리가 부족할 수 있다(스왑이 그래서 필요). 여유가 생기면 "내 PC에서 이미지 빌드 → 레지스트리(Docker Hub/GHCR)에 push → 서버는 pull만"으로 바꾼다(8주차 선택 과제).

**✔ 확인**: `docker run --rm hello-world` 성공.

---

## 9 · 배포 · 재배포 스크립트

**📄 파일**: `scripts/deploy.sh`

```bash
#!/usr/bin/env bash
# 서버에서 실행: ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export COMPOSE_FILE=docker-compose.prod.yml   # 이하 docker compose 명령은 운영 구성을 쓴다

echo "▶ 최신 코드"
git pull --ff-only

echo "▶ 이미지 빌드"
docker compose build

echo "▶ 컨테이너 교체"
docker compose up -d

echo "▶ 헬스체크 대기"
for i in $(seq 1 30); do
  if curl -fsS http://localhost/actuator/health | grep -q '"UP"'; then
    echo "✅ UP"; break
  fi
  sleep 5
  [ "$i" -eq 30 ] && { echo "❌ 헬스체크 실패"; docker compose logs --tail=100 backend; exit 1; }
done

echo "▶ 오래된 이미지 정리"
docker image prune -f

echo "▶ 스모크 테스트"
./scripts/smoke.sh http://localhost
```

**🔍 원리**
- `git pull --ff-only`: 서버에서 코드를 직접 고친 흔적이 있으면 **병합하지 않고 멈춘다**. 서버는 저장소의 복사본일 뿐, 거기서 수정하지 않는다.
- `docker compose up -d`는 **바뀐 이미지의 컨테이너만** 새로 만든다. MySQL은 그대로 유지되고 볼륨 데이터도 남는다.
- 헬스체크 실패 시 **백엔드 로그 100줄을 바로 출력**: 장애 대응의 첫 단계는 로그 확인이다.
- 이 스크립트가 **CI/CD의 씨앗**이다. 나중에 GitHub Actions가 SSH로 이 스크립트를 실행하게 하면 "push하면 자동 배포"가 된다.
- 무중단 배포는 아니다(백엔드 교체 중 수십 초 502). 1차 배포에서는 괜찮고, 무중단은 컨테이너 두 개를 번갈아 쓰는 blue-green 방식이 필요하다.

**✔ 확인**: 서버에서 `chmod +x scripts/*.sh && ./scripts/deploy.sh` → 마지막에 🎉.

---

## 10 · 운영 스모크 · 볼륨 검증

```bash
# 내 PC에서 외부 주소로
./scripts/smoke.sh http://<서버IP>

# 서버에서: 재시작해도 데이터가 남는지
export COMPOSE_FILE=docker-compose.prod.yml
docker compose restart
docker compose down && docker compose up -d        # 컨테이너 삭제 후 재생성 (볼륨은 유지)
./scripts/smoke.sh http://localhost
# → 이전에 쓴 글, 업로드한 파일이 그대로 있는지 브라우저로 확인

# ⚠️ 절대 주의: down -v 는 볼륨까지 삭제 = 운영 DB 전체 삭제
```

**🔍 원리**
- `restart`는 같은 컨테이너를 다시 켜고, `down → up`은 컨테이너를 **지우고 새로 만든다**. 두 경우 모두 볼륨의 데이터가 남아야 한다.
- 브라우저 수동 확인: 회원가입(아이디 중복 확인) → 로그인 → **새로고침 후 로그인 유지**(쿠키 + Nginx 같은 출처) → 글쓰기에서 이미지 첨부(client_max_body_size) → 상세 페이지 새로고침(try_files) → 첨부 한글 파일 다운로드 → 마이페이지 `?tab=posts` 새로고침 → 프로필 이미지 변경.
- 백업 한 줄(선택): `docker compose exec mysql mysqldump -u root -p fullstack > backup_$(date +%F).sql`. 볼륨은 서버 디스크가 망가지면 같이 사라진다.

**✔ 확인**: 외부 주소 스모크 통과 + 재생성 후 데이터 유지.

---

## 11 · (선택) 도메인 · HTTPS

```bash
# 1) 도메인 DNS A 레코드 → 서버 IP
# 2) 서버에서 certbot으로 인증서 발급 (80 포트가 잠시 필요 → frontend 잠깐 중지)
export COMPOSE_FILE=docker-compose.prod.yml
docker compose stop frontend
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d board.example.com
docker compose start frontend
```

```nginx
# nginx.conf — 443 서버 추가, 80은 https로 이동
server {
    listen 80;
    server_name board.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name board.example.com;
    ssl_certificate     /etc/letsencrypt/live/board.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/board.example.com/privkey.pem;
    add_header Strict-Transport-Security "max-age=31536000" always;
    # ...4번의 location 블록 그대로
}
```

```yaml
# docker-compose.prod.yml frontend에 추가
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
# .env
COOKIE_SECURE=true
```

**🔍 원리**
- 3주차 Refresh 쿠키의 `secure` 옵션은 **HTTPS에서만** 쿠키를 보낸다. HTTPS를 적용한 뒤에 `COOKIE_SECURE=true`로 바꿔야 한다(HTTP에서 true로 하면 새로고침 로그인 유지가 깨진다).
- 인증서는 90일마다 갱신해야 한다. `certbot renew`를 cron에 등록하고, 갱신 후 `docker compose exec frontend nginx -s reload`.

**✔ 확인**: `https://도메인` 접속, 자물쇠 표시, 로그인 후 쿠키에 `Secure` 표시.

---

## 🔧 안 될 때 체크리스트

- **backend가 계속 재시작** → `docker compose logs backend`. `Communications link failure`면 DB 헬스체크 대기(6번), `Access denied`면 `.env` 계정, `Schema-validation`이면 `schema.sql`이 initdb로 실행됐는지.
- **`schema.sql`을 고쳤는데 반영 안 됨** → initdb는 볼륨이 비어 있을 때만 실행(6번). 개발 서버라면 `docker compose down -v`로 초기화, 운영이라면 ALTER SQL을 직접 실행.
- **새로고침하면 404** → `try_files $uri $uri/ /index.html`(4번).
- **이미지 업로드 413** → `client_max_body_size`(4번).
- **502 Bad Gateway** → 백엔드가 아직 기동 중이거나 죽음. `proxy_pass` 호스트명이 compose 서비스 이름(`backend`)인가?
- **`docker compose ps`에 mysql 하나만 보임** → `-f docker-compose.prod.yml`(또는 `COMPOSE_FILE`) 없이 실행해서 개발용 compose를 띄웠다(6번).
- **프런트 이미지 빌드가 `tsc` 에러로 실패** → 로컬에서 `pnpm build`가 통과하는지 먼저 확인. 이미지 빌드는 타입 검사를 건너뛰지 않는다(5번).
- **운영에서 API가 `localhost:8080`으로 나감** → `.env*`가 이미지에 들어가 `VITE_API_BASE_URL`이 박혔다. `.dockerignore`에 `.env`, `.env.*`(5번).
- **업로드가 400 "Required part 'files'"(운영만)** → 로컬은 되는데 운영만 안 되면 Nginx 413을 먼저 의심하고, 둘 다 안 되면 5주차 13번 `Content-Type` 덮어쓰기.
- **API가 404인데 로컬에선 됨** → `proxy_pass` 끝에 `/`를 붙여서 `/api`가 잘렸나(4번)?
- **새로고침하면 로그아웃(운영만)** → HTTP인데 `COOKIE_SECURE=true`인가(11번)?
- **한글 깨짐** → MySQL `command`의 `utf8mb4`(6번), JDBC URL `characterEncoding=UTF-8`(1번).
- **시간이 9시간 차이** → 컨테이너 `TZ=Asia/Seoul`, JDBC `serverTimezone=Asia/Seoul`.
- **업로드 폴더 쓰기 권한 에러** → Dockerfile에서 `/app/uploads`를 `app` 사용자 소유로(3번).

## 🧠 스스로 설명해보기

1. 멀티스테이지 빌드로 줄어드는 것 두 가지(크기, 보안)는?
2. `build.gradle`을 소스보다 먼저 COPY하는 이유는?
3. 컨테이너 안에서 DB 주소로 `localhost`를 쓰면 왜 안 되나?
4. `try_files`가 없으면 어떤 상황에서 404가 나나?
5. `initdb.d`의 SQL은 언제 실행되고, 언제 실행되지 않나?
6. `depends_on`만으로는 부족하고 `service_healthy`가 필요한 이유는?
7. `VITE_API_BASE_URL`을 절대 주소가 아니라 `/api`(기본값)로 둔 덕분에 배포에서 무엇이 편해졌나?
8. `docker compose down`과 `down -v`의 차이는?

## 🚀 여유가 있다면

- [ ] GitHub Actions: `main`에 push → 테스트 → 이미지 빌드·GHCR push → 서버 SSH로 `docker compose pull && up -d`
- [ ] Flyway 도입: `schema.sql`을 `V1__init.sql`로 옮기고 이후 변경은 `V2__...sql`로 관리
- [ ] 매일 새벽 `mysqldump` 백업 cron + 7일치 보관
- [ ] 로그 파일 크기 제한: compose에 `logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }`
