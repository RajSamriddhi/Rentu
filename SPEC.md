# ⚡ SPEC.md: Product Specification & User Flows

**Product Name:** BorrowFlex (Gen Z Peer-to-Peer Gear Sharing & Rental Platform)  
**Motto:** *"Don't buy it. Borrow it. Flex it."*  
**Target Audience:** Gen Z college students, creators, flatmates, young professionals, and festival-goers.  
**Core Vibe:** Fast, trendy, anti-hoarding. Makes borrowing feel like a flex rather than a financial drag.

---

## 1. Product Overview & Gen Z Mindset

### The Psychology
Gen Z values **experiences over ownership**. Why spend ₹60,000 buying a camera or ₹8,000 on a camping tent that will sit in a closet collecting dust for 360 days a year?
- **For Borrowers:** Instant access to high-demand gear (cameras, DJ mixers, consoles, festival fits, power tools) at a fraction of retail cost. Cheaper than a round of iced matcha.
- **For Lenders:** Monetize gear chilling in the wardrobe and turn idle items into passive income (secure the bag 💸).
- **Core Principle for V1:** Ultra-simple, email-linked accounts, dual-sided feed (Available Gear vs. Community Wishlist / Bounties), and direct coordination. (Escrow is reserved for Version 2).

---

## 2. User Roles & Personas

1. **The Casual Lender / Hustler:**
   - Owns cool gear (retro cameras, drills, gaming consoles, tents, projectors).
   - Wants effortless passive income without dealing with awkward negotiations or endless questions.
   - Sets daily rate and max lend duration.
2. **The Smart Borrower / Creator:**
   - Needs gear for a weekend trip, a content shoot, a party, or a quick DIY fix.
   - Hates the idea of buying stuff they'll only use once.
   - Can browse existing gear or post a "Wish / Bounty" stating: *"Need a camera for Saturday, paying ₹400"*.
3. **The Domain Lead / Community Admin:**
   - Monitors community activity, tracks active lenders vs. borrowers, total savings/volume transacted, and sees which items are trending.

---

## 3. Core Features & Capabilities

### 3.1. Universal Email Authentication
- Clean email-based login/signup with instant password hashing or magic code.
- Profile includes:
  - Handle / Display Name (e.g. `@rohit.lens`)
  - Locality / Campus / Area (e.g. *Powai*, *Koramangala*, *Bandra*)
  - "Hustle Badges" & Trust Score
  - Listed Gear & Wishlist requests

### 3.2. Supply Flow: Drop Gear for Rent ("Lend & Earn")
- **Quick 30-Second Drop:**
  - Photo upload (instant camera snap or gallery).
  - Gear Name & Category (`📸 Tech & Cameras`, `👟 Style & Fits`, `⛺ Outdoor & Fest`, `🛠️ Tools & DIY`, `🎮 Gaming`, `🏠 Living`).
  - **Rental Rate:** Price per day (e.g., ₹200/day).
  - **Max Lend Duration:** (e.g., *"Up to 3 days max"*, *"Weekend only"*).
  - Auto-generated Gen Z sticker badge (e.g., *✨ Weekend Flex*, *💸 Certified Steal*).
- **Listing Status:**
  - Toggle between `AVAILABLE` and `RENTED`.

### 3.3. Demand Flow: "Drop a Wish / Community Bounty" (Reverse Request)
- When a user can't find what they want, they drop a **Bounty**:
  - Item / Gear needed (e.g., *"Sony FX3 or A7SIII"*).
  - Needed Date & Time (e.g., *"This Friday 6 PM"*).
  - Duration needed (e.g., *"2 days"*).
  - **Proposed Budget:** What they're willing to pay (e.g., *"₹1,200 for the weekend"*).
  - Area / Locality.
- **The "I Gotchu" Match Flow:**
  - Nearby owners browse the Community Wishlist.
  - An owner clicks **"I Gotchu / Rent It"** to claim and fulfill the bounty directly.

### 3.4. Direct Rental Proposals & Handshake
- Borrower taps **"Snag for the Weekend"** on an item card:
  - Picks rental dates and duration.
  - Submits proposal to lender.
- Lender receives prompt notification and taps **Accept** or **Decline**.
- Upon acceptance, chat / direct contact opens to coordinate local handoff.

### 3.5. Community Analytics ("Hustle Hub")
- Domain / Community Lead tracks:
  - Total members active.
  - Active lenders (users monetizing gear) vs. active borrowers.
  - Total community volume transacted ($₹$ saved / earned).
  - Leaderboard of most trending categories and unmet wishlists.

### 3.6. Profile-Centric Location & GPS Distance Tracking
- **Privacy-First Design**: City names and location indicators are removed from all navigation bars, search bars, and public headers.
- **1-Click GPS Setup in Profile**: Users set their location strictly inside their Profile modal using browser Geolocation, which auto-fills building number, street, locality, and PIN code.
- **Silent Coordinate Distance Tracking**: Stores high-accuracy `latitude` and `longitude` in the database to calculate real-time Haversine distance between borrowers and lenders (`X km away` / `Nearby`) without exposing private house/building addresses.

---

## 4. End-to-End User Journeys

### Journey 1: The Fast Gear Drop (Lender)
```
[User Logged In] ──► [Tap "List Gear 💸"] 
       │
       ▼
[Snap Photo + Name + ₹/day + Max Days] 
       │
       ▼
[Publish Item] ──► [Instant Card with Sticker Badge in Feed]
```

### Journey 2: The Weekend Snag (Borrower)
```
[Browse "Available to Rent" Feed] 
       │
       ▼
[Filter by Category (e.g. Cameras / Tech)]
       │
       ▼
[Tap "Snag It" -> Select Dates -> Send Proposal]
       │
       ▼
[Lender Taps "Accept"] ──► [Contact Unlocked -> Meet & Flex]
```

### Journey 3: The Community Wish / Bounty (Reverse Request)
```
[User Needs Specific Gear That Isn't Listed]
       │
       ▼
[Tap "Drop a Wish 🎯"]
       │
       ▼
[State Gear + Date + Budget: "Need DJ Mixer for Saturday, paying ₹800"]
       │
       ▼
[Published to Community Wishlist]
       │
       ▼
[Neighbor Sees Bounty -> Taps "I Gotchu" -> Transaction Done]
```
