# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Intelligent Event Management System — a multi-platform app for corporate events and tech conferences with AI/ML capabilities. Consists of three sub-projects: a FastAPI backend, a React/Vite frontend, and an Expo React Native mobile app.

---

## Commands

### Backend (from `backend/`)

```bash
source venv/bin/activate              # activate virtualenv first

uvicorn app.main:app --reload         # dev server (port 8000)

pytest                                # run all tests
pytest tests/test_auth.py -v         # run single test file
pytest tests/test_auth.py::test_register_success -v  # run single test function
pytest --cov=app tests/              # with coverage

alembic upgrade head                  # apply migrations
alembic revision --autogenerate -m "description"  # create migration

celery -A app.tasks worker -l info    # background worker
celery -A app.tasks beat -l info      # scheduled task runner

python seed_agenda.py                 # seed agenda data
```

### Frontend (from `frontend/`)

```bash
npm run dev       # dev server (port 5173)
npm run build     # production build
npm run lint      # ESLint
npm run preview   # preview production build
```

### Mobile (from `mobile/teqevent-mobile/`)

```bash
npm start         # Expo Go / emulator
npm run android   # Android emulator
npm run ios       # iOS simulator
npm run lint      # lint
```

---

## Architecture

### Three-layer Backend Pattern

Every domain follows: **Router → Service → Model**

- `app/api/` — FastAPI routers, only handle HTTP (validation, auth deps, response shape)
- `app/services/` — all business logic
- `app/models/` — SQLAlchemy ORM models
- `app/schemas/` — Pydantic request/response models (input validation and serialization)
- `app/core/` — cross-cutting concerns (config, security, dependencies, constants)

### Authentication & Authorization

- JWT (HS256, 30-min expiry) via `Authorization: Bearer <token>`
- Roles: `attendee`, `organizer`, `admin` — a user can hold multiple roles
- FastAPI dependency chain: `get_db()` → `get_current_user()` → `require_organizer()` / `require_admin()`
- Defined in `app/core/dependencies.py` and `app/core/security.py`

### Database

- PostgreSQL 15 via SQLAlchemy 2.0 ORM; migrations via Alembic (`alembic/`)
- All models use soft deletes (`deleted_at` timestamp) — always filter `.filter(Model.deleted_at.is_(None))`
- All models have `created_at` / `updated_at` with `server_default=func.now()`
- Connection pool: size 5, max overflow 10, recycle 300s (`app/db/session.py`)

### Background Jobs

Celery + Redis broker. Workers in `tasks/`:
- `tasks/email.py` — transactional emails (confirmation, cancellation, reminders)
- `tasks/notifications.py` — in-app notifications, waitlist promotion
- `tasks/analytics.py` — event and platform analytics computation

Scheduled (Celery Beat): email reminders hourly, analytics and notification cleanup daily.

### ML/AI

Three models, each with a training script and inference module:
- **Demand forecasting** — predicts ticket sales (`ml/training/train_demand.py`, `ml/inference/demand.py`)
- **Sentiment analysis** — analyzes event reviews (`train_sentiment.py`, `inference/sentiment.py`)
- **Recommendations** — personalized event suggestions (`train_recommender.py`, `inference/recommender.py`)

Models persisted as joblib files in `ml/models/`. Accessed via `app/services/ml.py`.

### Frontend

- React 18 SPA with React Router v6; role-based layouts: `AppLayout`, `OrganizerLayout`, `AdminLayout`
- Auth state via `AuthContext` (`src/context/`)
- API calls centralized in `src/services/` (Axios)
- Vite dev proxy: `/api/*` → `http://localhost:8000` (see `vite.config.js`)

### Mobile

- Expo 54 managed workflow with Expo Router (file-based routing under `app/`)
- Route groups: `(auth)/`, `(attendee)/`, `(organizer)/`, `(admin)/`
- QR scanning via `expo-camera`, credentials via `expo-secure-store`
- TypeScript throughout; dark UI theme enforced in `app.json`

---

## Environment Setup

Both the project root and `backend/` need a `.env` file. See `.env.example` for the full list. Key variables:

```
DATABASE_URL=postgresql://iem_user:iem_password@localhost:5432/iem_db
SECRET_KEY=<32-byte hex>
REDIS_URL=redis://localhost:6379
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD
CORS_ORIGINS='["http://localhost:5173"]'
```

---

## Key Conventions

- **Rate limiting**: `slowapi` applied per-endpoint (e.g., login: 5/min, register: 10/min) — defined in `app/core/limiter.py`
- **Error handling**: Raise `AppError(status_code, message)` from `app/core/exceptions.py`; never raise raw `HTTPException` in services
- **Constants**: Event statuses, registration statuses — always import from `app/core/constants.py`
- **Pagination**: List endpoints return `PaginatedResponse` (defined in schemas)
- **Tests**: Use fixtures from `tests/conftest.py`; test DB is SQLite in-memory; Celery tasks are auto-mocked; helpers like `make_user()`, `make_event()` are available

---

## Domain Features Worth Knowing

- **Waitlist**: Auto-promotes users when capacity opens (Celery task)
- **Promo codes**: Percentage or fixed discount with usage limits (`models/ticket.py`)
- **Event collaborators**: Multiple organizers per event (`EventCollaborator` model)
- **QR tickets**: Generated on registration confirmation, scanned at mobile check-in
- **Notifications**: Custom in-app system with `expires_at` field; cleaned up daily
