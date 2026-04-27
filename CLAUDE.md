# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack real estate CRM (RABS Connect) with multi-tenant architecture. React 19 frontend + Node.js/Express backend + MySQL databases. Vanilla JavaScript throughout (no TypeScript).

## Repository Layout

```
Frontend/   — React 19 app (Create React App)
Backend/    — Express API server
```

## Commands

### Frontend (run from `Frontend/`)
```bash
npm start          # Dev server (default port 3000)
npm run build      # Production build
npm test           # Run tests (react-scripts test)
```

### Backend (run from `Backend/`)
```bash
npm run dev        # Dev server with nodemon (port 5000)
npm start          # Production server
node utils/seed.js admin admin123 1   # Generate seed SQL for first user
```

### Database
```bash
mysql -u root -p <db_name> < rabsconnect_lite.sql   # Import schema
```

## Architecture

### Multi-Tenant Database Isolation
Each client has its own MySQL database (`rabsconnect_<clientname>`). The frontend sends the database name via `x-client-db` header on every API request. No `company_id` column needed — the database itself is the isolation boundary. Connection pools are cached per-client in `Backend/config/database.js`.

### Authentication Flow
1. Client code verified against external API (`backendcrm.rabs.in.net`)
2. Login returns JWT access token (24h) + refresh token (30d)
3. Tokens stored in localStorage
4. `Frontend/src/utils/api.js` auto-refreshes on 401 responses
5. Token rotation: refresh tokens are revoked after use

### Backend Middleware Chain
Request → `resolveDatabase` (reads `x-client-db`, sets pool) → `authenticate` (JWT verify, loads user) → controller

Key middleware files:
- `Backend/middleware/auth.js` — JWT verification + role/permission checks
- `Backend/middleware/dbResolver.js` — Multi-tenant DB pool resolution

### Frontend State Management
React Context API (no Redux):
- `AuthContext.js` — User session, tokens, permissions
- `CRMContext.js` — Leads, loans, sidebar state, master data
- `ToastContext.js` — Notifications

### API Layer
- `Frontend/src/utils/api.js` — Centralized HTTP client with auth headers and token refresh
- All backend routes under `/api/*` (no versioning)
- `Backend/API_DOCS.md` — Detailed endpoint documentation

### Scheduled Jobs (Backend)
Three cron jobs in `Backend/services/`:
- `followupScheduler.js` — Sends followup reminder notifications
- `attendanceScheduler.js` — Auto punch-out and policy enforcement
- `leadScheduleCron.js` — Lead follow-up automation

### Backend Pattern
- Controllers in `Backend/controllers/` handle request/response
- Models in `Backend/models/` contain raw SQL queries (mysql2/promise, no ORM)
- All model methods accept a `db` pool parameter for multi-tenant support
- Controllers may auto-create tables if missing
- `Backend/utils/response.js` — Standardized API response format

### Frontend Routing
- Route definitions in `Frontend/src/App.js`
- Pages organized by feature in `Frontend/src/pages/`
- Reusable components in `Frontend/src/components/`

### Push Notifications
Firebase Cloud Messaging via:
- `Frontend/src/services/firebase.js` — Client-side FCM setup
- `Backend/config/firebase.js` — Firebase Admin SDK
- `Backend/services/notificationService.js` — Server-side push

## Key Conventions

- Plain CSS (no Tailwind, no CSS-in-JS)
- Lucide React for icons
- Recharts for data visualization
- File uploads stored on disk in `Backend/uploads/` (multer)
- Email via Nodemailer with Gmail SMTP
- Role-based access: Master, Admin, Manager, and custom roles with granular permissions
