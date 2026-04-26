# Intelligent Event Management System

A full-stack web application for managing corporate events and tech conferences, built with FastAPI, React, and PostgreSQL. The system includes AI/ML features such as ticket demand forecasting, event recommendations, and sentiment analysis.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI |
| Frontend | React + Vite |
| Mobile | React Native |
| Database | PostgreSQL 15 |
| Background Jobs | Celery + Redis |
| Containerization | Docker |
| Auth | JWT (JSON Web Tokens) |

---

## Project Structure

```
intelligent-event-management/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py         # Reads .env variables
│   │   │   ├── security.py       # JWT and password hashing
│   │   │   ├── exceptions.py     # Custom error handlers
│   │   │   └── dependencies.py   # get_db, get_current_user
│   │   ├── db/
│   │   │   ├── base.py           # SQLAlchemy Base class
│   │   │   └── session.py        # Database connection
│   │   └── main.py               # FastAPI app entry point
│   ├── venv/                     # Python virtual environment (not pushed to GitHub)
│   ├── requirements.txt          # Python dependencies
│   └── .env                      # Your local environment variables (not pushed to GitHub)
├── frontend/                 # React + Vite frontend (coming soon)
├── mobile/                   # React Native app (coming soon)
├── .env.example              # Template for environment variables
├── .env                      # Your local environment variables (not pushed to GitHub)
└── README.md
```

---

## Prerequisites

Before you start, make sure you have the following installed on your machine:

| Tool | Version | How to check |
|---|---|---|
| Python | 3.11+ | `python3 --version` |
| Node.js | 22+ | `node --version` |
| Git | Any | `git --version` |
| PostgreSQL | 15 | `psql --version` |

---

## Setup Guide

Follow these steps **in order**. Do not skip any step.

---

### Step 1 — Clone the Repository

Open your terminal (Mac) or Command Prompt / Git Bash (Windows) and run:

```bash
git clone https://github.com/Ajdin111/intelligent-event-management.git
cd intelligent-event-management
```

Then switch to the `dev` branch (this is where all active development happens):

```bash
git checkout dev
```

---

### Step 2 — Install Python 3.11

**macOS:**
```bash
brew install python@3.11
```

> If you don't have Homebrew, install it first from https://brew.sh

**Windows:**

1. Go to https://www.python.org/downloads/
2. Download Python 3.11.x
3. During installation, **check the box that says "Add Python to PATH"** — this is important!
4. Click Install

Verify it works:
```bash
python3 --version   # Mac
python --version    # Windows
```

---

### Step 3 — Set Up Python Virtual Environment

A virtual environment is an isolated space for your project's Python packages. This prevents conflicts with other Python projects on your machine.

**macOS:**
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
```

**Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

You will know it's activated when you see `(venv)` at the start of your terminal line.

---

### Step 4 — Install Python Dependencies

With your virtual environment active, install all required packages:

```bash
pip install -r requirements.txt
```

This installs everything listed in `requirements.txt` — FastAPI, SQLAlchemy, Alembic, Celery, and more.

---

### Step 5 — Install and Start PostgreSQL

PostgreSQL is the database your app will use to store all data.

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**

1. Go to https://www.postgresql.org/download/windows/
2. Download the installer for PostgreSQL 15
3. Run the installer — remember the password you set for the `postgres` user
4. After installation, PostgreSQL starts automatically as a service

---

### Step 6 — Create the Database

**macOS:**
```bash
psql postgres -c "CREATE DATABASE iem_db;"
psql postgres -c "CREATE USER iem_user WITH PASSWORD 'iem_password';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE iem_db TO iem_user;"
```

**Windows (run in Command Prompt as Administrator):**
```bash
psql -U postgres -c "CREATE DATABASE iem_db;"
psql -U postgres -c "CREATE USER iem_user WITH PASSWORD 'iem_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE iem_db TO iem_user;"
```

> Windows users: if `psql` is not recognized, find it in `C:\Program Files\PostgreSQL\15\bin\psql.exe` and add it to your PATH, or just run the commands from that folder.

---

### Step 7 — Set Up Environment Variables

The `.env` file contains sensitive configuration like database credentials and secret keys. It is **never pushed to GitHub** for security reasons — you need to create it yourself.

First, generate a secret key for JWT tokens:

**macOS:**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Windows:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output — you will need it in the next step.

Now create the `.env` file in the **root** of the project AND inside the **backend/** folder (you need both):

```bash
# From the root of the project
cp .env.example .env
cp .env.example backend/.env
```

Open both `.env` files and fill them in like this:

```
# Database
DATABASE_URL=postgresql://iem_user:iem_password@localhost:5432/iem_db

# JWT
SECRET_KEY=paste_your_generated_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Redis
REDIS_URL=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

# App
APP_ENV=development
DEBUG=True
```

> Replace `paste_your_generated_key_here` with the key you generated above.

---

### Step 8 — Run the Backend

Make sure you are in the `backend/` folder and your virtual environment is active:

**macOS:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Windows:**
```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

You should see:
```
INFO: Uvicorn running on http://127.0.0.1:8000
INFO: Application startup complete.
```

Open your browser and go to:
- http://127.0.0.1:8000 — API root
- http://127.0.0.1:8000/docs — Interactive API documentation

---

## Branch Strategy

We follow a strict branching workflow:

```
main          ← production-ready code only
dev           ← active development, all PRs merge here
feature/xxx   ← your working branch for each feature
```

**Never push directly to `main` or `dev`.** Always create a feature branch:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name
```

When done, push and open a Pull Request into `dev`. At least 1 team member must approve before merging.

---

## Commit Message Format

We link commits to Jira tickets automatically. Always include the ticket ID:

```bash
git commit -m "SCRUM-5: Add user registration endpoint"
```

---

## Project Management

We use Jira for sprint planning and task tracking:
- Workspace: https://tarikskaljic01.atlassian.net
- All tasks are assigned to team members
- Move your ticket to **In Progress** when you start working on it
- Move it to **Done** when your PR is merged

---





## Common Issues

**`uvicorn: command not found`**
Your virtual environment is not activated. Run `source venv/bin/activate` (Mac) or `venv\Scripts\activate` (Windows) first.

**`ValidationError: DATABASE_URL field required`**
Your `.env` file is missing or in the wrong location. Make sure you have `.env` inside the `backend/` folder.

**`psql: command not found` (Windows)**
Add PostgreSQL's bin folder to your PATH or navigate to `C:\Program Files\PostgreSQL\15\bin\` and run commands from there.

**`could not connect to server` (PostgreSQL)**
PostgreSQL is not running. Start it with `brew services start postgresql@15` (Mac) or start the PostgreSQL service from Windows Services.