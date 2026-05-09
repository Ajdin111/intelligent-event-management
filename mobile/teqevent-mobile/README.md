# TeqEvent Mobile

React Native / Expo mobile app for the TeqEvent Intelligent Event Management System.

## Prerequisites

- Node.js 18+
- Expo Go app installed on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- Both your Mac and phone on the **same Wi-Fi network**

## Setup

### 1. Install dependencies

```bash
cd teqevent-mobile
npm install
```

You'll also need the IBM Plex Sans font package:

```bash
npx expo install @expo-google-fonts/ibm-plex-sans
```

And the module-resolver babel plugin:

```bash
npm install --save-dev babel-plugin-module-resolver
```

### 2. Set your local IP address

Open `src/services/api.ts` and change `BASE_URL` to your machine's local IP:

```bash
# On Mac, run this to find your IP:
ipconfig getifaddr en0
```

Then update the file:
```ts
const BASE_URL = 'http://YOUR_IP_HERE:8000';
```

### 3. Start the backend

Make sure the FastAPI backend is running:

```bash
cd backend
docker compose up   # or however your team runs it
```

### 4. Start the app

```bash
npx expo start
```

Scan the QR code with:
- **iOS**: Camera app
- **Android**: Expo Go app

## Project Structure

```
teqevent-mobile/
├── app/                       # expo-router file-based routing
│   ├── _layout.tsx            # Root layout, fonts, auth guard
│   ├── (auth)/                # Login + Register (no tabs)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (attendee)/            # Attendee tab group
│   │   ├── _layout.tsx        # Bottom tab navigator
│   │   ├── home.tsx
│   │   ├── discover.tsx
│   │   ├── scan.tsx
│   │   ├── tickets.tsx
│   │   └── profile.tsx
│   ├── (organizer)/           # Organizer tab group
│   │   ├── _layout.tsx
│   │   ├── home.tsx
│   │   ├── events.tsx
│   │   ├── scan.tsx
│   │   ├── analytics.tsx
│   │   └── profile.tsx
│   └── (admin)/               # Admin tab group
│       ├── _layout.tsx
│       ├── overview.tsx
│       ├── users.tsx
│       ├── events.tsx
│       └── profile.tsx
├── src/
│   ├── constants/
│   │   └── theme.ts           # Colors, spacing, typography, radius
│   ├── services/
│   │   └── api.ts             # Axios instance + all API functions
│   ├── context/
│   │   └── AuthContext.tsx    # JWT auth state, login/register/logout
│   ├── hooks/                 # Custom hooks (populated in later phases)
│   └── components/
│       └── ui/
│           └── index.tsx      # Screen, Card, Button, Typography, Divider
├── assets/                    # icon.png, splash.png (add your own)
├── app.json
├── babel.config.js
├── tsconfig.json
└── package.json
```

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Foundation — scaffold, tokens, API layer, auth context, nav shell |
| 2 | 🔜 Next | Auth — Login + Register screens |
| 3 | ⏳ | Core Attendee — Home, Discover, Event Detail, My Tickets |
| 4 | ⏳ | QR Check-in — camera, offline queue |
| 5 | ⏳ | Remaining — Profile, Notifications, Organizer, Admin |

## Key Files

| File | Purpose |
|------|---------|
| `src/services/api.ts` | All API calls — change `BASE_URL` to your IP |
| `src/context/AuthContext.tsx` | Login/logout, JWT stored in SecureStore |
| `src/constants/theme.ts` | Design tokens — match the Figma design |
| `src/components/ui/index.tsx` | Reusable components used across all screens |
