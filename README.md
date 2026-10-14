<div align="center">

# ⚡ Rentu⁺

### **Don't Buy It. Rent It. Flex It.**
*Peer-to-Peer Gear Rental Network for Creators, Students & Flatmates.*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

## 📖 Overview

**Rentu⁺** is an anti-ownership, community-powered gear rental platform where creators, students, and young professionals rent high-demand items (cameras, DJ mixers, projectors, tents, gaming consoles, tools, streetwear) from people nearby at a fraction of retail cost, while lenders turn idle gear into passive income.

> **Good things circulate. Same stuff, more people, happier planet.**

---

## 🌟 Key Features

### 1. 📍 Profile-Centric Location & GPS Distance Tracking
- **Zero Location Clutter**: City names and location pills are removed from the global navigation, search bar, and public views for a clean, privacy-first interface.
- **1-Click GPS Auto-Detection**: Users configure their location exclusively inside their Profile (`EditProfileModal`) via high-accuracy browser Geolocation, which reverse-geocodes into building number, street address, locality, and PIN code.
- **Discrete Address Management**: Dedicated input fields for Building / Flat / House No., Street / Road / Landmark, Locality / Neighborhood, and PIN / Postal Code.
- **Peer-to-Peer Distance Matching**: Silent GPS coordinate capture (`latitude`, `longitude`) enables real-time Haversine distance tracking between nearby borrowers and lenders without exposing private house/building addresses.

### 2. 🌙 Full Dark Mode & Light Mode (with Dedicated Toggle)
- Smooth animated Sun/Moon toggle button (`#theme-toggle-btn`) in the top navigation bar.
- Deep charcoal canvas (`#0F1015`), elevated cards (`#171821`), subtle borders (`#262734`), and crisp high-contrast typography.
- Automatic persistence to `localStorage` (`rentu-theme`) with system OS preference fallback (`prefers-color-scheme`).
- Inline head script prevents flash of unstyled theme on page refresh.

### 3. 🎯 Renting as the Primary Focus
- Optimized specifically for peer rentals with clear daily rates (₹/day), maximum rental durations, and instant date calculations.
- Optional free lending tag (`✨ Also available to borrow if owner agrees`) for community goodwill.

### 4. 🧭 Simplified Navigation Header
- Clean, focused top navigation bar:
  - **Explore**: Browse available gear listings with category pills and price filters.
  - **Requests**: Wanted board where community members post gear requests with offered budgets.
  - **How It Works**: Interactive modal explaining the rental and listing lifecycle.
  - **Theme Toggle**: 1-click Dark/Light mode switch.
  - **Notifications & Messages**: In-app booking alerts and direct messaging.
  - **+ Post Dropdown**: Consolidated action menu for **List Gear for Rent** and **Post a Request**.
  - **User Profile Menu**: Seamless demo switcher, theme changer, and logout.

### 5. ⚡ Fast Supply Flow: "List Gear"
- Multi-step modal to list items in under 60 seconds with title, category, daily rental rate (₹), maximum duration, description, and photo gallery preview.

### 6. 📢 Demand Flow: "Wanted Board"
- Reverse rental marketplace: post gear bounties with needed dates and offered rental budget (e.g., *"Need DJ Mixer for Saturday, paying ₹800"*).
- Nearby neighbors can claim and fulfill requests directly.

### 7. 💬 Direct Chat & Booking Handshake
- Clean split-view messaging interface for booking proposals, pickup coordination, and rental returns.

### 8. 📊 Hustle Hub (Community Analytics Dashboard)
- Real-time marketplace metrics for community leads:
  - Total transacted rental volume ($₹$).
  - Active lenders vs. active borrowers.
  - Healthy marketplace ratio monitoring.
  - Category demand leaderboards and locality distribution charts.

### 9. 🚀 Instant 1-Click Demo Login
- Instantly test different roles and cities without manual authentication:
  - 📸 **Rohit Verma (Lender):** Delhi — Sony Alpha camera, camping tent, tools.
  - 🎨 **Ananya Roy (Renter):** Bangalore — Fuji camera, streetwear, projector.
  - 👑 **Aarav Mehta (Admin):** Mumbai — DJ controller, leather jacket, analytics lead.

---

## 🎨 Design System & Aesthetics

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas** | `#FAFAFA` | `#0F1015` | Page background |
| **Surface** | `#FFFFFF` | `#171821` | Cards, modals, sidebars |
| **Surface Hover** | `#F9FAFB` | `#22232E` | Interactive hover states |
| **Brand Primary** | `#E11D74` | `#E11D74` | Hot pink CTA buttons, badges, highlights |
| **Brand Soft** | `#FFF0F5` | `rgba(225, 29, 116, 0.16)` | Subtle tag backgrounds, glows |
| **Ink (Primary)** | `#111827` | `#F9FAFB` | Main typography |
| **Ink Secondary** | `#6B7280` | `#9CA3AF` | Subtitles, labels, metadata |
| **Dividers** | `#E5E7EB` | `#262734` | Clean borders, separation lines |

---

## 🧱 Architecture & Directory Structure

```
Rento/
├── SPEC.md                  # Gen Z user stories & product specifications
├── DESIGN.md                # Neo-Pop pastel brutalist design tokens & specs
├── RULES.md                 # Engineering standards, conventions & guidelines
├── SCHEMA.md                # PostgreSQL relational database schema & SQL DDL
├── ROADMAP.md               # Live project milestones & progress
├── README.md                # Project documentation
├── package.json             # Root monorepo scripts
├── .gitignore               # Monorepo-level git ignore rules
│
├── backend/                 # Headless REST API (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/          # PostgreSQL pool connection & environment config
│   │   ├── middleware/      # JWT auth guard, standardized response envelope, error handler
│   │   ├── modules/
│   │   │   ├── auth/        # Login, registration, demo auth & current user
│   │   │   ├── items/       # Rental listings CRUD, city & category filtering
│   │   │   ├── requests/    # Community wanted board bounties
│   │   │   ├── bookings/    # Rental proposals & handshake state machine
│   │   │   ├── messages/    # Peer-to-peer coordination chat
│   │   │   ├── analytics/   # Community Pulse & Hustle Hub metrics
│   │   │   └── users/       # User profiles & trust ratings
│   │   ├── db/              # SQL schema migration & realistic seed script
│   │   ├── utils/           # City extraction & validation helpers
│   │   ├── app.ts           # Express application configuration
│   │   └── server.ts        # Server entry point (port 5001)
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                # Client Application (React 18 + Vite + Tailwind CSS)
    ├── src/
    │   ├── components/      # UI components (Navbar, ItemCard, Modals, HustleHub)
    │   ├── lib/             # API client, AuthContext, ThemeContext, City helpers, Types
    │   ├── styles/          # Tailwind setup, CSS custom properties & utility classes
    │   ├── App.tsx          # Main view router & layout coordinator
    │   └── main.tsx         # Root React entry point with ThemeProvider & AuthProvider
    ├── index.html           # HTML template with instant theme-detection script
    ├── tailwind.config.js   # Tailwind theme extensions & class dark mode config
    ├── vite.config.ts       # Vite bundler configuration
    ├── package.json
    └── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ (tested on v20 and v26)
- **PostgreSQL**: v14+ running locally on port `5432`

---

### 1. Database Setup

Create the PostgreSQL database:

```bash
createdb borrowflex
```

---

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Run database migrations and seed realistic listings
npm run db:migrate
npm run db:seed

# Start backend dev server (runs on http://localhost:5001)
npm run dev
```

---

### 3. Frontend Setup

In a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start frontend dev server (runs on http://localhost:3000)
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### 4. Root Monorepo Commands

From the root directory:

```bash
# Run both backend and frontend concurrently
npm run dev

# Run database seed
npm run seed

# Build production bundle
npm run build
```

---

## 📡 API Contract Reference

All API responses follow a standardized JSON response envelope:

```json
// Success Response
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Detailed error message"
  }
}
```

### Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Login with email & password | No |
| `GET` | `/api/auth/me` | Fetch currently authenticated user | Yes |
| `GET` | `/api/items` | Browse rental items (supports `city`, `category`, `search`) | No |
| `POST` | `/api/items` | List gear for rent | Yes |
| `GET` | `/api/items/:id` | Get item details and owner info | No |
| `GET` | `/api/requests` | Browse community wanted requests | No |
| `POST` | `/api/requests` | Post a new wanted request with budget | Yes |
| `POST` | `/api/bookings` | Submit a rental proposal | Yes |
| `GET` | `/api/bookings` | View active proposals (incoming & outgoing) | Yes |
| `PATCH`| `/api/bookings/:id/status`| Accept or decline rental proposal | Yes |
| `GET` | `/api/messages/booking/:bookingId`| Fetch booking message history | Yes |
| `POST` | `/api/messages` | Send chat message | Yes |
| `GET` | `/api/analytics/overview` | Community overview metrics (Hustle Hub) | Admin |
| `GET` | `/api/analytics/categories` | Most active categories distribution | Admin |

---

## 👥 Demo Personas

| Avatar | Name | Role | City | Seeded Gear |
| :---: | :--- | :--- | :--- | :--- |
| 📸 | **Rohit Verma** | Lender | Delhi | Sony A7 IV Camera, 4-Person Camping Tent, DeWalt Drill Kit |
| 🎨 | **Ananya Roy** | Renter | Bangalore | Fujifilm X-T30, Vintage Trench Coat, Anker Capsule Projector |
| 👑 | **Aarav Mehta** | Admin / Lead | Mumbai | Pioneer DDJ-FLX4 DJ Controller, Distressed Leather Jacket |

---

## 📄 License

MIT © 2026 Rentu⁺ Team. Built for the circular economy.
