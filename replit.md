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
- `LiveFeed` — Main page with CSS Grid casino feed, Casino/Top Kazanclar tabs, SSE-powered real-time updates, auto-scroll to top
- `TransactionRow` — Responsive grid row with hidden username, game thumbnail, bet amount, multiplier (hidden on mobile), winnings
- `AdminPanel` — Dialog form to manually create transactions
- `useTransactionStream` — SSE hook for real-time transaction streaming with auto-reconnect
- Game thumbnail images stored in `client/public/images/games/`

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

### Real-time Data Flow
- Server generates mock transactions every 1.5s via `setInterval`
- New transactions are saved to DB and broadcast to all connected SSE clients
- SSE clients receive JSON transaction objects via `EventSource`
- Client maintains max 50 items, newest at top, old items dropped from memory

### Database
- **Database**: PostgreSQL (required, connected via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-Zod integration
- **Schema Location**: `shared/schema.ts` and `shared/models/auth.ts`
- **Migrations**: Drizzle Kit with `drizzle-kit push` command (`npm run db:push`)
- **Connection**: `pg` Pool in `server/db.ts`

### Database Tables
1. **transactions** — Core data table (id, username, amount, currency, type WIN/LOSS, game, multiplier, timestamp, isSimulation)
2. **users** — User accounts for Replit Auth (id, email, firstName, lastName, profileImageUrl, timestamps)
3. **sessions** — Session storage for express-session with connect-pg-simple

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