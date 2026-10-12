# ⚡ BorrowFlex (Rento⁺) — Version 1.0

> **"Don't buy it. Borrow it. Flex it."**  
> Gen Z Peer-to-Peer Gear Sharing & Rental Platform.

BorrowFlex is an anti-ownership, community-powered gear sharing platform where creators, students, and festival-goers rent high-value items (cameras, DJ mixers, projectors, tents, gaming consoles, tools, streetwear) from people nearby at a fraction of retail cost, while lenders turn idle gear into passive income.

---

## 🚀 Live Running Services

- **Frontend Client (Vite + React + TypeScript + Tailwind CSS):** [http://localhost:3000](http://localhost:3000)
- **Backend API (Node.js + Express + TypeScript + PostgreSQL):** [http://localhost:5001/api/health](http://localhost:5001/api/health)

---

## 🎨 Design System & Aesthetics (Neo-Pop / Pastel Brutalism)

- **Signature Brand Color:** Electric Hot Pink (`#FF3B69`)
- **Canvas:** Warm Cream (`#FAF9F6`) & Pure White cards
- **Pastel Category Palette:**
  - 📸 Electronics & Tech (`#DDD6FE`)
  - ⛺ Camping & Outdoor (`#DCFCE7`)
  - 🛠️ Tools & DIY (`#FEF08A`)
  - 👗 Clothing & Fits (`#FCE7F3`)
  - 🥤 Home & Appliances (`#CCFBF1`)
  - 🏸 Sports & Fitness (`#FFEDD5`)
  - 📚 Books & Media (`#E0E7FF`)
- **Sticker Badges & Scrapbook Accents:**
  - `SAME STUFF. MORE PEOPLE. HAPPIER PLANET.`
  - `GOOD THINGS CIRCULATE`
  - `PEOPLE OVER THINGS`
  - `✨ Weekend Flex`, `💸 Certified Steal`, `🔥 Hot Demand`, `🌱 Eco Hero`

---

## ⚡ Key Features & Flows in V1

### 1. Dual-Feed Architecture
- **Available Gear Feed:** Browse gear with category filters, locality picker, and sort controls.
- **Community Wishlist (Reverse Bounties):** Got gear in your closet? Browse requests from neighbors willing to pay, and tap **"I Can Lend This ⚡"** to claim and fulfill.

### 2. Supply Flow: Drop Gear 💸
- 60-second lender flow with title, category, rate per day (₹), max duration days, Gen Z sticker badge, and photo presets or custom image URLs. Live card preview updates in real-time.

### 3. Demand Flow: Drop a Wish 🎯
- Reverse request creator: specify needed item, category, dates, duration, offered cash budget, and locality.

### 4. Direct Rental Proposals ("Snag for the Weekend")
- Item detail modal with high-res photo gallery, condition tags, owner trust score, and a sticky booking widget with real-time duration and price calculation.

### 5. Chat & Coordination Handshake
- Direct in-app messaging linked to booking proposals.
- Verified phone contact unlocks automatically once a lender accepts the proposal.

### 6. Hustle Hub (Community Analytics)
- Live metrics tracking total transacted volume, active lenders vs. borrowers, available vs. rented gear, category popularity leaderboard, and top hustlers.

### 7. Instant 1-Click Persona Switcher
- Switch between demo personas directly from the top navigation bar:
  - **Rohit Verma (Lender):** Indie filmmaker in Saket with Canon & Fuji gear.
  - **Ananya Roy (Borrower):** Design student in Koramangala.
  - **Aarav Mehta (Admin):** Community lead in Powai.

---

## 🛠️ Project Commands

```bash
# Run backend server
npm run dev:backend

# Run frontend client
npm run dev:frontend

# Build for production
npm run build

# Re-seed database with Gen Z gear and community bounties
npm run seed
```
