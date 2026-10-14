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
[![Vercel](https://img.shields.io/badge/Vercel_Services-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

---

## 📖 Product Overview

**Rentu⁺** is an anti-ownership, community-powered gear rental marketplace where digital creators, students, and young professionals rent high-demand items (cameras, DJ mixers, projectors, tents, gaming consoles, power tools, festival fits) from people nearby at a fraction of retail cost, while lenders turn idle gear into passive income (secure the bag 💸).

> **"Same stuff. More people. Happier planet. Good things circulate."**

---

## 🛠️ Technology Stack & Frameworks

| Component | Framework / Technology | Role in Architecture |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18 + Vite 5** | High-performance Single Page Application (SPA) with hot module reloading |
| **Styling & Design System** | **Tailwind CSS 3** | Neo-Pop / Pastel Brutalism tokens with full class-based Dark & Light mode |
| **Icons & Micro-UI** | **Lucide React + Canvas Confetti** | Crisp vector iconography and celebratory interaction micro-animations |
| **Backend REST Service** | **Node.js (v20+ LTS) + Express.js** | Decoupled, headless REST API built with TypeScript in strict mode |
| **Validation Engine** | **Zod 3.23+** | Runtime schema validation on all request bodies, query params, and route parameters |
| **Relational Database** | **PostgreSQL 14+ (Supabase)** | 100% 1NF, 2NF, and 3NF compliant relational schema with PostGIS spatial extensions |
| **Connection Pooling** | **`pg` (node-postgres) + PgBouncer** | High-throughput connection pooling on port 6543 for serverless executions |
| **Authentication System** | **JWT + Firebase Admin SDK** | Dual-mode token verification supporting local HMAC JWTs and Firebase Auth UIDs |
| **Object Cloud Storage** | **Supabase Storage** (`item-photos`) | Public CDN storage bucket for high-res gear galleries and profile avatars |
| **Deployment & Bundler** | **Vercel Services + esbuild** | Self-contained single-file bundled serverless execution with zero missing dependencies |

---

## 📐 System Architecture & Diagrams

### 1. Data Flow Diagram (DFD Level 0 & Level 1)

```mermaid
flowchart TD
    subgraph Client["💻 Rentu⁺ Client (React 18 + Vite SPA)"]
        UI1["Explore & Search View"]
        UI2["List an Item Modal (Lender)"]
        UI3["Wanted Board Modal (Borrower)"]
        UI4["Snag Proposal Modal"]
        UI5["Peer Chat & Profile Manager"]
    end

    subgraph Edge["🌐 Vercel Services Routing Layer"]
        Router{"Path Evaluation"}
        StaticRoutes["/ (Frontend Service)"]
        APIRoutes["/api/* (Backend Service)"]
    end

    subgraph Backend["⚡ Express REST Service (TypeScript)"]
        AuthM["Auth Guard (JWT / Firebase)"]
        ItemsR["/api/items"]
        ReqsR["/api/requests"]
        BooksR["/api/bookings"]
        MsgsR["/api/messages"]
        UsersR["/api/users"]
        StatsR["/api/analytics"]
    end

    subgraph Storage["☁️ Supabase Cloud Storage"]
        Bucket[("item-photos bucket")]
    end

    subgraph DB["🗄️ PostgreSQL 3NF Schema & Views"]
        T_Post["postal_codes (Pincode PK)"]
        T_Users["users (GPS coords)"]
        T_Items["items & item_images (1NF)"]
        T_Reqs["requests (bounties)"]
        T_Books["bookings"]
        T_Msgs["messages"]
        T_Revs["reviews"]
        V_Books["bookings_3nf_v (Dynamic Total Price)"]
        V_Users["user_scores_3nf_v (Dynamic Ratings)"]
    end

    Client -->|Public HTTP Traffic| Router
    Router -->|Static Assets| StaticRoutes
    Router -->|API Requests| APIRoutes
    APIRoutes --> Backend

    UI2 -->|Direct Image Upload| Bucket
    Bucket -->|Public CDN URL| UI2

    Backend --> AuthM
    AuthM --> ItemsR & ReqsR & BooksR & MsgsR & UsersR & StatsR

    ItemsR -->|Upsert Pincode| T_Post
    ItemsR -->|Insert Listing & Images| T_Items
    ReqsR -->|Insert Bounty| T_Reqs
    BooksR -->|Insert Proposal| T_Books
    MsgsR -->|Insert Message| T_Msgs
    UsersR -->|Update GPS Location| T_Users
    StatsR -->|Read Aggregated Metrics| V_Books & V_Users & T_Items
```

---

### 2. Relational Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    POSTAL_CODES ||--o{ USERS : "determines_locality"
    POSTAL_CODES ||--o{ ITEMS : "determines_locality"
    POSTAL_CODES ||--o{ REQUESTS : "determines_locality"

    USERS ||--o{ ITEMS : "owns_and_lists"
    USERS ||--o{ REQUESTS : "posts_bounties"
    USERS ||--o{ BOOKINGS : "submits_proposals"
    USERS ||--o{ REVIEWS : "authors_reviews"
    USERS ||--o{ REVIEWS : "receives_ratings"
    USERS ||--o{ MESSAGES : "sends_messages"
    USERS ||--o{ NOTIFICATIONS : "receives_alerts"

    ITEMS ||--o{ ITEM_IMAGES : "contains_photos"
    ITEMS ||--o{ BOOKINGS : "rented_through"

    BOOKINGS ||--o{ REVIEWS : "evaluated_by"
    BOOKINGS ||--o{ MESSAGES : "coordination_thread"

    POSTAL_CODES {
        varchar pincode PK
        varchar locality
        varchar city
        varchar state
    }

    USERS {
        text id PK
        varchar firebase_uid
        varchar name
        varchar email
        varchar phone
        text bio
        text avatar_url
        text address_text
        varchar locality
        varchar pincode FK
        double latitude
        double longitude
        decimal rating
        integer trust_score
        user_role role
    }

    ITEMS {
        uuid id PK
        text owner_id FK
        varchar title
        text description
        varchar category
        numeric price_per_day
        integer max_duration_days
        varchar sticker_badge
        text address_text
        varchar locality
        varchar pincode FK
        double latitude
        double longitude
        item_status status
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
        integer duration_days
        numeric offered_amount
        varchar locality
        text address_text
        varchar pincode FK
        double latitude
        double longitude
        request_status status
    }

    BOOKINGS {
        uuid id PK
        uuid item_id FK
        text borrower_id FK
        text lender_id FK
        date start_date
        time start_time
        integer duration_days
        numeric total_price
        booking_status status
        text message
    }

    REVIEWS {
        uuid id PK
        uuid booking_id FK
        text reviewer_id FK
        text reviewee_id FK
        numeric rating
        text comment
    }

    MESSAGES {
        uuid id PK
        uuid booking_id FK
        text sender_id FK
        text receiver_id FK
        text content
        timestamp created_at
    }
```

---

## 🌟 Key Features (Current Implementation)

### 1. 📍 Privacy-First Profile Location & GPS Proximity
- **Zero Public Location Clutter:** City names and location pills are removed from all navigation bars and search bars.
- **1-Click GPS Auto-Detection:** Users configure their location strictly inside their private Profile modal (`EditProfileModal`) via browser Geolocation and reverse-geocoding.
- **Discrete Address Management:** Structured fields for Building / Flat / House No., Street / Road, Locality, and PIN Code.
- **Silent Background GPS Radar:** Latitudes and longitudes are indexed in PostgreSQL to calculate real-time Haversine distance without exposing street addresses publicly.

### 2. 🌙 Complete Dark Mode & Light Mode
- Smooth animated Sun/Moon toggle button (`#theme-toggle-btn`) in the top navigation bar.
- Deep charcoal canvas (`#0F1015`), elevated cards (`#171821`), and crisp high-contrast typography.
- Automatic persistence to `localStorage` (`rentu-theme`) with zero flash of unstyled theme on page refresh.

### 3. 🎯 Dual-Marketplace (Supply & Demand Feeds)
- **Available Gear Feed:** Browse rental listings with category pills, availability badges, and instant search.
- **Wanted Board (Community Wishes):** Reverse marketplace where members post gear requests with offered budgets (e.g., *"Need DJ Mixer for Saturday, paying ₹800"*), and nearby owners can claim and fulfill them with **"I can lend this ⚡"**.

### 4. ⚡ 30-Second Fast Gear Drop
- 4-step wizard to list items in under a minute with price/day, maximum duration, specifications, and photo gallery preview.

### 5. 💬 Direct In-App Chat & Proposal Handshake
- Clean split-screen messaging interface for booking proposals, pickup coordination, and rental returns.

### 6. 📊 Hustle Hub (Community Analytics Dashboard)
- Real-time marketplace metrics: Total volume transacted (₹), active lenders vs. borrowers, and trending category leaderboards.

### 7. 🚀 Instant 1-Click Demo Login
- Instantly test different roles without entering credentials:
  - 📸 **Rohit Verma (Lender):** Delhi — Sony Alpha 7 IV, Camping Tent, Drill Set.
  - 🎨 **Ananya Roy (Renter):** Bangalore — Fujifilm X-T30, Vintage Camcorder, Streetwear.
  - 👑 **Aarav Mehta (Admin):** Mumbai — Pioneer DJ Controller, Analytics Lead.

### 8. 🗄️ 100% 1NF, 2NF, and 3NF Relational Database
- Dedicated atomic child table `item_images` (1NF).
- Postal boundaries isolated in `postal_codes` (3NF).
- Derived attributes calculated dynamically via mathematical views `bookings_3nf_v`, `user_scores_3nf_v`, and `messages_3nf_v`.

### 9. ☁️ Standalone Bundled Vercel Deployment
- High-efficiency `esbuild` bundling embedding all dependencies into `backend/index.js`, eliminating serverless `MODULE_NOT_FOUND` runtime crashes.

---

## 🚀 Future Roadmap & Upcoming Features

### Milestone 2: Escrow, Safety & Verification (In-Progress)
- **Automated Escrow State Machine:** Pre-authorize and hold security deposits during active rentals; automatically release funds upon clean return signoff.
- **Handover & Return OTP / QR Codes:** Dynamic 4-digit PINs or QR codes exchanged between borrower and lender during gear handoff to verify item condition and lock custody.
- **Real-Time WebSockets & Push Notifications:** Supabase Realtime channels for instant messaging and Web Push API alerts.

### Milestone 3: Commercial Scaling & AI Inspection (Planned)
- **Payment Gateway Integration:** Razorpay / Cashfree split-payments with automated UPI instant payouts to lenders.
- **Digital KYC & Student Verification:** DigiLocker / Aadhaar identity verification unlocking high-value gear without excessive deposit requirements.
- **AI Visual Damage Scanner:** Computer vision before/after photo comparison to flag scratches or structural damage automatically.

---

## 📁 Repository Directory Structure

```
Rento/
├── SPEC.md                  # Complete product specifications, personas & journeys
├── RULES.md                 # Engineering standards, tech stack & developer rules
├── SCHEMA.md                # 1NF/2NF/3NF database schema, ERD & SQL DDL
├── ROADMAP.md               # Live milestone progress & future feature checklist
├── DESIGN.md                # Neo-pop pastel brutalist design tokens & screen specs
├── README.md                # Project documentation & quickstart guide
├── package.json             # Root monorepo scripts & workspaces
├── vercel.json              # Vercel Services multi-service routing config
├── supabase_setup.sql       # PostgreSQL 1NF, 2NF, 3NF DDL setup script
│
├── backend/                 # Decoupled Headless REST API
│   ├── src/
│   │   ├── config/          # PostgreSQL pool connection & environment variables
│   │   ├── db/              # Schema migration & realistic seed scripts
│   │   ├── middleware/      # JWT auth guard, response envelope, error handler
│   │   ├── modules/
│   │   │   ├── auth/        # Login, registration, demo auth & current user
│   │   │   ├── items/       # Rental listings CRUD, category & distance filter
│   │   │   ├── requests/    # Wanted board reverse bounties & fulfillment
│   │   │   ├── bookings/    # Rental proposals & handshake state machine
│   │   │   ├── messages/    # Coordination chat messages
│   │   │   ├── analytics/   # Hustle Hub metrics & leaderboards
│   │   │   └── users/       # User profiles, address & trust score updates
│   │   ├── utils/           # City extractor & distance formulas
│   │   ├── app.ts           # Express setup, CORS & route registration
│   │   └── server.ts        # Server entrypoint & port listener
│   ├── index.js             # Standalone bundled entrypoint (esbuild)
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                # Client Application (Vite + React SPA)
    ├── src/
    │   ├── components/      # UI components (Navbar, ItemCard, Modals, HustleHub)
    │   ├── lib/             # API client, AuthContext, ThemeContext, Types
    │   ├── styles/          # Tailwind globals & CSS custom properties
    │   ├── App.tsx          # Main view coordinator & state container
    │   └── main.tsx         # Root DOM mount with Providers
    ├── index.html           # HTML5 template with theme flash prevention
    ├── tailwind.config.js   # Tailwind design tokens & dark mode class config
    ├── vite.config.ts       # Vite configuration
    ├── package.json
    └── tsconfig.json
```

---

## 🏁 Getting Started Locally

### Prerequisites
- **Node.js:** v18+ (tested on v20 and v24)
- **PostgreSQL:** v14+ (or a free [Supabase](https://supabase.com) project)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Sadiqua-Parween/Rentu.git
cd Rentu
npm install
```

### 2. Environment Variables
Create `.env` in `backend/`:
```env
PORT=5001
DATABASE_URL=postgresql://postgres.your-project:your-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
JWT_SECRET=your-super-secret-rentu-jwt-key
NODE_ENV=development
```

### 3. Database Migration & Seed
```bash
# Run migrations and seed sample data
npm run seed
```
*(Or paste `supabase_setup.sql` directly into your Supabase SQL Editor and execute).*

### 4. Run Development Servers
```bash
# Terminal 1: Start Backend REST API (Runs on http://localhost:5001)
npm run dev:backend

# Terminal 2: Start Frontend Client (Runs on http://localhost:3000)
npm run dev:frontend
```

### 5. Build for Production
```bash
# Compiles backend to standalone bundle and builds frontend via Vite
npm run build
```
