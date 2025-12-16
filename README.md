# White Label Islamic School Management System

**Version:** 1.0 (FROZEN SPEC)  
**Status:** APPROVED FOR EXECUTION  
**Target:** Small Islamic institutions (<300 students)

## Core Features
- Student Management with Graduation Path Tracking
- Period-wise Academic Attendance
- Masjid Prayer Attendance (5 daily prayers)
- Exam Results & Auto-Grading
- Class Promotions with Dynamic Sections
- White-Label Branding
- Offline-First PWA

## Tech Stack
- **Backend:** Node.js 20 + Express.js + Prisma + PostgreSQL 14
- **Frontend:** React 18 + Vite + TanStack Query + Dexie (IndexedDB)
- **Auth:** Manual JWT + OTP + Token Blacklist
- **Deployment:** Docker Compose

## Setup Instructions
See `/docs/SETUP.md` after Phase B completion.

## Architecture
Refer to: `white_label_school_management_system_architecture_freeze.md`

## Security Notes
- JWT expiry: 1 day (minimize lost device risk)
- Token blacklist enforced on all protected routes
- OTP rate limiting: 3 requests/5min, 5 verifications/10min
