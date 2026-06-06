# Vyapari: Autonomous E-Commerce Operations & Personalization Platform

**Vyapari** is a state-of-the-art, AI-native E-Commerce Monorepo designed to streamline and automate digital commerce operations while providing a highly personalized shopping experience. Powered by **Google Gemini** models (for intelligence and content generation) and **Supabase** (for authentication, PostgreSQL database, and Row-Level Security), it offers an end-to-end ecosystem for Shoppers, Sellers (Merchants), and Platform Administrators.

---

## 🌟 Key Features

### 🛍️ Customer Storefront
*   **Dynamic Product Catalog:** Seamless browsing, search, and filtering of merchant products.
*   **Smart Product Comparison:** Interactive product comparisons to help users make informed decisions.
*   **Intuitive Checkout & Cart:** Streamlined shopping cart lifecycle and simulated checkout experience.
*   **Social Commerce & Blog:** Engaging community content and detailed blog entries.
*   **Real-time Messaging:** In-app chat between buyers and sellers for queries and negotiations.
*   **Personalized Accounts:** User profiles, order history tracking, addresses manager, wishlist, and referral benefits.

### 🤖 Autonomous AI Assistants
*   **Shopper Assistant:** An intelligent agent helping buyers find products, answer questions, and navigate the platform.
*   **Merchant Assistant:** Provides AI-driven support for seller onboarding, listing optimization, and order management.
*   **AI Product Imagery:** Integrates Google's **Imagen 3** model to automatically generate clean, professional product photos.

### 🏪 Merchant Portal
*   **Inventory & Catalog Management:** Add, edit, or import products in bulk with AI assist.
*   **Sales Analytics:** Detailed metrics tracking order volumes, revenues, and active promotions.
*   **Promotion Manager:** Run campaigns, configure discounts, and manage store visibility.
*   **Payout & Order Fulfillments:** Manage incoming merchant orders and track payouts.

### 🛡️ Admin Moderation Suite
*   **Platform Analytics:** High-level dashboard containing usage metrics and platform health.
*   **Store & Product Moderation:** Review and approve merchant stores and product catalog items.
*   **User & Blog Moderation:** Handle user accounts and community/blog content.
*   **Dispute & Payout Resolution:** Moderate disputes and initiate payouts to seller accounts.

---

## 🛠️ Technology Stack

### Frontend (Client)
*   **Framework:** React 19 + Vite + TypeScript
*   **Routing:** TanStack Router (File-based routing)
*   **State & Data Fetching:** TanStack React Query (v5)
*   **Styling:** Tailwind CSS + Radix UI + Lucide Icons
*   **Form Management:** React Hook Form + Zod validation

### Backend (Server)
*   **Runtime/Framework:** Node.js + Express + TypeScript
*   **Execution:** `tsx` (TypeScript Execute) for watch/dev mode
*   **Validation:** Zod schemas
*   **AI Services:** Google Gemini API (`gemini-2.5-flash` and `imagen-3.0-generate-002`)

### Database & Backend-as-a-Service (BaaS)
*   **Database:** Supabase PostgreSQL with custom triggers and RLS policies
*   **Authentication:** Supabase Auth (JWT session management)
*   **Migrations:** Managed via Supabase Local CLI migrations

---

## 📁 Repository Structure

```text
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Shared UI components
│   │   ├── routes/         # File-system routes (TanStack Router)
│   │   ├── hooks/          # Custom react hooks
│   │   ├── integrations/   # Supabase client integration
│   │   └── main.tsx        # Client entry point
├── server/                 # Express API server
│   ├── src/
│   │   ├── routes/         # Express routing endpoints (admin, seller, chat, etc.)
│   │   ├── services/       # AI service wrappers (Gemini & Imagen)
│   │   ├── middleware/     # Auth and error middleware
│   │   └── index.ts        # Server entry point
├── supabase/               # Supabase database configurations
│   ├── migrations/         # PostgreSQL schema files & seed data
│   └── config.toml         # Supabase project configuration
├── package.json            # Monorepo workspace configuration
├── .gitignore              # Files to ignore in Git
└── .env.example            # Environment variables template
```

---

## 🚀 Getting Started

### 📋 Prerequisites
Make sure you have the following installed on your system:
*   [Node.js](https://nodejs.org/) (v18+ recommended)
*   [npm](https://www.npmjs.com/) or [Bun](https://bun.sh/)
*   [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local DB development)

### ⚙️ Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Kings-man-6969/Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform.git
    cd Vyapari-Autonomous-E-Commerce-Operations-Personalization-Platform
    ```

2.  **Install Monorepo Dependencies:**
    Run the following command in the root directory to install packages for the root, client, and server:
    ```bash
    npm install
    ```

3.  **Environment Configuration:**
    Copy the template environment file and fill in your credentials:
    ```bash
    cp .env.example .env
    ```
    Open `.env` and fill in the following variables:
    *   `SUPABASE_URL` & `SUPABASE_PUBLISHABLE_KEY`: Get these from your Supabase Project Settings.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Required by the server for admin transactions and bypassing RLS when necessary.
    *   `GEMINI_API_KEY`: Required by the server to run the AI Assistants and Imagen 3.

4.  **Database Migration Setup:**
    If you are running Supabase locally:
    ```bash
    supabase start
    supabase db reset # This runs all migrations in /supabase/migrations
    ```
    If using a hosted Supabase project, link it using the CLI and apply migrations:
    ```bash
    supabase login
    supabase link --project-ref your-supabase-project-id
    supabase db push
    ```

### 💻 Running the Application

To run both the **Vite client** and the **Express backend server** concurrently in development mode, run:

```bash
npm run dev
```

*   **Client Dashboard:** Usually runs at [http://localhost:5173](http://localhost:5173)
*   **Express API Server:** Usually runs at [http://localhost:3000](http://localhost:3000)

Alternatively, you can run them individually:
*   **Run Client Only:** `npm run dev:client`
*   **Run Server Only:** `npm run dev:server`

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
