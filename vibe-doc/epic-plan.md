# EPIC Plan — Meowingful Platform

**Baseline**: MVP v0.1 complete — Auth, profile management, JWT, Docker Compose, NestJS/GraphQL/PostgreSQL/React.

---

## Release Milestones Overview

| Release | Name | Target | Focus |
|---------|------|--------|-------|
| v0.2 | Foundation | Month 3 | Multi-tenant infra + RBAC + Admin |
| v0.3 | CRM Core | Month 6 | Lead/sales management + Notifications |
| v0.4 | E-Learning Core | Month 9 | Courses, content, grading, file storage |
| v0.5 | Live Learning | Month 12 | Live classes, exams, student portal |
| v0.6 | Teacher Platform | Month 15 | Teacher marketplace + payouts |
| v0.7 | Community | Month 18 | CMS, social feed, gamification, search |
| v0.8 | Call Center | Month 21 | VoIP, auto dialer, call recording |
| v1.0 | Enterprise | Month 24 | Payments, analytics, integrations |

---

## EPIC-01: Foundation & Infrastructure Enhancement
**Release**: v0.2  
**Goal**: Harden the platform for multi-tenant production use — security, observability, and CI/CD.

### Scope
- CI/CD pipeline (GitHub Actions): lint, test, build, deploy
- Redis integration for caching and session storage
- Application monitoring and structured logging (e.g., Prometheus + Grafana or equivalent)
- Enhanced security: 2FA, OAuth/SSO, session management, refresh tokens
- API improvements: pagination, filtering, error standardization
- Automated database backups and staging environment

### Acceptance Criteria
- PR gates enforce lint + test pass before merge
- Application metrics and alerts are visible in a dashboard
- Users can log in with OAuth (Google at minimum)
- All API list endpoints support pagination and filtering

---

## EPIC-02: Multi-Tenant Admin & RBAC
**Release**: v0.2  
**Goal**: Enable multiple isolated organizations to operate on one platform with fine-grained role control.

### Scope (spec A.1–A.5)
- Tenant (organization) creation and management with data isolation
- Tenant-level configuration: branding, feature toggles, settings
- RBAC: roles Admin, Developer, Director, Sales Manager, Staff, Accountant, HR
- Fine-grained permissions per role and organization unit
- Admin dashboard: real-time metrics (revenue, enrollment, teacher activity)
- Audit logging: searchable log of user actions, data changes, login history

### Acceptance Criteria
- Two tenants cannot access each other's data
- An admin can assign roles and permissions to users
- Audit log records every create/update/delete with actor and timestamp
- Admin dashboard renders key metrics without page refresh

---

## EPIC-03: CRM & Sales Management
**Release**: v0.3  
**Goal**: Give sales teams a full pipeline from lead capture through close with automation and reporting.

### Scope (spec B.1–B.5)
- Lead and customer management: create, update, classify, score
- Configurable sales pipeline with stage transitions and SLA tracking
- Workflow automation: trigger actions on events, auto-assign leads
- Task management: create/assign/deadline/recur, Kanban board
- Landing page builder: drag-and-drop, template library, A/B testing
- Sales analytics: conversion rates, revenue forecasting, custom reports

### Acceptance Criteria
- Sales manager can configure pipeline stages and transition rules
- Leads are auto-assigned based on configurable rules
- Kanban board reflects real-time task state
- Report builder can export conversion rate and revenue data

---

## EPIC-04: Notification & Communication Infrastructure
**Release**: v0.3  
**Goal**: Deliver reliable multi-channel notifications and real-time in-app communication as a shared service for all modules.

### Scope (spec 4.4, 4.6)
- Notification engine: email, SMS, push, in-app
- Notification template management and user preference controls
- Scheduled and triggered notifications
- WebSocket/SSE infrastructure for real-time updates (feed, chat, live class)
- Internal messaging between users (basic)
- Calendar integration: scheduling and appointment management (foundation for D.6)

### Acceptance Criteria
- System sends email/SMS/in-app for any registered event
- Users can opt out of notification types
- WebSocket connection is stable under 1K concurrent users
- Scheduled notifications fire within 1-minute tolerance

---

## EPIC-05: E-Learning Core
**Release**: v0.4  
**Goal**: Full lifecycle management of courses, content, and assessments.

### Scope (spec D.1–D.4, D.9)
- Course management: create, curriculum structure, prerequisites, pricing
- Content management: upload video/documents/text, SCORM compatibility
- Assignment management: create, submit, deadline enforcement, resubmission
- Grading system: manual and auto, multiple-choice, essay, rubric-based, partial scoring
- File storage: folder management, sharing, version control, per-tenant quota
- Student enrollment and course access control

### Acceptance Criteria
- Instructor can publish a course with video and document content
- Students can enroll, submit assignments, and receive grades
- SCORM packages can be uploaded and tracked
- File storage enforces tenant quota limits

---

## EPIC-06: Live Learning, Exams & Scheduling
**Release**: v0.5  
**Goal**: Enable synchronous learning with live classes, proctored exams, and conflict-free scheduling.

### Scope (spec D.5–D.8)
- Live class integration: Zoom/Jitsi with screen share, whiteboard, recording
- Online exams: question bank, randomized questions, timer, anti-cheating, basic proctoring
- Scheduling: calendar management, conflict detection, recurring schedules, notifications
- Document viewer: in-browser preview for Word/Excel/PowerPoint, annotation support
- Learning analytics: student progress, course completion rates, teacher performance

### Acceptance Criteria
- Teacher can schedule and start a live class; recording is saved automatically
- Exam engine serves randomized questions within a timer; tab-switch is flagged
- Scheduling system detects and rejects conflicting bookings
- Documents render in-browser without download

---

## EPIC-07: Student Portal
**Release**: v0.5  
**Goal**: Give students a self-service hub for learning, payments, and credentials.

### Scope (spec G.1–G.8)
- Student profile: personal info, learning history, certificates
- Wallet and payments: top-up, withdrawal, transaction history, refund management
- Assignment submission: upload, view feedback, resubmit
- Attendance tracking: check-in system, remaining sessions
- Learning interface: join live classes, view recordings, chat tools
- Exam taking: take, review answers, view results and rankings
- Certification: auto-generated certificates, template customization, verification/sharing
- Social features (student): participate in feed, follow users, bookmark content

### Acceptance Criteria
- Student can top up wallet and pay for a course
- Certificate is auto-generated on course completion and has a public verification URL
- Student can check in to a class and see remaining sessions
- Attendance and progress data are visible on the profile

---

## EPIC-08: Teacher / Freelancer Marketplace
**Release**: v0.6  
**Goal**: Attract and onboard freelance teachers with profiles, earnings visibility, and a managed approval workflow.

### Scope (spec E.1–E.3)
- Teacher public profile: bio, portfolio, skills, ratings, reviews
- Teacher dashboard: schedule, earnings, payout history, performance stats
- Onboarding workflow: application submission, admin approval, basic KYC
- Payout management: automated earnings calculation and payout tracking

### Acceptance Criteria
- Teacher applicant submits onboarding form; admin approves/rejects with notification
- Teacher dashboard shows correct earnings and upcoming schedule
- Public profile is visible to unauthenticated users and shows ratings
- Payout history is accurate and exportable

---

## EPIC-09: CMS, Website & Social Network
**Release**: v0.7  
**Goal**: Turn the platform into a content destination with public pages, a social feed, and community discovery tools.

### Scope (spec F.1–F.6)
- CMS: page builder, blog management, SEO tools, menu configuration
- Product/course catalog: browse, search, filter, ratings and reviews
- Social feed: post creation (text/image/video), real-time updates, hashtags, mentions
- Interaction system: nested comments, emoji reactions, content moderation and reporting
- Gamification: badges, achievements, leaderboards, activity counters
- Full-text search engine: filters, suggestions, Elasticsearch (or equivalent) integration

### Acceptance Criteria
- Marketing team can publish blog posts and landing pages without engineering
- Social feed shows new posts in real time without page reload
- User earns a badge automatically when a gamification trigger fires
- Search returns ranked results with filters in < 500ms

---

## EPIC-10: Call Center & VoIP
**Release**: v0.8  
**Goal**: Equip sales and support teams with integrated voice calling and campaign automation.

### Scope (spec C.1–C.3)
- VoIP/SIP integration: trunk setup, call routing, IVR
- Call management: history logging, recording storage and playback, search and filter
- Auto dialer: campaign management, scheduled calling, retry logic

### Acceptance Criteria
- Agent can make and receive calls from the browser via SIP
- All calls are logged and recorded; recordings play back in-app
- Auto dialer campaign runs on schedule and respects retry rules
- IVR routes incoming calls to the correct queue

---

## EPIC-11: Payments, Analytics & Enterprise Integrations
**Release**: v1.0  
**Goal**: Close the monetization loop and provide enterprise-grade analytics and API extensibility.

### Scope (spec 4.5, B.5, D.10, C.4, 4.8)
- Payment gateway integration: multiple processors, transaction reconciliation, invoice generation
- Advanced learning and sales analytics dashboards
- API gateway: REST API, webhook support, rate limiting, Swagger/OpenAPI docs
- Third-party integrations: SSO (SAML/OAuth2), CRM connectors
- Performance and load testing infrastructure
- Security testing (automated scanning, OWASP checks)

### Acceptance Criteria
- Platform processes real payments through at least two gateways
- Webhook fires reliably within 5 seconds of a triggering event
- API documentation is auto-generated and publicly accessible
- Load test demonstrates platform handles 10K concurrent users

---

## EPIC Summary Table

| EPIC | Name | Release | Spec Sections |
|------|------|---------|---------------|
| EPIC-01 | Foundation & Infrastructure | v0.2 | NFR 4.2, 4.3, 4.8 |
| EPIC-02 | Multi-Tenant Admin & RBAC | v0.2 | A.1–A.5 |
| EPIC-03 | CRM & Sales Management | v0.3 | B.1–B.5 |
| EPIC-04 | Notification & Communication Infra | v0.3 | NFR 4.4, 4.6 |
| EPIC-05 | E-Learning Core | v0.4 | D.1–D.4, D.9 |
| EPIC-06 | Live Learning, Exams & Scheduling | v0.5 | D.5–D.8, D.10 |
| EPIC-07 | Student Portal | v0.5 | G.1–G.8 |
| EPIC-08 | Teacher / Freelancer Marketplace | v0.6 | E.1–E.3 |
| EPIC-09 | CMS, Website & Social Network | v0.7 | F.1–F.6 |
| EPIC-10 | Call Center & VoIP | v0.8 | C.1–C.3 |
| EPIC-11 | Payments, Analytics & Enterprise | v1.0 | 4.5, C.4, B.5, D.10 |
