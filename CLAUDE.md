# CLAUDE.md

## Project Overview

Langfuse is an open-source LLM engineering platform that helps teams collaboratively develop, monitor, evaluate, and debug AI applications.
The main feature areas are tracing, evals and prompt management. Langfuse consists of the web application (this repo), documentation, python SDK and javascript/typescript SDK.
This repo contains the web application, worker, and supporting packages but notably not the JS nor Python client SDKs.

## Repository Structure
High level structure. There are more folders (eg for hooks etc).
```
langfuse/
├── web/                     # Next.js 14 frontend/backend application
│   ├── src/
│   │   ├── components/     # Reusable UI components (shadcn/ui)
│   │   ├── features/       # Feature-specific code organized by domain
│   │   ├── pages/          # Next.js pages (Pages Router)
│   │   └── server/         # tRPC API routes and server logic
│   └── public/             # Static assets
├── worker/                  # Express.js background job processor
│   └── src/
│       ├── queues/         # BullMQ job queues
│       └── services/       # Background processing services
├── packages/
│   ├── shared/             # Shared types, schemas, and utilities
│   │   ├── prisma/         # Database schema and migrations
│   │   └── src/            # Shared TypeScript code
│   ├── config-eslint/      # ESLint configuration
│   └── config-typescript/  # TypeScript configuration
├── ee/                     # Enterprise Edition features
├── fern/                   # API documentation and OpenAPI specs
├── generated/              # Auto-generated client code
└── scripts/                # Development and deployment scripts
```

## Repository Architecture
This is a **pnpm + Turbo monorepo** with the following key packages:

### Core Applications
- **`/web/`** - Next.js 14 application (Pages Router) providing both frontend UI and backend APIs
- **`/worker/`** - Express.js background job processing server
- **`/packages/shared/`** - Shared database schema, types, and utilities

### Supporting Packages
- **`/ee/`** - Enterprise Edition features (separate licensing)
- **`/packages/config-eslint/`** - Shared ESLint configuration
- **`/packages/config-typescript/`** - Shared TypeScript configuration

## Development Commands

### Development
```sh
pnpm i               # Install dependencies
pnpm run dev         # Start all services (web + worker)
pnpm run dev:web     # Web app only (localhost:3000) - **used in most cases!**
pnpm run dev:worker  # Worker only
pnpm run dx          # Full initial setup: install deps, reset DBs, resets node modules, seed data, start dev. USE SPARINGLY AS IT WIPES THE DATABASE & node_modules
```

### Database Management
database commands are to be run in the `packages/shared/` folder.
```sh
pnpm run db:generate       # Build prisma models
pnpm run db:migrate        # Run Prisma migrations
pnpm run db:reset          # Reset and reseed databases
pnpm run db:seed           # Seed with example data
```

### Infrastructure
```sh
pnpm run infra:dev:up      # Start Docker services (PostgreSQL, ClickHouse, Redis, MinIO)
pnpm run infra:dev:down    # Stop Docker services
```

### Building & Type Checking
```sh
pnpm --filter=PACKAGE_NAME run build  # Runs the build command, will show real typescript errors etc.
pnpm tc                               # Fast typecheck across all packages (alias for pnpm typecheck)
pnpm build:check                      # Full Next.js build to alternate dir (can run parallel with dev server)
```

### Testing in Web Package
The web package uses JEST for unit tests.
Depending on the file location (sync, async)
`web` related tests must go into the `web/src/__tests__/` folder.
```sh
pnpm test-sync --testPathPatterns="$FILE_LOCATION_PATTERN" --testNamePattern="$TEST_NAME_PATTERN"
# For tests in the async folder:
pnpm test -- --testPathPatterns="$FILE_LOCATION_PATTERN" --testNamePattern="$TEST_NAME_PATTERN"
# For client tests:
pnpm test-client --testPathPatterns="buildStepData" --testNamePattern="buildStepData"
```

### Testing in the Worker Package
The worker uses `vitest` for unit tests.
```sh
pnpm run test --filter=worker -- $TEST_FILE_NAME -t "$TEST_NAME"
```

### Utilities
```bash
pnpm run format            # Format code across entire project
pnpm run nuke              # Remove all node_modules, build files, wipe database, docker containers. **USE WITH CAUTION**
```

## Technology Stack

### Web Application (`/web/`)
- **Framework**: Next.js 14 (Pages Router)
- **APIs**: tRPC (type-safe client-server communication) + REST APIs for public access
- **Authentication**: NextAuth.js/Auth.js
- **Database**: Prisma ORM with PostgreSQL
- **Analytics Database**: ClickHouse (high-volume trace data)
- **Validation**: Zod schemas, we use zodv4 (always import from `zod/v4`)
- **Styling**: Tailwind CSS with CSS variables for theming
- **Components**: shadcn/ui (Radix UI primitives)
- **State Management**: TanStack Query (React Query) + tRPC
- **Charts**: Recharts

### Worker Application (`/worker/`)
- **Framework**: Express.js
- **Queue System**: BullMQ with Redis
- **Purpose**: Async processing (data ingestion, evaluations, exports, integrations)

### Infrastructure
- **Primary Database**: PostgreSQL (via Prisma ORM)
- **Analytics Database**: ClickHouse
- **Cache/Queues**: Redis
- **Blob Storage**: MinIO/S3

## Development Guidelines

### Frontend Features
- All new features go in `/web/src/features/[feature-name]/`
- Use tRPC for full-stack features (entry point: `web/src/server/api/root.ts`)
- Follow existing feature structure for consistency
- Use shadcn/ui components from `@/src/components/ui`
- Custom reusable components go in `@/src/components`

### Public API Development
- All public API routes in `/web/src/pages/api/public`
- Use `withMiddlewares.ts` wrapper
- Define types in `/web/src/features/public-api/types` with strict Zod v4 objects
- Add end-to-end tests (see `datasets-api.servertest.ts`)
- Manually update Fern API specs in `/fern/`, then regenerate OpenAPI spec via Fern CLI

### Authorization & RBAC
- Check `/web/src/features/rbac/README.md` for authorization patterns
- Implement proper entitlements checking (see `/web/src/features/entitlements/README.md`)

### Database
- **Dual database system**: PostgreSQL (primary) + ClickHouse (analytics)
- Use `golang-migrate` CLI for database migrations
- All database operations go through Prisma ORM for PostgreSQL
- Foreign key relationships may not be enforced in schema to allow unordered ingestion

### Testing
- Jest for API tests, Playwright for E2E tests
- For backend/API changes, tests must pass before pushes
- Add tests for new API endpoints and features
- When writing tests, focus on decoupling each `it` or `test` block to ensure that they can run independently and concurrently. Tests must never depend on the action or outcome of previous or subsequent tests.
- When writing tests, especially in the __tests__/async directory, ensure that you avoid `pruneDatabase` calls.

### Code Conventions
- **Pages Router** (not App Router)
- Follow conventional commits on main branch
- Use CSS variables for theming (supports auto dark/light mode)
- TypeScript throughout
- Zod v4 for all input validation

## Environment Setup

- **Node.js**: Version 24 (specified in `.nvmrc`)
- **Package Manager**: pnpm v9.5.0
- **Database Dependencies**: Docker for local PostgreSQL, ClickHouse, Redis, MinIO
- **Environment**: Copy `.env.dev.example` to `.env`

## Login for Development

When running locally with seed data:
- Username: `demo@langfuse.com`
- Password: `password`
- Demo project URL: `http://localhost:3000/project/7a88fb47-b4e2-43b8-a06c-a5ce950dc53a`

## Linear MCP
To get a project, use the `get_project` capability with the full project name as it is in the title.
- bad: message-placeholder-in-chat-messages-2beb6f02ec48
- good: Message placeholder in chat messages

## Front-end Tips

### Window Location Handling
- Whenever you want to use or do use window.location..., ensure that you also add proper handling for a custom basePath

## TypeScript Best Practices
- In TypeScript, if possible, don't use the `any` type
- **Use a single params object for functions with multiple arguments** - This makes code more readable at call sites and prevents bugs when arguments of the same type are accidentally swapped:

```typescript
// ❌ Bad - positional arguments are unclear and can be swapped without type errors
function sendMessage(userId: string, sessionId: string, projectId: string) {
  // ...
}
sendMessage(someString, someOtherString, anotherString); // Which is which?

// ✅ Good - params object makes intent clear and prevents argument swapping
function sendMessage(params: { userId: string; sessionId: string; projectId: string }) {
  // ...
}
sendMessage({ userId: someString, sessionId: someOtherString, projectId: anotherString });
```

## General Coding Guidelines
- For easier code reviews, prefer not to move functions etc around within a file unless necessary or instructed to do so

## Development Tips
- Before trying to build the package, try running the linter once first

## Custom Features (feat/meta-prompt branch)

### Meta Prompt - AI-Assisted Prompt Creation

AI와 대화하며 프롬프트를 자동 생성/개선하는 기능. 프롬프트 목록 페이지에서 "New prompt with AI" 버튼으로 진입합니다.

**진입점**: `/project/[projectId]/prompts` → "New prompt with AI" 버튼 → `/project/[projectId]/prompts/new-with-ai`

**구조**:
- 좌측 ChatPanel: AI와 대화하며 프롬프트 생성 (스트리밍)
- 우측 PromptEditorPanel: 생성된 프롬프트를 NewPromptForm에 적용하여 저장
- 데스크톱: 2-column 레이아웃 / 모바일: Tabs 전환

**핵심 기술**:
- `fetchLLMCompletion()` (LangChain 기반) + `StreamingTextResponse` 으로 스트리밍 응답
- 프로젝트의 LLM API Keys (`LlmApiKeys` 모델)를 활용한 모델/프로바이더 선택
- 플랫폼별 포매팅 규칙: OpenAI (### 블록), Claude (XML 태그), Gemini (System/User 분리), generic
- AI 응답에서 `## Improved Prompt`, `## Clarifying Questions` 등 섹션 자동 파싱

**파일 구조**:
```
web/src/features/meta-prompt/
├── types.ts                              # 공유 타입 (MetaPromptMessage, TargetPlatform 등)
├── constants/systemPrompt.ts             # 시스템 프롬프트 + PLATFORM_RULES
├── utils/parsePromptFromResponse.ts      # AI 응답 섹션 파싱
├── server/
│   ├── validation.ts                     # Zod v4 요청 스키마
│   ├── buildMetaPromptMessages.ts        # 플랫폼별 시스템 프롬프트 주입
│   └── metaPromptCompletionHandler.ts    # 인증 → LLM 호출 → 스트리밍 응답
├── context/MetaPromptProvider.tsx        # React Context + 스트리밍 fetch
└── components/
    ├── ModelSelector.tsx                 # Provider/Model/TargetPlatform 드롭다운
    ├── ChatHistory.tsx                   # 채팅 히스토리 (마크다운 렌더링)
    ├── ChatInput.tsx                     # 채팅 입력 (auto-resize, Enter 전송)
    ├── ChatPanel.tsx                     # 채팅 패널 조합
    ├── ApplyToEditorButton.tsx           # "Apply to Editor" 버튼
    ├── PromptEditorPanel.tsx             # NewPromptForm ref 연결
    └── MetaPromptPage.tsx                # 메인 페이지 레이아웃
```

**API 엔드포인트**: `POST /api/metaPromptCompletion` (`web/src/app/api/metaPromptCompletion/route.ts`)

**수정된 기존 파일**:
- `web/src/pages/project/[projectId]/prompts/[[...folder]].tsx` - "New prompt with AI" 버튼 추가
- `web/src/features/prompts/components/NewPromptForm/index.tsx` - `forwardRef` + `useImperativeHandle` 추가

**테스트** (28개, 모두 PASS):
```sh
pnpm test-sync --testPathPatterns="meta-prompt"
```
- `web/src/__tests__/meta-prompt/parsePromptFromResponse.servertest.ts` (8 tests)
- `web/src/__tests__/meta-prompt/buildMetaPromptMessages.servertest.ts` (9 tests)
- `web/src/__tests__/meta-prompt/validation.servertest.ts` (11 tests)

### Public REST API for Managed Models & Resources (feat/public-rest-api-resources branch)

UI에서 tRPC로만 접근 가능했던 4개 리소스를 외부 시스템/스크립트에서도 사용할 수 있도록 Public REST API로 노출.

**인증 방식**:
- **Project-scoped** (Managed Models): Basic Auth with project API key → `createAuthedProjectAPIRoute`
- **Org-scoped** (Menu Templates, String Resources, Drawable Resources): Basic Auth with org API key → `createAuthedOrgAPIRoute`

**API 엔드포인트 (22개)**:

| 리소스 | Scope | 엔드포인트 수 | URL prefix |
|--------|-------|-------------|------------|
| Managed Models | Project | 6 | `/api/public/managed-models` |
| Menu Templates | Org | 6 | `/api/public/organizations/menu-templates` |
| String Resources | Org | 7 | `/api/public/organizations/string-resources` |
| Drawable Resources | Org | 7 | `/api/public/organizations/drawable-resources` |

**핵심 설계**:
- `createAuthedOrgAPIRoute` 헬퍼: `createAuthedProjectAPIRoute`의 org 버전. `accessLevel === "organization"` 검증, Rate limiting, OTel context 동일 적용
- Pagination: Public API는 1-indexed (`publicApiPaginationZod`), tRPC는 0-indexed → `skip: (page - 1) * limit`
- Drawable 목록 조회 시 `content` 필드 제외 (메타데이터만), 단건 조회에서만 포함
- Bulk upsert: String Resources는 500개 배치 처리, 나머지는 단일 트랜잭션

**파일 구조**:
```
web/src/features/public-api/
├── server/
│   ├── createAuthedProjectAPIRoute.ts   # 기존 project 인증 헬퍼
│   └── createAuthedOrgAPIRoute.ts       # 신규 org 인증 헬퍼
└── types/
    ├── managed-models.ts                # Managed Models Zod 스키마
    ├── menu-templates.ts                # Menu Templates Zod 스키마
    ├── string-resources.ts              # String Resources Zod 스키마
    └── drawable-resources.ts            # Drawable Resources Zod 스키마

web/src/pages/api/public/
├── managed-models/
│   ├── index.ts                         # GET (list) + POST (create)
│   ├── [id]/index.ts                    # GET + PUT + DELETE
│   └── bulk/index.ts                    # POST (bulk upsert)
└── organizations/
    ├── menu-templates/
    │   ├── index.ts                     # POST (create, auto-version)
    │   ├── products/index.ts            # GET (product list)
    │   ├── products/[product]/versions/index.ts  # GET (versions)
    │   ├── [id]/index.ts               # GET + DELETE
    │   └── [id]/labels/index.ts        # PATCH (labels)
    ├── string-resources/
    │   ├── index.ts                     # GET (list) + POST (create)
    │   ├── categories/index.ts          # GET (distinct categories)
    │   ├── locales/index.ts             # GET (distinct locales)
    │   ├── [id]/index.ts               # GET + PUT + DELETE
    │   └── bulk/index.ts               # POST (bulk upsert)
    └── drawable-resources/
        ├── index.ts                     # GET (list, no content) + POST (create)
        ├── locales/index.ts             # GET (distinct locales)
        ├── [id]/index.ts               # GET (with content) + PUT + DELETE
        └── bulk/index.ts               # POST (bulk upsert)
```

**테스트** (4파일):
```sh
pnpm test -- --testPathPatterns="managed-models-api|menu-templates-api|string-resources-api|drawable-resources-api"
```
- `web/src/__tests__/async/managed-models-api.servertest.ts` — CRUD, pagination, search, brand filter, tenant isolation, bulk upsert
- `web/src/__tests__/async/menu-templates-api.servertest.ts` — CRUD, auto-version, products, labels PATCH, tenant isolation
- `web/src/__tests__/async/string-resources-api.servertest.ts` — CRUD, category/locale filter, categories/locales endpoints, bulk upsert, tenant isolation
- `web/src/__tests__/async/drawable-resources-api.servertest.ts` — CRUD, content 제외 확인, locale filter, bulk upsert, tenant isolation

**curl 예시**:
```bash
# Project-scoped (Managed Models)
curl -u pk:sk http://localhost:3000/api/public/managed-models

# Org-scoped (String Resources)
curl -u org-pk:org-sk http://localhost:3000/api/public/organizations/string-resources
```

### Task Template Execution Engine (feat/task-template-engine branch)

coconut SDK의 Task Template 실행 엔진을 TypeScript로 구현. Task Template 정의를 읽고, ManagedModel을 해석하여 LLM API Key를 찾고, 프롬프트를 포매팅하여 LLM API를 호출.

**핵심 구성요소**:
- `resolveModelConnection`: ManagedModel.brand → LlmApiKeys.provider 매핑으로 API 자격증명 해석
- `promptBuilder`: 변수 치환({{var}}, {var}) + chat/general 타입별 메시지 빌드
- `taskTemplateRouter`: tRPC CRUD + execute
- Public REST API: CRUD + execute(JSON) + stream(SSE)

**Prisma 모델**: `TaskTemplate` (project-scoped, auto-versioning by name)

**API 엔드포인트** (7개):

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/public/task-templates` | 목록 (pagination, search, typeFilter) |
| POST | `/api/public/task-templates` | 생성 (자동 버전 증가) |
| GET | `/api/public/task-templates/[id]` | 단건 조회 |
| PUT | `/api/public/task-templates/[id]` | 수정 |
| DELETE | `/api/public/task-templates/[id]` | 삭제 |
| POST | `/api/public/task-templates/[id]/execute` | 실행 (JSON) |
| POST | `/api/public/task-templates/[id]/stream` | 실행 (SSE 스트리밍) |

**RBAC 스코프**: `taskTemplates:read`, `taskTemplates:CUD`, `taskTemplates:execute`

**파일 구조**:
```
web/src/features/task-templates/
├── types.ts                                    # 공유 타입
├── validation.ts                               # Zod 스키마
└── server/
    ├── router.ts                               # tRPC 라우터
    ├── resolveModelConnection.ts               # 모델 해석 브릿지
    └── promptBuilder.ts                        # 프롬프트 빌더 + 변수 치환

web/src/features/public-api/types/
└── task-templates.ts                           # Public API Zod 스키마

web/src/pages/api/public/task-templates/
├── index.ts                                    # GET (list) + POST (create)
└── [id]/
    ├── index.ts                                # GET + PUT + DELETE
    ├── execute.ts                              # POST (JSON 실행)
    └── stream.ts                               # POST (SSE 스트리밍)
```

**테스트** (3파일, 59개):
```sh
# 단위 테스트 (44개)
pnpm test-sync --testPathPatterns="task-templates"
# 통합 테스트 (15개)
pnpm test -- --testPathPatterns="task-templates-api"
```

**curl 예시**:
```bash
# CRUD
curl -u pk:sk http://localhost:3000/api/public/task-templates
# 실행
curl -u pk:sk -X POST http://localhost:3000/api/public/task-templates/TEMPLATE_ID/execute \
  -H 'Content-Type: application/json' -d '{"inputs": {"topic": "AI"}}'
```

## Claude Code Configuration (.claude/)

### Agents (`.claude/agents/`)
| Agent | 설명 |
|-------|------|
| `changelog-writer.md` | 피처 브랜치 완료 후 changelog 작성 |
| `meta-prompt-dev.md` | Meta Prompt 기능 개발 팀 (backend → frontend → test → build 파이프라인) |

### Skills (`.claude/skills/`)
| Skill | 설명 |
|-------|------|
| `skill-developer` | Claude Code 스킬 생성/관리 메타 스킬 |
| `add-model-price` | `default-model-prices.json`에 LLM 모델 가격 추가 |
| `backend-dev-guidelines` | Next.js/tRPC/Express 백엔드 개발 패턴 가이드 |

트리거 규칙: `.claude/skills/skill-rules.json`
