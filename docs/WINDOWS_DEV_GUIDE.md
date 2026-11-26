# Deye Solar Monitor V2 — Windows Development Guide

## Prerequisites (Windows 10 / 11)
1. **Node.js 20 LTS+** (`winget install OpenJS.NodeJS.LTS`)
2. **Python 3.12+** (`winget install Python.Python.3.12`)
3. **Git for Windows** (`winget install Git.Git`)

## 1. Clone & Configure Environment
```powershell
git clone <your-repo-url>
cd deye-solar-monitor
Copy-Item .env.example .env
Copy-Item frontend\.env.example frontend\.env
```
Edit `frontend\.env` with your Supabase Project URL and `anon` key.
Edit `.env` with your DeyeCloud credentials and `SUPABASE_SERVICE_ROLE_KEY` (for local collector testing).

## 2. Run the V2 Frontend
```powershell
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. If `frontend\.env` is not configured yet, the app automatically starts in **Demo Mode** with a clear banner.

## 3. Run the Python Collector Locally
```powershell
python -m venv collector\.venv
.\collector\.venv\Scripts\Activate.ps1
pip install -r collector\requirements.txt
python -m collector.main
```

## 4. Run Tests
```powershell
# Collector unit & integration tests
.\collector\.venv\Scripts\pytest collector\tests\test_collector.py -v

# Frontend TypeScript check & production build
cd frontend
npm run build
```
