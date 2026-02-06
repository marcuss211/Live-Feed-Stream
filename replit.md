# replit.md

## Overview

This is a **casino transaction live feed** application — a real-time dashboard that displays casino win/loss transactions via Server-Sent Events (SSE). The server auto-generates mock transactions every 1.5s and broadcasts them in real-time. The app tracks casino bets (wins and losses) with details like username, amount, game, multiplier, and currency (Turkish Lira ₺). It features a dark-themed UI optimized for monitoring casino activity with GPU-accelerated CSS animations and fully responsive mobile support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query with infinite query support for cursor-based pagination
- **Styling**: Tailwind CSS with CSS variables for theming (dark mode by default)
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Animations**: CSS-only GPU-accelerated animations (translateY, will-change-transform) for 60fps feed transitions
- **Real-time**: Server-Sent Events (SSE) via EventSource for live transaction streaming
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers
- **Build Tool**: Vite with React plugin
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Key Frontend Components
- `LiveFeed` — Main page with CSS Grid casino feed, SSE-powered real-time updates, auto-scroll to top, max 40 items
- `TransactionRow` — Responsive grid row with hidden username ("Gizli"), game thumbnail, bet amount, multiplier (dash for losses, hidden on mobile), winnings
- `useTransactionStream` — SSE hook for real-time transaction streaming with auto-reconnect
- Game thumbnail images stored in `client/public/images/games/` (30 unique slot game thumbnails)

### Responsive Layout
- Desktop (>=640px): 5-column CSS Grid (Kullanici, Oyun, Bahis, Carpan, Kazanc)
- Mobile (480-639px): 4-column CSS Grid (Carpan hidden)
- Small mobile (<480px): 4-column CSS Grid with narrower columns
- No horizontal scroll on any viewport — columns auto-narrow
- Text, padding, images scale down on mobile via sm: breakpoints

### Backend
- **Framework**: Express.js on Node.js with TypeScript
- **Runtime**: tsx for development, esbuild for production bundling
- **HTTP Server**: Node's `http.createServer` wrapping Express
- **API Pattern**: REST API with typed route definitions in `shared/routes.ts` using Zod schemas
- **Development**: Vite dev server middleware for HMR (via `server/vite.ts`)
- **Production**: Static file serving from `dist/public`

### API Endpoints
- `GET /api/transactions` — List transactions with cursor-based pagination, optional type/search filters
- `POST /api/transactions` — Create a new transaction (also broadcasts via SSE)
- `GET /api/transactions/stream` — SSE endpoint for real-time transaction streaming
- `GET /api/stats` — Get aggregated profit/loss statistics
- `GET /api/auth/user` — Get authenticated user info

### Admin API Endpoints (requires auth + admin role)
- `GET /api/admin/me` — Get current user's admin role (auto-bootstraps first user as super_admin)
- `GET /api/admin/games` — List all game configurations
- `PUT /api/admin/games/:gameId` — Update game config (name, provider, active, ladder, image)
- `POST /api/admin/games` — Create a new game config (name, provider, gameId/slug, active, ladder, customLadder)
- `POST /api/admin/games/:gameId/image` — Upload game image (binary body, max 300KB, PNG/JPG/WebP)
- `GET /api/admin/settings` — Get all feed settings (SuperAdmin only for write)
- `PUT /api/admin/settings` — Update provider weights and feed settings (SuperAdmin only)
- `GET /api/admin/audit-logs` — View change audit history
- `POST /api/admin/promote` — Promote/demote user roles (SuperAdmin only)

### Real-time Data Flow
- Server generates mock transactions every 1.5s via `setInterval`
- New transactions are saved to DB and broadcast to all connected SSE clients
- SSE clients receive JSON transaction objects via `EventSource`
- Client maintains max 40 items, newest at top, old items dropped from memory

### Realistic Transaction Generation
- **30 slot games**: Gates of Olympus, Sweet Bonanza, Big Bass Bonanza, Book of Dead, Wolf Gold, Sugar Rush, Starlight Princess, Wanted Dead or a Wild, The Dog House, Fruit Party, Fire Joker, Legacy of Dead, Gates of Gatotkaca, Aztec Gems, Madame Destiny Megaways, Extra Chilli Megaways, Floating Dragon, Reactoonz, Jammin' Jars, Bonanza Megaways, Starburst, Gonzo's Quest, Dead or Alive 2, Razor Shark, Rise of Olympus, Mental, Buffalo King Megaways, Money Train 2, Eye of Horus, Joker's Jewels
- **Bet distribution** (heavy-tail): 70% ₺5-250, 20% ₺250-1500, 7% ₺1500-7500, 2.5% ₺7500-25000, 0.5% ₺25000-120000 (whale)
- **Outcome distribution**: 58% loss, 32% small win (1.1-4x), 8% mid win (4-20x), 1.8% big win (20-120x), 0.2% mega win (120-1000x)
- **Whale cooldown**: 20-40 events between whale-tier bets
- **User behavior**: Same user won't appear back-to-back; returning users' bet amounts drift gradually (human simulation)
- **Natural amounts**: Bet values snap to clean numbers (₺50, ₺75, ₺250, ₺2,750) with slight jitter, not random decimals
- **High-bet restrictions**: Big multipliers (200x+) are very rare on high bets (>₺5,000)
- **Pragmatic Play ladder**: 9 Pragmatic games (Gates of Olympus, Sweet Bonanza, Big Bass Bonanza, Sugar Rush, Starlight Princess, The Dog House, Fruit Party, Gates of Gatotkaca, Buffalo King Megaways) use a fixed bet ladder [1,2,...,10000] instead of random amounts. Returning users drift ±1-3 steps on the ladder (more stable at 1000+)

### Database
- **Database**: PostgreSQL (required, connected via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-Zod integration
- **Schema Location**: `shared/schema.ts` and `shared/models/auth.ts`
- **Migrations**: Drizzle Kit with `drizzle-kit push` command (`npm run db:push`)
- **Connection**: `pg` Pool in `server/db.ts`

### Database Tables
1. **transactions** — Core data table (id, username, amount, currency, type WIN/LOSS, game, multiplier, timestamp, isSimulation)
2. **users** — User accounts for Replit Auth (id, email, firstName, lastName, profileImageUrl, role, timestamps)
3. **sessions** — Session storage for express-session with connect-pg-simple
4. **game_configs** — Admin-managed game configurations (gameId, name, provider, imagePath, isActive, ladderType, customLadder)
5. **feed_settings** — Key-value store for feed parameters (provider weights, etc.)
6. **audit_logs** — Change audit trail (adminUserId, adminEmail, entity, entityId, field, oldValue, newValue, timestamp)

### Admin Panel
- **Route**: `/admin` — separate admin layout, not shared with player UI
- **Roles**: SuperAdmin (all access), ContentManager (games/images/ladders only), User (no admin access)
- **First user bootstrap**: First authenticated user on `/api/admin/me` is auto-promoted to SuperAdmin
- **Game Config Cache**: `server/gameConfigCache.ts` — in-memory cache refreshed on admin changes, no restart needed
- **Default Active Games**: 7 games active on initial seed (Gates of Olympus, Sweet Bonanza, Big Bass Bonanza, Sugar Rush, Starlight Princess, The Dog House, Fruit Party), rest inactive
- **Game Creation**: Self-service "Yeni Oyun Ekle" modal with name, provider, auto-slug, image upload, active toggle, ladder type, custom ladder
- **Bet Ladder Types**: Pragmatic, Play'n GO, NetEnt, Hacksaw, Custom. Per-game custom ladder overrides provider default when filled. Bracket format [1,2,3] accepted. Min 5 values, ascending order required.
- **Image Upload**: Binary upload to `client/public/images/games/`, max 300KB, PNG/JPG/WebP. Guidelines shown in UI (256x256px, transparent bg preferred).
- **Image Flow**: Upload -> file write -> DB update -> cache invalidate -> thumbnail refresh. Success only after all steps complete.
- **Audit Logging**: Every admin change logged with timestamp, user, entity, field, old/new values
- **Save Indicator**: "Updated" badge shown for 3s after successful save, only on mutation success

### Authentication
- **Provider**: Replit OpenID Connect (OIDC) Auth
- **Session Store**: PostgreSQL via `connect-pg-simple`
- **Implementation**: Passport.js with OpenID Client strategy (`server/replit_integrations/auth/`)
- **Required env vars**: `DATABASE_URL`, `SESSION_SECRET`, `REPL_ID`, `ISSUER_URL`

### Shared Code (`shared/` directory)
- `schema.ts` — Drizzle table definitions and Zod insert schemas (transactions + re-exports auth models)
- `routes.ts` — Typed API route definitions with Zod input/output schemas
- `models/auth.ts` — User and session table definitions

### Build System
- **Development**: `npm run dev` — runs tsx with Vite middleware for HMR
- **Production Build**: `npm run build` — Vite builds client to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Type Check**: `npm run check` — TypeScript compiler check
- **DB Sync**: `npm run db:push` — Push schema to database

## External Dependencies

### Required Services
- **PostgreSQL Database** — Connected via `DATABASE_URL` environment variable. Used for transactions, user accounts, and session storage.
- **Replit Auth (OIDC)** — OpenID Connect authentication provided by Replit platform. Requires `REPL_ID` and `ISSUER_URL` environment variables.

### Key npm Packages
- `drizzle-orm` + `drizzle-kit` — Database ORM and migration tooling
- `express` + `express-session` — HTTP server and session management
- `passport` + `openid-client` — Authentication
- `connect-pg-simple` — PostgreSQL session store
- `@tanstack/react-query` — Client-side data fetching and caching
- `framer-motion` — Animation library for transaction cards
- `zod` + `drizzle-zod` — Runtime validation and schema generation
- `react-hook-form` — Form state management
- `wouter` — Client-side routing
- `date-fns` — Date formatting
- Full shadcn/ui component library (Radix UI primitives)

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Secret for session encryption (required)
- `REPL_ID` — Replit environment identifier (required for auth)
- `ISSUER_URL` — OIDC issuer URL, defaults to `https://replit.com/oidc`