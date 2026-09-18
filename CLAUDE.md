# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A monorepo with a Spring Boot backend, a React frontend, and a docker-compose MySQL instance for local development. There is no root-level task runner — `backend/` and `frontend/` are built and run independently.

## Tech stack & versions

**Backend** (`backend/`)
- Java 21 (Gradle toolchain), Gradle 9.7.1 (via wrapper)
- Spring Boot 4.1.1 (`org.springframework.boot`), Spring Dependency Management plugin 1.1.7
- Spring Data JPA, Spring Security, Spring Validation, Spring Web MVC, Spring Boot Actuator
- MySQL (`mysql-connector-j`, runtime), Lombok
- Tests: JUnit 5 (`useJUnitPlatform`), Spring Boot Testcontainers + Testcontainers MySQL module

**Frontend** (`frontend/`)
- React 19, TypeScript ~6.0.2, Vite 8
- Package manager: **pnpm** (`pnpm-lock.yaml`)
- Routing: react-router 8 (`createBrowserRouter`)
- Server state: TanStack Query 5; client state: Zustand
- Forms/validation: react-hook-form + zod (via `@hookform/resolvers`)
- HTTP: axios (`src/lib/api-client.ts`)
- UI: Tailwind CSS 4, shadcn/ui (style `radix-nova`, base color `neutral`), radix-ui, lucide-react icons
- Lint/format: ESLint 10 (flat config) + Prettier 3 (no semicolons, single quotes — see `.prettierrc`)
- Tests: Vitest + Testing Library (unit/component), Playwright (e2e, `frontend/e2e/`)

**Infra**
- `docker-compose.yml` at repo root runs MySQL 8.4 only (container `fullstack-mysql`), exposed on host port `3307` → container `3306`, database `fullstack`, charset `utf8mb4`. Requires a `.env` with `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD` (see `backend/.env` for local values).

## Commands

### Backend (run from `backend/`)
```
./gradlew build              # compile + run tests
./gradlew bootRun            # run the API (uses active profile, default 'local')
./gradlew test               # run all tests
./gradlew test --tests "jinavely.github.io.fullstack.FullstackApplicationTests"   # single test class
```
Tests that need MySQL rely on Testcontainers (Docker must be running); they do not require the docker-compose stack to be up.

### Frontend (run from `frontend/`)
```
pnpm install
pnpm dev                     # start Vite dev server (port 5175, per vite.config.ts)
pnpm build                   # tsc -b && vite build
pnpm lint                    # eslint .
pnpm format                  # prettier --write .
pnpm test                    # vitest run (single run)
pnpm test:watch              # vitest watch mode
pnpm test -- src/features/example/ExampleList.test.tsx   # run a single test file
pnpm test:e2e                # playwright test (boots the dev server itself)
```

### Database
```
docker compose up -d         # starts MySQL on localhost:3307, db "fullstack"
```

## Architecture

### Backend
Standard Spring Boot layout under `backend/src/main/java/jinavely/github/io/fullstack/`:
- `FullstackApplication.java` — entry point (`@SpringBootApplication`)
- `config/` — Spring `@Configuration` classes (e.g. `SecurityConfig`)

Configuration is profile-based: `application.yml` sets `spring.profiles.active: local` and JPA defaults (`ddl-auto: update`, SQL logging on). `application-local.yml` supplies the local datasource (points at `localhost:3307`, matching the docker-compose MySQL port mapping). `application.properties` is a separate, currently-unused default-profile config pointing at port `3306` — `application-local.yml` is what actually applies locally since `local` is the active profile.

`SecurityConfig` currently disables CSRF and permits all requests — a temporary/scaffolding state, not a final security posture.

Test setup uses `TestcontainersConfiguration` (`@ServiceConnection` MySQL container) combined with `TestFullstackApplication` to boot the app against a real, ephemeral MySQL in tests.

### Frontend
Feature-based structure under `frontend/src/`:
- `app/router.tsx` — route table (`react-router` `createBrowserRouter`)
- `pages/` — route-level components
- `components/layout/`, `components/ui/` — shared layout and shadcn/ui-generated primitives
- `features/<feature>/` — colocated per-feature code, each typically containing `api.ts` (axios calls), `schema.ts` (zod schemas), `queries.ts` (TanStack Query hooks), and the component + its test
- `lib/` — cross-cutting singletons: `api-client.ts` (axios instance, base URL from `VITE_API_BASE_URL`), `queryClient.ts`, `utils.ts`
- `store/` — Zustand stores
- `test/setup.ts` — Vitest/Testing Library setup

Data flow convention (see `features/example/`): `api.ts` calls the backend via the shared `apiClient` and parses the response through a zod schema from `schema.ts`; `queries.ts` wraps that call in a `useQuery`/`useMutation` hook; components consume only the hook, never `api.ts` or axios directly.

Path alias `@` → `frontend/src` (configured in both `vite.config.ts` and `tsconfig.app.json`).

The `VITE_API_BASE_URL` env var points the frontend at the backend API (see `.env.development` / `.env.example`); it currently targets `http://localhost:4000/api`, so if the backend is run with default Spring settings the two must be reconciled (port and `/api` base path).
