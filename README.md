# PUB Bus Track — GPS + SIM + MongoDB

A full university bus tracking system using a dedicated GPS/GSM device installed on each bus. The device has its own SIM/mobile data connection and sends coordinates to a Node.js + Express API. MongoDB stores the live position and GPS history. Authenticated students, teachers, drivers and admins can use the web app.

## Architecture

```text
GPS/GSM device installed in bus
        |
        | SIM/mobile internet
        v
HTTPS POST /api/device/gps
        |
        v
Node.js + Express
        |
        +----> MongoDB: buses
        +----> MongoDB: trips
        +----> MongoDB: gpspoints
        |
        v
Authenticated React web app
        |
        +---- Student / Teacher: Live Map
        +---- Driver: trip controls
        +---- Admin: fleet, routes, buses, issues, configuration
```

## GPS device API

### POST /api/device/gps

Headers:

```text
Content-Type: application/json
```

Body:

```json
{
  "device_id": "GPS-PUB-01",
  "device_token": "YOUR_DEVICE_TOKEN",
  "latitude": 24.9223067,
  "longitude": 89.3490259,
  "speed_kmh": 32.5,
  "bearing": 90,
  "accuracy_m": 8,
  "satellites": 9,
  "device_time": "2026-09-29T08:00:00.000Z"
}
```

When the device is authenticated and its bus has a route, the server automatically creates an active trip if one does not exist, updates the latest bus position, and stores the GPS point in MongoDB.

### POST /api/device/heartbeat

```json
{
  "device_id": "GPS-PUB-01",
  "device_token": "YOUR_DEVICE_TOKEN"
}
```

Use heartbeat when the device has mobile internet but does not have a new GPS fix.

## Email verification

New users must verify their email with a 6-digit code before login.

Flow:

```text
Sign Up
  -> MongoDB user created as email_verified=false
  -> 6-digit code generated
  -> code sent to user's email
  -> /verify-email
  -> code verified
  -> email_verified=true
  -> JWT session issued
  -> dashboard
```

The project uses the Resend HTTP API so no SMTP library is required.

Backend `.env`:

```env
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=PUB Bus Track <no-reply@your-verified-domain.com>
```

For a real deployment, verify your sending domain in Resend and use that domain in `EMAIL_FROM`.

If `RESEND_API_KEY` is empty during local development, the server logs the verification code in the backend terminal so development can continue without crashing. Production requires a real email provider.

## Local setup

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` from `.env.example` and set at least:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/pub_bus_track
JWT_SECRET=replace_with_a_long_random_secret
PORT=5000
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
RESEND_API_KEY=
EMAIL_FROM=PUB Bus Track <onboarding@resend.dev>
```

Then:

```bash
npm run seed
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Optional frontend environment:

```env
VITE_API_URL=http://localhost:5000/api
```

## Seeded GPS devices

The seed creates 10 buses with device IDs such as:

```text
GPS-PUB-01
GPS-PUB-02
...
GPS-PUB-10
```

Secure device tokens are generated during seeding and printed once in the backend terminal. Store the token in the physical device configuration. Do not expose it in the frontend or GitHub.

## GPS simulator

To test without hardware:

```bash
cd backend
npm run simulate:gps
```

Or:

```powershell
$env:DEVICE_ID="GPS-PUB-01"
$env:DEVICE_TOKEN="TOKEN_FROM_SEED"
npm run simulate:gps
```

The simulator sends GPS packets to the Express API.

## Hardware

A typical bus unit is:

```text
GNSS/GPS module
      +
GSM/4G module with SIM
      +
Microcontroller / tracker board
      +
Vehicle power supply + protection
```

The tracker should send HTTPS JSON to the deployed backend. Do not point a real bus device to `localhost` because `localhost` means the tracker itself, not the development PC.

## Live map

The live page is protected by authentication. After login, the browser polls the Express live endpoint every 3 seconds and displays the latest MongoDB location. Route and stop data also come from MongoDB.

The map uses OpenStreetMap tiles and does not require a Google Maps API key for the core live-tracking screen.

## Admin auto-update

Admin route, bus and configuration changes are stored in MongoDB. Open dashboard/live pages refresh their data automatically, so changes appear without manually reloading the browser.

## Main API endpoints

```text
GET  /api/health
POST /api/auth/signup
POST /api/auth/verify-email
POST /api/auth/resend-verification
POST /api/auth/login
GET  /api/auth/session
GET  /api/tracking/live
POST /api/tracking/start
PATCH /api/tracking/:tripId/location
PATCH /api/tracking/:tripId/status
PATCH /api/tracking/:tripId/occupancy
POST /api/tracking/sos
POST /api/device/gps
POST /api/device/heartbeat
PUT  /api/admin/routes/sync
GET  /api/tracking/bus/:busId/history
```

## Important security rules

- Keep GPS device tokens private.
- Use HTTPS for a deployed GPS API.
- Use a strong JWT secret.
- Use a verified email sender domain in production.
- Do not put MongoDB credentials, Resend keys or GPS device tokens in frontend code.
