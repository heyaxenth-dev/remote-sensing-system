# Remote sensing system

**Remote Sensing-Based Reforestation Monitoring and Management System** for DENR-CENRO Culasi — mobile field data collection, a centralized geospatial repository, and location analytics for reforestation plots.

### Study objectives (system alignment)

| Objective | Implementation |
|-----------|----------------|
| Mobile data acquisition (GPS, imagery, plots) | `app/(tabs)/capture.jsx` — live GPS via `expo-location`, plot picker, grid cells, camera + Supabase sync |
| Centralized geospatial repository | `reforestation_plots` + `monitoring_submissions` in Supabase; admin **Location analytics** (GeoJSON export, interactive map) and **Data verification** |
| Location analytics dashboard | Admin **KPI automation** — survival rates, health trends, plot comparison, interactive map from field data |

**Roles:** set `profiles.role` to `forest_ranger`, `planning_officer`, or `admin` (mobile home shows role label). After pulling schema changes, run migrations in `supabase/migrations/` in the SQL Editor.

**PENRO NGP reference (data accuracy):** Field captures are scored against `data/ngp-penro-reference.json` (imported from the PENRO compliance workbook). Import sites into Supabase:

```bash
npm run import:ngp-sites   # requires SUPABASE_SERVICE_ROLE_KEY in .env
```

Accuracy checks: NGP site code, GPS vs reference, GPS precision, species vs contract, stocking vs contracted density. Survival KPIs compare field progress to each site’s **latest survival rate** from the PENRO database.

---

Monorepo for remote sensing / monitoring:

| Module | Path | Stack |
|--------|------|--------|
| **Mobile app** | Repository root | Expo (React Native), Expo Router |
| **Admin dashboard** | `admin/` | Vite, React, Tailwind |
| **Analysis API** (optional) | `analysis/` | FastAPI, Uvicorn |

Supabase is shared by the mobile app and the admin UI. Open-Meteo is used for weather (no API key by default).

---

## Full system setup

Follow these steps once per machine so every part of the system has its dependencies and configuration.

### Prerequisites

- **Node.js** 20 LTS or newer (Expo SDK 54 and Vite 6 expect a current Node release).
- **npm** (comes with Node).
- **Python 3.10+** only if you run the analysis server or `npm run test:analysis`.
- A **Supabase** project: project URL, **anon** key, and **service role** key (for seeding only).

### 1. Environment files

1. In the **repository root**, copy the template and fill in Supabase values for the mobile app:

   ```bash
   cp .env.example .env
   ```

   Required for the Expo app:

   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

   Optional (see `.env.example`):

   - `EXPO_PUBLIC_ANALYZE_API_URL` — point at your analysis API (e.g. `http://127.0.0.1:8000`) when not using on-device analysis.
   - `EXPO_PUBLIC_OPEN_METEO_FORECAST_URL` — override Open-Meteo forecast endpoint if needed.
   - `SUPABASE_SERVICE_ROLE_KEY` — only for `npm run seed:demo-client` (never expose in client apps).

2. **Admin app:** Vite only reads variables prefixed with `VITE_`. Create `admin/.env` with the **same** Supabase project as the mobile app:

   ```bash
   cd admin
   cp ../.env.example .env
   ```

   Then set at least:

   - `VITE_SUPABASE_URL` (same value as `EXPO_PUBLIC_SUPABASE_URL`)
   - `VITE_SUPABASE_ANON_KEY` (same value as `EXPO_PUBLIC_SUPABASE_ANON_KEY`)

   Remove or ignore Expo-only keys in `admin/.env` if you prefer a minimal file; only `VITE_*` entries are used there.

### 2. Install JavaScript dependencies

**Mobile (root):**

```bash
npm install
```

**Admin dashboard:**

```bash
cd admin
npm install
cd ..
```

Each package tree is independent (`package-lock.json` at root and under `admin/`).

### 3. Supabase schema and optional demo user

1. In the Supabase dashboard, open **SQL Editor** and run `supabase/schema.sql` (monitoring tables such as `reforestation_plots`, `monitoring_submissions`, `seedling_progress`, etc.).

2. To create the demo client user, set `SUPABASE_SERVICE_ROLE_KEY` in the root `.env`, then from the **repository root**:

   ```bash
   npm run seed:demo-client
   ```

   Default demo credentials:

   - Email: `clientdemo@denr-cenro.local`
   - Password: `ClientDemo123!`

### 4. Python analysis API (optional)

Used for remote scene analysis when `EXPO_PUBLIC_ANALYZE_API_URL` is set. If it is unset, the mobile app uses on-device heuristics.

```bash
cd analysis
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

Start the server from the **repository root**:

```bash
npm run analyze-server
```

Dependencies are listed in `analysis/requirements.txt` (FastAPI, Uvicorn, Pillow, Pydantic). Optional env for the Python side: `OPEN_METEO_FORECAST_URL` (see `.env.example`).

### 5. Run the apps

| What | Command | From |
|------|---------|------|
| Mobile (Expo) | `npx expo start` | Repository root |
| Admin UI | `npm run dev` | `admin/` |
| Analysis API | `npm run analyze-server` | Repository root (after Python venv + `pip install`) |

---

## Quick start (mobile only)

If you only need the Expo app and already have root `.env` configured:

```bash
npm install
npx expo start
```

Use the Expo CLI output to open Android emulator, iOS simulator, Expo Go, or web.

This project uses [file-based routing](https://docs.expo.dev/router/introduction) under the `app` directory.

## Weather and recommendations

- **Dashboard and GrowCalendar-style scoring** use [Open-Meteo](https://open-meteo.com/) (free tier, no API key by default). Override with `EXPO_PUBLIC_OPEN_METEO_FORECAST_URL` (Expo) or `OPEN_METEO_FORECAST_URL` (Python analyzer) if you proxy or self-host.

## Tests

Analysis unit tests (Python):

```bash
npm run test:analysis
```

## Fresh Expo scaffold

When you want to reset the starter layout:

```bash
npm run reset-project
```

This moves starter code to **app-example** and creates a blank **app** directory.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo on GitHub](https://github.com/expo/expo)
- [Discord community](https://chat.expo.dev)
