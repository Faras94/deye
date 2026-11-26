# Deye Solar Monitor V2

Production-quality solar monitoring application for 3 Deye microinverters (`260605A076` 2.2 kW, `260603A1D5` 2.2 kW, `260505A373` 1.0 kW — **5.4 kW combined**), supporting up to **5 users** (1 Admin + 4 Viewers) at **₹0/month** on Cloudflare Pages, Supabase, and GitHub Actions.

## Architecture
- **Frontend (`frontend/`)**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Apache ECharts, TanStack Query, React Router, Supabase Auth.
- **Database (`supabase/`)**: PostgreSQL schema with 10 tables, UTC timestamps, deduplication constraints, Row Level Security (RLS), and 90-day raw retention cleanup.
- **Collector (`collector/`)**: Python 3.12+ scheduled script (`requests` + `supabase`) running every 30 minutes via `.github/workflows/collect-data.yml` with token caching and exponential backoff.
- **Legacy V1 Backend (`backend/`)**: Preserved intact for local FastAPI/SQLite development.

## Documentation
- [Windows Development Guide](docs/WINDOWS_DEV_GUIDE.md)
- [Zero-Cost Production Deployment Guide](docs/DEPLOYMENT_GUIDE.md)

## Quick Test Commands
```bash
# Collector tests
collector/.venv/bin/pytest collector/tests/test_collector.py -v

# V1 Backend tests
cd backend && python3 -m pytest -v

# Frontend TypeScript & production build
cd frontend && npm run build
```
