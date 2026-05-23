# Story: Structured Logging & Application Monitoring

## Metadata
- **Story ID**: STORY-E01-03
- **Epic**: EPIC-01 — Foundation & Infrastructure Enhancement
- **Priority**: Medium
- **Status**: In Progress
- **Created**: 2026-05-09
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a platform operator, I want structured logs and a metrics dashboard so that I can diagnose issues and observe system health without SSHing into the server.

## Context
The current backend has no structured logging — NestJS default console output only. There are no application metrics, no health check endpoint, and no alerting. As the platform adds more modules and tenants, observability becomes critical for diagnosing production issues.

## Requirements

### Functional Requirements
- [x] Backend emits structured JSON logs (timestamp, level, context, message, traceId)
- [x] Every HTTP/GraphQL request is logged: method, path/operation, status, duration
- [x] A `/health` REST endpoint returns application health: DB, Redis, uptime
- [x] Prometheus metrics endpoint `/metrics` exposes: request count, response time histogram, error rate
- [x] Grafana dashboard (Docker Compose) shows: request rate, error rate, p95 latency, DB connections
- [ ] Error events (unhandled exceptions, DB failures) trigger an alert (log-level ERROR minimum)

### Non-Functional Requirements
- [x] Logging does not log sensitive data (passwords, tokens) — enforced by log sanitizer
- [x] Structured log format is consistent across all modules
- [x] `/health` and `/metrics` endpoints are excluded from auth guards

## Acceptance Criteria
- [x] `docker-compose up` starts Prometheus and Grafana alongside the app
- [ ] Making a GraphQL request produces a JSON log line with operation name and duration
- [x] `/health` returns `{ "status": "ok", "db": "ok", "redis": "ok", "uptime": 123 }`
- [ ] Grafana dashboard shows request rate graph with real data after 5 requests
- [ ] An intentional DB failure causes a log line at ERROR level with context

## Technical Specifications

### Architecture Impact
- **Backend**: Replace NestJS default logger with `pino` (via `nestjs-pino`); add `@nestjs/terminus` health checks; add `@willsoto/nestjs-prometheus` for metrics
- **Infrastructure**: Add Prometheus + Grafana containers to Docker Compose

### Docker Compose Addition
```yaml
prometheus:
  image: prom/prometheus:v2.52.0
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana:10.4.0
  ports:
    - "3001:3000"
  volumes:
    - grafana_data:/var/lib/grafana
    - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
```

### Log Format
```json
{
  "timestamp": "2026-05-09T12:00:00.000Z",
  "level": "info",
  "context": "AuthResolver",
  "traceId": "abc-123",
  "operation": "login",
  "duration": 42,
  "message": "GraphQL request completed"
}
```

### Health Endpoint Response
```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "uptime": 3600
}
```

### Metrics Exposed
- `http_requests_total` — counter by operation, status
- `http_request_duration_seconds` — histogram
- `db_query_duration_seconds` — histogram (Prisma middleware)
- `app_uptime_seconds` — gauge

## Implementation Plan

### Step 1: Structured Logging with Pino
- Install `nestjs-pino` and `pino-pretty` (dev only)
- Configure `LoggerModule` globally in `AppModule`
- Add `traceId` via `cls-hooked` or NestJS request scope
- Mask sensitive fields: `password`, `passwordHash`, `token`

### Step 2: Health Check Endpoint
- Install `@nestjs/terminus`
- Create `HealthModule` with `HealthController` at `/health`
- Add DB health indicator (Prisma ping query)
- Add Redis health indicator (see STORY-E01-02)

### Step 3: Prometheus Metrics
- Install `@willsoto/nestjs-prometheus` and `prom-client`
- Add request counter and duration histogram via NestJS interceptor
- Add Prisma middleware for DB query duration metric
- Expose `/metrics` endpoint

### Step 4: Monitoring Stack (Docker Compose)
- Add Prometheus and Grafana services to `docker-compose.yml`
- Create `monitoring/prometheus.yml` scrape config pointing to backend
- Provision a Grafana datasource (Prometheus) and a starter dashboard via JSON

## Testing Strategy

### Unit Tests
- [ ] Log sanitizer strips `password` and `token` fields

### Integration Tests
- [ ] `GET /health` returns 200 with expected shape
- [ ] `GET /metrics` returns Prometheus text format

### Manual Testing
- [ ] Open Grafana at `localhost:3001` and confirm dashboard renders

## Dependencies

### Blocked By
- STORY-E01-02 (Redis health indicator)

### Blocks
- All future modules benefit from logging and metrics

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pino breaks existing log tests | Low | Update tests to expect JSON output |
| Grafana/Prometheus overkill for solo dev | Low | Use Docker profile (`--profile monitoring`) to make optional |
