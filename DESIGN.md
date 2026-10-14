# 🎨 DESIGN.md: Design System, UI Components & Screen Specifications

**Brand Archetype:** Gen Z Neo-Pop / Pastel Brutalism (Rentu⁺)  
**Core Motto:** *"Borrow. Rent. Lend. Everything."*  
**Secondary Tagline:** *"Same stuff. More people. Happier planet. Good things circulate."*  
**Design Philosophy:** Vibrant, playful, approachable, social, and ultra-crisp. Merges modern rounded card geometry with pastel category accents, hot-pink interactive highlights, and high-contrast dark/light mode balance.

---

## 1. Visual Identity & Brand Elements

- **Wordmark & Logo:** Bold rounded modern sans font with an electric hot-pink superscript accent (**Rentu⁺**).
- **Sticker Badges & Scrapbook Accents:**
  - Yellow Memo Sticker: `SAME STUFF. MORE PEOPLE. HAPPIER PLANET.`
  - Purple Pill Badge: `GOOD THINGS CIRCULATE`
  - Charcoal Micro-Badge: `PEOPLE OVER THINGS`
  - Micro-Doodle Accents: Sparkles ✨, stars ⭐, lightning bolts ⚡, megaphone 📢, and fire 🔥.
- **Tone of Voice:** Direct, energetic, witty, anti-gatekeeping:
  - *"Don't buy it. Rent it. Flex it."*
  - *"Turn your unused items into passive income 💸"*
  - *"Need something specific? Drop a bounty on the Wanted Board 🎯"*
  - *"I can lend this ⚡"*

---

## 2. Color Palette & Design Tokens

### 2.1. Signature Brand Tokens (Dual Theme)

| Token | Light Mode Hex | Dark Mode Hex | Tailwind Class | Semantic Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Canvas** | `#FAFAFA` | `#0F1015` | `bg-canvas` | Global application backdrop |
| **Surface** | `#FFFFFF` | `#171821` | `bg-surface` | Elevated item cards, dialog modals, dropdowns |
| **Surface Hover** | `#F4F4F5` | `#22232E` | `bg-surface-hover` | Hover states on interactive cards and list items |
| **Brand Primary** | `#E11D74` | `#E11D74` | `bg-brand`, `text-brand`| Hot pink CTA buttons, active state pills, glowing accents |
| **Brand Hover** | `#BE1260` | `#BE1260` | `hover:bg-brand-hover`| High-emphasis button hover and active states |
| **Brand Soft** | `#FFF0F5` | `rgba(225,29,116,0.16)` | `bg-brand-soft` | Active tab backgrounds, request card badges |
| **Ink Primary** | `#111827` | `#F9FAFB` | `text-ink` | Display headings, titles, high-contrast text |
| **Ink Secondary** | `#6B7280` | `#9CA3AF` | `text-ink-secondary` | Subtitles, timestamps, distance indicators |
| **Dividers** | `#E5E7EB` | `#262734` | `border-divider` | Crisp, clean 1px card outlines and section separators |

### 2.2. Pastel Category Palette
Each category features a distinctive pastel background paired with a dark icon for instant visual recognition:

| Category | Light Background | Dark Accent Tint | Icon | Example Gear |
| :--- | :--- | :--- | :--- | :--- |
| **Tools & DIY** | `#FEF08A` (Yellow-200) | `rgba(254, 240, 138, 0.2)` | 🛠️ Wrench / Drill | Power drill, toolkit, heat gun |
| **Electronics & Tech** | `#DDD6FE` (Purple-200) | `rgba(221, 214, 254, 0.2)` | 💻 Camera / Laptop | Mirrorless camera, projector, drone |
| **Camping & Outdoor** | `#DCFCE7` (Emerald-100) | `rgba(220, 252, 231, 0.2)` | ⛺ Tent / Backpack | 4-person tent, trekking gear, sleeping bag |
| **Home & Living** | `#CCFBF1` (Teal-100) | `rgba(204, 251, 241, 0.2)` | 🏠 Blender / Vacuum | Espresso maker, vacuum, air mattress |
| **Clothing & Fits** | `#FCE7F3` (Pink-100) | `rgba(252, 231, 243, 0.2)` | 👟 Jacket / Sneakers | Retro streetwear, festival jacket, tuxedo |
| **Books & Media** | `#E0E7FF` (Indigo-100) | `rgba(224, 231, 255, 0.2)` | 📚 Books / Vinyl | Fiction bestsellers, textbooks, vinyl records |
| **Sports & Fitness** | `#FFEDD5` (Orange-100) | `rgba(255, 237, 213, 0.2)` | 🏸 Racket / Board | Tennis racket, skateboard, dumbbells |
| **Other** | `#F3E8FF` (Purple-100) | `rgba(243, 232, 255, 0.2)` | 🔮 Sparkle Box | Board games, party disco lights, tripods |

---

## 3. Typography Hierarchy

- **Display & Headings:** Plus Jakarta Sans (`font-display font-extrabold tracking-tight`)
- **Body & Controls:** Inter (`font-sans font-medium`)

| Level | Size (Desktop) | Weight | Tracking | Semantic Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | 48px–56px | Black (900) | `-0.03em` | *"Borrow. Rent. Lend. Everything."* |
| **Section Header** | 24px–28px | Bold (800) | `-0.02em` | *"Featured near you"*, *"Wanted Board"* |
| **Item Title** | 16px–18px | SemiBold (700) | `-0.01em` | *"Sony Alpha 7 IV"*, *"Pioneer DJ Mixer"* |
| **Price Tag** | 16px–18px | ExtraBold (800)| `0em` | `₹300 / day` |
| **Body (Default)** | 14px | Regular (400) | `0em` | Descriptions, chat messages, addresses |
| **Badge / Caption** | 12px | SemiBold (600) | `0.02em` | `Saket • 0.8 km`, `AVAILABLE` |

---

## 4. UI Component Specifications

### 4.1. Clean Hero Search Bar (Zero Location Clutter)
```
+-----------------------------------------------------------------------------------+
|  🔍 What are you looking for? (e.g. Sony A7IV, Camping Tent)      [ Search ⚡ ]   |
+-----------------------------------------------------------------------------------+
  Popular: [📸 Cameras] [🎥 Projectors] [⛺ Tents] [🛠️ Drills] [🎮 Consoles] [👟 Fits]
```
- **Styling:**
  - Container: `bg-surface border border-divider rounded-full px-5 py-3 shadow-sm flex items-center gap-3`
  - Action Button: `bg-brand hover:bg-brand-hover text-white px-5 py-2.5 rounded-full font-bold shadow-md`
  - Tag Chips: `bg-surface-hover text-ink text-xs px-3.5 py-1.5 rounded-full border border-divider hover:border-brand`

### 4.2. Gear Listing Card (Explore Feed)
```
+------------------------------------------+
| ┌──────────────────────────────────────┐ |
| │ [ Photo: 4:3 rounded-2xl ]    [❤️]   │ |
| │ [✨ Weekend Flex]                    │ |
| └──────────────────────────────────────┘ |
| Sony Alpha 7 IV                          |
| ₹850 / day                               |
| 📍 1.2 km away • Saket                   |
| ⭐ 4.95 (18 reviews)                     |
+------------------------------------------+
```
- **Visual Attributes:**
  - Card: `bg-surface border border-divider rounded-2xl p-3 hover:shadow-xl transition-all cursor-pointer`
  - Aspect Ratio: `aspect-[4/3] w-full object-cover rounded-xl`
  - Top Floating Sticker: `bg-yellow-300 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase`
  - Heart Wishlist Button: `bg-white/90 dark:bg-black/80 backdrop-blur rounded-full p-2`

### 4.3. Wanted Board Bounty Card (Reverse Request)
```
+-------------------------------------------------------------------------------+
| 📢 Need a DJ Controller for Saturday Night                 📍 0.8 km away     |
|    ₹1,200 budget • 18-20 Oct (2 days)                                         |
|    Need a Pioneer DDJ-400 or FLX4 for a college party in Koramangala.         |
|    👤 Ananya Roy • 2 hours ago                         [ I can lend this ⚡ ] |
+-------------------------------------------------------------------------------+
```
- **Visual Attributes:**
  - Card: `bg-surface border border-divider rounded-2xl p-5 hover:border-brand/40 transition-all shadow-sm`
  - Budget Tag: `text-brand font-black text-base`
  - Action CTA: `bg-brand text-white hover:bg-brand-hover font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm`

### 4.4. 4-Step Modal Stepper ("List an Item" & "Post a Request")
```
STEPS
 (✔) 1. Item Details
 (✔) 2. Date & Budget
 (✔) 3. Location & Preferences
 (4) 4. Review & Confirm
```
- **Stepper Column:** `w-full md:w-1/3 bg-canvas/60 p-6 border-r border-divider`
- **Active Step Circle:** `bg-brand text-white shadow-sm`
- **Passed Step Circle:** `bg-emerald-500 text-white`
- **Upcoming Step Circle:** `bg-divider text-ink-secondary`

---

## 5. Screen Specifications (Key Application Views)

### Screen 1: Explore & Browse Feed
- **Header:** Hero Search Bar + Popular Category Pills (`All`, `Tools`, `Electronics`, `Camping`, etc.)
- **Bounty Callout Banner:** *"Can't find what you need? Post a request and let the community find it for you! [Post a Request 📢]"*
- **Grid Layout:** 3-column / 4-column responsive grid of high-res item cards with Haversine distance tags.

### Screen 2: Wanted Board (Reverse Marketplace)
- **Header:** Community Wishlist overview with count of active bounties.
- **Filter Tabs:** `All Bounties`, `Tech & Cameras`, `Tools`, `Camping`, `High Budget`.
- **Bounty List:** Interactive cards with instant "I can lend this ⚡" proposal triggers.

### Screen 3: Item Detail & "Snag It" Proposal Flow
- **Gallery:** High-res primary photo + thumbnail gallery carousel.
- **Price Calculation Panel:** Date picker calculates dynamic price:
  $$\text{Total Fee} = \text{Days} \times \text{Daily Rate}$$
- **Owner Card:** Avatar, Trust Score, dynamic star rating from `user_scores_3nf_v`.
- **CTA:** Sticky bottom button: `Snag for the Weekend ⚡`.

### Screen 4: Split-View Direct Chat
- **Left Panel:** Active conversations grouped by booking reservation.
- **Right Panel:** Message bubble history, pickup instructions, item status banner (`PENDING` / `ACCEPTED`), and phone call unlock button.

### Screen 5: Hustle Hub (Community Analytics)
- **Top Row KPI Cards:** Total Volume Transacted ($₹$), Active Lenders, Active Borrowers, Marketplace Health Ratio.
- **Demand Leaderboards:** Top 5 trending categories and locality distribution.

### Screen 6: Profile & Privacy Location Manager
- **Profile Card:** Avatar, Handle, Bio, Trust Score Badge (*98/100*), Active Listings, and Saved Bounties.
- **1-Click GPS Location Editor:** Button `Detect Current Location 📍` auto-fills address fields without exposing street numbers publicly on the platform.
