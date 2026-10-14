# 🗺️ ROADMAP.md: Product Milestones & Live Progress Checklist

**Project:** Rentu⁺ (Gen Z Peer-to-Peer Rental Platform)  
**Current Active Milestone:** Version 2.0 (Escrow, Safety & Real-Time Verification)  
**Previous Milestone:** Version 1.0 (Core Headless API & Neo-Pop Client) — **100% Complete & Live**  
**Last Updated:** October 14, 2026  

---

## 📍 CURRENT ACTIVE FOCUS
> **Milestone 2.0:** Implementing the **Automated Escrow Wallet & Security Deposit State Machine**, paired with **Handover/Return OTP Codes** to guarantee zero-risk peer transactions.

---

## 🟢 MILESTONE 1: Version 1.0 (Core Marketplace & 3NF Engine) — COMPLETE ✅

### Phase 1: Relational Database Architecture (1NF, 2NF, 3NF Certified)
- [x] Configure PostgreSQL 14+ on Supabase with PostGIS coordinate extensions
- [x] **1NF Normalization:**
  - [x] Replace unstructured image arrays with dedicated `item_images` child relation (1 photo per row)
  - [x] Eliminate unconstrained JSON blobs in `notifications` with explicit atomic scalar foreign key columns
- [x] **2NF Normalization:**
  - [x] Ensure every relation uses a single-attribute surrogate key (`id UUID/TEXT` or `pincode VARCHAR(10)`)
- [x] **3NF Normalization:**
  - [x] Extract postal boundaries into `postal_codes (pincode PK, locality, city, state)`
  - [x] Remove transitive `lender_id` redundancy in `bookings` via relational view `bookings_3nf_v`
  - [x] Derive `total_price` dynamically from `(duration_days * price_per_day)`
  - [x] Extract `reviews` table and aggregate dynamic user ratings & trust scores in `user_scores_3nf_v`
  - [x] Derive message recipients dynamically in `messages_3nf_v`
- [x] PostGIS spatial indices (`idx_items_coords`, `idx_users_coords`) for sub-second proximity queries

### Phase 2: Decoupled Headless REST API (Node.js + Express + TypeScript)
- [x] Strict TypeScript configuration with modular service-based architecture (`backend/src/modules/*`)
- [x] **Auth Module (`/api/auth`):**
  - [x] User registration & login with `bcryptjs` password hashing
  - [x] JSON Web Token (JWT) issuance & auth guard middleware (`authMiddleware`)
  - [x] Firebase Authentication UID token verification with seamless fallback
  - [x] 1-Click instant demo persona switching (Rohit, Ananya, Aarav)
- [x] **Items Supply Module (`/api/items`):**
  - [x] List gear with price/day, max duration, category, and photo gallery (`POST /api/items`)
  - [x] Browse gear feed with category, search, and 100-meter proximity radar filters (`GET /api/items`)
  - [x] Get single item details with related gear recommendations (`GET /api/items/:id`)
  - [x] Toggle listing status (`AVAILABLE`, `RENTED`, `UNAVAILABLE`) (`PUT /api/items/:id`)
  - [x] Delete item listing (`DELETE /api/items/:id`)
- [x] **Requests Demand Module (`/api/requests`):**
  - [x] Wanted board reverse bounty creation with needed dates & offered budget (`POST /api/requests`)
  - [x] Browse open bounties feed (`GET /api/requests`)
  - [x] Reverse fulfillment: Claim / mark bounty fulfilled (`PUT /api/requests/:id`)
  - [x] Cancel / delete bounty (`DELETE /api/requests/:id`)
- [x] **Bookings & Proposals Module (`/api/bookings`):**
  - [x] Submit rental proposal with dynamic price calculation (`POST /api/bookings`)
  - [x] View incoming and outgoing proposals (`GET /api/bookings`)
  - [x] Lender accept/reject action (`PATCH /api/bookings/:id/status`)
- [x] **Direct Coordination Chat Module (`/api/messages`):**
  - [x] Message persistence tied to active booking reservations
  - [x] Message history fetching and real-time thread synchronization
- [x] **Community Analytics ("Hustle Hub") Module (`/api/analytics`):**
  - [x] Overview metrics (Total transacted volume ₹, active lenders, active borrowers)
  - [x] Category demand leaderboards and locality distribution charts

### Phase 3: Client Interface (React 18 + Vite + Tailwind CSS)
- [x] Neo-Pop & Pastel Brutalism design system (Hot pink `#E11D74`, pastel tiles, smooth drop shadows)
- [x] **Complete Dark & Light Mode Theme Engine:**
  - [x] Sun/Moon animated toggle button in top navigation bar (`#theme-toggle-btn`)
  - [x] Class-based Tailwind dark mode (`dark:` classes throughout UI)
  - [x] Instant `localStorage` persistence with zero flash of unstyled theme
- [x] **Privacy-First Profile Location & GPS Distance Tracking:**
  - [x] Zero public location clutter in navigation bars and search headers
  - [x] 1-Click GPS auto-detection inside Profile modal via browser Geolocation & Nominatim
  - [x] Discrete address breakdown (House/Flat, Street, Locality, PIN)
  - [x] Real-time Haversine distance calculations without exposing street addresses
- [x] **Dual Marketplace Experience:**
  - [x] Available Gear feed with sticker badges & category pills
  - [x] Wanted Board (Reverse Bounties) with "I can lend this ⚡" fulfillment
- [x] **Modals & Interactive Workflows:**
  - [x] "List an Item" 4-step wizard with live photo previews
  - [x] "Post a Request" 4-step wizard with instant community broadcast
  - [x] Item detail view with dynamic date picker & rental cost breakdown
  - [x] Direct split-screen messaging interface
  - [x] Hustle Hub community metrics dashboard

### Phase 4: Production Deployment & Infrastructure
- [x] Monorepo orchestration using root npm workspaces (`backend`, `frontend`)
- [x] Vercel Services multi-service configuration (`vercel.json`)
- [x] Standalone esbuild bundling (`--external:pg-native` only) eliminating serverless `MODULE_NOT_FOUND` runtime crashes
- [x] Clean service path preservation for `/api/(.*)` routes
- [x] Successful live deployment on Vercel preview environments

---

## 🟡 MILESTONE 2: Version 2.0 (Escrow, Safety & Real-Time Engine) — IN-PROGRESS ⏳

### Phase 1: Escrow & Security Deposit State Machine
- [ ] Implement escrow deposit calculation:
  $$\text{Total Authorized Hold} = (\text{Daily Rate} \times \text{Days}) + \text{Security Deposit}$$
- [ ] Escrow state machine transitions: `DRAFT` $\to$ `PROPOSED` $\to$ `ESCROW_HOLD` $\to$ `ACTIVE_RENTAL` $\to$ `RETURN_INSPECTION` $\to$ `COMPLETED`
- [ ] Automatic deposit unlock & release upon clean return signoff

### Phase 2: Handover & Return OTP / QR Verification
- [ ] Dynamic 4-digit PIN / QR code generated on lender's device upon meetup
- [ ] Borrower enters PIN to confirm receipt and certify pre-rental item condition
- [ ] Return verification handshake with reverse PIN exchange triggering deposit release

### Phase 3: Real-Time WebSockets & Push Notifications
- [ ] Supabase Realtime channel integration for instantaneous chat messaging
- [ ] Web Push API implementation using `push_subscriptions` table
- [ ] Firebase Cloud Messaging (FCM) alerts for incoming proposals and messages

---

## 🟠 MILESTONE 3: Version 3.0 (Commercial Scaling & AI Automation) — PLANNED 🚀

### Phase 1: Payment Gateway & Automated Payouts
- [ ] Razorpay Route / Cashfree Split Payments integration
- [ ] Automatic platform commission deduction (8–10%)
- [ ] Instant automated UPI payouts to lenders upon return completion

### Phase 2: Digital KYC & Verification Badges
- [ ] DigiLocker / Aadhaar XML / Stripe Identity verification
- [ ] Verified Campus Student & Trusted Lender shield badges (*🛡️ Verified*)
- [ ] Tiered deposit exemptions for high-trust verified members

### Phase 3: AI Condition Inspection & Dynamic Pricing
- [ ] Computer vision visual condition comparison (before vs. after photos) to highlight new scratches or damage
- [ ] AI-driven price recommendation engine based on item age, retail value, and local demand density
- [ ] Automated dispute resolution hub with deposit claim arbitration
