# Deye Solar Monitor V2 — Zero-Cost Production Deployment Guide

## Free-Tier Architecture (₹0 / month)
| Component | Service | Free-Tier Limits & Notes |
| --- | --- | --- |
| Frontend | Cloudflare Pages | Unlimited bandwidth, 500 builds/mo |
| Database & Auth | Supabase Free Tier | 500 MB PostgreSQL, 50,000 MAUs; pauses after 7 days of zero DB activity (30-min collector keeps it active) |
| Scheduled Collector | GitHub Actions | 2,000 free mins/mo on private repos (unlimited on public repos). At 30-min intervals (~48 runs/day × ~25s = ~600 mins/mo), fits within private repo free tier. |

> **Availability Note:** Free-tier services do not include an SLA or guaranteed 24/7 uptime. GitHub Actions cron schedules may experience slight queuing delays during peak hours.

## Step 1: Supabase Setup
1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and execute in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_retention_and_triggers.sql`
   - `supabase/seed.sql`
3. In **Authentication → Providers**, enable Email/Password.
4. Create up to 5 user accounts (the first user created is automatically assigned `admin`; the next 4 are `viewer`).
5. Copy **Project URL**, **anon public key**, and **service_role secret key** from **Project Settings → API**.

## Step 2: GitHub Actions Collector Setup
1. Push this repository to GitHub.
2. Go to **Settings → Secrets and variables → Actions** and add:
   - `DEYE_BASE_URL` (`https://india-developer.deyecloud.com`)
   - `DEYE_APP_ID`
   - `DEYE_APP_SECRET`
   - `DEYE_EMAIL`
   - `DEYE_PASSWORD`
   - `DEYE_DEVICE_SNS` (`260605A076,260603A1D5,260505A373`)
   - `DEYE_COMPANY_ID` (`0`)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Open **Actions → Collect Deye Solar Telemetry → Run workflow** to verify the first collection run.

## Step 3: Cloudflare Pages Frontend Setup
1. In Cloudflare Dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select your repository and configure:
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Add **Environment Variables** (Production & Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Future pushes to `main` deploy automatically.

## Step 4: Backup & Retention
- Raw 30-minute readings are pruned after 90 days via `SELECT public.cleanup_old_readings(90, 60);` while `daily_energy` and `monthly_energy` summaries are retained indefinitely.
- Users can export filtered historical data to CSV anytime from the **History** page.
