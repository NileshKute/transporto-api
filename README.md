# 🚛 Transporto Backend API

Transportation Fleet & Cold Storage Management System

**Stack:** NestJS 10 · TypeScript · Prisma ORM · PostgreSQL · JWT Auth · Swagger

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

---

## How to Run

### 1. Clone & Install

```bash
git clone https://github.com/NileshKute/transporto-backend.git
cd transporto-backend/transporto/transporto-backend
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@127.0.0.1:5432/YOUR_DB?schema=transporto"
JWT_SECRET="transporto-super-secret-jwt-key-2026"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"

# Twilio WhatsApp (optional — for WhatsApp webhook & send)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
```

> Replace `YOUR_USER`, `YOUR_PASSWORD`, `YOUR_DB` with your PostgreSQL credentials.

### 3. Set Up Database

```bash
# Push schema to PostgreSQL (creates all 23 tables)
npx prisma db push

# (Optional) Run migrations instead of db push
npx prisma migrate dev --name init

# Seed with sample Indian transport data
npx ts-node prisma/seed.ts
```

### 4. Start the Server

```bash
# Development (with hot reload)
npm run start:dev

# Production build
npm run build
npm run start
```

Server starts at: **http://localhost:3001**

---

## API Docs

Swagger UI: **http://localhost:3001/api/docs**

---

## Test Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@transporto.in","password":"admin123"}'
```

### Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@transporto.in | admin123 |
| Manager | priya@transporto.in | admin123 |
| Cold Storage Ops | ravi@transporto.in | admin123 |
| Driver | rajesh@transporto.in | driver123 |
| Driver | suresh@transporto.in | driver123 |

---

## API Endpoints

| Module | Base Path | Key Routes |
|--------|-----------|------------|
| Auth | `/api/auth` | `POST /login`, `POST /register`, `GET /me` |
| Dashboard | `/api/dashboard` | `GET /stats`, `GET /recent` |
| Vehicles | `/api/vehicles` | CRUD + `GET /stats` |
| Drivers | `/api/drivers` | CRUD |
| Trips | `/api/trips` | CRUD + `PUT /:id/complete` |
| Fuel | `/api/fuel` | `GET /`, `GET /stats`, `POST /` |
| Maintenance | `/api/maintenance` | CRUD + `GET /due` |
| Emergencies | `/api/emergencies` | List + Report + `PUT /:id/resolve` |
| Insurance | `/api/insurance` | CRUD + `GET /expiring` |
| Cold Storage | `/api/cold-storage` | Units + Alerts + `POST /:id/temperature` |
| Shifts | `/api/shifts` | CRUD + `PUT /:id/start` + `PUT /:id/end` |
| WhatsApp | `/api/whatsapp` | `GET /` + `POST /webhook` (public) |

---

## Project Structure

```
src/
├── auth/               # JWT auth, login, register
├── common/
│   ├── decorators/     # @Roles() decorator
│   └── guards/         # RolesGuard
├── prisma/             # PrismaService (global)
├── modules/
│   ├── dashboard/
│   ├── vehicles/
│   ├── drivers/
│   ├── trips/
│   ├── fuel/
│   ├── maintenance/
│   ├── emergencies/
│   ├── insurance/
│   ├── cold-storage/
│   ├── shifts/
│   └── whatsapp/
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma       # 23 models, 20+ enums
└── seed.ts             # Indian transport sample data
```

---

## Database Schema

23 tables: `users`, `sessions`, `vehicles`, `drivers`, `driver_vehicle_assignments`, `driver_attendance`, `trips`, `trip_expenses`, `fuel_entries`, `fuel_averages`, `maintenance`, `emergencies`, `insurance`, `vehicle_documents`, `cold_storage_units`, `temperature_logs`, `storage_clients`, `cold_storage_alerts`, `shifts`, `whatsapp_messages`, `notifications`, `audit_logs`, `settings`
