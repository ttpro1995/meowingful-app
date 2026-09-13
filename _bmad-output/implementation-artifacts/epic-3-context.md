# EPIC 03: CRM & Sales Management Context

## Epic Overview
- **Epic ID**: EPIC-03
- **Name**: CRM & Sales Management
- **Release**: v0.3 (Month 6)
- **Goal**: Give sales teams a full pipeline from lead capture through close with automation and reporting.

## Stories (User Stories)
Epic 03 comprises the following six user stories:

1. **STORY-E03-01: Lead & Customer Management**
   - Create, view, update, classify leads and customers
   - Lead status tracking (NEW, CONTACTED, QUALIFIED, UNQUALIFIED, CONVERTED, LOST)
   - Lead-to-customer conversion
   - Lead assignment and timeline notes
   - Lead scoring (manual/computed)

2. **STORY-E03-02: Sales Pipeline — Stages, Transitions & SLA Tracking**
   - Configurable sales pipelines with ordered stages
   - Stage transitions with timestamps and history
   - SLA duration tracking and breach alerts
   - Pipeline board view (Kanban-style)

3. **STORY-E03-03: Task Management & Kanban Board**
   - Task CRUD with due dates, priorities, recurrence
   - Task linking to leads/customers
   - Kanban board view grouped by status
   - Overdue task highlighting
   - Recurring task automation

4. **STORY-E03-04: Workflow Automation — Trigger-Based Actions & Auto-Assignment**
   - Automation rules (trigger → condition → actions)
   - Trigger events: LEAD_CREATED, LEAD_STAGE_CHANGED, SLA_BREACHED, TASK_OVERDUE
   - Actions: ASSIGN_LEAD, CREATE_TASK, SEND_NOTIFICATION, UPDATE_LEAD_FIELD
   - Asynchronous execution with retry logic

5. **STORY-E03-05: Sales Analytics & Reporting**
   - Conversion funnel reports (stage-to-stage conversion rates)
   - Lead source analysis
   - Staff performance metrics
   - Revenue forecasting
   - Pre-aggregated reporting with background jobs
   - CSV export functionality

6. **STORY-E03-06: Landing Page Builder**
   - Template-based landing page creation
   - Form submission → Lead creation in CRM
   - Page publishing/draft status
   - Basic analytics (views, submissions)

## Technical Architecture (Relevant Components)
Based on the platform architecture documentation:

### Core Services
- **CRM Service**: Core microservice handling all CRM functionality
- **Notification Service**: For sales alerts and lead assignment notifications
- **Analytics Service**: For reporting and dashboard data

### Data Layer
- **Modular Database Structure** (Phase 2):
  - `crm/leads`: Lead management
  - `crm/customers`: Customer data
  - `crm/sales_pipeline`: Sales workflow
  - Tenant isolation enforced via `tenantId` on all tables

### Key Technical Details
- **API Layer**: GraphQL with code-first approach
- **Real-time Updates**: WebSocket/SSE infrastructure for live dashboard updates
- **Event-Driven**: BullMQ/RabbitMQ for workflow automation and async processing
- **Multi-tenancy**: Tenant-scoped data access with Row-Level Security
- **Security**: RBAC guards and permission enforcement (`lead:*`, `pipeline:*`, `task:*`, `report:*`)

### Technology Stack
- **Backend**: NestJS (Node.js/TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **API**: GraphQL
- **Real-time**: WebSocket/SSE via Socket.io
- **Caching**: Redis (for session management, event streaming)
- **File Storage**: S3/MinIO (for exports, templates)

## Dependencies & Integration Points
Epic 03 integrates with and depends on:

### Internal Dependencies
- **Epic 02 (Multi-Tenant Admin & RBAC)**:
  - Tenant isolation and scoping (STORY-E02-01)
  - RBAC permission system (STORY-E02-02)
  - Feature flagging system (STORY-E02-04)
  - Tenant configuration (STORY-E02-04)

- **Epic 04 (Notification & Communication Infrastructure)**:
  - Notification service for sales alerts and lead assignments
  - WebSocket infrastructure for real-time updates
  - Internal messaging (optional integration)

- **Epic 11 (Payments, Analytics & Enterprise Integrations)**:
  - Analytics service for enhanced reporting capabilities
  - Payment gateway integration (for revenue tracking in forecasts)

### External Systems (Future)
- Email providers (SMTP/SendGrid) for outbound notifications
- SMS providers (Twilio) for SMS alerts
- Calendar integrations (Google/Outlook) for scheduling
- Payment processors (Stripe/PayPal) for revenue collection

## Implementation Considerations
- **Data Isolation**: All CRM entities must be tenant-scoped
- **Performance**: 
  - Pagination on list queries (default limit 20, max 100)
  - Indexing strategy for tenant-scoped queries
  - Background jobs for report aggregation (hourly)
  - Rate limiting for form submissions (5/min/IP)
- **Security**:
  - JWT authentication with tenant validation
  - Permission checks on all mutations/queries
  - Input validation and sanitization
- **Extensibility**:
  - Modular service architecture allows for future enhancement
  - Event-driven design enables easy addition of new triggers/actions
  - GraphQL schema evolves with backward compatibility

## Acceptance Criteria Summary
- Sales manager can configure pipeline stages and transition rules
- Leads are auto-assigned based on configurable rules
- Kanban board reflects real-time task state
- Report builder can export conversion rate and revenue data
- Landing page form submissions create leads in CRM
- Automation rules execute triggers reliably with retry logic
- Reporting respects tenant isolation and role-based access
- WebSocket connections maintain stability under load

## Testing Approach
- **Unit Tests**: Service logic, DTO validation, permission guards
- **Integration Tests**: API contracts, database operations, service interactions
- **E2E Tests**: User workflows (lead creation → assignment → task creation → completion)
- **Performance Tests**: Concurrent lead processing, report generation speed
- **Security Tests**: Permission bypass attempts, data leakage validation

---
*Context compiled from: epic-plan.md, architecture.md, and EPIC-03 story files*