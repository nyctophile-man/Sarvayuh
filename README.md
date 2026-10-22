# SARVAYUH

SARVAYUH is an Expo/React Native mobile app with a Node.js/Express API. Follow
the quick start below to run the backend and frontend locally.

```
sarvayuh-mobile/
├── app/                  # Expo Router screens
├── lib/api.ts            # API client -> backend (JWT auth)
├── backend/
│   ├── api-gateway/      # Express server + middleware (JWT, roles, kiosk key, audit)
│   ├── infrastructure/   # postgresql, redis, queue, encrypted-storage, docker-compose.yml
│   ├── modules/          # auth, profile, records, sharing-consent, medcard, prescriptions, pharmacy-medatm, ai-service, feedback
│   ├── sarvayuh-chatbot.ts  # SARVAYUH AI chatbot (TypeScript, compiled to dist/)
│   ├── tsconfig.json     # backend TypeScript build
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
```

## Quick start (Windows / PowerShell)

### 1. Start the backend

Make sure Docker Desktop is running. In a terminal from the project root:

```powershell
cd backend
Copy-Item .env.example .env
```

Open `backend/.env` and set `FILE_KEY` to a 64-character hexadecimal value.
You can generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then start the API, PostgreSQL, and Redis:

```powershell
npm install
npm run infra
```

Wait for the Docker services to start, then check the API at
`http://localhost:4000/health` (it should return `{"ok":true}`). Keep this
terminal available. `npm run infra` runs the API in Docker, so do not also run
`npm run dev`.

### 2. Start the frontend

Open a second terminal in the project root (the folder containing the root
`package.json`) and run:

```powershell
npm install
npx expo start
```

Use the Expo terminal's options to open the app in a browser or Android
emulator, or scan its QR code with Expo Go. The app uses
`http://10.0.2.2:4000` for an Android emulator and `http://localhost:4000` for
web and iOS simulators.

For Expo Go on a physical phone, the phone and computer must be on the same
network. Set the computer's LAN IP in the same PowerShell window before
starting Expo (replace the example IP):

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.25:4000"
npx expo start
```

`EXPO_PUBLIC_API_URL` overrides the platform default and is read by `lib/api.ts`.

### Stop the backend

From the `backend` folder, stop the containers while keeping the database data:

```powershell
docker compose -f infrastructure/docker-compose.yml down
```

To start the backend again, run `npm run infra` from `backend`. Do not add
`-v` to the `down` command unless you intend to delete the database volume.

## Other backend options

To run the notification worker, open another terminal in `backend` and run
`npm run worker`.

To run the API directly instead of in Docker, start PostgreSQL 16 and Redis 7
locally, configure their URLs in `backend/.env`, and run `npm run dev` from
`backend`. Do not run this alongside the Docker API.

## Test flow (end to end)

1. Backend up (`npm run infra` for Docker, or run the API locally with `npm run dev`).
2. App: `/onboarding` → `/terms` → `/signup` (POST `/auth/signup`, JWT stored) → `/profile-setup` (PUT `/profile`, optional POST `/profile/photo`) → `/home`.
3. `/records`: list from `GET /records`, upload PDF/JPG/PNG (`POST /records`, multipart, max 10 MB, encrypted at rest), download file, delete (`DELETE /records/:id`), export JSON/CSV/text, and share via QR (a 10-minute `POST /shares` link that anyone can scan and download from).
4. `/medcard`: `GET /medcard`, issue 2-min single-use QR (`POST /medcard/qr`, Redis TTL), lock/unlock (`PATCH /medcard/lock`).
5. `/ai`: the SARVAYUH AI chatbot. `GET /ai/init` gives the greeting and quick replies, `POST /ai/chat` takes `{ sessionId?, message }` and returns `{ sessionId, messages[], quickReplies[], actions[], flags, disclaimer }`. Emergency and self-harm messages are caught before anything else and answer with a "Call 112" action; prescription-only drugs and dosing questions are refused; a symptom opens a short safety question flow (age, pregnancy, conditions, duration) before any advice. Session state lives in Redis (30 min), so the flow survives restarts. Free-form questions go to Anthropic only when `ANTHROPIC_API_KEY` is set, and the answer is screened before it is shown.
6. `/profile`: `GET /profile`, sign out clears the token → `/login`.
7. Password reset: `/login` → "Forgot password?" → `/forgot` → `/reset-password` (POST `/auth/forgot-password` then `/auth/reset-password`).
8. App feedback (on Home): POST `/feedback`; if the API is unreachable the entry is queued on the device.

Roles: `patient`, `doctor`, `pharmacist`. Kiosk (MedATM) routes use the `x-kiosk-key` header.

## Backend endpoints

| Method | Path | Who |
|---|---|---|
| POST | /auth/signup, /auth/login | public |
| POST | /auth/forgot-password | public (always replies the same, no user probing) |
| POST | /auth/reset-password | public (15 min single-use token) |
| GET / PUT | /profile | any / patient |
| POST | /profile/photo | patient (multipart, JPG/PNG/WEBP, max 5 MB, encrypted at rest) |
| GET | /profile/photo | any (streams your own avatar) |
| GET / POST | /records | patient; GET ?patientId= shared records |
| GET | /records/:id/file | owner / active share |
| DELETE | /records/:id | owner (also removes the encrypted file) |
| POST / GET / DELETE | /shares | patient |
| GET | /shares/public/:token | public (QR share link, no login, expires) |
| GET | /shares/public/:token/file/:recordId | public (file behind a share link) |
| GET | /medcard | patient |
| POST | /medcard/qr | patient (2 min, single-use) |
| PATCH | /medcard/lock | patient |
| POST / GET | /prescriptions | doctor / patient |
| POST | /medatm/scan, /medatm/orders | kiosk (x-kiosk-key) |
| GET | /medatm/orders/:id | kiosk |
| GET / POST | /orders/:id/approve | /medatm/orders | pharmacist |
| POST | /ai/chat | patient (chatbot: safety checks, symptom flow, record/prescription answers) |
| GET | /ai/init | patient (greeting, quick replies, disclaimer) |
| POST | /feedback | any (app feedback, 1-5 stars) |
| GET | /feedback | any (your own feedback) |

`GET /health` returns `{ ok: true }`.

`DEV_RESET_TOKEN=true` (see `backend/.env.example`) makes `/auth/forgot-password`
return the reset token in the response so the flow can be tested without email.
Set it to `false` in production, where the token is only delivered by mail/SMS.

## Troubleshooting

**"The development server returned response error code: 500" / "Failed to download
remote update"** — Metro cached a module resolution that is now stale (usually
after `npm install` or `npx expo install --fix` swapped `node_modules` while the
dev server was running). Restart the dev server with a cleared cache:

```powershell
npx expo start --clear
```

A plain restart is not enough: the poisoned entry lives in the Metro cache.

**"Unable to resolve module expo-modules-core"** — same cause. `expo-modules-core`
must be present in `node_modules`; if it is, clear the cache rather than
reinstalling.

**API calls fail on Android** — the app talks to `http://10.0.2.2:4000` on an
emulator and `http://localhost:4000` elsewhere. For a physical device set
`EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000` before starting Expo.

## Docker commands

```bash
cd backend
docker compose -f infrastructure/docker-compose.yml up -d      # postgres + redis + api
docker compose -f infrastructure/docker-compose.yml logs -f api
docker compose -f infrastructure/docker-compose.yml down
```

The `api` container uses `backend/Dockerfile` and depends on healthy postgres/redis. It runs migrations on startup.

## Details

- `backend/README.md` — folder structure, endpoint flow, remaining work.
- Secrets: `backend/.env.example` → `backend/.env` (never commit `.env`; `.env*.local` is gitignored).

## Code quality

```powershell
npx tsc --noEmit              # app type check (must be clean)
npx eslint .                  # lint (0 errors; `npx expo lint` also works)
npm run typecheck --prefix backend   # backend type check
npm run build --prefix backend       # compile backend/sarvayuh-chatbot.ts -> backend/dist/
```

The backend chatbot is TypeScript and is compiled to `backend/dist/` by `npm run build`
(`npm start` and `npm run dev` build it first; the Docker image builds it in a separate
stage so TypeScript never ships in the runtime image). `backend/dist/` is gitignored.

`eslint.config.js` extends `eslint-config-expo` and adds Node.js globals for
`backend/**/*.js`. The React Compiler rules (`react-hooks/refs`,
`react-hooks/purity`, `react-hooks/set-state-in-effect`) are warnings here:
the compiler is not enabled in this project and they flag standard React Native
idioms such as `Animated.Value` refs, `PanResponder` gestures and mount-time
data fetching.
#   S a r v a y u h  
 #   S a r v a y u h  
 