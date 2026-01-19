# Auth Test Users & Seeding

For development and TestFlight testing, we utilize a set of pre-defined test accounts. These allow testing of both "Pro" and "Free" plan logic without manual account creation.

## 1. Setup

Ensure you have the Supabase Service Role Key in your local `.env` file (DO NOT COMMIT THIS FILE):

```bash
SUPABASE_SERVICE_ROLE_KEY=your_secret_admin_key
VITE_SUPABASE_URL=your_supabase_url
```

## 2. Seeding Users

To create or reset these users in the Supabase Auth database, run:

```bash
npm run seed:testusers
```

This script is safe to run multiple times (idempotent). It will:
- Create missing users.
- Reset passwords to `trainq1234`.
- Ensure correct metadata (`plan: 'pro' | 'free'`, `is_testflight: true`).

## 3. Test Accounts

**Password for all:** `trainq1234`

### Pro Plan (10 Users)
- `pro01@testflight.trainq`
- ...
- `pro10@testflight.trainq`

### Free Plan (6 Users)
- `free01@testflight.trainq`
- ...
- `free06@testflight.trainq`

## 4. Login Autofill

In Development builds (`npm run dev`) or if `VITE_ENABLE_TEST_USERS=true` is set, a dropdown appears on the Login screen to autofill these credentials.
