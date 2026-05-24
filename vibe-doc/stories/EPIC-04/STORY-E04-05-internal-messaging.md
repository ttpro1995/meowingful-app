# Story: Internal Messaging — User-to-User Direct Messages

## Metadata
- **Story ID**: STORY-E04-05
- **Epic**: EPIC-04 — Notification & Communication Infrastructure
- **Priority**: Low
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a staff member, I want to send direct messages to colleagues within my organization so that I can discuss leads or assignments without leaving the platform.

## Context
Internal messaging is a quality-of-life feature. Sales staff want to discuss a lead with their manager; teachers want to message students about an assignment. The WebSocket infrastructure (E04-02) makes real-time delivery straightforward. This story covers basic 1:1 messaging only — group channels and threads are out of scope.

## Requirements

### Functional Requirements
- [ ] Start a conversation with any tenant member by searching their name
- [ ] Send and receive text messages in a conversation thread
- [ ] New messages delivered in real-time via WebSocket (`message.new` event)
- [ ] Unread message count visible in the UI navigation
- [ ] Message history paginated (cursor-based, newest first)
- [ ] Conversations are tenant-scoped — cannot message across tenants

### Non-Functional Requirements
- [ ] Messages are soft-deletable by the sender (hidden, not physically deleted)
- [ ] No file attachment in this story (deferred)
- [ ] Cursor-based pagination for message history (not offset-based) for stable results

## Acceptance Criteria
- [ ] Staff A sends "Hey, call lead John" to Staff B; Staff B sees the message in real-time without refresh
- [ ] Unread count in nav updates when a new message arrives
- [ ] Scrolling up in the conversation loads older messages via cursor pagination
- [ ] Staff A cannot message users from a different tenant

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Conversation`, `Message` models
- **Backend**: `MessagingModule`; WebSocket events via `WebSocketService` (E04-02)
- **GraphQL**: Conversation and message queries + send mutation

### Prisma Schema
```prisma
model Conversation {
  id           String    @id @default(uuid())
  tenantId     String
  participantIds String[] // Array of 2 user IDs (sorted, for dedup)
  lastMessageAt DateTime?
  messages     Message[]
  tenant       Tenant    @relation(fields: [tenantId], references: [id])
  @@unique([tenantId, participantIds]) // prevent duplicate conversations
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  senderId       String
  content        String
  isDeleted      Boolean      @default(false)
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  sender         User         @relation(fields: [senderId], references: [id])
  @@index([conversationId, createdAt])
}
```

### Real-Time Delivery
```typescript
// After saving Message to DB:
websocketService.emitToUser(recipientId, 'message.new', {
  conversationId,
  message: { id, content, senderId, createdAt },
});
```

### Cursor Pagination for Messages
```graphql
type MessageConnection {
  edges: [MessageEdge!]!
  pageInfo: { hasNextPage: Boolean!, endCursor: String }
}

query messages(conversationId: ID!, first: Int, after: String): MessageConnection
```

## Implementation Plan

### Step 1: Prisma Models
- Create `Conversation` and `Message` models

### Step 2: Messaging API
- Query: `myConversations` — list conversations sorted by `lastMessageAt`
- Query: `messages(conversationId, first, after)` — cursor-paginated message history
- Mutation: `sendMessage(recipientId, content)` — creates conversation if not exists, adds message, emits WebSocket event
- Mutation: `deleteMessage(id)` — soft delete (sender only)

### Step 3: Unread Count
- `unreadConversationCount` query — counts conversations with messages newer than `lastReadAt`
- `markConversationRead(conversationId)` mutation — updates `lastReadAt` for current user

### Step 4: Frontend Chat UI
- Conversation list sidebar
- Message thread view with WebSocket subscription
- Unread badge in navigation

## Testing Strategy

### Unit Tests
- [ ] `sendMessage` to new recipient creates a new `Conversation`
- [ ] `sendMessage` to existing recipient reuses the existing `Conversation`

### Integration Tests
- [ ] Sending a message emits `message.new` WebSocket event to recipient
- [ ] Cursor pagination returns messages in correct order

## Dependencies

### Blocked By
- STORY-E04-02 (WebSocket for real-time message delivery)
- STORY-E02-01 (tenant scoping)
- STORY-E02-03 (validate recipient is a tenant member)

### Blocks
- Nothing

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Message history grows very large | Low | Cursor pagination keeps queries fast; archive > 1 year old messages |
| Duplicate conversations created in race condition | Low | `@@unique([tenantId, participantIds])` constraint + upsert |
