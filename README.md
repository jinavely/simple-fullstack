# simple-fullstack

Spring Boot 백엔드 + React 프론트엔드 + MySQL(docker-compose)로 구성된 풀스택 포트폴리오 프로젝트입니다.

## 기술 스택

### 백엔드 (`backend/`)
- Java 21 (Gradle 툴체인), Gradle 9.7.1 (wrapper 포함)
- Spring Boot 4.1.1, Spring Dependency Management 1.1.7
- Spring Data JPA, Spring Security, Spring Validation, Spring Web MVC, Spring Boot Actuator
- MySQL (`mysql-connector-j`), Lombok
- 테스트: JUnit 5, Spring Boot Testcontainers + Testcontainers MySQL

### 프론트엔드 (`frontend/`)
- React 19, TypeScript ~6.0.2, Vite 8
- 패키지 매니저: **pnpm**
- 라우팅: react-router 8
- 서버 상태: TanStack Query 5 / 클라이언트 상태: Zustand
- 폼·검증: react-hook-form + zod
- HTTP 클라이언트: axios
- UI: Tailwind CSS 4, shadcn/ui (style: `radix-nova`), radix-ui, lucide-react
- Lint/Format: ESLint 10(flat config) + Prettier 3 (세미콜론 없음, 싱글쿼트)
- 테스트: Vitest + Testing Library(유닛/컴포넌트), Playwright(e2e)

### 인프라
- `docker-compose.yml`: MySQL 8.4 컨테이너(`fullstack-mysql`)만 실행, 호스트 포트 `3307` → 컨테이너 `3306`, DB명 `fullstack`, `utf8mb4` 사용
- 실행 전 루트에 `.env` 필요 (`MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD`)

## 폴더 구조

```
.
├── backend/                Spring Boot 애플리케이션
│   └── src/main/java/jinavely/github/io/fullstack/
│       ├── FullstackApplication.java   진입점
│       └── config/                     Spring 설정 클래스 (예: SecurityConfig)
├── frontend/                React 애플리케이션
│   └── src/
│       ├── app/             라우터(router.tsx)
│       ├── pages/           라우트 단위 페이지 컴포넌트
│       ├── components/      레이아웃(layout/), shadcn/ui 컴포넌트(ui/)
│       ├── features/        기능별 모듈 (api.ts / schema.ts / queries.ts / 컴포넌트 + 테스트)
│       ├── lib/              api-client.ts, queryClient.ts, utils.ts
│       ├── store/            Zustand 스토어
│       └── test/             Vitest 테스트 셋업
└── docker-compose.yml       MySQL 로컬 실행용
```

## 실행 방법

### DB 실행
```bash
docker compose up -d
```

### 백엔드 (backend/ 에서 실행)
```bash
./gradlew bootRun
```

### 프론트엔드 (frontend/ 에서 실행)
```bash
pnpm install
pnpm dev
```

## 주요 명령어

### 백엔드
| 명령 | 설명 |
| --- | --- |
| `./gradlew build` | 컴파일 + 테스트 |
| `./gradlew bootRun` | API 서버 실행 (기본 활성 프로필 `local`) |
| `./gradlew test` | 전체 테스트 실행 |
| `./gradlew test --tests "패키지.클래스명"` | 단일 테스트 클래스 실행 |

테스트는 Testcontainers로 MySQL을 띄우므로(도커 필요) docker-compose 스택이 떠 있지 않아도 동작합니다.

### 프론트엔드
| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | 개발 서버 실행 (`vite.config.ts` 기준 포트 5175) |
| `pnpm build` | `tsc -b && vite build` |
| `pnpm lint` | ESLint 검사 |
| `pnpm format` | Prettier 포맷팅 |
| `pnpm test` | Vitest 단발 실행 |
| `pnpm test:watch` | Vitest watch 모드 |
| `pnpm test -- <파일경로>` | 특정 테스트 파일만 실행 |
| `pnpm test:e2e` | Playwright e2e 테스트 (dev 서버 자동 기동) |

## 코딩 규칙

- 프론트엔드 import 경로는 `@` alias 사용 (`frontend/src`를 가리킴, `vite.config.ts` / `tsconfig.app.json`에 설정)
- `features/<feature>/` 구조를 따를 것: `api.ts`(axios 호출) → `schema.ts`(zod로 응답 검증) → `queries.ts`(TanStack Query 훅) → 컴포넌트는 훅만 사용하고 axios/api.ts를 직접 호출하지 않음
- 포맷: Prettier 기준 세미콜론 미사용, 싱글쿼트 사용 (`.prettierrc`)
- 백엔드 설정은 프로필 기반: `application.yml`에서 `spring.profiles.active: local` 지정, 실제 로컬 DB 접속 정보는 `application-local.yml`(포트 3307, docker-compose와 일치)이 사용됨. `application.properties`는 포트 3306을 가리키는 별도 설정으로 현재 사용되지 않는 것으로 보임

## 참고 / TODO

- `SecurityConfig`는 현재 CSRF 비활성화 + 모든 요청 허용 상태로, 개발 단계의 임시 설정입니다.
- 프론트엔드 `VITE_API_BASE_URL`은 현재 `http://localhost:4000/api`를 가리키는데, 백엔드 기본 포트(8080)와 다르므로 실제 연동 시 포트를 맞추거나 백엔드 서버 포트 설정이 필요합니다.
