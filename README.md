# Biker - On-Demand Delivery & Logistics Platform

Biker is a robust, scalable, and feature-rich on-demand delivery platform designed to connect customers with local bikers for fast and efficient logistics. Built with a modern tech stack (React Native Expo & NestJS), it provides real-time tracking, secure payments, and a seamless user experience.

---

## 🚀 Key Features

### 🛵 For Bikers (The Fleet)
*   **Real-time Dashboard**: View available orders, earnings, and trip history.
*   **Live Navigation**: Integrated GPS tracking and turn-by-turn routing using OSRM.
*   **Flexible Availability**: Easily toggle between "Online" and "Offline" status.
*   **Subscription Model**: Access the platform through a tiered subscription system (Daily, Weekly, Monthly) with a free trial period.

### 👤 For Customers (The Users)
*   **Smart Booking**: Easy-to-use interface to request deliveries, with auto-completion for addresses.
*   **Dynamic Pricing**: Instant fare estimates based on distance, time, and service type.
*   **Live Tracking**: Watch your biker move in real-time from pickup to drop-off.
*   **Multi-Payment Support**: Secure payments via Stripe and PayPal.

### 🛡️ Core Safety & Trust
*   **OTP Verification**: Secure login and delivery confirmation using Supabase Auth.
*   **Trusted Contacts**: Add emergency contacts for safety during trips.
*   **Biker Verification**: Built-in flow for uploading and verifying biker documentation.

---

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Mobile App** | [React Native (Expo)](https://expo.dev/) |
| **Backend API** | [NestJS (Node.js framework)](https://nestjs.com/) |
| **Database** | [PostgreSQL (Supabase Managed)](https://supabase.com/) |
| **Real-time** | [Socket.io](https://socket.io/) (with Redis Adapter) |
| **Authentication** | [Supabase Auth (OTP/Email)](https://supabase.com/auth) |
| **Maps & Routing** | [Google Maps API](https://developers.google.com/maps) & [OSRM](http://project-osrm.org/) |
| **Payments** | [Stripe](https://stripe.com/) & [PayPal](https://www.paypal.com/) |

---

## 📂 Project Structure

The project is organized as a monorepo-style structure for ease of development:

```text
├── biker-app/          # Mobile Application (React Native Expo)
│   ├── src/            # Application logic, screens, and components
│   └── app.json        # Expo configuration
├── biker-backend/      # Backend API (NestJS)
│   ├── src/            # Controllers, Services, Entities (TypeORM)
│   ├── db/             # Database initialization scripts
│   └── src/worker.ts   # Background job processor
└── docker-compose.yml  # Local development for Postgres & Redis
```

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn
*   Expo Go app on your physical device (for mobile testing)

### 1. Backend Setup
1.  Navigate to the backend: `cd biker-backend`
2.  Install dependencies: `npm install`
3.  Configure environment: Copy `.env.example` to `.env` and fill in your keys.
4.  Start development: `npm run start:dev`

### 2. Mobile App Setup
1.  Navigate to the app: `cd biker-app`
2.  Install dependencies: `npm install`
3.  Configure environment: Update `.env` with your API and Supabase URLs.
4.  Start the app: `npx expo start --tunnel` (use `--tunnel` for physical device testing).

---

## 👨‍💻 Author
**Clever M Antonio** ([devmuna2002](https://github.com/devmuna2002))

---

## ⚖️ License
This project is licensed under the [MIT License](LICENSE).
