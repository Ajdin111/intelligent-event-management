# TeqEvent

An event management platform for corporate events and tech conferences. Organizers create and run events end to end; attendees discover them, register, get a QR ticket, check in at the door, and leave feedback afterward. On top of the usual CRUD, it does demand forecasting, event recommendations, and review sentiment analysis with a real scikit-learn pipeline that retrains on a schedule.

It's a full-stack project: a FastAPI backend, a React web app, and a React Native (Expo) mobile app that does the QR scanning. Postgres for data, Redis + Celery for background work and scheduled jobs.

This started as a university project, but the architecture and tooling are meant to hold up like a real product would.

---

## Table of contents

- [What's inside](#whats-inside)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Quick start (Docker)](#quick-start-docker)
- [Manual setup](#manual-setup-without-docker)
- [Running the web app](#running-the-web-app)
- [Running the mobile app](#running-the-mobile-app)
- [Environment variables](#environment-variables)
- [The API](#the-api)
- [Background jobs](#background-jobs-celery)
- [The ML side](#the-ml-side)
- [Database & migrations](#database--migrations)
- [Tests](#tests)
- [Project layout](#project-layout)
- [Git workflow](#git-workflow)
- [Team](#team)

---

## What's inside

| Module | What it does |
| --- | --- |
| Auth & users | Email/password signup, JWT login, profile editing, password change, account soft-delete, self-upgrade to organizer |
| Events | Full lifecycle — draft → published → closed/cancelled, physical/online/hybrid, capacity, soft delete, collaborators |
| Agenda | Tracks, sessions, speakers, per-session registration |
| Ticketing | Tiers with pricing and quantity, promo codes (percentage/fixed), QR-coded tickets, guest tickets |
| Registration | Automatic, manual-approval, and invite-only flows, plus a waitlist with confirmation deadlines |
| Check-in | QR scanning from the mobile app, manual check-in fallback, offline scan queue |
| Notifications | In-app + email, per-user preferences, scheduled event reminders |
| Reviews | One post-event review per user, editable, with automatic sentiment tagging |
| Admin | User management, platform-wide analytics, event oversight |
| ML | Demand forecasting, recommendations, sentiment analysis — trained, cached, and served behind the API |

The backend exposes **95 endpoints across 14 modules**. Full interactive docs at `/docs` when the app runs in debug.

---

## Tech stack

**Backend** — FastAPI · SQLAlchemy 2.0 · Alembic · Pydantic v2 · PostgreSQL 15 · Redis · Celery · python-jose (JWT) · passlib/bcrypt · slowapi (rate limiting) · scikit-learn / pandas / numpy

**Web** — React 18 · Vite · React Router · Axios

**Mobile** — React Native · Expo (SDK 54) · expo-router · expo-camera (QR) · expo-secure-store

**Infra** — Docker Compose · Flower (Celery monitoring)

---

## Architecture

It's a modular monolith. One FastAPI app, but split into clear layers so the modules don't bleed into each other:

```
request → api/ (routers, thin)
            → services/ (business logic, the rules live here)
              → models/ (SQLAlchemy ORM)
              → schemas/ (Pydantic in/out)
```

Route handlers stay thin — they validate input, call a service, return a schema. Anything that takes real work (registering for an event, cancelling and rolling the waitlist forward, issuing a ticket) lives in `services/`. Slow or scheduled work (emails, analytics rollups, ML retraining) gets handed to Celery so the request can return immediately.

The whole thing runs as six containers in development: Postgres, Redis, the API, a Celery worker, a Celery beat scheduler, and the Vite dev server for the web app.

---

## Quick start (Docker)

This is the easiest path. You get the database, Redis, the API, both Celery processes, and the web app with one command. You only need Docker installed.

**1. Clone and enter the repo**

```bash
git clone https://github.com/Ajdin111/intelligent-event-management.git
cd intelligent-event-management
```

**2. Create the Docker env file**

```bash
cp .env.docker.example .env.docker
```

Open `.env.docker` and set `SECRET_KEY` to any long random string. The database and Redis URLs already point at the Docker containers — leave those alone. Email is optional; fill in `SMTP_USER` / `SMTP_PASSWORD` later if you want real emails to send (use a Gmail App Password, not your account password).

**3. Bring it up**

```bash
docker compose up --build
```

First run takes a few minutes to build images. The backend container runs `alembic upgrade head` automatically before starting, so the database schema is created for you.

**4. You're up**

| Service | URL |
| --- | --- |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Web app | http://localhost:5173 |

Postgres is exposed on host port **5433** and Redis on **6380** (shifted off the defaults so they don't clash with anything you already run locally).

To stop: `Ctrl+C`, then `docker compose down`. Add `-v` if you want to wipe the database volume and start clean.

---

## Manual setup (without Docker)

If you'd rather run things directly on your machine — useful when you're iterating fast on the backend.

**Prerequisites:** Python 3.12+, PostgreSQL 15, Redis, Node 20+.

**1. Start Postgres and Redis**

```bash
brew services start postgresql@15
brew services start redis
redis-cli ping   # should print PONG
```

**2. Create the database**

```bash
psql postgres
```

```sql
CREATE DATABASE event_management;
\q
```

**3. Create the root `.env`**

The backend reads `../.env` relative to itself, so this file goes in the **project root**, not inside `backend/`.

```bash
cp .env.example .env
```

Fill it in (replace `YOUR_USERNAME` with your machine's Postgres user — on a default Homebrew install that's your Mac username):

```
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/event_management
SECRET_KEY=some-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REDIS_URL=redis://localhost:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
APP_ENV=development
DEBUG=True
```

**4. Install backend dependencies**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**5. Run migrations**

```bash
alembic upgrade head
```

You should see it apply through to the latest revision. Confirm the tables exist:

```bash
psql YOUR_USERNAME -d event_management -c "\dt"
```

**6. Start the API**

```bash
uvicorn app.main:app --reload
```

API at http://localhost:8000, docs at http://localhost:8000/docs.

**7. Start Celery (separate terminals, venv active)**

```bash
celery -A app.core.celery_app.celery_app worker --loglevel=info
celery -A app.core.celery_app.celery_app beat --loglevel=info
```

The worker handles jobs; beat fires the scheduled ones. You can skip both if you only need the API and don't care about emails or analytics rollups while developing.

---

## Running the web app

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173. It talks to the backend at `http://localhost:8000` (Vite also proxies `/api`), so have the API running first.

Heads up: the web app currently ships with placeholder data in `src/data/` for screens that aren't wired to the API yet. That's intentional for now — the UI was built from the Figma design ahead of full integration.

---

## Running the mobile app

The mobile app is what scans QR tickets at check-in. It needs the backend reachable over your network.

```bash
cd mobile/teqevent-mobile
npm install
cp .env.example .env
```

Edit `.env` and point `EXPO_PUBLIC_API_URL` at your machine's backend. Which address depends on where you're running it:

- **iOS simulator** → `http://localhost:8000`
- **Android emulator** → `http://10.0.2.2:8000`
- **Physical phone** → `http://YOUR_LAN_IP:8000` (find it with `ipconfig getifaddr en0` on macOS)

Then:

```bash
npm start
```

Scan the QR code Expo prints with the Expo Go app on your phone, or press `i` / `a` for a simulator. The camera-based ticket scanner only works on a real device or a simulator with a camera.

---

## Environment variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | backend | Postgres connection string |
| `SECRET_KEY` | backend | Signs JWTs — make it long and random |
| `ALGORITHM` | backend | JWT algorithm, default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | backend | Token lifetime, default 30 |
| `REDIS_URL` | backend / celery | Broker + result backend |
| `SMTP_HOST` / `SMTP_PORT` | celery | Email server (Gmail works) |
| `SMTP_USER` / `SMTP_PASSWORD` | celery | Use a Gmail App Password, leave blank to disable email |
| `APP_ENV` | backend | `development` / `production` |
| `DEBUG` | backend | When true, exposes `/docs` and `/redoc` |
| `UPLOAD_DIR` | backend | Where uploaded images land, default `uploads` |
| `MAX_IMAGE_SIZE_MB` | backend | Upload size cap, default 5 |
| `CORS_ORIGINS` | backend | JSON list of allowed origins |
| `EXPO_PUBLIC_API_URL` | mobile | Backend URL the phone app calls |

Never commit `.env`, `.env.docker`, or the mobile `.env` — they're all gitignored.

---

## The API

Every route lives under `/api/...`. A taste of the auth module:

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account (starts as an attendee) |
| POST | `/api/auth/login` | Exchange credentials for a JWT |
| GET | `/api/auth/me` | Current user from the token |
| PATCH | `/api/auth/me` | Update your profile |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/upgrade-to-organizer` | Add the organizer role to yourself |
| DELETE | `/api/auth/me` | Soft-delete your account |

The other 13 modules (`events`, `agenda`, `tickets`, `registrations`, `checkin`, `reviews`, `notifications`, `collaborators`, `invites`, `categories`, `admin`, `ml`, `uploads`) follow the same shape. Rather than list all 95 here, just run the app and open **http://localhost:8000/docs** — it's the live, always-correct reference, and you can authorize with a token and call endpoints right from the page.

Auth is a bearer JWT: log in, take the `access_token`, send it as `Authorization: Bearer <token>`. Rate limiting is on (via slowapi), and there's request-timing logging on every call.

---

## Background jobs (Celery)

Anything that shouldn't block a request runs on a Celery worker. A beat scheduler also fires recurring jobs:

| Job | Runs |
| --- | --- |
| Clean up expired notifications | daily |
| Send upcoming event reminders | hourly |
| Compute platform analytics | daily |
| Regenerate recommendations | every 6 hours |
| Recompute demand forecasts | daily |
| Check whether models need retraining | daily |
| Full model retrain | weekly |

Email sending and review sentiment tagging also run as tasks, triggered by user actions rather than the clock.

Want to watch the queue? Flower is included:

```bash
celery -A app.core.celery_app.celery_app flower
```

---

## The ML side

The ML isn't a stub — there's a full pipeline under `backend/ml/`:

```
ml/
├── seed/          # generate synthetic training data
├── training/      # train demand, recommender, sentiment models
├── inference/     # load cached models, expose predict()
├── pipeline/      # evaluate + retrain orchestration
└── models/        # trained .pkl files land here
```

Three models:

- **Demand forecasting** — predicts ticket demand and a likely sell-out date per tier, even suggests pricing.
- **Recommendations** — scores events per user (based on their history, category popularity, similar events).
- **Sentiment** — tags each review positive/neutral/negative; runs automatically when a review is submitted.

Models are trained offline and saved as `.pkl` files, then loaded once per worker process and cached in memory — so inference during a request is cheap. Beat keeps them fresh on the retrain schedule above.

To train them yourself (from `backend/`, venv active):

```bash
python -m ml.seed.seed_data            # generate training data first
python -m ml.training.train_sentiment
python -m ml.training.train_demand
python -m ml.training.train_recommender
```

---

## Database & migrations

28 tables across the 11 modules, third-normal-form, foreign keys enforcing every relationship. A few decisions worth knowing:

- **Soft deletes** on users and events (`deleted_at`) — history matters, especially after an event has happened.
- **Pre-computed analytics** — dashboards read from stored rollup tables instead of aggregating on every page load.
- **Guest tickets** — a buyer can hand a ticket to someone who isn't a registered user, with just a name and email.
- **Offline check-in queue** — scans made while a device is offline get queued and reconciled later.

Schema changes go through Alembic. When you change a model:

```bash
alembic revision --autogenerate -m "what changed"
alembic upgrade head
```

Commit the generated migration file alongside the model change. After pulling someone else's migrations, run `alembic upgrade head` to catch up. Don't edit a migration once it's been pushed — write a new one.

---

## Tests

The backend has a real test suite (19 files, one per module) running against an in-memory SQLite database, so tests are fast and don't touch your real Postgres.

```bash
cd backend
source venv/bin/activate
pytest
```

Run one module:

```bash
pytest tests/test_registration.py
```

---

## Project layout

```
intelligent-event-management/
├── backend/
│   ├── app/
│   │   ├── api/          # routers (one per module)
│   │   ├── services/     # business logic
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── tasks/        # Celery tasks
│   │   ├── core/         # config, security, deps, celery, limiter
│   │   ├── db/           # engine + session + base
│   │   └── main.py       # app entry, router registration
│   ├── alembic/          # migrations
│   ├── ml/               # ML pipeline (seed/train/inference)
│   ├── tests/            # pytest suite
│   ├── uploads/          # uploaded images (gitignored)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/             # React + Vite web app
│   └── Dockerfile
├── mobile/teqevent-mobile/   # Expo / React Native app
├── docker-compose.yml
├── .env.example
└── .env.docker.example
```

---

## Git workflow

`main` is stable and demo-ready. `dev` is the integration branch — everything lands there first. Real work happens on feature branches off `dev`.

```bash
git checkout dev
git pull origin dev
git checkout -b feature/your-task

# ... work ...

git add .
git commit -m "Short description of the change"
git push origin feature/your-task
```

Then open a PR with the base set to **`dev`** (never `main`), and get one teammate to review before merging. Both branches are protected, so a PR with an approval is the only way in.

---

## Team

- Ajdin Mujkanovic
- Mehmedalija Bikic
- Tarik Skaljic
- Ahmed Okic
- Hamza Jasarevic
