# ⚙️ RULES.md: Tech Stack, Conventions & AI Instructions

**Scope:** Architectural standards, conventions, API contracts, and instructions for developers building BorrowFlex.

---

## 1. Approved Technology Stack

### 1.1. Backend API (Decoupled Headless Service)
- **Runtime:** Node.js (v20+ LTS)
- **Language:** TypeScript (`strict: true`)
- **Framework:** Express.js (or Fastify)
- **Database:** PostgreSQL (with Prisma ORM or Knex.js query builder)
- **Auth:** JWT (JSON Web Tokens) with `bcryptjs` password hashing
- **Validation:** Zod (schema-driven validation for all endpoints)

### 1.2. Frontend Client(s)
- **Web:** Next.js (App Router) or Vite + React with Tailwind CSS
- **Design Tokens:** Neo-brutalist style tokens (`shadow-[4px_4px_0px_0px_#0D0D12]`, borders `border-2 border-[#0D0D12]`)
- **Icons:** Lucide React
- **State & Data Fetching:** TanStack Query + Zustand

---

## 2. Directory & File Organization

```
peer-rental-app/
├── SPEC.md                  # What the app does & Gen Z user journeys
├── RULES.md                 # Tech stack, conventions & AI instructions
├── SCHEMA.md                # Database tables, types & SQL DDL
├── ROADMAP.md               # Live progress checklist
├── DESIGN.md                # Gen Z neo-brutalist design tokens & layouts
│
├── backend/                 # Headless REST API
│   ├── src/
│   │   ├── config/          # DB connection, env variables
│   │   ├── middleware/      # Auth JWT, error handler, validation
│   │   ├── modules/
│   │   │   ├── auth/        # Controller, service, routes
│   │   │   ├── items/       # Gear listing management
│   │   │   ├── requests/    # Wishes / Bounties management
│   │   │   ├── bookings/    # Rental proposals & handshake
│   │   │   ├── analytics/   # Community Pulse & Hustle Hub metrics
│   │   │   └── users/       # Profile & trust scores
│   │   ├── app.ts           # Express setup & route mounting
│   │   └── server.ts        # Entry point & port listener
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                # Web / Mobile Client
    ├── src/
    │   ├── components/      # UI components (FlexItemCard, BountyCard, Badge)
    │   ├── pages/           # Feed, Wishlist, ItemDetail, HustleHub
    │   ├── lib/             # API client, auth context
    │   └── styles/          # Tailwind configuration & globals
    └── package.json
```

---

## 3. Coding Conventions & Standards

### 3.1. Standard API Response Structure
```json
// Success Response
{
  "success": true,
  "data": {
    "id": "gear_123",
    "title": "Fujifilm X-T30 Retro Camera",
    "price_per_day": 350
  },
  "message": "Gear listed successfully"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email address format"
  }
}
```

### 3.2. Developer & AI Guardrails
1. **Scope Discipline:** No escrow or security deposit locking in Version 1. Focus exclusively on email accounts, gear listings, community bounties, and direct booking coordination.
2. **Type Safety:** 100% TypeScript with strict typing. No untyped `any`.
3. **Data Validation:** Validate every incoming request body with Zod schemas.
4. **Analytics RBAC:** Guard all `/api/analytics/*` routes with `requireRole('ADMIN')`.
