# AssetFlow — Enterprise Asset & Resource Management

A full-stack ERP system built for a hackathon. Manages assets, allocations, bookings, maintenance, audits, and reporting across an organization.

## Stack
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL
- **Auth**: JWT tokens

## Screens (10 total)
1. Login / Sign Up
2. Dashboard — stats, overdue alerts, recent activity
3. Organization Setup (Admin) — departments, categories, employee roles
4. Asset Directory — register, search, filter
5. Allocation & Transfer — conflict detection, transfer requests
6. Resource Booking — time-slot grid with conflict detection
7. Maintenance — 5-column Kanban workflow
8. Audit — cycle checklist, auto-discrepancy flagging
9. Reports & Analytics — charts, idle assets, maintenance alerts
10. Notifications — tabbed alerts with live unread count

## Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Demo Accounts (password: `test123`)
| Role | Email |
|------|-------|
| Admin | admin@co.com |
| Asset Manager | manager@co.com |
| Dept Head | head@co.com |
| Employee | emp@co.com |
