# Master Development Plan — Watch Party SaaS

**Версия:** 1.0  
**Дата:** 2 августа 2026  
**Статус:** На согласовании  
**Рабочая папка:** `DiMovie` (продукт: Watch Party SaaS)

---

## Резюме discovery

| Вопрос | Решение |
|--------|---------|
| Контекст | Greenfield, проект с нуля |
| Источник видео (MVP) | Embed по URL **и** загрузка файла |
| Авторизация (Phase 1) | Обязательная: JWT + Refresh Token |
| Управление воспроизведением | Демократичное: любой участник может play/pause/seek |
| Деплой MVP | Vercel (frontend) + отдельный backend + Cloudflare |

### Персоны

| Персона | Контекст | Главная задача за сессию |
|---------|----------|--------------------------|
| **Host** | Дома, ПК/ноутбук | Создать комнату, выбрать видео, пригласить друзей |
| **Guest** | Мобильный/ПК | Зайти по ссылке, смотреть синхронно, общаться |
| **Power user** | Регулярные watch party | Быстро создавать комнаты, управлять приватностью |

### Критический UX-поток (MVP)

```
Регистрация/логин → Создать комнату → Выбрать видео (URL или upload)
    → Получить ссылку watchparty.com/r/ABCD123 → Поделиться
    → Гости входят → Синхронный просмотр + чат + голос
```

### Ключевые экраны (MVP)

1. **Auth** — login / register / refresh session  
2. **Dashboard** — «Создать комнату», список активных комнат пользователя  
3. **Room Setup** — выбор видео (URL embed или upload), настройки приватности  
4. **Room** — плеер + участники + чат + голос + реакции  
5. **Join** — вход по коду/ссылке, проверка пароля (если есть)

### Сознательно НЕ делаем в MVP

- CRUD-админка, sidebar с десятью разделами  
- Подписки и биллинг (Phase 2)  
- Мобильное нативное приложение (Phase 3)  
- AI-модерация (Phase 3)  
- Хранение и стриминг видео как Netflix (только embed + upload в object storage)

---

## 0.1 Архитектурный план

### 0.1.1 Общая архитектура системы

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Cloudflare (Edge)                               │
│   DDoS protection · WAF · CDN · R2 (uploaded video) · DNS              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Next.js App  │     │  NestJS API     │     │  TURN Server    │
│  (Vercel)     │     │  (Railway/Fly)  │     │  (coturn)       │
│               │     │                 │     │                 │
│  · UI Room    │◄───►│  · REST API     │     │  WebRTC relay   │
│  · Auth UI    │ WS  │  · WebSocket GW │◄───►│  for voice      │
│  · Player     │     │  · Signaling    │     │                 │
└───────────────┘     └────────┬────────┘     └─────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────────┐
        │PostgreSQL│    │  Redis   │    │ Sentry /     │
        │ (Neon)   │    │ (Upstash)│    │ Grafana stack│
        └──────────┘    └──────────┘    └──────────────┘
```

**Принципы:**

- **Server-authoritative sync** — сервер хранит единственное «истинное» состояние плеера; клиенты отправляют intent, сервер применяет с ordering по timestamp.
- **Democratic control** — любой participant может отправить `PLAY`/`PAUSE`/`SEEK`; конфликты решаются last-event-wins с server timestamp (не блокируем управление одним host).
- **Thin client для видео** — передаём только команды и `currentTime`, не медиапоток синхронизации (кроме upload → CDN URL).
- **Separation of concerns** — HTTP для CRUD/auth, WebSocket для realtime (sync + chat), WebRTC mesh/SFU для голоса.

### 0.1.2 Технологический стек

| Слой | Технология | Обоснование |
|------|------------|-------------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript | Единый стек, SSR для auth/SEO landing |
| **UI** | Tailwind CSS v4, shadcn/ui | Стандарт проекта, кастомный room UI без template dashboard |
| **Client state** | TanStack Query (server state), XState (room session FSM) | Sync/connection lifecycle — state machine |
| **Forms** | React Hook Form + Zod | Auth, room settings, password |
| **Backend** | NestJS (Node.js 22), TypeScript | WebSocket Gateway, DI, guards, ORM; единый язык с frontend |
| **ORM** | Prisma | Type-safe, миграции, защита от SQL injection |
| **Database** | PostgreSQL 16 (Neon) | ACID, JSON для metadata комнат |
| **Cache / PubSub** | Redis (Upstash) | Активные комнаты, WS presence, rate limits, pub/sub между инстансами |
| **Realtime** | Socket.IO (NestJS Gateway) | Комнаты, sync events, chat; fallback transport |
| **Voice** | WebRTC + coturn (STUN/TURN) | P2P audio; при >8 участников — рассмотреть mediasoup SFU (Phase 1.5) |
| **Video embed** | react-player / iframe adapters | YouTube, Vimeo, прямые URL |
| **File storage** | Cloudflare R2 (S3-compatible) | Upload пользовательских файлов, presigned URLs |
| **Auth** | JWT (access 15m) + Refresh Token (httpOnly cookie, 30d) | Stateless API + secure refresh rotation |
| **Password hash** | argon2 | Предпочтительнее bcrypt для новых проектов |
| **Edge / Security** | Cloudflare (Proxy, WAF, Rate Limiting) | DDoS, bot protection |
| **Monitoring** | Sentry (errors), Prometheus + Grafana (metrics) | SLA MVP: p95 sync < 500ms |
| **CI/CD** | GitHub Actions | Lint, test, deploy Vercel + backend |
| **Load testing** | k6 | 1000 concurrent users target |

### 0.1.3 Структура Frontend

```
apps/web/                          # Next.js (Vercel)
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (app)/
│   │   ├── dashboard/             # Создать комнату, мои комнаты
│   │   └── room/[code]/           # Главный экран watch party
│   ├── join/[code]/               # Deep link entry
│   └── api/                       # BFF proxies (optional, minimal)
├── components/
│   ├── room/
│   │   ├── VideoPlayer.tsx        # Embed + uploaded file player
│   │   ├── SyncController.tsx     # XState-driven sync client
│   │   ├── ChatPanel.tsx
│   │   ├── VoicePanel.tsx         # WebRTC UI
│   │   ├── ParticipantsList.tsx
│   │   └── ReactionsOverlay.tsx
│   └── ui/                        # shadcn primitives
├── lib/
│   ├── socket/                    # Socket.IO client
│   ├── webrtc/                    # Voice peer management
│   ├── api/                       # TanStack Query hooks
│   └── machines/                  # XState: roomSession, voiceSession
└── types/
```

**Ключевые UX-решения:**

- Room — **fullscreen-first**, чат/voice как collapsible panels (не dashboard layout).
- Mobile web — responsive, voice через browser permissions.
- Реакции — ephemeral overlay (не засоряют чат).

### 0.1.4 Структура Backend

```
apps/api/                          # NestJS (Railway/Fly)
├── src/
│   ├── auth/                      # JWT, refresh, guards
│   ├── users/
│   ├── rooms/                     # CRUD, room codes, privacy
│   ├── participants/
│   ├── messages/
│   ├── sync/                      # Playback state engine
│   │   ├── sync.gateway.ts        # PLAY, PAUSE, SEEK, TIME_UPDATE
│   │   └── sync.service.ts        # State machine, conflict resolution
│   ├── voice/                     # WebRTC signaling
│   │   └── signaling.gateway.ts
│   ├── media/                     # Presigned upload, R2
│   ├── chat/
│   │   └── chat.gateway.ts
│   └── common/
│       ├── redis/
│       ├── rate-limit/
│       └── filters/               # XSS sanitization
├── prisma/
│   └── schema.prisma
└── test/
```

**Модульная монорепа (рекомендация):**

```
DiMovie/
├── apps/web/          # Next.js
├── apps/api/          # NestJS
├── packages/shared/   # Event types, DTOs, Zod schemas
└── docs/
```

### 0.1.5 Структура базы данных

```prisma
// Расширение базового ТЗ под MVP-решения

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String   @map("password_hash")
  displayName   String   @map("display_name")
  createdAt     DateTime @default(now()) @map("created_at")
  subscription  SubscriptionTier @default(FREE)
  refreshTokens RefreshToken[]
  ownedRooms    Room[]   @relation("RoomOwner")
  participants  Participant[]
  messages      Message[]
}

enum SubscriptionTier {
  FREE
  PRO
  ENTERPRISE
}

model RefreshToken {
  id        String   @id @default(cuid())
  tokenHash String   @map("token_hash")
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
}

model Room {
  id           String         @id @default(cuid())
  roomCode     String         @unique @map("room_code")  // 6-8 chars, e.g. 8HD92K
  ownerId      String         @map("owner_id")
  owner        User           @relation("RoomOwner", fields: [ownerId], references: [id])
  createdAt    DateTime       @default(now()) @map("created_at")
  status       RoomStatus     @default(ACTIVE)
  privacy      RoomPrivacy    @default(PUBLIC)
  passwordHash String?        @map("password_hash")
  maxUsers     Int            @default(100) @map("max_users")
  videoSource  VideoSource?
  participants Participant[]
  messages     Message[]
  playbackState PlaybackState?
}

enum RoomStatus {
  ACTIVE
  CLOSED
  ARCHIVED
}

enum RoomPrivacy {
  PUBLIC
  PRIVATE
  PASSWORD
}

model VideoSource {
  id        String          @id @default(cuid())
  roomId    String          @unique @map("room_id")
  room      Room            @relation(fields: [roomId], references: [id], onDelete: Cascade)
  type      VideoSourceType
  url       String          // embed URL or R2 CDN URL
  metadata  Json?           // title, duration estimate, provider
}

enum VideoSourceType {
  EMBED
  UPLOAD
}

model Participant {
  id        String          @id @default(cuid())
  roomId    String          @map("room_id")
  room      Room            @relation(fields: [roomId], references: [id], onDelete: Cascade)
  userId    String          @map("user_id")
  user      User            @relation(fields: [userId], references: [id])
  joinedAt  DateTime        @default(now()) @map("joined_at")
  role      ParticipantRole @default(MEMBER)
  @@unique([roomId, userId])
}

enum ParticipantRole {
  OWNER
  MEMBER
}

model PlaybackState {
  id            String   @id @default(cuid())
  roomId        String   @unique @map("room_id")
  room          Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  isPlaying     Boolean  @default(false) @map("is_playing")
  currentTime   Float    @default(0) @map("current_time")  // seconds
  playbackRate  Float    @default(1)
  lastEventAt   DateTime @map("last_event_at")
  lastEventBy   String?  @map("last_event_by")
  version       Int      @default(0)  // optimistic concurrency
}

model Message {
  id        String   @id @default(cuid())
  roomId    String   @map("room_id")
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id])
  content   String   // sanitized plain text + emoji
  createdAt DateTime @default(now()) @map("created_at")
  deletedAt DateTime? @map("deleted_at")
  @@index([roomId, createdAt])
}
```

**Redis keys (hot path):**

| Key pattern | TTL | Назначение |
|-------------|-----|------------|
| `room:{code}:state` | — | Текущий playback state (cache) |
| `room:{code}:presence` | 60s | Set socketId → userId, heartbeat |
| `room:{code}:chat:recent` | — | List последних 100 сообщений |
| `ratelimit:chat:{userId}` | 60s | Sliding window 20 msg/min |
| `ratelimit:auth:{ip}` | 15m | Brute force: 5 attempts |

### 0.1.6 Система хранения данных

| Тип данных | Hot storage | Cold storage | Политика |
|------------|-------------|----------------|----------|
| Playback state | Redis + PG `PlaybackState` | — | Redis primary, PG persist каждые 5s / on event |
| Chat (recent) | Redis list (100 msg) | PostgreSQL | Archive при overflow |
| Uploaded video | Cloudflare R2 | — | Presigned PUT, max 2GB/file MVP |
| User credentials | PostgreSQL | — | argon2 hash |
| Session tokens | PostgreSQL (refresh hash) | — | Rotation on refresh |
| WS presence | Redis | — | Ephemeral |

**Upload flow:**

1. Client запрашивает presigned URL (`POST /media/upload-url`).
2. Direct upload в R2.
3. Client подтверждает (`POST /rooms/:id/video`) → сохраняется `VideoSource`.

### 0.1.7 Система авторизации

```
┌──────────┐    POST /auth/login     ┌──────────┐
│  Client  │ ───────────────────────►│   API    │
│          │◄── accessToken (JSON) ──│          │
│          │◄── refreshToken (cookie)│          │
└──────────┘                         └──────────┘

REST:  Authorization: Bearer <accessToken>
WS:    auth handshake { token } → join room
Room password: отдельно от account password (argon2 hash в Room.passwordHash)
```

**Guards:**

- `JwtAuthGuard` — REST endpoints.
- `WsAuthGuard` — Socket.IO connection middleware.
- `RoomAccessGuard` — privacy check (public / invite link / password).

**MVP scope:** регистрация email+password, login, logout, refresh, protected routes. OAuth — Phase 2.

### 0.1.8 Система безопасности

| Угроза | Мера |
|--------|------|
| DDoS | Cloudflare proxy, rate limits, challenge on auth |
| SQL Injection | Prisma parameterized queries |
| XSS | DOMPurify на клиенте, sanitize на сервере для chat |
| CSRF | SameSite cookies для refresh; CSRF token для state-changing если cookie auth |
| Brute force | Redis rate limit login: 5/15min per IP + account lockout notification |
| JWT theft | Short access TTL, refresh rotation, httpOnly secure cookie |
| Room bombing | maxUsers, optional password, owner can kick (Phase 1.1) |
| Spam chat | 20 msg/min per user, duplicate detection |
| File upload abuse | MIME whitelist (video/*), size limit, virus scan — Phase 2 |
| WebRTC leaks | TURN credentials time-limited, no IP logging in client |

### 0.1.9 Система масштабирования

**Phase 1 target:** 100 concurrent users per room, 1000 concurrent connections platform-wide.

**Phase 2 target:** 10 000 platform-wide via horizontal scaling.

```
                    ┌─────────────┐
                    │   Redis     │
                    │  Pub/Sub    │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ API Pod 1  │  │ API Pod 2  │  │ API Pod N  │
    │ Socket.IO  │  │ Socket.IO  │  │ Socket.IO  │
    │ + sticky   │  │            │  │            │
    └────────────┘  └────────────┘  └────────────┘
```

**Стратегии:**

1. **Socket.IO Redis adapter** — broadcast между инстансами.
2. **Sticky sessions** — load balancer affinity по socket (или Redis adapter без sticky).
3. **Room sharding** — room_code как partition key; один room → один primary pod (optional optimization).
4. **Voice scaling** — MVP: full mesh до 8 участников; 9–100: mediasoup SFU (отдельный сервис, Phase 1.5).
5. **DB** — connection pooling (PgBouncer), read replicas для analytics (Phase 2).
6. **CDN** — статика Next.js на Vercel Edge; uploaded video через Cloudflare CDN.

**Sync latency budget (<500ms p95):**

| Segment | Budget |
|---------|--------|
| Client → Server WS | 50ms |
| Server processing | 10ms |
| Redis state update | 5ms |
| Server → Clients broadcast | 50ms |
| Client apply + player seek | 100ms |
| **Total** | **~215ms typical**, margin for jitter |

---

## 0.2 План разработки

### Phase 1 — MVP

**Цель:** «Синхронизация просмотра + общение» с аккаунтами.

| Sprint | Deliverables | Duration |
|--------|--------------|----------|
| **1.1 Foundation** | Monorepo, Prisma schema, auth (register/login/refresh), CI | 1 week |
| **1.2 Rooms** | Create room, unique codes, join by link, privacy modes | 1 week |
| **1.3 Video** | Embed player (YouTube/Vimeo/direct), upload to R2, room setup UI | 1 week |
| **1.4 Sync** | WebSocket sync engine, democratic control, drift correction | 1.5 weeks |
| **1.5 Chat** | Real-time chat, emoji, rate limit, owner delete message | 1 week |
| **1.6 Voice** | WebRTC signaling, mute self, mute others (local), STUN/TURN | 1.5 weeks |
| **1.7 Hardening** | Security pass, monitoring, load tests, bug fixes | 1 week |

**Phase 1 feature checklist:**

- [x] Создание комнаты (unique ID, WS channel, owner assigned)
- [x] Подключение пользователей (link/code, access checks)
- [x] Видеосинхронизация (PLAY/PAUSE/SEEK/TIME_UPDATE)
- [x] Чат (WebSocket, rate limit, emoji)
- [x] Голос (WebRTC, mute controls)
- [x] Реакции (ephemeral overlay)
- [x] Privacy: Public / Private / Password
- [x] Auth: JWT required

**Sync protocol (WebSocket events):**

```typescript
// Client → Server (intent)
{ type: 'SYNC_INTENT', event: 'PLAY' | 'PAUSE' | 'SEEK', time: number, clientTs: number }

// Server → All clients (authoritative)
{ type: 'SYNC_STATE', isPlaying: boolean, time: number, version: number, serverTs: number, by: userId }

// Drift correction (periodic)
{ type: 'TIME_UPDATE', time: number, serverTs: number }
```

**Democratic control logic:**

- Любой authenticated participant отправляет intent.
- Server инкрементирует `version`, применяет event, broadcast всем.
- Клиент игнорирует state с `version <= localVersion`.
- Drift > 300ms → client выполняет soft seek.

### Phase 2 — Growth

| Feature | Description |
|---------|-------------|
| **Subscriptions** | Stripe integration, FREE/PRO tiers, max_users limits |
| **Profiles** | Avatar, display name, watch history |
| **Quality** | Adaptive voice (SFU), sync precision, reconnection UX |
| **OAuth** | Google, Discord login |
| **Room recording** | Phase 2.5 — metadata only / optional cloud record |
| **Kick/ban** | Owner moderation tools |
| **Analytics dashboard** | Room stats for owner (not admin CRUD) |

### Phase 3 — Platform

| Feature | Description |
|---------|-------------|
| **Mobile app** | React Native или PWA-first + native wrappers |
| **AI functions** | AI-модератор чата, spam detection, content warnings |
| **Communities** | Groups, scheduled watch parties, friend lists |
| **Events** | Public scheduled rooms, discovery feed |

---

## 0.3 План тестирования

### Функция 1: Создание комнаты

| Aspect | Detail |
|--------|--------|
| **Что тестируется** | Уникальность `room_code`, время создания, назначение owner, WS channel init |
| **Способ** | Unit (code generator), Integration (POST /rooms), Load (k6: 10 000 rooms) |
| **Ожидаемый результат** | 0 collisions; p95 creation < 500ms |
| **Критерий успеха** | 10 000 sequential creates без duplicate codes; p99 < 500ms на staging |

### Функция 2: Вход по ссылке

| Aspect | Detail |
|--------|--------|
| **Что тестируется** | Valid/invalid code, closed room, password protection, max_users |
| **Способ** | Integration e2e (Playwright), Unit (access guard) |
| **Ожидаемый результат** | Valid → join; invalid → 404; wrong password → 403; full room → 409 |
| **Критерий успеха** | 100% pass на matrix из 12 access scenarios |

### Функция 3: Синхронизация видео

| Aspect | Detail |
|--------|--------|
| **Что тестируется** | PLAY/PAUSE/SEEK propagation, democratic multi-user control, drift correction |
| **Способ** | Integration (multi-client mock), Load (50 simulated clients), Manual (2 browsers) |
| **Ожидаемый результат** | All clients sync within 500ms on PAUSE |
| **Критерий успеха** | k6 WS test: 50 clients, PAUSE latency p95 < 500ms; drift < 1s after 30min |

### Функция 4: Голосовой чат

| Aspect | Detail |
|--------|--------|
| **Что тестируется** | Signaling, audio connect, mute, latency, packet loss handling |
| **Способ** | Manual (WebRTC internals), Load (limited — 10 bots Phase 1, 100 Phase 1.5 with SFU) |
| **Ожидаемый результат** | Audio connects < 3s; mute immediate; acceptable quality at 10 users |
| **Критерий успеха** | 10-user room: all peers connected; MOS subjective ≥ 3.5; server CPU < 70% |

### Функция 5: Текстовый чат

| Aspect | Detail |
|--------|--------|
| **Что тестируется** | Delivery, ordering, emoji, rate limit, owner delete, XSS sanitization |
| **Способ** | Unit (sanitizer, rate limiter), Integration (WS chat flow) |
| **Ожидаемый результат** | Messages delivered < 200ms; 21st message in 1 min blocked |
| **Критерий успеха** | Rate limit triggers; `<script>` stripped; deleted msg hidden for all |

### Функция 6: Авторизация

| Aspect | Detail |
|--------|--------|
| **Что тестируется** | Register, login, refresh rotation, expired token, brute force limit |
| **Способ** | Unit (hash, JWT), Integration (auth flow), Security (rate limit) |
| **Ожидаемый результат** | Valid creds → tokens; invalid → 401; 6th login attempt blocked |
| **Критерий успеха** | Refresh rotation invalidates old token; OWASP auth checklist pass |

### Функция 7: Upload видео

| Aspect | Detail |
|--------|--------|
| **Что тестируется** | Presigned URL, upload complete, playback from CDN URL |
| **Способ** | Integration (mock R2), E2E (small test file) |
| **Ожидаемый результат** | File accessible via CDN; room video source updated |
| **Критерий успеха** | 100MB test file uploads and plays in room |

### Функция 8: Privacy modes

| Aspect | Detail |
|--------|--------|
| **Что тестируется** | Public join, private link-only, password gate |
| **Способ** | Integration matrix |
| **Ожидаемый результат** | Correct gate per mode |
| **Критерий успеха** | 3 modes × 3 scenarios = 9/9 pass |

### Integration test: Full MVP scenario

```
1. User A registers and logs in
2. User A creates room with YouTube URL, privacy=PASSWORD
3. User B registers, joins with wrong password → fail
4. User B joins with correct password → success
5. User A presses PLAY → B's player starts within 500ms
6. User B sends chat message → A receives within 200ms
7. Both enable voice → audio connected
8. User B presses PAUSE → both pause within 500ms
9. User A deletes B's chat message → hidden for both
10. User A closes room → B gets disconnected gracefully
```

### Load testing plan (k6)

| Scenario | Users | Duration | Pass criteria |
|----------|-------|----------|---------------|
| Room creation burst | 1000 creates | 5 min | p95 < 500ms, 0 errors |
| WS connections | 1000 sockets | 10 min | 99% connected |
| Sync stress | 100 users, 1 room | 5 min | PAUSE p95 < 500ms |
| Chat throughput | 500 msg/s | 2 min | 0 dropped, rate limits work |
| Mixed workload | 200 users, 20 rooms | 15 min | Error rate < 0.1% |

### MVP readiness checklist (from ТЗ §13)

| Criterion | Test | Target |
|-----------|------|--------|
| 100 users simultaneous | k6 load test | Pass |
| Sync latency | WS latency metrics | p95 < 500ms |
| Voice works | Manual + 10-user bot | Pass |
| Chat works | Integration + load | Pass |
| Rooms protected | Security matrix | Pass |
| No critical errors | Sentry 24h staging soak | 0 critical |
| Server load | Grafana CPU/memory | < 80% at peak |

---

## Инфраструктура и деплой (MVP)

| Service | Provider | Notes |
|---------|----------|-------|
| Frontend | Vercel | `apps/web`, env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` |
| Backend | Railway or Fly.io | `apps/api`, Dockerfile, auto-scale 1–3 instances |
| PostgreSQL | Neon | Serverless PG, branching for staging |
| Redis | Upstash | Serverless, global replication optional |
| R2 | Cloudflare | Video uploads bucket |
| TURN | Fly.io coturn or Cloudflare Calls | Evaluate cost |
| DNS + WAF | Cloudflare | `watchparty.com` proxy enabled |
| Monitoring | Sentry + Grafana Cloud | Free tiers for MVP |

---

## Риски и mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Embed providers block sync (YouTube API limits) | High | Support direct MP4/WebM URLs + upload; document limitations |
| WebRTC mesh doesn't scale to 100 users | High | SFU (mediasoup) in Phase 1.5 before 100-user voice claim |
| Democratic sync conflicts | Medium | Server versioning + last-event-wins; UI debounce 200ms |
| Vercel + WS long connections | Medium | WS on dedicated backend domain, not Vercel serverless |
| Upload storage costs | Medium | Size limits, PRO tier in Phase 2 |

---

## Следующие шаги (после согласования плана)

1. **Подтверждение плана** — stakeholder sign-off на этот документ.
2. **Инициализация monorepo** — `apps/web` (Next.js), `apps/api` (NestJS), `packages/shared`.
3. **Prisma schema + миграции** — per §0.1.5.
4. **Sprint 1.1** — auth end-to-end.
5. **Staging environment** — Neon + Upstash + Railway preview deploys.

---

## Открытые вопросы для финального sign-off

1. **Доменное имя** — `watchparty.com` placeholder; финальный domain?
2. **Voice 100 users in MVP** — подтвердить: в Phase 1 цель 10–15 voice participants, 100 — только video sync + chat; full 100 voice → Phase 1.5 + SFU?
3. **Монетизация Phase 2** — Stripe с самого начала архитектурно заложен (`subscription` field), OK?
4. **Embed providers** — MVP: YouTube + Vimeo + direct URL; другие?

---

*Документ подготовлен для согласования. После approval начинается Sprint 1.1 без изменения архитектурных решений без ADR.*
