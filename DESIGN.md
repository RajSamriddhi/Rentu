# 🎨 DESIGN.md: Design System, UI Components & Screen Specifications

**Brand Archetype:** Gen Z Neo-Pop / Pastel Brutalism (Inspired by Rento⁺)  
**Core Motto:** *"Borrow. Rent. Lend. Everything."*  
**Secondary Tagline:** *"Same stuff. More people. Happier planet. Good things circulate."*  
**Design Philosophy:** Playful, approachable, social, and vibrant. Combines clean modern card architecture with playful sticker tags, pastel category tiles, and high-energy hot-pink accents.

---

## 1. Visual Identity & Brand Elements

- **Wordmark & Logo:** Bold rounded modern sans with a playful superscript accent (e.g. **Rento⁺** or **BorrowFlex⁺**).
- **Sticker Badges & Scrapbook Accents:**
  - Tilted yellow memo stickers: `SAME STUFF. MORE PEOPLE. HAPPIER PLANET.`
  - Purple pill badge: `GOOD THINGS CIRCULATE`
  - Black micro-badge: `PEOPLE OVER THINGS`
  - Hand-drawn doodle accents: Sparkles ✨, stars ⭐, smiley faces 😊, and squiggles.
- **Micro-Copy Tone:** Friendly, casual, ultra-direct:
  - *"Can't find what you need? Post a request and let the community find it for you!"*
  - *"I can lend this"*
  - *"Turn your unused items into income ✨"*

---

## 2. Color Palette & Design Tokens

### 2.1. Signature Brand Colors
| Role | Color Name | Hex Code | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Brand** | Electric Hot Pink / Coral | `#FF3B69` | `bg-[#FF3B69]` | Primary CTA buttons, search buttons, active tabs, brand accents |
| **Primary Hover** | Deep Coral Pink | `#E02956` | `bg-[#E02956]` | Button hover & active states |
| **Primary Soft** | Pastel Pink / Blush | `#FFF0F3` | `bg-[#FFF0F3]` | Active tab backgrounds, request card highlights |
| **Canvas Background**| Warm Cream / Off-White | `#FAF9F6` | `bg-[#FAF9F6]` | Global page background |
| **Card Surface** | Pure White | `#FFFFFF` | `bg-white` | Item cards, dialogs, floating panels |
| **Ink / Text Primary**| Charcoal Black | `#18181B` | `text-zinc-900` | Headings, titles, high-emphasis text |
| **Text Secondary** | Slate Gray | `#71717A` | `text-zinc-500` | Subtitles, timestamps, distance tags |
| **Borders** | Subtle Divider | `#E4E4E7` | `border-zinc-200` | Clean, subtle 1px card outlines |

### 2.2. Pastel Category Palette (Card & Tile Accents)
Each category features a unique pastel background paired with a dark icon:

| Category | Background Hex | Tailwind Class | Icon Theme |
| :--- | :--- | :--- | :--- |
| **Tools & DIY** | `#FEF08A` | `bg-yellow-200` | 🛠️ Power drill, wrench |
| **Electronics & Tech** | `#DDD6FE` | `bg-purple-200` | 💻 Laptop, camera |
| **Camping & Outdoor** | `#DCFCE7` | `bg-emerald-100` | ⛺ Tent, backpack |
| **Home & Appliances** | `#CCFBF1` | `bg-teal-100` | 🥤 Blender, vacuum |
| **Clothing & Fits** | `#FCE7F3` | `bg-pink-100` | 👗 Jacket, lehenga |
| **Books & Media** | `#E0E7FF` | `bg-indigo-100` | 📚 Books, vinyl |
| **Sports & Fitness** | `#FFEDD5` | `bg-orange-100` | 🏸 Racket, skates |
| **Other** | `#F3E8FF` | `bg-purple-100` | 🔮 Miscellaneous |

---

## 3. Typography Hierarchy

**Display & Headings:** Plus Jakarta Sans or Clash Display (`font-display font-extrabold tracking-tight`)  
**Body & UI Controls:** Inter or Plus Jakarta Sans (`font-sans font-medium`)

| Level | Size | Weight | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | 44px–52px | Black (900) | `-0.03em` | *"Borrow. Rent. Lend. Everything."* |
| **Section Header**| 24px–28px | Bold (800) | `-0.02em` | *"Featured near you"*, *"Explore"* |
| **Item Title** | 16px–18px | SemiBold (700)| `-0.01em` | *"Canon EOS 250D"*, *"Camping Tent"* |
| **Price Tag** | 16px–18px | ExtraBold (800)| `0em` | `₹300 / day` |
| **Body (Default)**| 14px | Regular (400) | `0em` | Descriptions, chat messages |
| **Badge / Caption**| 12px | SemiBold (600)| `0.02em` | `Saket • 0.8 km`, `Available` |

---

## 4. UI Component Specifications

### 4.1. The Hot-Pink Hero Search Bar
```
+-----------------------------------------------------------------------------------+
|  🔍 What are you looking for?                   📍 Delhi ▾      [ 🔍 (Hot Pink) ] |
+-----------------------------------------------------------------------------------+
  Popular right now: [Camera] [Projector] [Tent] [Power Drill] [Books] [Outfits]
```
- **Styling:**
  - Container: `bg-white border border-zinc-200 rounded-full px-5 py-3 shadow-sm flex items-center`
  - Location Dropdown: Integrated pill separator with pin icon.
  - Action Button: Circular or rounded-full `bg-[#FF3B69] hover:bg-[#E02956] text-white p-3 shadow-md`.
  - Tags: Pill chips with `bg-zinc-100 text-zinc-700 text-xs px-3.5 py-1.5 rounded-full hover:bg-zinc-200`.

### 4.2. Item Listing Card (Grid & Carousel)
```
+------------------------------------------+
| ┌──────────────────────────────────────┐ |
| │ [ Photo: 4:3 rounded-xl ]     [❤️]   │ |
| └──────────────────────────────────────┘ |
| Canon EOS 250D                           |
| ₹300 / day                               |
| 📍 Saket • 0.8 km                        |
| ⭐ 4.8 (24)                              |
+------------------------------------------+
```
- **Styling:**
  - Card: `bg-white border border-zinc-200/80 rounded-2xl p-3 hover:shadow-lg transition-all cursor-pointer`
  - Image: `aspect-[4/3] w-full object-cover rounded-xl relative`
  - Floating Favorite Button: Top-right heart button `bg-white/90 backdrop-blur rounded-full p-2 shadow-sm`
  - Price: `text-zinc-900 font-extrabold text-base`

### 4.3. Reverse Request Card ("Wanted to Rent")
```
+-------------------------------------------------------------------------------+
| [Icon] Need a Projector for 2 days                       📍 Saket             |
|        ₹300 budget • 12-14 Oct                                                |
|        Looking for a projector for a college event. Needs HDMI support.       |
|        👤 Rohan • 2 hours ago                         [ I can lend this ⚡ ]  |
+-------------------------------------------------------------------------------+
```
- **Styling:**
  - Card: `bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start hover:border-[#FF3B69]/40 transition-all`
  - Budget Highlight: `text-[#FF3B69] font-bold text-sm`
  - Action Button: `bg-[#FFF0F3] text-[#FF3B69] hover:bg-[#FF3B69] hover:text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors`

### 4.4. Category Tile (Pastel Box)
- Box: `w-28 h-28 rounded-2xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-transform hover:-translate-y-1`
- Content: Illustrated 3D/flat icon + clean category label (`text-xs font-bold text-zinc-800`).

---

## 5. Screen Layout Specifications (The 8 Key Screens)

### Screen 1: Landing Page (The Hook)
- **Top Bar:** Wordmark `Rento⁺`, Nav links (`Browse`, `Requests`, `How it works`), Search icon, `Log in`, `Sign up` (black pill).
- **Hero Section:**
  - Left: Headline *"Borrow. Rent. Lend. Everything."*, subheading, Hero search bar, Popular pills.
  - Right: Playful photo collage of user with camera, floating yellow & purple sticker badges (*"Same stuff. More people. Happier planet."*), star doodles.
- **Value Props Row:** 4 soft pastel circles with icons:
  1. 🔍 *Find what you need*
  2. 📷 *Rent or Borrow*
  3. 👜 *Lend & Earn*
  4. 💜 *Build your community*

### Screen 2: Explore & Browse Feed
- **Header:** *"Explore. Everyday items. Real people. Your community."*
- **Horizontal Category Pills:** `All`, `Tools & DIY`, `Electronics`, `Camping`, `Home`, etc.
- **Floating Banner:** *"Can't find what you need? Post a request and let the community find it for you! [Post a Request →]"* with megaphone icon 📢.
- **Featured Grid:** Multi-column responsive item grid with distance and ratings.
- **Category Browse Grid:** Grid of 7 pastel category tiles.

### Screen 3: Item Detail Page
- **Breadcrumb:** `← Back to search`
- **Left Column:** High-res gallery (Main image + thumbnail strip `+3 photos`).
- **Center Details:**
  - Item Title, `₹300 / day`, Rating ⭐ 4.8 (24 reviews).
  - Category, Location (`Saket • 0.8 km`), Availability pill (`Available` in soft green).
  - Tabs: `Overview`, `Reviews`, `Owner`.
  - Key Conditions: `⏱️ Up to 5 days max`, `🚫 Delivery not available`, `📍 Self pickup (Saket)`.
  - Owner Card: Mini avatar, name, member duration, `[View profile]` button.
- **Right Column (Sticky Booking Widget):**
  - Card: *"Request to Rent • ₹300 / day"*
  - Form: Start Date picker, Start Time picker, Duration dropdown (e.g. *2 days*).
  - Summary: Total cost calculated (`₹600`).
  - CTA Button: `[Send Request]` in full-width electric pink (`#FF3B69`).
  - Disclaimer: *"This will send a request to the owner. Contact details are shared only after acceptance."*

### Screen 4: List an Item (Lender Flow)
- Stepper: `(1) Item Details` $\rightarrow$ `(2) Pricing & Availability` $\rightarrow$ `(3) Review`.
- Fields: Title, Category dropdown, Description textarea.
- Photos: Drag & drop upload box (supports up to 8 photos with thumbnail preview).

### Screen 5: Requests Feed ("Wanted to Rent")
- Segmented Control: `Browse Items` | `Requests` (Active Tab).
- Header with `[+ Post a Request]` pink button.
- Category filter chips.
- List of open community bounties with seeker name, required dates, offered budget, and `[I can lend this]` action.

### Screen 6: Post a Request Modal / Screen
- Header: *"Post a Request • Tell the community what you need 📢"*
- Inputs: Item name, Category, Required date & time, Duration, Your budget (₹ per day), Additional requirements, Pickup location.
- CTA: Full-width `[Post Request]` button in hot pink.

### Screen 7: User Profile & Public Dashboard
- Header: Profile photo, Name (@handle), Bio (*"Student • Photographer • Cat person"*), Rating ⭐.
- Stats Strip: `5 Listings` | `12 Total Rents` | `8 Completed` | `4.8 Rating`.
- Tabbed Content: `My Listings` | `My Requests` | `Bookings`.
- Item rows with status badges (`Available`, `Rented`) and edit pencil icon.

### Screen 8: Messages & Chat Coordination
- Split View (Inbox + Chat Window):
  - Left: Conversation list with unread badges and filters (`All`, `Requests`, `Bookings`).
  - Right: Direct conversation with item thumbnail banner at the top, real-time message bubbles, and bottom text field with photo attachment button.

---

## 6. Mobile Layout & Bottom Navigation (The Mobile Experience)
- Full responsiveness matching the rightmost mobile frame in the design:
  - Top bar with compact search and location pill.
  - Floating action button (FAB) `[+]` in bottom center for quick listing / request.
  - Bottom Tab Bar:
    - 🏠 `Explore`
    - 🔍 `Requests`
    - ➕ `List / Post`
    - 📦 `My Bookings`
    - 👤 `Profile`
