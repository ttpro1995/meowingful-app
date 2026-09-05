<!-- bmad:context -->
<!-- Verified 2026-09-05 against 02221aa. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## meowingful-app

Multi-tenant CRM & E-Learning platform: NestJS/GraphQL/Prisma/PostgreSQL/Redis/BullMQ backend, React/TypeScript/Apollo/Vite frontend, Docker Compose orchestration. Planning docs live in `vibe-doc/`; implementation work logs append to `work-log/`.

## Policy

- Trunk-based development; merge short-lived branches to `master`.
- Never commit secrets to code or config files; use environment variables.
- Append a work-log entry to `work-log/` after implementation stories.

## Where things are

- Backend modules: `back-end/src/{feature}/{feature}.{module|resolver|service|types}.ts`; cross-cutting concerns in `back-end/src/shared/`.
- Frontend pages/context: `front-end/src/pages/`, `front-end/src/context/`; centralized GraphQL operations in `front-end/src/graphql/queries.ts`.
- Generated artifacts — never hand-edit: `back-end/src/schema.gql`, `back-end/prisma/migrations/*`, `dist/`, `coverage/`, `node_modules/`.
- Database schema: `back-end/prisma/schema.prisma`; migrations required after every schema change.

## Running and verifying

- Run backend commands from `back-end/` and frontend commands from `front-end/`; each has its own `package.json`.
- CI enforces zero lint warnings and coverage floors (backend 70%, frontend 65%); local `npm run lint` does not fail on warnings.
- E2E tests require Postgres and Redis running; CI runs them against service containers, not Docker Compose.
- After schema changes: `cd back-end && npx prisma generate && npx prisma migrate dev`; production uses `cd back-end && npx prisma migrate deploy`.

## Conventions that differ from defaults

- Backend ESLint allows `any` (`no-explicit-any: off`); frontend strictly forbids unused locals and parameters.
- Backend tests: `.spec.ts` in `src/`; frontend tests: `.spec.tsx`.
- `User` and `Auth` are separate tables; `Auth` holds credentials, related to `User` by 1:1 `userId`.
- Audit mutations use `@Auditable(resource)` and `@AuditAction(resolver)`; global `AuditInterceptor` enqueues to BullMQ queue `audit-log`.

<!-- /bmad:context -->
