<div align="center">

# ⚡ Rentu⁺

### **Don't Buy It. Rent It. Flex It.**
*Peer-to-Peer Gear Sharing & Rental Platform for Creators, Students & Flatmates.*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite_5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express.js_4-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_14+-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Vercel](https://img.shields.io/badge/Vercel_Deployment-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

---

## 📖 Product Overview

**Rentu⁺** is an anti-ownership, community-powered gear rental marketplace where digital creators, students, and young professionals rent high-demand gear (cameras, DJ controllers, projectors, camping kits, gaming rigs, power tools, festival fits) from people nearby at a fraction of retail cost, while lenders turn idle equipment into passive income (secure the bag 💸).

> **"Same stuff. More people. Happier planet. Good things circulate."**

---

## 🛠️ Technology Stack & Architecture

| Component | Framework / Technology | Role in Architecture |
| :--- | :--- | :--- |
| **Frontend SPA** | **React 18 + Vite 5** | High-performance Single Page Application with instant client-side routing & fast HMR |
| **Styling & Tokens** | **Tailwind CSS 3** | Neo-Pop / Pastel Brutalist design system with full dark/light theme persistence |
| **Icons & Confetti** | **Lucide React + Canvas Confetti** | Vector iconography, milestone celebration confetti, and dynamic UI state badges |
| **Backend API** | **Node.js (v20+ LTS) + Express.js** | Decoupled RESTful API built in strict TypeScript with comprehensive middleware |
| **Validation** | **Zod 3.23+** | Strict runtime schema validation across query params, request bodies, and mutations |
| **Relational Database** | **PostgreSQL 14+ (Supabase)** | Fully normalized 1NF, 2NF & 3NF relational schema with Row Level Security (RLS) |
| **Spatial Proximity** | **PostGIS + Haversine SQL** | Geospatial calculations for nearby gear matching without leaking private street addresses |
| **Connection Pool** | **`pg` (node-postgres) + Pooler** | High-throughput connection pooling on port 6543 optimized for serverless execution |
| **Auth System** | **Dual JWT + Firebase Admin** | Unified authentication supporting local HMAC JWTs and Firebase Auth UIDs |
| **AI Gear Assistant** | **Google Gemini API** | AI-assisted listing generation, smart specs extraction, and description polishing |
| **Notifications** | **Web Push API + Service Worker** | In-app alerts, background notification scheduler, and desktop/mobile Web Push |
| **Cloud Storage** | **Supabase Storage** (`item-photos`) | Public CDN storage bucket with automated image resizing and fallbacks |
| **Production Build** | **esbuild + Vite** | Standalone zero-dependency backend bundling (`api/index.js`) for resilient Vercel serverless execution |

---

## 📐 Architecture & System Design

### 1. Data Flow Diagram (DFD Level 1)

```mermaid
flowchart TD
    subgraph Client["💻 Rentu⁺ Client (React 18 + Vite SPA)"]
        UI_Market["Marketplace & Category Feed"]
        UI_List["Drop Gear Modal (Lender)"]
        UI_Wish["Wanted Board (Borrower Bounty)"]
        UI_Book["Booking & Handshake Modal"]
        UI_QR["Handover / Return QR Code Verification"]
        UI_Chat["Split-Screen Peer Chat"]
        UI_Comm["Community Leaderboards & Social"]
        UI_Admin["Admin & Live Analytics Dashboard"]
    end

    subgraph Edge["🌐 Edge Gateway (Vercel)"]
        VercelRouter{"Route Handler"}
        StaticAssets["Frontend SPA CDN"]
        ServerlessAPI["/api/* Serverless API"]
    end

    subgraph Backend["⚡ Express API Services"]
        AuthMid["Auth Middleware (JWT & Firebase UID)"]
        ItemsMod["/api/items (CRUD & Spatial Radar)"]
        RequestsMod["/api/requests (Wanted Board)"]
        BookingsMod["/api/bookings (Lifecycle, OTP & QR)"]
        MessagesMod["/api/messages (Chat & In-Chat Proposals)"]
        UsersMod["/api/users (Profiles, Follows & Badges)"]
        NotifyMod["/api/notifications (Reminders & Web Push)"]
        AiMod["/api/ai (Gemini Assistant)"]
        AdminMod["/api/admin (Analytics & Support Triage)"]
    end

    subgraph Cloud["☁️ Supabase Infrastructure"]
        Bucket[("Storage: item-photos")]
        DB[("PostgreSQL Database (RLS Enforced)")]
    end

    Client -->|Static Assets| VercelRouter
    VercelRouter --> StaticAssets
    Client -->|HTTP / JSON API| ServerlessAPI
    ServerlessAPI --> Backend
    Backend --> AuthMid

    AuthMid --> ItemsMod & RequestsMod & BookingsMod & MessagesMod & UsersMod & NotifyMod & AiMod & AdminMod

    ItemsMod --> DB
    RequestsMod --> DB
    BookingsMod --> DB
    MessagesMod --> DB
    UsersMod --> DB
    NotifyMod --> DB
    AdminMod --> DB
    UI_List -->|Direct Upload| Bucket
```

---

### 2. Relational Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    POSTAL_CODES ||--o{ USERS : "resolves_area"
    POSTAL_CODES ||--o{ ITEMS : "resolves_area"
    POSTAL_CODES ||--o{ REQUESTS : "resolves_area"

    USERS ||--o{ ITEMS : "lists_gear"
    USERS ||--o{ REQUESTS : "posts_wishes"
    USERS ||--o{ BOOKINGS : "borrows"
    USERS ||--o{ BOOKINGS : "lends"
    USERS ||--o{ REVIEWS : "authors"
    USERS ||--o{ REVIEWS : "receives"
    USERS ||--o{ MESSAGES : "sends"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ PUSH_SUBSCRIPTIONS : "registers"
    USERS ||--o{ USER_FOLLOWS : "follows"
    USERS ||--o{ SUPPORT_TICKETS : "files"

    ITEMS ||--o{ ITEM_IMAGES : "includes"
    ITEMS ||--o{ BOOKINGS : "booked_in"

    BOOKINGS ||--o{ REVIEWS : "rated_by"
    BOOKINGS ||--o{ MESSAGES : "negotiated_in"

    POSTAL_CODES {
        varchar pincode PK
        varchar locality
        varchar city
        varchar state
    }

    USERS {
        text id PK
        varchar firebase_uid
        varchar username
        varchar name
        varchar email
        varchar phone
        text bio
        text avatar_url
        varchar locality
        varchar pincode FK
        double latitude
        double longitude
        decimal rating
        decimal owner_rating
        decimal renter_rating
        decimal community_lender_rating
        integer trust_score
        user_role role
    }

    ITEMS {
        uuid id PK
        text owner_id FK
        varchar title
        text description
        varchar category
        varchar condition
        numeric price_per_day
        integer max_duration_days
        boolean available_for_borrowing
        boolean offers_delivery
        boolean offers_pickup
        varchar locality
        varchar pincode FK
        double latitude
        double longitude
        item_status status
        boolean is_deleted
    }

    ITEM_IMAGES {
        uuid id PK
        uuid item_id FK
        text image_url
        integer display_order
    }

    REQUESTS {
        uuid id PK
        text seeker_id FK
        varchar item_name
        text description
        varchar category
        date start_date
        time start_time
        date end_date
        time end_time
        integer duration_days
        numeric offered_amount
        varchar locality
        varchar pincode FK
        request_status status
    }

    BOOKINGS {
        uuid id PK
        uuid item_id FK
        text borrower_id FK
        text lender_id FK
        date start_date
        date end_date
        numeric total_price
        boolean is_borrowing
        varchar pickup_code
        varchar return_code
        booking_status status
        varchar payment_status
        timestamp handed_over_at
        timestamp completed_at
    }

    MESSAGES {
        uuid id PK
        uuid booking_id FK
        text sender_id FK
        text receiver_id FK
        text content
        varchar message_type
        jsonb proposal_data
        timestamp created_at
    }

    NOTIFICATIONS {
        uuid id PK
        text user_id FK
        varchar title
        text message
        varchar type
        boolean is_read
        timestamp created_at
    }

    PUSH_SUBSCRIPTIONS {
        uuid id PK
        text user_id FK
        text endpoint
        text p256dh
        text auth
        timestamp created_at
    }

    USER_FOLLOWS {
        text follower_id PK, FK
        text following_id PK, FK
        timestamp created_at
    }

    SUPPORT_TICKETS {
        uuid id PK
        text user_id FK
        varchar guest_email
        varchar category
        varchar subject
        text message
        varchar status
        timestamp created_at
    }
```

---

## 🌟 Core Features & Modules

### 1. 🔍 Dual Marketplace (Supply & Demand)
- **Gear Marketplace (`/explore`):** Filter by category, price range, distance radius, item condition (Pristine, Good, Fair), and perks (Instant Availability, Home Delivery, Free Borrowing).
- **Wanted Board (Community Wishes):** Reverse bounty board where renters post what gear they need with their offered budget, and nearby owners claim with **"I can lend this ⚡"**.
- **Free Community Borrowing:** Support for zero-cost peer lending (`available_for_borrowing`) alongside paid rentals.

### 2. 🔐 Two-Party Handshake & QR Code Verification
- **Dynamic 4-Digit Security Codes:** Unique pickup codes generated for the borrower and return codes generated for the lender.
- **Offline-Ready QR Scanning:** Generates lightweight canvas QR codes (`frontend/src/lib/qr.ts`) that can be scanned or manually validated during in-person meetups without network dependency.
- **Strict Booking State Machine:**
  $$\text{PENDING} \longrightarrow \text{ACCEPTED} \longrightarrow \text{HANDED\_OVER} \longrightarrow \text{COMPLETED}$$
- Time-window validation protects against tampering with handover or return schedules.

### 3. 💬 In-App Chat & Live Negotiation
- Real-time coordination with embedded interactive proposals.
- Custom proposal actions: Renter or Lender can adjust pricing, dates, and delivery options directly inside the conversation thread.
- Instant soft-deletion and unread badge counters.

### 4. 🏆 Community Leaderboards & Social Graph
- **Community Champions (`/community`):** 4 separate verified ranking boards:
  - 🌟 **Top Rated:** Ranked by blended trust rating across Owner, Renter, and Free Sharer reviews.
  - ⚡ **Top Lenders:** Ranked by gear items lent and owner satisfaction score.
  - 🎒 **Top Borrowers:** Ranked by rentals completed and punctuality.
  - 🎁 **Free Community Sharers:** Highlighting selfless community lending heroes.
- **Social Graph (`/user/:id`):** View public profiles, follower/following lists via `FollowListModal`, member badges, and gear inventories.

### 5. 🔔 Automated Reminders & Web Push
- Native **Web Push API** integration with Service Worker (`sw.js`).
- Background cron scheduler (`reminder.scheduler.ts`) automatically sends proactive pickup reminders, return deadlines, and overdue notices.
- Interactive in-app notification center with read/unread filtering.

### 6. 🤖 Google Gemini AI Gear Assistant
- **AI Listing Enhancer:** Generates catchy titles, technical specifications, and recommended daily rates from raw gear descriptions.
- Smart categorization and image tagging.

### 7. 🛡️ Security, Privacy & Database Hardening
- **Row Level Security (RLS):** Enabled and enforced across all 13 database tables in Supabase with zero security lint violations.
- **GPS Privacy Shield:** Street numbers and building flats remain private; public discovery is computed via background coordinates and locality boundaries.
- **Admin Hub (`/admin`):** Protected dashboard with live GMV metrics, support ticket triage, and sanitized CSV exports immune to formula injection.

---

## 📁 Repository Directory Structure

```
Rento/
├── SPEC.md                  # Comprehensive product specification & user journeys
├── RULES.md                 # Engineering guidelines & coding standards
├── SCHEMA.md                # 1NF, 2NF & 3NF database schema specifications
├── ROADMAP.md               # Product milestones & feature roadmap
├── DESIGN.md                # Neo-Pop pastel brutalist design tokens
├── README.md                # Project documentation & local setup guide
├── package.json             # Root workspace scripts & monorepo orchestration
├── vercel.json              # Vercel multi-service routing & serverless build config
├── supabase_setup.sql       # PostgreSQL DDL with RLS & PostGIS configuration
│
├── backend/                 # Headless Express REST API
│   ├── src/
│   │   ├── config/          # PostgreSQL pool connection, SSL & environment variables
│   │   ├── db/              # Relational migration scripts & database seeds
│   │   ├── middleware/      # JWT authentication, error handling, input sanitization
│   │   ├── modules/
│   │   │   ├── admin/       # Dashboard metrics, user moderation & ticket resolution
│   │   │   ├── ai/          # Google Gemini AI gear assistant
│   │   │   ├── analytics/   # Transaction volumes & marketplace metrics
│   │   │   ├── auth/        # Demo accounts, user login & registration
│   │   │   ├── bookings/    # Handshake state machine, OTP & QR verification
│   │   │   ├── items/       # Gear listings CRUD, distance filters & categories
│   │   │   ├── messages/    # Peer chat, in-thread proposals & deletion
│   │   │   ├── notifications/# In-app alerts, scheduler & Web Push service
│   │   │   ├── requests/    # Wanted bounty board & fulfillment logic
│   │   │   ├── support/     # Support ticket creation & triage
│   │   │   ├── upload/      # Supabase Storage proxy & image upload
│   │   │   └── users/       # Profiles, social follows & trust scores
│   │   ├── utils/           # Haversine distance, city parsing & user helpers
│   │   ├── app.ts           # Express application setup & middleware registration
│   │   ├── server.ts        # Dedicated standalone server entrypoint
│   │   └── serverless.ts    # Resilient Vercel serverless request wrapper
│   ├── index.js             # Standalone bundled execution artifact (esbuild)
│   ├── bundle.js            # esbuild bundle configuration script
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                # Client Application (React 18 + Vite SPA)
    ├── public/
    │   ├── sw.js            # Web Push & offline service worker
    │   └── favicon.svg
    ├── src/
    │   ├── components/      # Modular UI components:
    │   │   ├── BookingStageModal.tsx # OTP / QR code verification & payment steps
    │   │   ├── BookingsView.tsx      # Renter & lender booking tabs
    │   │   ├── CommunityView.tsx     # 4-tier leaderboard & trust score podium
    │   │   ├── DropGearModal.tsx     # 4-step listing wizard with AI assist
    │   │   ├── DropWishModal.tsx     # Wanted bounty creation modal
    │   │   ├── ExploreView.tsx       # Dual-marketplace supply & demand feeds
    │   │   ├── FollowListModal.tsx   # Followers & following modal
    │   │   ├── HelpSupportModal.tsx  # Support ticket submission & history
    │   │   ├── HustleHub.tsx         # Admin dashboard with live charts & metrics
    │   │   ├── ItemDetailModal.tsx   # Gear inspection, dates & rent/borrow flow
    │   │   ├── MessagesView.tsx      # Split-screen messaging & proposals
    │   │   ├── Navbar.tsx            # Navigation, notifications & demo switcher
    │   │   └── ProfileView.tsx       # User profile, gear listings & bookings
    │   ├── lib/             # API client, AuthContext, ThemeContext, QR generator
    │   ├── styles/          # Tailwind design tokens & dark/light mode styles
    │   ├── App.tsx          # Master tab router & global modal coordinator
    │   └── main.tsx         # Root DOM mount point
    ├── index.html           # HTML entrypoint with theme flash prevention
    ├── tailwind.config.js   # Tailwind configuration & custom color palettes
    ├── vite.config.ts       # Vite build & proxy settings
    ├── package.json
    └── tsconfig.json
```

---

## 🏁 Getting Started Locally

### Prerequisites
- **Node.js:** v18.0.0 or later (tested on v20 and v22 LTS)
- **npm:** v9.0.0 or later
- **PostgreSQL:** v14+ (or a cloud [Supabase](https://supabase.com) project)

---

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/Sadiqua-Parween/Rentu.git
cd Rentu

# Install root, backend, and frontend dependencies
npm install
```

---

### 2. Configure Environment Variables

Create `.env` inside `backend/`:
```env
PORT=5001
NODE_ENV=development
DATABASE_URL=postgresql://postgres.your-project:your-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
JWT_SECRET=super-secret-rentu-jwt-token-key-2026

# Optional: Supabase Storage & Push
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional: Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
```

Create `.env` inside `frontend/` (optional for local proxy):
```env
VITE_API_URL=http://localhost:5001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

### 3. Database Initialization

Run the complete 3NF schema and seed script via your terminal:
```bash
npm run seed
```
*Alternatively, paste the contents of [`supabase_setup.sql`](supabase_setup.sql) directly into your Supabase Dashboard SQL Editor and click **Run**.*

---

### 4. Run Development Servers

In two separate terminals:

```bash
# Terminal 1: Start Backend REST API (http://localhost:5001)
npm run dev:backend

# Terminal 2: Start Frontend Client (http://localhost:3000)
npm run dev:frontend
```

---

### 5. Production Build & Bundling

To create an optimized production build for both backend serverless and frontend assets:

```bash
npm run build
```

This compiles:
1. Backend TypeScript to standalone bundled `backend/index.js` and `api/index.js` via `esbuild`.
2. Frontend React SPA to static assets in `dist/` via Vite.

---

## 👥 Demo Accounts (Instant 1-Click Login)

Test all permissions and workflows immediately using the **Demo Switcher** inside the navigation bar:

| Persona | Role | Location | Test Gear & Capabilities |
| :--- | :--- | :--- | :--- |
| **Rohit Verma** | Gear Owner / Lender | Indiranagar, Bengaluru | Canon EOS 250D DSLR, Mirrorless cameras, verifies pickup codes |
| **Zoya Khan** | Community Member / Renter | Koramangala, Bengaluru | Submits booking proposals, free borrowing requests & returns |
| **Aarav Mehta** | Platform Admin | Mumbai, Maharashtra | Full access to `/admin` Hustle Hub, live analytics & ticket triage |

---

## 📄 License & Contributing

This project is licensed under the MIT License. Contributions and feedback are welcome! Feel free to open issues or submit pull requests.
